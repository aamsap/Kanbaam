const {test}=require('node:test');const assert=require('node:assert/strict');
const M=require('../model.js');const S=require('../storage.js');
test('replacement backs up original including corruption and aborts on backup failure',()=>{
 const ls=memory();ls.setItem(S.KEY,'bad');const store=S.create(ls,M);store.load();store.replace(M.empty());assert.equal(ls.getItem(S.BACKUP),'bad');assert.doesNotThrow(()=>store.save(M.empty()));
 const fail={getItem:()=> 'original',setItem:()=>{throw Error('quota');}};const failingStore=S.create(fail,M);failingStore.load();assert.throws(()=>failingStore.replace(M.empty()),/quota/);
 assert.throws(()=>store.parse(' '.repeat(S.MAX_BYTES+1)));
});
test('linked writes are serialized and recover after failures without hiding errors',async()=>{
 let concurrent=0,max=0;const output=[],events=[];let fail=true;
 const handle={createWritable:async()=>{concurrent++;max=Math.max(max,concurrent);return {write:async text=>{await new Promise(r=>setTimeout(r,5));if(fail){fail=false;throw Error('disk');}output.push(text);},close:async()=>{concurrent--;},abort:async()=>{concurrent--;}};}};
 const link=S.writer(e=>events.push(e));link.connect(handle);await Promise.all([link.enqueue('one'),link.enqueue('two')]);
 assert.equal(max,1);assert.deepEqual(output,[]);assert.match(link.error,/disk/);
 await link.retry('latest');assert.deepEqual(output,['latest']);assert.equal(link.error,null);assert.ok(events.some(e=>e.error));
 link.disconnect();await link.enqueue('ignored');assert.deepEqual(output,['latest']);
});
test('saved payload respects reload size limit',()=>{
 const ls=memory(),store=S.create(ls,M),s=M.empty(),p=M.addProject(s,'Large');
 for(let i=0;i<1100;i++)M.saveTask(p,{title:'Task',description:'x'.repeat(5000)});
 assert.throws(()=>store.save(s),/large/);assert.equal(ls.getItem(S.KEY),null);
});
test('disconnect isolates failures from an in-flight old handle',async()=>{
 let rejectWrite;const old={name:'old',createWritable:async()=>({write:()=>new Promise((_,reject)=>{rejectWrite=reject;}),abort:async()=>{}})};
 const output=[];const next={name:'new',createWritable:async()=>({write:async s=>output.push(s),close:async()=>{}})};
 const link=S.writer();link.connect(old);const pending=link.enqueue('old');await new Promise(r=>setImmediate(r));link.connect(next);const second=link.enqueue('new');rejectWrite(Error('old failed'));await Promise.all([pending,second]);assert.equal(link.error,null);assert.deepEqual(output,['new']);
});
function memory(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),data};}
test('import size cap measures UTF-8 bytes, not just character count',()=>{
 const store=S.create(memory(),M),raw=JSON.stringify({text:'\u2603'.repeat(Math.ceil(S.MAX_BYTES/3))});
 assert.ok(raw.length<S.MAX_BYTES);
 assert.throws(()=>store.parse(raw),/too large/);
});
test('a stale write blocked mid-flight after disconnect is aborted, never committed',async()=>{
 let release;const gate=new Promise(r=>{release=r;});const output=[];let aborted=false;
 const handle={name:'stale',createWritable:async()=>{await gate;return {write:async s=>output.push(s),close:async()=>{},abort:async()=>{aborted=true;}};}};
 const link=S.writer();link.connect(handle);const pending=link.enqueue('should-not-land');await new Promise(r=>setImmediate(r));
 link.disconnect();release();await pending;
 assert.deepEqual(output,[]);assert.equal(aborted,true);assert.equal(link.linked,false);
});

test('initializes browser JSON and refuses to overwrite corrupted original',()=>{
 const ls=memory(),store=S.create(ls,M);assert.deepEqual(store.load().state,M.empty());assert.ok(ls.getItem(S.KEY));
 ls.setItem(S.KEY,'{broken');const broken=S.create(ls,M);assert.ok(broken.load().error);assert.throws(()=>broken.save(M.empty()));assert.equal(ls.getItem(S.KEY),'{broken');
});
test('stale browser save preserves newer storage and keeps local edits',()=>{
 const ls=memory(),first=S.create(ls,M),second=S.create(ls,M);first.load();const stale=second.load().state;
 const fresh=first.load().state;M.addProject(fresh,'Newer tab');first.save(fresh);
 M.addProject(stale,'Local edit');assert.throws(()=>second.save(stale),/another tab|changed/i);
 assert.deepEqual(JSON.parse(ls.getItem(S.KEY)),fresh);assert.equal(stale.projects[0].name,'Local edit');
});
test('replacement refuses a newer tab payload without touching workspace or backup',()=>{
 const ls=memory(),first=S.create(ls,M),stale=S.create(ls,M);first.load();stale.load();
 const newer=M.empty();M.addProject(newer,'Newer tab');first.save(newer);
 const raw=ls.getItem(S.KEY);ls.setItem(S.BACKUP,'prior backup');
 const imported=M.empty();M.addProject(imported,'Imported');
 assert.throws(()=>stale.replace(imported),/another tab|changed/i);
 assert.equal(ls.getItem(S.KEY),raw);assert.equal(ls.getItem(S.BACKUP),'prior backup');
 assert.throws(()=>stale.save(imported),/another tab|changed/i);
});
test('corrupt payload recovery replaces exactly the protected original',()=>{
 const ls=memory();ls.setItem(S.KEY,'{broken');const store=S.create(ls,M);assert.ok(store.load().error);
 const next=M.empty();M.addProject(next,'Recovered');store.replace(next);
 assert.equal(ls.getItem(S.BACKUP),'{broken');assert.equal(JSON.parse(ls.getItem(S.KEY)).projects[0].name,'Recovered');
 const racing=memory();racing.setItem(S.KEY,'{broken');const other=S.create(racing,M);other.load();racing.setItem(S.KEY,'newer');
 assert.throws(()=>other.replace(next),/another tab|changed/i);assert.equal(racing.getItem(S.KEY),'newer');assert.equal(racing.getItem(S.BACKUP),null);
});
test('writer rejects oversized UTF-8 payloads on enqueue and retry without touching file',async()=>{
 let writes=0;const link=S.writer(),handle={name:'linked',createWritable:async()=>{writes++;return {write:async()=>{},close:async()=>{}};}};
 link.connect(handle);const oversized='☃'.repeat(Math.ceil(S.MAX_BYTES/3));
 await link.enqueue(oversized);assert.match(link.error,/5 MB/);assert.equal(writes,0);
 await link.retry(oversized);assert.match(link.error,/5 MB/);assert.equal(writes,0);
});
test('linked-file conflict cannot be retried over external edits',async()=>{
 let raw='original';const statuses=[];const handle={name:'linked',getFile:async()=>({text:async()=>raw}),createWritable:async()=>({write:async value=>{raw=value;},close:async()=>{}})};
 const link=S.writer(status=>statuses.push(status));link.connect(handle,'original');raw='external';await link.enqueue('local');
 assert.equal(statuses.at(-1).conflict,true);await link.retry('retry');assert.equal(raw,'external');
});
test('linked writer detects edits to a real file and leaves both versions intact',async()=>{
 const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
 const dir=await fs.mkdtemp(path.join(process.env.TMPDIR||os.tmpdir(),'kanbaam-writer-')),file=path.join(dir,'workspace.json');
 try{
  await fs.writeFile(file,'original');
  const handle={name:'workspace.json',getFile:async()=>({text:()=>fs.readFile(file,'utf8')}),createWritable:async()=>({write:raw=>fs.writeFile(file,raw),close:async()=>{},abort:async()=>{}})};
  const link=S.writer();link.connect(handle,'original');await link.enqueue('first');assert.equal(await fs.readFile(file,'utf8'),'first');
  await fs.writeFile(file,'external');await link.enqueue('second');assert.equal(await fs.readFile(file,'utf8'),'external');assert.match(link.error,/changed/i);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('linked writer stops before writing after external file changes',async()=>{
 let raw='original',writes=0;const handle={name:'linked',getFile:async()=>({text:async()=>raw}),createWritable:async()=>{writes++;return {write:async value=>{raw=value;},close:async()=>{}};}};
 const link=S.writer();link.connect(handle,'original');await link.enqueue('first');assert.equal(raw,'first');
 raw='external';await link.enqueue('second');assert.equal(raw,'external');assert.equal(writes,1);assert.match(link.error,/changed/i);
 await link.retry('third');assert.equal(raw,'external');assert.equal(writes,1);
});
