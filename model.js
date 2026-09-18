(function(root){
 'use strict';
 const statuses=['backlog','progress','review','done'];
 const defaultCategories=()=>[
  {id:'backlog',name:'Backlog',color:'#78847c',completed:false},
  {id:'progress',name:'In progress',color:'#c07b24',completed:false},
  {id:'review',name:'Review',color:'#7766b5',completed:false},
  {id:'done',name:'Done',color:'#3b8b69',completed:true}
 ];
 const priorities=['low','medium','high'];
 const accents=['vermilion','forest','cobalt','plum','ochre','custom'];
 const defaultCustomAccent='#0f8b8d';
 const cardColors=['','rose','amber','lime','teal','sky','violet','slate'];
 const projectIcons=['','folder','rocket','briefcase','palette','code','book','home','heart','star','lightbulb','target','leaf','coffee','music','camera','plane','graduation'];
 const empty=()=>({version:1,projects:[],activeProjectId:null,settings:{accent:'vermilion',customAccent:defaultCustomAccent,mode:'system',motion:true}});
 function validate(value){
  if(!value||value.version!==1||!Array.isArray(value.projects)) throw Error('Not a Kanbaam version 1 workspace.');
  if(value.projects.length>100)throw Error('Maximum 100 projects.');
  const used=new Set(); const key=v=>{if(typeof v!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(v)||used.has(v))throw Error('Invalid or duplicate ID.');used.add(v);return v;};
  const projects=value.projects.map(p=>{if(!p||!Array.isArray(p.tasks)||p.tasks.length>2000)throw Error('Invalid project tasks.');if(p.archived!==undefined&&typeof p.archived!=='boolean')throw Error('Invalid archive state.');const categories=validateCategories(p.categories);return {id:key(p.id),...projectFields(p),archived:p.archived??false,categories,tasks:p.tasks.map(t=>{if(!t||['title','description','priority','status','due'].some(k=>typeof t[k]!=='string'))throw Error('Invalid task fields.');return {id:key(t.id),...taskFields(t,categories),createdAt:createdAt(t.createdAt)};})};});
  const settings=value.settings;
  if(!settings||!accents.includes(settings.accent)||!['light','dark','system'].includes(settings.mode)||typeof settings.motion!=='boolean')throw Error('Invalid appearance settings.');
  if(value.activeProjectId!==null&&!projects.some(p=>p.id===value.activeProjectId))throw Error('Invalid active project.');
  const customAccent=settings.customAccent??defaultCustomAccent;
  if(typeof customAccent!=='string'||!/^#[0-9a-f]{6}$/i.test(customAccent))throw Error('Invalid custom accent color.');
  return {version:1,projects,activeProjectId:projects.find(p=>p.id===value.activeProjectId)?.archived?(projects.find(p=>!p.archived)?.id??null):value.activeProjectId,settings:{accent:settings.accent,customAccent:customAccent.toLowerCase(),mode:settings.mode,motion:settings.motion}};
 }
 function createdAt(value){if(value==null)return null;if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw Error('Invalid creation date.');return new Date(value).toISOString();}
 const id=()=>globalThis.crypto.randomUUID();
 function text(v,max,label,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim())) throw Error(label+' is invalid.'); return v.trim();}
 function taskFields(data,categories){
  const title=text(data.title,160,'Title',true),description=text(data.description??'',5000,'Description');
  const priority=data.priority??'medium',status=data.status??categories[0].id,due=data.due??'';
  if(!priorities.includes(priority)||!categories.some(c=>c.id===status)) throw Error('Invalid task choice.');
  if(typeof due!=='string'||(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due))) throw Error('Choose a valid due date.');
  const color=data.color??'';if(!cardColors.includes(color))throw Error('Invalid card color.');
  return {title,description,priority,status,due,link:link(data.link),tags:tags(data.tags),color};
 }
 function link(v){const s=text(v??'',2000,'Link');if(!s)return '';let u;try{u=new URL(s);}catch(e){throw Error('Enter a full link starting with http:// or https://');}if(u.protocol!=='http:'&&u.protocol!=='https:')throw Error('Only http and https links are allowed.');return s;}
 function tags(v){const arr=Array.isArray(v)?v:(v==null?[]:String(v).split(','));const seen=new Set(),out=[];for(const raw of arr){const t=text(raw,24,'Tag');if(!t)continue;const k=t.toLowerCase();if(seen.has(k))continue;seen.add(k);out.push(t);if(out.length>=12)break;}return out;}
 function projectFields(data){const icon=data.icon??'';if(!projectIcons.includes(icon))throw Error('Invalid project icon.');return {name:text(data.name,80,'Project name',true),description:text(data.description??'',300,'Project description'),icon};}
 function addProject(s,name,extra={}){if(s.projects.length>=100) throw Error('Maximum 100 projects.'); const p={id:id(),...projectFields({...extra,name}),archived:false,categories:defaultCategories(),tasks:[]};s.projects.push(p);s.activeProjectId=p.id;return p;}
 function updateProject(s,key,data){const p=s.projects.find(p=>p.id===key);if(!p)throw Error('Project not found.');Object.assign(p,projectFields({name:p.name,description:p.description,icon:p.icon,...data}));}
 function renameProject(s,key,name){updateProject(s,key,{name});}
 function deleteProject(s,key){s.projects=s.projects.filter(p=>p.id!==key);if(s.activeProjectId===key)s.activeProjectId=s.projects.find(p=>!p.archived)?.id??null;}
 function setProjectArchived(s,key,archived){const p=s.projects.find(p=>p.id===key);if(!p)throw Error('Project not found.');if(typeof archived!=='boolean')throw Error('Invalid archive state.');p.archived=archived;if(archived&&s.activeProjectId===key)s.activeProjectId=s.projects.find(p=>!p.archived)?.id??null;else if(!archived&&!s.activeProjectId)s.activeProjectId=key;}
 function saveTask(p,data){const fields=taskFields(data,p.categories);let t=p.tasks.find(t=>t.id===data.id);if(t)Object.assign(t,fields);else{if(p.tasks.length>=2000)throw Error('Maximum 2,000 tasks per project.');t={id:id(),...fields,createdAt:new Date().toISOString()};p.tasks.push(t);}return t;}
 function deleteTask(p,key){p.tasks=p.tasks.filter(t=>t.id!==key);}
 function moveTask(p,key,status,index){if(!p.categories.some(c=>c.id===status))throw Error('Invalid status.');const t=p.tasks.find(t=>t.id===key);if(!t)throw Error('Task not found.');deleteTask(p,key);t.status=status;const lane=p.tasks.filter(t=>t.status===status);index=Math.max(0,Math.min(lane.length,Math.trunc(index)||0));const before=lane[index];p.tasks.splice(before?p.tasks.indexOf(before):p.tasks.length,0,t);}
 function reorderLane(p,status,orderedIds,key){
  if(!p.categories.some(c=>c.id===status))throw Error('Invalid category.');
  const moved=p.tasks.find(t=>t.id===key);if(!moved)throw Error('Task not found.');
  const current=new Map(p.tasks.filter(t=>t.status===status||t.id===key).map(t=>[t.id,t]));
  if(!Array.isArray(orderedIds)||new Set(orderedIds).size!==current.size||orderedIds.length!==current.size||orderedIds.some(id=>!current.has(id)))throw Error('Invalid task order.');
  const firstIndex=p.tasks.findIndex(t=>t.status===status||t.id===key);
  moved.status=status;p.tasks=p.tasks.filter(t=>!current.has(t.id));
  p.tasks.splice(firstIndex<0?p.tasks.length:firstIndex,0,...orderedIds.map(id=>current.get(id)));
 }
 function categoryFields(data){
  const name=text(data.name,40,'Category name',true),color=data.color??'#78847c',completed=data.completed??false;
  if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color)||typeof completed!=='boolean')throw Error('Invalid category settings.');
  return {name,color:color.toLowerCase(),completed};
 }
 function validateCategories(value){
  if(value===undefined)return defaultCategories();
  if(!Array.isArray(value)||value.length<1||value.length>24)throw Error('A project needs 1 to 24 categories.');
  const ids=new Set(),names=new Set();
  return value.map(c=>{
   if(!c||typeof c.id!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(c.id)||ids.has(c.id))throw Error('Invalid or duplicate category ID.');
   const fields=categoryFields(c),name=fields.name.toLowerCase();
   if(names.has(name))throw Error('Category names must be unique.');
   ids.add(c.id);names.add(name);return {id:c.id,...fields};
  });
 }
 function saveCategory(p,data){
  const fields=categoryFields(data),existing=data.id?p.categories.find(c=>c.id===data.id):null;
  if(data.id&&!existing)throw Error('Category not found.');
  if(p.categories.some(c=>c.id!==existing?.id&&c.name.toLowerCase()===fields.name.toLowerCase()))throw Error('A category with this name already exists.');
  if(existing){Object.assign(existing,fields);return existing;}
  if(p.categories.length>=24)throw Error('Maximum 24 categories per project.');
  const category={id:id(),...fields};p.categories.push(category);return category;
 }
 function moveCategory(p,key,index){
  const from=p.categories.findIndex(c=>c.id===key);if(from<0)throw Error('Category not found.');
  if(!Number.isInteger(index)||index<0||index>=p.categories.length)throw Error('Invalid category position.');
  const [category]=p.categories.splice(from,1);p.categories.splice(index,0,category);
 }
 function deleteCategory(p,key,destination){
  if(!p.categories.some(c=>c.id===key))throw Error('Category not found.');
  if(p.categories.length===1)throw Error('Keep at least one category.');
  const tasks=p.tasks.filter(t=>t.status===key);
  if(tasks.length&&(!p.categories.some(c=>c.id===destination)||destination===key))throw Error('Choose a category for the remaining tasks.');
  tasks.forEach(t=>t.status=destination);p.categories=p.categories.filter(c=>c.id!==key);
 }
 const api={empty,validate,statuses,defaultCategories,saveCategory,moveCategory,deleteCategory,priorities,accents,projectIcons,cardColors,addProject,updateProject,renameProject,setProjectArchived,deleteProject,saveTask,deleteTask,moveTask,reorderLane};
 if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.KanbaamModel=api;
})(typeof window!=='undefined'?window:globalThis);
