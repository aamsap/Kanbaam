const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../model.js');
test('project and task lifecycle preserves lane order and rejects bad input',()=>{
 const s=M.empty(); const p=M.addProject(s,'  Studio  '); assert.equal(p.name,'Studio');
 const a=M.saveTask(p,{title:'One'}); const b=M.saveTask(p,{title:'Two'});
 M.moveTask(p,b.id,'backlog',0); assert.deepEqual(p.tasks.map(t=>t.id),[b.id,a.id]);
 M.moveTask(p,a.id,'done',0); assert.equal(a.status,'done');
 M.saveTask(p,{...b,title:'Updated'}); assert.equal(b.title,'Updated');
 assert.throws(()=>M.saveTask(p,{title:' '})); assert.throws(()=>M.saveTask(p,{title:'x',due:'2026-02-30'}));
 M.renameProject(s,p.id,'New'); assert.equal(p.name,'New');
 M.deleteTask(p,a.id); assert.equal(p.tasks.length,1); M.deleteProject(s,p.id); assert.equal(s.activeProjectId,null);
});
test('import validation rejects malformed data, duplicates and excess limits; strips unknown keys',()=>{
 const s=M.empty(); const p=M.addProject(s,'Valid'); M.saveTask(p,{title:'<img onerror=alert(1)>'});
 assert.equal(M.validate(s).projects[0].tasks[0].title,'<img onerror=alert(1)>');
 for(const mutate of [s=>s.projects[0].tasks[0].status='oops',s=>s.projects.push(s.projects[0]),s=>s.settings.motion='yes',s=>s.activeProjectId='missing',s=>s.projects[0].tasks[0].title='x'.repeat(161),s=>delete s.projects[0].tasks[0].description]){
  const bad=structuredClone(s);mutate(bad);assert.throws(()=>M.validate(bad));
 }
 s.extra='untrusted';assert.equal(M.validate(s).extra,undefined);
});
test('initial workspace validates and survives JSON round trip',()=>{
 const s=M.empty(); assert.equal(s.version,1); assert.deepEqual(s.projects,[]);
 assert.deepEqual(M.validate(JSON.parse(JSON.stringify(s))),s);
 assert.throws(()=>M.validate({...s,version:2}));
});
