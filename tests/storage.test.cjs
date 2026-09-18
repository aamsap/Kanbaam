const {test}=require('node:test');const assert=require('node:assert/strict');
const M=require('../model.js');const S=require('../storage.js');
test('replacement backs up original including corruption and aborts on backup failure',()=>{
 const ls=memory();ls.setItem(S.KEY,'bad');const store=S.create(ls,M);store.load();store.replace(M.empty());assert.equal(ls.getItem(S.BACKUP),'bad');assert.doesNotThrow(()=>store.save(M.empty()));
 const fail={getItem:()=> 'original',setItem:()=>{throw Error('quota');}};assert.throws(()=>S.create(fail,M).replace(M.empty()),/quota/);
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
