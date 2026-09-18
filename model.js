(function(root){
 'use strict';
 const statuses=['backlog','progress','review','done'];
 const priorities=['low','medium','high'];
 const accents=['vermilion','forest','cobalt','plum','ochre'];
 const empty=()=>({version:1,projects:[],activeProjectId:null,settings:{accent:'vermilion',mode:'system',motion:true}});
 function validate(value){
  if(!value||value.version!==1||!Array.isArray(value.projects)) throw Error('Not a Kanbaam version 1 workspace.');
  if(value.projects.length>100)throw Error('Maximum 100 projects.');
  const used=new Set(); const key=v=>{if(typeof v!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(v)||used.has(v))throw Error('Invalid or duplicate ID.');used.add(v);return v;};
  const projects=value.projects.map(p=>{if(!p||!Array.isArray(p.tasks)||p.tasks.length>2000)throw Error('Invalid project tasks.');return {id:key(p.id),name:text(p.name,80,'Project name',true),tasks:p.tasks.map(t=>{if(!t||['title','description','priority','status','due'].some(k=>typeof t[k]!=='string'))throw Error('Invalid task fields.');return {id:key(t.id),...taskFields(t)};})};});
  const settings=value.settings;
  if(!settings||!accents.includes(settings.accent)||!['light','dark','system'].includes(settings.mode)||typeof settings.motion!=='boolean')throw Error('Invalid appearance settings.');
  if(value.activeProjectId!==null&&!projects.some(p=>p.id===value.activeProjectId))throw Error('Invalid active project.');
  return {version:1,projects,activeProjectId:value.activeProjectId,settings:{accent:settings.accent,mode:settings.mode,motion:settings.motion}};
 }
 const id=()=>globalThis.crypto.randomUUID();
 function text(v,max,label,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim())) throw Error(label+' is invalid.'); return v.trim();}
 function taskFields(data){
  const title=text(data.title,160,'Title',true),description=text(data.description??'',5000,'Description');
  const priority=data.priority??'medium',status=data.status??'backlog',due=data.due??'';
  if(!priorities.includes(priority)||!statuses.includes(status)) throw Error('Invalid task choice.');
  if(typeof due!=='string'||(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due))) throw Error('Choose a valid due date.');
  return {title,description,priority,status,due,link:link(data.link),tags:tags(data.tags)};
 }
 function link(v){const s=text(v??'',2000,'Link');if(!s)return '';let u;try{u=new URL(s);}catch(e){throw Error('Enter a full link starting with http:// or https://');}if(u.protocol!=='http:'&&u.protocol!=='https:')throw Error('Only http and https links are allowed.');return s;}
 function tags(v){const arr=Array.isArray(v)?v:(v==null?[]:String(v).split(','));const seen=new Set(),out=[];for(const raw of arr){const t=text(raw,24,'Tag');if(!t)continue;const k=t.toLowerCase();if(seen.has(k))continue;seen.add(k);out.push(t);if(out.length>=12)break;}return out;}
 function addProject(s,name){if(s.projects.length>=100) throw Error('Maximum 100 projects.'); const p={id:id(),name:text(name,80,'Project name',true),tasks:[]};s.projects.push(p);s.activeProjectId=p.id;return p;}
 function renameProject(s,key,name){const p=s.projects.find(p=>p.id===key);if(!p)throw Error('Project not found.');p.name=text(name,80,'Project name',true);}
 function deleteProject(s,key){s.projects=s.projects.filter(p=>p.id!==key);if(s.activeProjectId===key)s.activeProjectId=s.projects[0]?.id??null;}
 function saveTask(p,data){const fields=taskFields(data);let t=p.tasks.find(t=>t.id===data.id);if(t)Object.assign(t,fields);else{if(p.tasks.length>=2000)throw Error('Maximum 2,000 tasks per project.');t={id:id(),...fields};p.tasks.push(t);}return t;}
 function deleteTask(p,key){p.tasks=p.tasks.filter(t=>t.id!==key);}
 function moveTask(p,key,status,index){if(!statuses.includes(status))throw Error('Invalid status.');const t=p.tasks.find(t=>t.id===key);if(!t)throw Error('Task not found.');deleteTask(p,key);t.status=status;const lane=p.tasks.filter(t=>t.status===status);index=Math.max(0,Math.min(lane.length,Math.trunc(index)||0));const before=lane[index];p.tasks.splice(before?p.tasks.indexOf(before):p.tasks.length,0,t);}
 const api={empty,validate,statuses,priorities,accents,addProject,renameProject,deleteProject,saveTask,deleteTask,moveTask};
 if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.KanbaamModel=api;
})(typeof window!=='undefined'?window:globalThis);
