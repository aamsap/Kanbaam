const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../model.js');
const S=require('../storage.js');

test('legacy workspaces receive independent default categories without changing tasks',()=>{
 const s=M.empty(),p=M.addProject(s,'Old'),q=M.addProject(s,'Other');
 M.saveTask(p,{title:'Done task',status:'done'});
 delete p.categories;delete q.categories;
 const result=M.validate(s);
 assert.deepEqual(result.projects[0].categories.map(c=>c.id),M.statuses);
 assert.equal(result.projects[0].tasks[0].status,'done');
 result.projects[0].categories[0].name='Ideas';
 assert.equal(result.projects[1].categories[0].name,'Backlog');
});

test('custom categories rename, reorder, move tasks and round-trip through storage',()=>{
 const s=M.empty(),p=M.addProject(s,'Custom'),c=M.saveCategory(p,{name:'Shipped',color:'#123ABC',completed:true});
 const t=M.saveTask(p,{title:'Feature',status:c.id});
 M.saveCategory(p,{id:c.id,name:'Released',color:'#334455',completed:true});
 M.moveCategory(p,c.id,0);
 assert.equal(p.categories[0].name,'Released');assert.equal(t.status,c.id);
 const second=M.saveTask(p,{title:'Default target'});assert.equal(second.status,c.id);
 M.moveTask(p,t.id,'backlog',0);M.moveTask(p,t.id,c.id,0);
 M.reorderLane(p,c.id,[second.id,t.id],t.id);
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const store=S.create(storage,M);store.save(s);
 assert.deepEqual(store.load().state,s);
});

test('category removal requires a valid destination and cannot remove the last category',()=>{
 const s=M.empty(),p=M.addProject(s,'Delete'),t=M.saveTask(p,{title:'Keep me'});
 const original=JSON.stringify(p);
 for(const destination of [undefined,'backlog','missing'])assert.throws(()=>M.deleteCategory(p,'backlog',destination));
 assert.equal(JSON.stringify(p),original);
 M.deleteCategory(p,'backlog','progress');assert.equal(t.status,'progress');
 M.deleteCategory(p,'review');M.deleteCategory(p,'done');
 assert.throws(()=>M.deleteCategory(p,'progress'));
 assert.equal(p.tasks.length,1);assert.equal(M.validate(s).projects[0].categories.length,1);
});

test('category validation rejects malformed imports and orphaned tasks',()=>{
 const s=M.empty(),p=M.addProject(s,'Validate');M.saveTask(p,{title:'Task'});
 for(const change of [
  p=>p.categories=[],p=>p.categories=null,p=>p.categories.push(p.categories[0]),
  p=>p.categories[1].name='backlog',p=>p.categories[0].color='red',
  p=>p.categories[0].completed='yes',p=>p.categories[0].name=' ',
  p=>p.categories[0].id='bad id',p=>p.tasks[0].status='missing'
 ]){const clone=structuredClone(s);change(clone.projects[0]);assert.throws(()=>M.validate(clone));}
 assert.throws(()=>M.saveCategory(p,{name:'BACKLOG'}));
 assert.throws(()=>M.saveCategory(p,{id:'missing',name:'Missing'}));
 for(let i=0;i<20;i++)M.saveCategory(p,{name:'Category '+i});
 assert.throws(()=>M.saveCategory(p,{name:'Too many'}));
});

test('invalid lane reorder cannot drop tasks or mutate status',()=>{
 const s=M.empty(),p=M.addProject(s,'Order'),a=M.saveTask(p,{title:'A'}),b=M.saveTask(p,{title:'B'});
 const before=JSON.stringify(p);
 for(const ids of [[],[a.id],[a.id,a.id],[a.id,'missing']])assert.throws(()=>M.reorderLane(p,'backlog',ids,a.id));
 assert.equal(JSON.stringify(p),before);
 assert.throws(()=>M.reorderLane(p,'done',[b.id],a.id));assert.equal(a.status,'backlog');
});
