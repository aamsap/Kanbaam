const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../model.js');
test('creation dates survive editing and imports; legacy dates remain unknown',()=>{
 const s=M.empty(),p=M.addProject(s,'Dates'),t=M.saveTask(p,{title:'First'});
 const date=t.createdAt;
 assert.ok(Number.isFinite(Date.parse(date)));
 M.saveTask(p,{id:t.id,title:'Changed'});
 assert.equal(t.createdAt,date);
 assert.equal(M.validate(s).projects[0].tasks[0].createdAt,date);
 delete t.createdAt;
 assert.equal(M.validate(s).projects[0].tasks[0].createdAt,null);
 t.createdAt='invalid';assert.throws(()=>M.validate(s));
});
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
test('task link is optional, http/https only, and rejects dangerous schemes',()=>{
 const s=M.empty(),p=M.addProject(s,'Links');
 assert.equal(M.saveTask(p,{title:'No link'}).link,'');
 assert.equal(M.saveTask(p,{title:'Has link',link:'https://example.com/x'}).link,'https://example.com/x');
 assert.throws(()=>M.saveTask(p,{title:'js',link:'javascript:alert(1)'}));
 assert.throws(()=>M.saveTask(p,{title:'data',link:'data:text/html,x'}));
 assert.throws(()=>M.saveTask(p,{title:'bare',link:'not a url'}));
 // legacy tasks without a link field still validate and normalize to empty
 const legacy=structuredClone(s);delete legacy.projects[0].tasks[0].link;
 assert.equal(M.validate(legacy).projects[0].tasks[0].link,'');
});
test('task tags dedupe, cap, trim, drop empties, and reject over-long entries',()=>{
 const s=M.empty(),p=M.addProject(s,'Tags');
 assert.deepEqual(M.saveTask(p,{title:'No tags'}).tags,[]);
 assert.deepEqual(M.saveTask(p,{title:'From string',tags:' Content , design ,Content, ,Design '}).tags,['Content','design']);
 assert.deepEqual(M.saveTask(p,{title:'From array',tags:['A','a','B']}).tags,['A','B']);
 assert.equal(M.saveTask(p,{title:'Capped',tags:Array.from({length:20},(_,i)=>'t'+i)}).tags.length,12);
 assert.throws(()=>M.saveTask(p,{title:'Too long',tags:['x'.repeat(25)]}));
 // legacy tasks without tags normalize to an empty array
 const legacy=structuredClone(s);delete legacy.projects[0].tasks[0].tags;
 assert.deepEqual(M.validate(legacy).projects[0].tasks[0].tags,[]);
});
test('projects carry an optional icon and description that validate and survive legacy imports',()=>{
 const s=M.empty(),p=M.addProject(s,'Launch',{icon:'rocket',description:'  Ship the beta  '});
 assert.equal(p.icon,'rocket');assert.equal(p.description,'Ship the beta');
 assert.equal(M.addProject(s,'Plain').icon,'');
 M.updateProject(s,p.id,{name:'Launch v2',icon:'star',description:''});
 assert.deepEqual([p.name,p.icon,p.description],['Launch v2','star','']);
 M.renameProject(s,p.id,'Renamed');assert.equal(p.icon,'star');
 assert.throws(()=>M.addProject(s,'Bad',{icon:'javascript:alert(1)'}));
 assert.throws(()=>M.updateProject(s,p.id,{description:'x'.repeat(301)}));
 const legacy=structuredClone(s);delete legacy.projects[0].icon;delete legacy.projects[0].description;
 const v=M.validate(legacy).projects[0];assert.equal(v.icon,'');assert.equal(v.description,'');
});
test('custom accent color validates as a hex color and defaults for older workspaces',()=>{
 const s=M.empty();s.settings.accent='custom';s.settings.customAccent='#FFD400';
 assert.equal(M.validate(s).settings.customAccent,'#ffd400');
 const legacy=structuredClone(s);delete legacy.settings.customAccent;legacy.settings.accent='forest';
 assert.match(M.validate(legacy).settings.customAccent,/^#[0-9a-f]{6}$/);
 for(const bad of ['red','#fff','#12345g','url(x)',42]){const b=structuredClone(s);b.settings.customAccent=bad;assert.throws(()=>M.validate(b));}
});
test('task card color defaults to plain, accepts known tints only, and survives edits and legacy imports',()=>{
 const s=M.empty(),p=M.addProject(s,'Colors'),t=M.saveTask(p,{title:'Plain'});
 assert.equal(t.color,'');
 const tinted=M.saveTask(p,{title:'Tinted',color:'teal'});assert.equal(tinted.color,'teal');
 M.saveTask(p,{...tinted,color:'rose'});assert.equal(tinted.color,'rose');
 for(const bad of ['red','#ff0000','url(x)']) assert.throws(()=>M.saveTask(p,{title:'Bad',color:bad}));
 const legacy=structuredClone(s);delete legacy.projects[0].tasks[1].color;
 assert.equal(M.validate(legacy).projects[0].tasks[1].color,'');
});
test('reorderLane places a task by explicit id sequence instead of stale insertion order, and moves status',()=>{
 const s=M.empty(),p=M.addProject(s,'Reorder');
 const a=M.saveTask(p,{title:'A'}),b=M.saveTask(p,{title:'B',priority:'high'}),c=M.saveTask(p,{title:'C'}),d=M.saveTask(p,{title:'D',priority:'high'});
 // creation order is A,B,C,D; simulate a drop computed against a priority-sorted view (B,D,C,A) that relocates A between D and C
 M.reorderLane(p,'backlog',[b.id,d.id,a.id,c.id],a.id);
 assert.deepEqual(p.tasks.map(t=>t.id),[b.id,d.id,a.id,c.id]);
 // moving into a different status updates the task's status and drops it into that lane at the given position
 M.reorderLane(p,'done',[a.id],a.id);
 assert.equal(a.status,'done');
 assert.deepEqual(p.tasks.filter(t=>t.status==='done').map(t=>t.id),[a.id]);
 assert.deepEqual(p.tasks.filter(t=>t.status==='backlog').map(t=>t.id),[b.id,d.id,c.id]);
 assert.throws(()=>M.reorderLane(p,'nowhere',[b.id],b.id));
 assert.throws(()=>M.reorderLane(p,'backlog',[],'missing'));
});
