/* Classic scripts intentionally work without a server or network. */
(function(){'use strict';
 const M=window.KanbaamModel,S=window.KanbaamStorage,$=s=>document.querySelector(s);
 let local;try{local=window.localStorage;}catch(e){local={getItem(){throw e;},setItem(){throw e;}};}
 const store=S.create(local,M),initial=store.load();let state=initial.state,browserError=initial.error||'',fileError='',actionError='';
 let editingProject=null,editingTask=null,viewingTask=null,dragId=null,filter='',priority='all',tag='',projectPage=0;const sorts={};let lastProjectId,projectPageSize=projectCapacity();
 function projectCapacity(){return Math.max(1,Math.min(14,Math.floor((innerHeight-390)/48)));}
 const categoryName=status=>project()?.categories.find(c=>c.id===status)?.name||'Category';
 const isCompleted=status=>!!project()?.categories.find(c=>c.id===status)?.completed;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),dark=matchMedia('(prefers-color-scheme: dark)');
 const animate=()=>state.settings.motion&&!reduce.matches;
 const activeProjects=()=>state.projects.filter(p=>!p.archived);
 const project=()=>state.projects.find(p=>p.id===state.activeProjectId);
 const json=()=>JSON.stringify(state,null,2);
 const writer=S.writer(info=>{fileError=info.error||'';$('#file-status').textContent=info.error||(info.linked?(info.pending?'Saving linked file…':'Linked: '+info.name+' · up to date'):'No file linked.');$('#retry-file').hidden=!info.error;$('#disconnect-file').hidden=!info.linked;if(info.linked)$('#reconnect-file').hidden=true;renderNotice();});
 const I={
  en:{skip:'Skip to board',workspace:'Workspace',workspaceAria:'Workspace',workspaceLabel:'Personal workspace',projects:'Projects',addProject:'Add project',newProject:'New project',settings:'Settings',opening:'Opening workspace…',offline:'Yours. Offline.',eyebrow:'A LITTLE MORE DONE',workspaceTitle:'Your workspace',workspaceSubtitle:'A clear place to see what’s next, what’s moving, and what’s done.',startTitle:'Start with one project.',startText:'Your next project starts here.',startProject:'Create your first project',sampleProject:'Or, try a sample board',privacy:'No account. No connection. Just your work.',search:'Search tasks',searchPlaceholder:'Search tasks…',allPriorities:'All priorities',highPriority:'High priority',mediumPriority:'Medium priority',lowPriority:'Low priority',clear:'Clear',addTask:'Add task',category:'Category',settingsTitle:'Settings',settingsEyebrow:'MAKE IT YOURS',appearance:'Appearance',background:'Background',categories:'Categories',data:'Data',accentColor:'Accent color',customColor:'Custom color',colorMode:'Color mode',matchSystem:'Match system',light:'Light',dark:'Dark',motion:'Motion & celebrations',reducedMotion:'Your device’s reduced-motion setting always takes priority.',languageNext:'ID',switchLanguage:'Switch to Indonesian',switchDark:'Switch to dark mode',switchLight:'Switch to light mode',project:'Project',yourBoards:'Your boards',tasks:'tasks',completed:'completed',noTasks:'No tasks yet.',noMatching:'No matching tasks',saved:'Saved in this browser',notSaved:'Not saved in browser · export a backup',taskSaved:'Task saved',projectSaved:'Project saved',projectOrder:'Project order updated',categorySaved:'Category saved',categoryDeleted:'Category deleted',categoryOrder:'Category order updated',templateExtended:'Template extended categories',templateReplaced:'Template replaced categories',customAccentApplied:'Custom accent color applied',opened:'Opened ',newTask:'New task',taskDetails:'Task details',deleteTask:'Delete task',editTask:'Edit task',viewTask:'View task: ',cardColor:'Card color',default:'Default',filters:'Filters'},
  id:{skip:'Lewati ke papan',workspace:'Ruang kerja',workspaceAria:'Ruang kerja',workspaceLabel:'Ruang kerja pribadi',projects:'Proyek',addProject:'Tambah proyek',newProject:'Proyek baru',settings:'Pengaturan',opening:'Membuka ruang kerja…',offline:'Milikmu. Offline.',eyebrow:'SELESAI SEDIKIT LAGI',workspaceTitle:'Ruang kerjamu',workspaceSubtitle:'Tempat jelas untuk melihat berikutnya, yang berjalan, dan yang selesai.',startTitle:'Mulai dengan satu proyek.',startText:'Proyek berikutnya mulai di sini.',startProject:'Buat proyek pertama',sampleProject:'Atau coba papan contoh',privacy:'Tanpa akun. Tanpa koneksi. Hanya pekerjaanmu.',search:'Cari tugas',searchPlaceholder:'Cari tugas…',allPriorities:'Semua prioritas',highPriority:'Prioritas tinggi',mediumPriority:'Prioritas sedang',lowPriority:'Prioritas rendah',clear:'Hapus',addTask:'Tambah tugas',category:'Kategori',settingsTitle:'Pengaturan',settingsEyebrow:'ATUR SESUKAMU',appearance:'Tampilan',background:'Latar belakang',categories:'Kategori',data:'Data',accentColor:'Warna aksen',customColor:'Warna kustom',colorMode:'Mode warna',matchSystem:'Ikuti sistem',light:'Terang',dark:'Gelap',motion:'Gerakan & perayaan',reducedMotion:'Pengaturan kurangi gerakan dari perangkat tetap diprioritaskan.',languageNext:'EN',switchLanguage:'Beralih ke bahasa Inggris',switchDark:'Beralih ke mode gelap',switchLight:'Beralih ke mode terang',project:'Proyek',yourBoards:'Papanmu',tasks:'tugas',completed:'selesai',noTasks:'Belum ada tugas.',noMatching:'Tidak ada tugas yang cocok',saved:'Tersimpan di browser ini',notSaved:'Tidak tersimpan di browser · ekspor cadangan',taskSaved:'Tugas disimpan',projectSaved:'Proyek disimpan',projectOrder:'Urutan proyek diperbarui',categorySaved:'Kategori disimpan',categoryDeleted:'Kategori dihapus',categoryOrder:'Urutan kategori diperbarui',templateExtended:'Template menambahkan kategori',templateReplaced:'Template mengganti kategori',customAccentApplied:'Warna aksen kustom diterapkan',opened:'Membuka ',newTask:'Tugas baru',taskDetails:'Detail tugas',deleteTask:'Hapus tugas',editTask:'Edit tugas',viewTask:'Lihat tugas: ',cardColor:'Warna kartu',default:'Default',filters:'Filter'}
 };
 const lang=()=>state.settings.language||'en',t=key=>I[lang()]?.[key]||I.en[key]||key;
 function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
 function icon(name){
  const build=([tag,attrs,children=[]])=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));children.forEach(c=>n.append(build(c)));return n;};
  const n=build(window.KanbaamIcons[name]);n.classList.add('icon');n.setAttribute('aria-hidden','true');n.setAttribute('focusable','false');return n;
 }
 function button(text,cls,click,label){
  const b=el('button',cls);b.type='button';b.onclick=click;
  const symbols={'+':'Plus','+ Add task':'Plus','Edit':'Pencil','↑':'ArrowUp','↓':'ArrowDown','‹':'ChevronLeft','›':'ChevronRight'};
  if(symbols[text]){b.append(icon(symbols[text]));if(text==='+ Add task')b.append(el('span','',t('addTask')));}else b.textContent=text;
  if(label){b.setAttribute('aria-label',label);b.title=label;}return b;
 }
 function setButtonIcon(selector,name,text){const b=$(selector);b.replaceChildren(icon(name));if(text){b.append(el('span','button-label',text));b.setAttribute('aria-label',text);}b.title=b.getAttribute('aria-label')||text||'';}
 function tagChip(name){const c=el('span','tag',name);let h=0;for(const char of name.toLowerCase())h=(h*31+char.charCodeAt(0))%360;c.style.setProperty('--tag-h',h);return c;}
 function tagRow(t,cls){const row=el('span',cls);t.tags.forEach(name=>row.append(tagChip(name)));return row;}
 function announce(text){$('#announcement').textContent='';requestAnimationFrame(()=>$('#announcement').textContent=text);}
 function renderNotice(){const text=[browserError,fileError,actionError].filter(Boolean).join(' ');$('#notice').hidden=!text;$('#notice').textContent=text;$('#save-status').textContent=browserError?t('notSaved'):t('saved');$('#save-status').classList.toggle('error',!!browserError);}
 function persist(){try{store.save(state);browserError='';}catch(e){browserError=e.message+' Changes are only in memory; export a backup before closing.';}writer.enqueue(json());renderNotice();}
 function staticText(){
  document.documentElement.lang=lang();$('.skip').textContent=t('skip');$('.sidebar').setAttribute('aria-label',t('workspaceAria'));$('.workspace-label').textContent=t('workspaceLabel');$('.rail-heading h2').textContent=t('projects');$('.offline-label').textContent=t('offline');$('#search').placeholder=t('searchPlaceholder');$('#settings-title').textContent=t('settingsTitle');$('#settings-dialog .eyebrow').textContent=t('settingsEyebrow');$('#tab-appearance').textContent=t('appearance');$('#tab-background').textContent=t('background');$('#tab-categories').textContent=t('categories');$('#tab-data').textContent=t('data');$('#panel-appearance h3').textContent=t('appearance');$('.accents legend').textContent=t('accentColor');$('.custom-color-field label').textContent=t('customColor');$('#theme-mode').closest('label').firstChild.textContent=t('colorMode');$('#theme-mode').options[0].textContent=t('matchSystem');$('#theme-mode').options[1].textContent=t('light');$('#theme-mode').options[2].textContent=t('dark');$('#motion').parentElement.lastChild.textContent=' '+t('motion');$('.settings-section .fine-print').textContent=t('reducedMotion');$('#priority-filter').options[0].textContent=t('allPriorities');$('#priority-filter').options[1].textContent=t('highPriority');$('#priority-filter').options[2].textContent=t('mediumPriority');$('#priority-filter').options[3].textContent=t('lowPriority');$('#clear-filters').textContent=t('clear');$('.welcome h2').textContent=t('startTitle');$('.welcome p:not(.privacy-note)').textContent=t('startText');$('#sample-project').textContent=t('sampleProject');$('.privacy-note').textContent=t('privacy');$('#breadcrumb').textContent=project()?project().name:t('yourBoards');
  setButtonIcon('#add-project','Plus');$('#add-project').setAttribute('aria-label',t('addProject'));setButtonIcon('#new-project','Plus',t('newProject'));setButtonIcon('#settings-open','Settings',t('settings'));setButtonIcon('#add-task','Plus',t('addTask'));setButtonIcon('#add-category','Settings',t('category'));$('#language-toggle').textContent=t('languageNext');$('#language-toggle').setAttribute('aria-label',t('switchLanguage'));$('#language-toggle').title=t('switchLanguage');renderNotice();
 }
 // Custom theme surfaces keep the picked hue where color fidelity matters; app text accents are shifted only where needed for contrast.
 function hexRgb(hex){const n=parseInt(hex.slice(1),16);return [n>>16&255,n>>8&255,n&255];}
 function rgbHex(rgb){return '#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');}
 function luminance(rgb){const [r,g,b]=rgb.map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;}
 function contrast(a,b){const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05);}
 function readableInk(hex){const bg=hexRgb(hex);return contrast(hexRgb('#ffffff'),bg)>=contrast(hexRgb('#202925'),bg)?'#ffffff':'#202925';}
 function shiftUntilReadable(hex,toward,against,ratio){const c=hexRgb(hex),t=hexRgb(toward),bg=hexRgb(against);for(let k=0;k<=1.0001;k+=.02){const mixed=c.map((v,i)=>v+(t[i]-v)*k);if(contrast(mixed,bg)>=ratio)return rgbHex(mixed);}return toward;}
 const paletteCache=new Map();
 function customPalette(hex){if(!paletteCache.has(hex))paletteCache.set(hex,{light:shiftUntilReadable(hex,'#000000','#ffffff',5.2),dark:shiftUntilReadable(hex,'#ffffff','#262a2c',5.5),railInk:readableInk(hex)});return paletteCache.get(hex);}
 function applyTheme(){const root=document.documentElement;const custom=state.settings.customAccent,palette=customPalette(custom);root.style.setProperty('--custom-accent-raw',custom);root.style.setProperty('--custom-accent-light',palette.light);root.style.setProperty('--custom-accent-dark',palette.dark);root.style.setProperty('--custom-rail-ink',palette.railInk);$('#custom-accent').value=custom;$('#custom-hex').textContent=custom.toUpperCase();document.querySelector('.custom-option span')?.style.setProperty('--swatch',custom);root.dataset.accent=state.settings.accent;root.dataset.dark=String(state.settings.mode==='dark'||(state.settings.mode==='system'&&dark.matches));root.dataset.motion=String(animate());$('#theme-mode').value=state.settings.mode;$('#motion').checked=state.settings.motion;document.querySelectorAll('[name=accent]').forEach(n=>n.checked=n.value===state.settings.accent);
  const toggle=$('#theme-toggle'),isDark=root.dataset.dark;if(toggle.dataset.dark!==isDark){toggle.dataset.dark=isDark;toggle.replaceChildren(icon(isDark==='true'?'Sun':'Moon'));}const label=isDark==='true'?t('switchLight'):t('switchDark');toggle.setAttribute('aria-label',label);toggle.title=label;}
 dark.addEventListener('change',applyTheme);reduce.addEventListener('change',applyTheme);
 function rects(){return new Map([...document.querySelectorAll('.task-card')].map(n=>[n.dataset.id,n.getBoundingClientRect()]));}
 function flip(before){if(!animate())return;document.querySelectorAll('.task-card').forEach((n,index)=>{const old=before.get(n.dataset.id),r=n.getBoundingClientRect();if(old){const dx=old.left-r.left,dy=old.top-r.top;if(dx||dy)n.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'translate(0,0)'}],{duration:420,easing:'cubic-bezier(.16,1,.3,1)'});}else n.animate([{opacity:0,transform:'translateY(16px) scale(.97)'},{opacity:1,transform:'none'}],{duration:350,delay:Math.min(index*35,250),easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'});});}
 function commit(action,message,doneId){const before=rects();try{action();actionError='';persist();render();flip(before);if(message)announce(message);if(doneId)celebrate(doneId);}catch(e){actionError=e.message;renderNotice();}}
 function focusCard(id,direction){const card=[...document.querySelectorAll('.task-card')].find(n=>n.dataset.id===id);const control=direction?card?.querySelector(`[data-direction="${direction}"]`):null;(control&&!control.disabled?control:card?.querySelector('.card-open'))?.focus({preventScroll:true});}
 // render() rebuilds these controls, so focus is moved to the equivalent new element (or a visible fallback).
 function focusByLabel(selector,label,fallback){const match=[...document.querySelectorAll(selector)].find(n=>n.getAttribute('aria-label')===label&&!n.disabled&&n.offsetParent);(match||(fallback&&document.querySelector(fallback)))?.focus();}
 function focusProject(name){const rows=[...document.querySelectorAll('#projects .project-button')].filter(n=>n.offsetParent),target=rows.find(n=>n.getAttribute('aria-label')===name)||rows.find(n=>n.getAttribute('aria-current')==='true');if(target)target.focus();else if(mobileProject.offsetParent)mobileProject.focus();else $('#new-project').focus();}
 const sidebar=$('.sidebar'),collapse=button('‹','icon-button sidebar-toggle',()=>{const closed=sidebar.classList.toggle('collapsed');document.body.classList.toggle('sidebar-collapsed',closed);collapse.replaceChildren(icon(closed?'PanelLeftOpen':'PanelLeftClose'));collapse.setAttribute('aria-expanded',String(!closed));},'Toggle sidebar');collapse.title='Toggle sidebar';collapse.setAttribute('aria-expanded','true');collapse.replaceChildren(icon('PanelLeftClose'));sidebar.prepend(collapse);
 setButtonIcon('#add-project','Plus');setButtonIcon('#new-project','Plus',t('newProject'));$('#new-project').setAttribute('aria-label',t('newProject'));
 setButtonIcon('#settings-open','Settings',t('settings'));$('#settings-open').setAttribute('aria-label',t('settings'));
 setButtonIcon('#add-task','Plus',t('addTask'));
 setButtonIcon('#add-category','Settings',t('category'));
 const projectIconNames={folder:'Folder',rocket:'Rocket',briefcase:'Briefcase',palette:'Palette',code:'CodeXml',book:'BookOpen',home:'House',heart:'Heart',star:'Star',lightbulb:'Lightbulb',target:'Target',leaf:'Leaf',coffee:'Coffee',music:'Music',camera:'Camera',plane:'Plane',graduation:'GraduationCap'};
 function projectMark(item){const m=el('span','project-mark');if(item.icon)m.append(icon(projectIconNames[item.icon]));else m.textContent=item.name.trim().slice(0,1).toUpperCase();return m;}
 let menuProjectId=null,menuTrigger=null;
 function menuButton(id,label,cls){const b=el('button','icon-button '+cls);b.type='button';b.append(icon('EllipsisVertical'));b.setAttribute('aria-label',label);b.title='Project options';b.setAttribute('aria-haspopup','menu');b.setAttribute('aria-expanded','false');b.setAttribute('popovertarget','project-menu');b.addEventListener('click',e=>{e.preventDefault();const menu=$('#project-menu');if(menu.matches(':popover-open')){const same=menuTrigger===b;menu.hidePopover();if(same)return;}menuProjectId=id??state.activeProjectId;menuTrigger=b;menu.showPopover();document.querySelectorAll('[popovertarget=project-menu]').forEach(x=>x.setAttribute('aria-expanded',String(x===b)));menu.querySelector('[role=menuitem]').focus();});return b;}
 document.querySelectorAll('[data-close].icon-button').forEach(b=>b.replaceChildren(icon('X')));
 const mobileProject=el('select','mobile-project');mobileProject.setAttribute('aria-label','Current project');sidebar.append(mobileProject);mobileProject.onchange=()=>selectProject(mobileProject.value);
 const mobileMenu=menuButton(null,'Project options','mobile-project-menu');sidebar.append(mobileMenu);
 const filterToggle=button('','icon-button filter-toggle',()=>{const open=$('#board-tools').classList.toggle('filters-open');filterToggle.setAttribute('aria-expanded',String(open));},'Filters');filterToggle.append(icon('SlidersHorizontal'));filterToggle.setAttribute('aria-expanded','false');filterToggle.setAttribute('aria-controls','task-filters');$('.filters').id='task-filters';$('#board-tools').append(filterToggle);
 $('.search-label').prepend(icon('Search'));setButtonIcon('#view-delete','Trash2','Delete');$('#view-delete').setAttribute('aria-label','Delete task');
 const pages=el('div','project-pages');$('#projects').after(pages);
 const tagSelect=el('select');tagSelect.id='tag-filter';tagSelect.setAttribute('aria-label','Filter by tag');$('.filters').insertBefore(tagSelect,$('#clear-filters'));tagSelect.onchange=()=>{tag=tagSelect.value;render();};
 const header=el('div','workspace-header');$('#main').prepend(header);['.topbar','#notice','.board-heading','#board-tools'].forEach(s=>header.append($(s)));

 let editingCategory=null,categoryOwner=null,removingCategory=null;
 const categoryTemplates=[
  {id:'software',name:'Software Development',categories:[['Backlog','#6f7a85',false],['Ready','#4f7ca8',false],['In Development','#c07b24',false],['Code Review','#7766b5',false],['QA','#ad7a2d',false],['Deployed','#3b8b69',true]]},
  {id:'marketing',name:'Marketing / Content',categories:[['Ideas','#8a768b',false],['Briefed','#4f7ca8',false],['In Production','#c07b24',false],['In Review','#7766b5',false],['Scheduled','#ad7a2d',false],['Published','#3b8b69',true]]},
  {id:'support',name:'Operations / Support',categories:[['New','#6f7a85',false],['Triaged','#4f7ca8',false],['In Progress','#c07b24',false],['Waiting on Customer','#ad7a2d',false],['Resolved','#3b8b69',true]]},
  {id:'editorial',name:'Editorial Calendar',categories:[['Idea','#8a768b',false],['Draft','#c07b24',false],['Review','#7766b5',false],['Scheduled','#ad7a2d',false],['Published','#3b8b69',true]]},
  {id:'simple',name:'Simple Kanban',categories:[['To Do','#78847c',false],['Doing','#c07b24',false],['Done','#3b8b69',true]]}
 ];
 function slug(text){return text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'category';}
 function uniqueCategoryId(p,name){const used=new Set(p.categories.map(c=>c.id));let base=slug(name),id=base,i=2;while(used.has(id))id=(base+'-'+i++).slice(0,80);used.add(id);return id;}
 function templateCategories(p,template){return template.categories.map(([name,color,completed])=>({id:uniqueCategoryId(p,name),name,color,completed}));}
 function selectedTemplate(){return categoryTemplates.find(t=>t.id===$('#category-template').value)||categoryTemplates[0];}
 function templatePreview(){const t=selectedTemplate();$('#template-preview').textContent=t.categories.map(([name])=>name).join(' -> ');}
 function categoryIndexMap(categories){return new Map(categories.map((c,index)=>[c.id,index]));}
 function applyCategoryTemplate(mode){
  const p=project();if(!p)return;const t=selectedTemplate(),incoming=templateCategories(p,t);
  try{
   if(mode==='extend'){
    const existing=new Set(p.categories.map(c=>c.name.toLowerCase())),add=incoming.filter(c=>!existing.has(c.name.toLowerCase()));
    if(p.categories.length+add.length>24)throw Error('Template would exceed 24 categories.');
    p.categories.push(...add);
   }else{
    const old=p.categories,oldIndex=categoryIndexMap(old),byName=new Map(incoming.map(c=>[c.name.toLowerCase(),c.id])),done=incoming.find(c=>c.completed)?.id||incoming[incoming.length-1].id;
    p.categories=incoming;
    p.tasks.forEach(task=>{
     const previous=old.find(c=>c.id===task.status),match=previous&&byName.get(previous.name.toLowerCase());
     task.status=match||(previous?.completed?done:incoming[Math.min(oldIndex.get(task.status)??0,incoming.length-1)].id);
    });
   }
   persist();render();renderCategories();announce(mode==='extend'?t('templateExtended'):t('templateReplaced'));
  }catch(error){$('#category-error').textContent=error.message;}
 }
 function activateSettings(name,focus=false){
  document.querySelectorAll('.settings-tabs [role=tab]').forEach(tab=>{
   const active=tab.id==='tab-'+name;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
   $('#'+tab.getAttribute('aria-controls')).hidden=!active;if(active&&focus)tab.focus();
  });
 }
 document.querySelectorAll('.settings-tabs [role=tab]').forEach(tab=>{
  tab.onclick=()=>activateSettings(tab.id.slice(4));
  tab.onkeydown=e=>{
   const tabs=[...document.querySelectorAll('.settings-tabs [role=tab]')],i=tabs.indexOf(tab);
   const index={ArrowRight:(i+1)%tabs.length,ArrowLeft:(i-1+tabs.length)%tabs.length,Home:0,End:tabs.length-1}[e.key];
   if(index!==undefined){e.preventDefault();activateSettings(tabs[index].id.slice(4),true);}
  };
 });
 function renderCategories(){
  const p=project(),selector=$('#category-project');
  selector.replaceChildren(...activeProjects().map(item=>new Option(item.name,item.id)));selector.value=p?.id||'';selector.disabled=!p;
  $('#category-empty').hidden=!!p;$('#settings-add-category').disabled=!p||p.categories.length>=24;$('#category-template').disabled=!p;$('#extend-template').disabled=!p||p.categories.length>=24;$('#replace-template').disabled=!p;
  templatePreview();
  const list=$('#category-list');list.replaceChildren();
  if(!p)return;
  p.categories.forEach((category,index)=>{
   const row=el('div','category-row'),swatch=el('span','category-swatch'),info=el('div','category-info'),actions=el('div','category-actions');
   row.dataset.categoryId=category.id;swatch.style.backgroundColor=category.color;
   info.append(el('strong','',category.name),el('span','',p.tasks.filter(t=>t.status===category.id).length+' tasks'+(category.completed?' · Completed':'')));
   const up=button('↑','icon-button',()=>shiftCategory(category.id,index-1),'Move '+category.name+' left');
   const down=button('↓','icon-button',()=>shiftCategory(category.id,index+1),'Move '+category.name+' right');
   up.disabled=index===0;down.disabled=index===p.categories.length-1;
   const edit=button('Edit','icon-button',()=>openCategory(category),'Edit category '+category.name);
   const remove=button('','icon-button danger',()=>openRemoveCategory(category),'Delete category '+category.name);remove.append(icon('Trash2'));remove.disabled=p.categories.length===1;
   actions.append(up,down,edit,remove);row.append(swatch,info,actions);list.append(row);
  });
 }
 function shiftCategory(id,index){
  try{M.moveCategory(project(),id,index);persist();render();const row=[...$('#category-list').children].find(n=>n.dataset.categoryId===id);row?.querySelector('button:not(:disabled)')?.focus();announce(t('categoryOrder'));}
  catch(error){$('#category-error').textContent=error.message;}
 }
 function renderArchivedProjects(){
  const list=$('#archived-projects');list.replaceChildren();
  const archived=state.projects.filter(p=>p.archived);$('#archive-empty').hidden=!!archived.length;
  archived.forEach(p=>{
   const row=el('div','category-row'),info=el('div','category-info');
   info.append(el('strong','',p.name),el('span','',p.tasks.length+' tasks'));
   const restore=button('Restore','',()=>{commit(()=>M.setProjectArchived(state,p.id,false),'Project restored');$('#archive-heading').focus();},'Restore project '+p.name);
   row.append(info,restore);list.append(row);
  });
 }
 function openCategory(category=null){
  if(!project())return;categoryOwner=project().id;editingCategory=category?.id??null;
  const f=$('#category-form');f.reset();f.elements.name.value=category?.name||'';f.elements.color.value=category?.color||'#78847c';f.elements.completed.checked=category?.completed||false;
  $('#category-title').textContent=category?'Edit category':'New category';show($('#category-dialog'));f.elements.name.focus();
 }
 $('#category-form').onsubmit=e=>{
  e.preventDefault();const f=e.currentTarget,owner=state.projects.find(p=>p.id===categoryOwner);
  try{if(!owner)throw Error('Project not found.');M.saveCategory(owner,{id:editingCategory,name:f.elements.name.value,color:f.elements.color.value,completed:f.elements.completed.checked});persist();render();$('#category-dialog').close();announce(t('categorySaved'));}
  catch(error){f.querySelector('.form-error').textContent=error.message;}
 };
 function openRemoveCategory(category){
  categoryOwner=project().id;removingCategory=category.id;const count=project().tasks.filter(t=>t.status===category.id).length;
  $('#remove-category-message').textContent=count?category.name+' contains '+count+' tasks. Choose where to move them.':'Delete "'+category.name+'"?';
  $('#category-destination').replaceChildren(new Option('Choose a category',''),...project().categories.filter(c=>c.id!==category.id).map(c=>new Option(c.name,c.id)));
  $('#category-destination-label').hidden=!count;$('#category-destination').disabled=!count;show($('#remove-category-dialog'));
 }
 $('#remove-category-form').onsubmit=e=>{
  e.preventDefault();try{
   const owner=state.projects.find(p=>p.id===categoryOwner);if(!owner)throw Error('Project not found.');
   M.deleteCategory(owner,removingCategory,$('#category-destination').value);persist();render();$('#remove-category-dialog').close();announce(t('categoryDeleted'));
  }catch(error){e.currentTarget.querySelector('.form-error').textContent=error.message;}
 };
 $('#settings-add-category').onclick=()=>openCategory();
 $('#category-project').onchange=e=>{selectProject(e.target.value);$('#category-error').textContent='';};
 $('#category-template').replaceChildren(...categoryTemplates.map(t=>new Option(t.name,t.id)));
 $('#category-template').onchange=templatePreview;
 $('#extend-template').onclick=()=>applyCategoryTemplate('extend');
 $('#replace-template').onclick=()=>applyCategoryTemplate('replace');

 let filteredProjectId;
 let projectDragId=null;
 function activeProjectOrder(ids){
  const byId=new Map(activeProjects().map(p=>[p.id,p])),active=ids.map(id=>byId.get(id)).filter(Boolean),archived=state.projects.filter(p=>p.archived);
  state.projects=[...active,...archived];
 }
 function reorderVisibleProjects(){
  const ids=[...document.querySelectorAll('#projects .project-row')].map(row=>row.dataset.projectId).filter(Boolean),active=activeProjects(),start=projectPage*projectPageSize;
  const next=[...active.slice(0,start),...ids.map(id=>active.find(p=>p.id===id)).filter(Boolean),...active.slice(start+ids.length)];
  if(next.map(p=>p.id).join()===active.map(p=>p.id).join())return false;
  activeProjectOrder(next.map(p=>p.id));persist();render();return true;
 }
 function attachProjectDrag(row,item){
  row.dataset.projectId=item.id;row.draggable=true;
  row.addEventListener('dragstart',e=>{projectDragId=item.id;row.classList.add('project-drag-source');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',item.id);});
  row.addEventListener('dragend',()=>{projectDragId=null;document.querySelectorAll('.project-drag-source,.project-drop-target').forEach(n=>n.classList.remove('project-drag-source','project-drop-target'));});
  row.addEventListener('dragover',e=>{if(!projectDragId||projectDragId===item.id)return;e.preventDefault();const dragging=$(`#projects .project-row[data-project-id="${CSS.escape(projectDragId)}"]`);if(!dragging)return;row.classList.add('project-drop-target');const after=e.clientY>row.getBoundingClientRect().top+row.offsetHeight/2;if(after)row.after(dragging);else row.before(dragging);});
  row.addEventListener('dragleave',()=>row.classList.remove('project-drop-target'));
  row.addEventListener('drop',e=>{if(!projectDragId)return;e.preventDefault();const id=projectDragId;projectDragId=null;if(reorderVisibleProjects()){announce('Project order updated');focusProject(state.projects.find(p=>p.id===id)?.name);}});
 }
 function render(){
  if(filteredProjectId!==state.activeProjectId){filteredProjectId=state.activeProjectId;filter='';priority='all';tag='';$('#search').value='';$('#priority-filter').value='all';}
  applyTheme();staticText();const p=project();$('#projects').replaceChildren();if(lastProjectId!==state.activeProjectId){projectPage=Math.floor(Math.max(0,activeProjects().findIndex(item=>item.id===state.activeProjectId))/projectPageSize);lastProjectId=state.activeProjectId;}projectPage=Math.min(projectPage,Math.max(0,Math.ceil(activeProjects().length/projectPageSize)-1));activeProjects().slice(projectPage*projectPageSize,(projectPage+1)*projectPageSize).forEach(item=>{const row=el('div','project-row'),b=button('','project-button',()=>selectProject(item.id));b.title=item.name;b.setAttribute('aria-label',item.name);b.setAttribute('aria-current',String(p?.id===item.id));b.append(projectMark(item),el('span','project-name',item.name),el('span','project-count',String(item.tasks.length)));row.append(b,menuButton(item.id,'Project options for '+item.name,'project-menu-button'));attachProjectDrag(row,item);$('#projects').append(row);});
  pages.replaceChildren();if(activeProjects().length>projectPageSize){const prev=button('‹','icon-button',()=>{projectPage--;render();focusByLabel('.project-pages button','Previous projects','.project-pages button:not(:disabled)');},'Previous projects'),next=button('›','icon-button',()=>{projectPage++;render();focusByLabel('.project-pages button','Next projects','.project-pages button:not(:disabled)');},'Next projects');prev.disabled=projectPage===0;next.disabled=(projectPage+1)*projectPageSize>=activeProjects().length;pages.append(prev,el('span','',String(projectPage+1)+' / '+Math.ceil(activeProjects().length/projectPageSize)),next);}
  mobileProject.replaceChildren(...(activeProjects().length?activeProjects().map(item=>new Option(item.name,item.id)):[new Option('Your projects','')]));mobileProject.value=state.activeProjectId||'';
  const available=new Map();(p?.tasks||[]).forEach(t=>t.tags.forEach(name=>available.set(name.toLowerCase(),name)));if(!available.has(tag))tag='';tagSelect.replaceChildren(new Option('All tags',''),...[...available].sort((a,b)=>a[1].localeCompare(b[1])).map(([value,name])=>new Option(name,value)));tagSelect.value=tag;
  $('#breadcrumb').textContent=p?p.name:t('yourBoards');$('#project-title').textContent=p?p.name:t('workspaceTitle');$('#project-title').title=p?.name||t('workspaceTitle');$('#project-eyebrow').textContent=p?t('project'):t('workspace');$('#project-subtitle').textContent=p?`${p.tasks.length} ${t('tasks')} · ${p.tasks.filter(t=>isCompleted(t.status)).length} ${t('completed')}`:t('workspaceSubtitle');
  const description=$('#project-description');description.textContent=p?.description||'';description.title=p?.description||'';description.hidden=!p?.description;
  $('#welcome').hidden=!!p;mobileMenu.hidden=!p;['#board-tools','#board','#board-footer'].forEach(s=>$(s).hidden=!p);$('#board').replaceChildren();renderCategories();renderArchivedProjects();if(!p)return;$('#board').style.setProperty('--category-count',p.categories.length);
  const visible=p.tasks.filter(t=>(priority==='all'||t.priority===priority)&&(!tag||t.tags.some(name=>name.toLowerCase()===tag))&&(!filter||(t.title+' '+t.description+' '+t.tags.join(' ')).toLowerCase().includes(filter)));
  $('#board-tools').classList.toggle('has-filters',!!filter||!!tag||priority!=='all');
  $('#task-total').textContent=filter||tag||priority!=='all'?`${visible.length} of ${p.tasks.length}`:String(p.tasks.length);$('#clear-filters').hidden=!filter&&!tag&&priority==='all';
  for(const category of p.categories){const status=category.id;const lane=el('section','lane');lane.dataset.status=status;lane.style.setProperty('--lane',category.color);lane.setAttribute('aria-label',categoryName(status));const heading=el('div','lane-heading');heading.append(el('span','lane-dot'),el('h2','',categoryName(status)),el('span','lane-count',String(visible.filter(t=>t.status===status).length)),button('+','icon-button',()=>openTask(null,status),'Add task to '+categoryName(status)));const sort=el('select','lane-sort');sort.setAttribute('aria-label','Sort '+categoryName(status));sort.append(new Option('Manual order','manual'),new Option('Priority: high first','priority'),new Option('Newest first','newest'),new Option('Oldest first','oldest'));sort.value=sorts[p.id+status]||'manual';sort.onchange=()=>{const before=rects();sorts[p.id+status]=sort.value;render();flip(before);focusByLabel('.lane-sort',sort.getAttribute('aria-label'));};const sortControl=el('span','sort-control');sortControl.title=sort.options[sort.selectedIndex].text;sortControl.classList.toggle('is-sorted',sort.value!=='manual');sortControl.append(icon('ArrowUpDown'),sort);heading.insertBefore(sortControl,heading.lastElementChild);const laneHeader=el('div','lane-header');laneHeader.append(heading);lane.append(laneHeader);const cards=el('div','lane-cards');
   const tasks=visible.filter(t=>t.status===status);const order=sorts[p.id+status];if(order==='priority')tasks.sort((a,b)=>M.priorities.indexOf(b.priority)-M.priorities.indexOf(a.priority));if(order==='newest'||order==='oldest')tasks.sort((a,b)=>((Date.parse(a.createdAt)||0)-(Date.parse(b.createdAt)||0))*(order==='newest'?-1:1));tasks.forEach(t=>cards.append(renderCard(t,p,tasks)));if(!tasks.length)cards.append(el('p','lane-empty',filter||tag||priority!=='all'?t('noMatching'):t('noTasks')));
   lane.append(cards,button('+ Add task','lane-add',()=>openTask(null,status),t('addTask')+' '+categoryName(status)));$('#board').append(lane);
  }
 }
 function renderCard(t,p,laneTasks){const card=el('article','task-card');card.dataset.id=t.id;if(t.color)card.dataset.color=t.color;const open=button('','card-open',()=>openView(t),'View task: '+t.title);const cardHeading=el('span','card-heading');cardHeading.append(el('span','card-title',t.title),el('span','priority '+t.priority,t.priority[0].toUpperCase()+t.priority.slice(1)));open.append(cardHeading);if(t.description)open.append(el('span','card-description',t.description));if(t.tags.length)open.append(tagRow(t,'card-tags'));const meta=el('span','card-meta');if(t.link){const link=el('span','card-link-dot','Link');link.prepend(icon('Link'));meta.append(link);}if(t.due){const date=new Date(t.due+'T12:00:00');const today=new Date();today.setHours(0,0,0,0);const due=el('span','due'+(date<today&&!isCompleted(t.status)?' overdue':''),date.toLocaleDateString(undefined,{month:'short',day:'numeric',...(date.getFullYear()!==today.getFullYear()?{year:'numeric'}:{})}));due.title='Due '+t.due;due.prepend(icon('CalendarDays'));meta.append(due);}if(meta.childElementCount)open.append(meta);const controls=el('div','card-controls');controls.append(button('Edit','subtle card-edit',()=>openTask(t),'Edit task: '+t.title));const index=laneTasks.indexOf(t);
  for(const [dir,symbol,delta] of [['up','↑',-1],['down','↓',1]]){const b=button(symbol,'subtle',()=>{const target=index+delta;if(target<0||target>=laneTasks.length)return;const ids=laneTasks.map(x=>x.id);[ids[index],ids[target]]=[ids[target],ids[index]];reorder(t.id,t.status,laneOrderIds(t.status,laneTasks,ids));focusCard(t.id,dir);},'Move '+t.title+' '+dir);b.dataset.direction=dir;b.disabled=dir==='up'?index===0:index===laneTasks.length-1;controls.append(b);}card.append(open,controls);attachMouseDrag(card,t);attachTouchDrag(card,t);return card;
 }
 function laneOrderIds(status,laneTasks,orderedVisibleIds){const shown=new Set(laneTasks.map(t=>t.id));const hidden=project().tasks.filter(t=>t.status===status&&!shown.has(t.id)&&!orderedVisibleIds.includes(t.id)).map(t=>t.id);return [...orderedVisibleIds,...hidden];}
 function reorder(id,status,orderedIds){sorts[project().id+status]='manual';const t=project().tasks.find(t=>t.id===id);const done=isCompleted(status)&&!isCompleted(t.status);commit(()=>M.reorderLane(project(),status,orderedIds,id),'Task moved to '+categoryName(status),done?id:null);}
 function laneVisibleOrder(laneEl){return [...laneEl.querySelectorAll('.lane-cards .task-card')].map(n=>project().tasks.find(x=>x.id===n.dataset.id)).filter(Boolean);}
 // Drag uses pointer/touch events rather than native HTML5 drag, which froze input in some Chromium browsers.
 // While dragging, the source card is hidden and a placeholder marks the drop slot; the placeholder's position is the drop result.
 let activeDrag=null;
 const ease='cubic-bezier(.2,.8,.2,1)';
 function slide(mutate){
  const before=[...document.querySelectorAll('.lane-cards > .task-card, .drop-placeholder')].map(n=>[n,n.getBoundingClientRect()]).filter(([,r])=>r.width);
  mutate();
  if(!animate())return;
  for(const [n,r] of before){if(!n.isConnected)continue;n.getAnimations().forEach(a=>a.cancel());const now=n.getBoundingClientRect(),dx=r.left-now.left,dy=r.top-now.top;if(Math.abs(dx)+Math.abs(dy)>.5)n.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:'none'}],{duration:220,easing:ease});}
 }
 function edgeScroll(x,y){const board=$('#board'),b=board.getBoundingClientRect(),edge=48,step=14;if(x<b.left+edge)board.scrollLeft-=step;else if(x>b.right-edge)board.scrollLeft+=step;if(y<b.top+edge)board.scrollTop-=step;else if(y>b.bottom-edge)board.scrollTop+=step;}
 function placeGhost(x,y){const d=activeDrag;d.ghost.style.transform=`translate(${x-d.dx}px,${y-d.dy}px)`;}
 function startDrag(card,t,x,y){
  const r=card.getBoundingClientRect(),ghost=card.cloneNode(true),placeholder=el('div','drop-placeholder');
  ghost.classList.add('drag-ghost');ghost.removeAttribute('data-id');ghost.setAttribute('aria-hidden','true');ghost.inert=true;
  Object.assign(ghost.style,{width:r.width+'px',height:r.height+'px'});placeholder.style.height=r.height+'px';
  activeDrag={card,t,ghost,placeholder,dx:x-r.left,dy:y-r.top,origin:{status:t.status,ids:laneVisibleOrder(card.closest('.lane')).map(x=>x.id).join()}};
  dragId=t.id;getSelection()?.removeAllRanges();document.documentElement.classList.add('is-dragging');
  card.after(placeholder);card.classList.add('drag-source');card.closest('.lane')?.classList.add('drag-over');
  document.body.append(ghost);placeGhost(x,y);
  if(animate())ghost.animate([{scale:'1',rotate:'0deg'},{scale:'1.04',rotate:'2deg'}],{duration:180,easing:ease,fill:'forwards'});
  window.addEventListener('keydown',cancelOnEscape);
 }
 function trackDrag(x,y){
  placeGhost(x,y);edgeScroll(x,y);
  const lane=document.elementFromPoint(x,y)?.closest('.lane');if(!lane)return;
  const {card,placeholder:ph}=activeDrag,list=lane.querySelector('.lane-cards');
  document.querySelectorAll('.lane.drag-over').forEach(n=>{if(n!==lane)n.classList.remove('drag-over');});lane.classList.add('drag-over');
  // Compare against card midpoints as if the placeholder were absent, so the slot doesn't flicker at boundaries.
  const inList=ph.parentElement===list,gap=ph.offsetHeight+12,rel=y-lane.getBoundingClientRect().top;
  const next=[...list.children].filter(n=>n.classList.contains('task-card')&&n!==card).find(n=>{let mid=n.offsetTop+n.offsetHeight/2;if(inList&&ph.compareDocumentPosition(n)&Node.DOCUMENT_POSITION_FOLLOWING)mid-=gap;return rel<mid;})||null;
  let cur=ph.nextElementSibling;while(cur&&(cur===card||!cur.classList.contains('task-card')))cur=cur.nextElementSibling;
  if(inList&&cur===next)return;
  slide(()=>{if(next)next.before(ph);else list.append(ph);});
 }
 function settle(id,from){
  if(!animate())return;const n=[...document.querySelectorAll('.task-card')].find(x=>x.dataset.id===id);if(!n)return;
  n.getAnimations().forEach(a=>a.cancel());const to=n.getBoundingClientRect();
  n.animate([{transform:`translate(${from.left-to.left}px,${from.top-to.top}px) rotate(2deg) scale(1.04)`,boxShadow:'0 18px 40px #17271e33'},{transform:'none'}],{duration:280,easing:ease});
 }
 function finishDrag(drop){
  const d=activeDrag;if(!d)return;activeDrag=null;window.removeEventListener('keydown',cancelOnEscape);
  const {card,t,ghost,placeholder:ph}=d,from=ghost.getBoundingClientRect(),list=ph.parentElement,lane=ph.closest('.lane');
  const ids=drop&&lane?[...list.children].filter(n=>n===ph||(n.classList.contains('task-card')&&n!==card)).map(n=>n===ph?t.id:n.dataset.id):null;
  slide(()=>{if(ids)ph.replaceWith(card);else ph.remove();card.classList.remove('drag-source');});
  ghost.remove();document.documentElement.classList.remove('is-dragging');document.querySelectorAll('.drag-over').forEach(n=>n.classList.remove('drag-over'));dragId=null;
  if(ids){const status=lane.dataset.status;if(status!==d.origin.status||ids.join()!==d.origin.ids)reorder(t.id,status,laneOrderIds(status,laneVisibleOrder(lane),ids));}
  settle(t.id,from);
 }
 function cancelOnEscape(e){if(e.key==='Escape'){e.preventDefault();finishDrag(false);}}
 function suppressNextClick(){const stop=e=>{e.stopPropagation();e.preventDefault();};window.addEventListener('click',stop,{capture:true,once:true});setTimeout(()=>window.removeEventListener('click',stop,{capture:true}));}
 function attachMouseDrag(card,t){
  card.addEventListener('pointerdown',e=>{
   if(e.pointerType==='touch'||e.button!==0||dragId)return;
   const id=e.pointerId,sx=e.clientX,sy=e.clientY;let started=false;
   const move=ev=>{
    if(ev.pointerId!==id)return;
    if(!started){if(Math.hypot(ev.clientX-sx,ev.clientY-sy)<5)return;started=true;try{document.documentElement.setPointerCapture(id);}catch(err){}startDrag(card,t,sx,sy);}
    if(!activeDrag)return;ev.preventDefault();trackDrag(ev.clientX,ev.clientY);
   };
   const end=ev=>{
    if(ev.pointerId!==id)return;
    window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);
    if(!started)return;suppressNextClick();finishDrag(ev.type==='pointerup');
   };
   window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
  });
 }
 function attachTouchDrag(card,t){
  let timer=null,sx=0,sy=0,started=false;
  const clear=()=>{clearTimeout(timer);timer=null;};
  card.addEventListener('touchstart',e=>{
   if(e.touches.length!==1||dragId)return;
   sx=e.touches[0].clientX;sy=e.touches[0].clientY;started=false;
   timer=setTimeout(()=>{timer=null;started=true;if(navigator.vibrate)navigator.vibrate(12);startDrag(card,t,sx,sy);},420);
  },{passive:true});
  card.addEventListener('touchmove',e=>{
   const p=e.touches[0];if(!p)return;
   if(!started){if(timer&&Math.hypot(p.clientX-sx,p.clientY-sy)>10)clear();return;}
   e.preventDefault();if(activeDrag)trackDrag(p.clientX,p.clientY);
  },{passive:false});
  card.addEventListener('touchend',e=>{clear();if(!started)return;started=false;e.preventDefault();finishDrag(true);});
  card.addEventListener('touchcancel',()=>{clear();if(started){started=false;finishDrag(false);}});
  card.addEventListener('contextmenu',e=>{if(started||timer)e.preventDefault();});
 }
 window.addEventListener('resize',()=>{if(activeDrag)return;const size=projectCapacity();if(size!==projectPageSize){projectPageSize=size;lastProjectId=undefined;render();}});
 function selectProject(id){if(id===state.activeProjectId)return;state.activeProjectId=id;filter='';priority='all';tag='';$('#search').value='';$('#priority-filter').value='all';persist();render();$('#board').classList.remove('project-enter');void $('#board').offsetWidth;$('#board').classList.add('project-enter');flip(new Map());announce('Opened '+project().name);}
 function show(dialog){dialog.querySelector('.form-error')?.replaceChildren();dialog.showModal();}
 function openProject(id=null){const existing=state.projects.find(x=>x.id===id);editingProject=existing?.id??null;$('#project-dialog-title').textContent=existing?'Edit project':'New project';$('#project-name').value=existing?.name??'';$('#project-description-input').value=existing?.description??'';iconOptions.querySelector(`input[value="${existing?.icon??''}"]`).checked=true;updateLetterIcon();show($('#project-dialog'));$('#project-name').focus();}
 async function deleteProject(id){const target=state.projects.find(x=>x.id===id);if(target&&await confirmAction('Delete project?',`“${target.name}” and all its tasks will be permanently removed. Export a backup first if you want to keep a copy.`,'Delete project')){commit(()=>M.deleteProject(state,id),'Project deleted');focusProject();}}
 function openTask(task,status=project()?.categories[0]?.id){$('#view-dialog').close();editingTask=task?.id??null;const f=$('#task-form');f.reset();f.elements.status.replaceChildren(...project().categories.map(c=>new Option(c.name,c.id)));f.elements.title.value=task?.title??'';f.elements.description.value=task?.description??'';f.elements.status.value=task?.status??status;f.elements.priority.value=task?.priority??'medium';f.elements.due.value=task?.due??'';f.elements.link.value=task?.link??'';f.elements.tags.value=(task?.tags??[]).join(', ');f.querySelector(`input[name=color][value="${task?.color??''}"]`).checked=true;$('#task-dialog-title').textContent=task?t('taskDetails'):t('newTask');$('#delete-task').hidden=!task;show($('#task-dialog'));f.elements.title.focus();}
 function openView(task){viewingTask=task.id;$('#view-status-tag').textContent=categoryName(task.status);$('#view-status-tag').dataset.status=task.status;$('#view-title').textContent=task.title;const desc=$('#view-description');desc.textContent=task.description||'No description yet.';desc.classList.toggle('empty',!task.description);$('#view-priority').textContent=task.priority[0].toUpperCase()+task.priority.slice(1);$('#view-due-row').hidden=!task.due;if(task.due)$('#view-due').textContent=new Date(task.due+'T12:00:00').toLocaleDateString(lang()==='id'?'id-ID':undefined,{year:'numeric',month:'long',day:'numeric'});$('#view-link-row').hidden=!task.link;if(task.link){const a=$('#view-link');a.href=task.link;a.textContent=task.link;}$('#view-tags-row').hidden=!task.tags.length;$('#view-tags').replaceChildren(...task.tags.map(tagChip));show($('#view-dialog'));$('#view-edit').focus();}
 function confirmAction(title,message,label='Confirm'){return new Promise(resolve=>{const d=$('#confirm-dialog'),confirm=$('#confirm-button'),cancel=d.querySelector('button[value=cancel]');let settled=false;const done=accepted=>{if(settled)return;settled=true;confirm.onclick=null;cancel.onclick=null;d.oncancel=null;if(d.open)d.close(accepted?'confirm':'cancel');resolve(accepted);};$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;confirm.textContent=label;d.returnValue='cancel';confirm.onclick=e=>{e.preventDefault();done(true);};cancel.onclick=e=>{e.preventDefault();done(false);};d.oncancel=e=>{e.preventDefault();done(false);};d.showModal();});}
 document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
 M.cardColors.forEach(key=>{const label=el('label','card-color-option'),input=document.createElement('input'),name=key?key[0].toUpperCase()+key.slice(1):'Default';input.type='radio';input.name='color';input.value=key;input.setAttribute('aria-label',name);label.title=name;label.append(input,el('span'));if(key)label.dataset.color=key;$('#card-color-options').append(label);});
 const iconOptions=$('#icon-options');
 M.projectIcons.forEach(key=>{const label=el('label','icon-option'),input=document.createElement('input'),face=el('span','icon-face'),name=key?key[0].toUpperCase()+key.slice(1):'First letter';input.type='radio';input.name='icon';input.value=key;input.setAttribute('aria-label',name);label.title=name;if(key)face.append(icon(projectIconNames[key]));else face.classList.add('icon-letter');label.append(input,face);iconOptions.append(label);});
 function updateLetterIcon(){iconOptions.querySelector('.icon-letter').textContent=($('#project-name').value.trim()[0]||'A').toUpperCase();}
 $('#project-name').addEventListener('input',updateLetterIcon);
 const projectMenu=$('#project-menu');$('#menu-edit').prepend(icon('Pencil'));$('#menu-archive').prepend(icon('Archive'));$('#menu-delete').prepend(icon('Trash2'));
 projectMenu.addEventListener('beforetoggle',e=>{if(e.newState!=='open'||!menuTrigger)return;const r=menuTrigger.getBoundingClientRect(),w=190,h=140;projectMenu.style.left=Math.max(8,Math.min(r.left,innerWidth-w-8))+'px';projectMenu.style.top=(r.bottom+h+8>innerHeight?r.top-h-4:r.bottom+4)+'px';});
 projectMenu.addEventListener('toggle',()=>{if(!projectMenu.matches(':popover-open'))document.querySelectorAll('[popovertarget=project-menu]').forEach(b=>b.setAttribute('aria-expanded','false'));});
 projectMenu.addEventListener('keydown',e=>{const items=[...projectMenu.querySelectorAll('[role=menuitem]')],i=items.indexOf(document.activeElement);const to={ArrowDown:(i+1)%items.length,ArrowUp:(i-1+items.length)%items.length,Home:0,End:items.length-1}[e.key];if(to!==undefined){e.preventDefault();items[to].focus();}else if(e.key==='Tab')projectMenu.hidePopover();});
 $('#menu-edit').onclick=()=>{projectMenu.hidePopover();openProject(menuProjectId);};
 $('#menu-archive').onclick=()=>{const id=menuProjectId;projectMenu.hidePopover();commit(()=>M.setProjectArchived(state,id,true),'Project archived');$('#settings-open').focus();};
 $('#menu-delete').onclick=()=>{projectMenu.hidePopover();deleteProject(menuProjectId);};
 $('#theme-toggle').onclick=()=>{const t=$('#theme-toggle');state.settings.mode=document.documentElement.dataset.dark==='true'?'light':'dark';applyTheme();persist();if(animate())t.firstElementChild?.animate([{rotate:'-90deg',scale:'.5',opacity:0},{rotate:'0deg',scale:'1',opacity:1}],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'});};
 $('#language-toggle').onclick=()=>{state.settings.language=lang()==='en'?'id':'en';persist();render();announce(state.settings.language==='id'?'Bahasa Indonesia':'English');};
 ['#add-project','#new-project','#start-project'].forEach(s=>$(s).onclick=()=>openProject());$('#add-task').onclick=()=>openTask();$('#add-category').onclick=()=>{activateSettings('categories');renderCategories();show($('#settings-dialog'));};$('#view-edit').onclick=()=>{const t=project()?.tasks.find(t=>t.id===viewingTask);if(t)openTask(t);};
 $('#project-form').onsubmit=e=>{e.preventDefault();try{const data={name:$('#project-name').value,description:$('#project-description-input').value,icon:e.currentTarget.elements.icon.value};if(editingProject)M.updateProject(state,editingProject,data);else M.addProject(state,data.name,data);persist();render();$('#project-dialog').close();flip(new Map());focusProject(data.name.trim());announce(t('projectSaved'));}catch(error){$('#project-form .form-error').textContent=error.message;}};
 $('#task-form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget;try{const before=rects(),old=project().tasks.find(t=>t.id===editingTask);const previous=old?.status;const t=M.saveTask(project(),{id:editingTask,title:f.elements.title.value,description:f.elements.description.value,priority:f.elements.priority.value,status:f.elements.status.value,due:f.elements.due.value,link:f.elements.link.value,tags:f.elements.tags.value,color:f.elements.color.value});persist();render();$('#task-dialog').close();flip(before);if(isCompleted(t.status)&&!isCompleted(previous))celebrate(t.id);focusCard(t.id);announce(t('taskSaved'));}catch(error){$('#task-form .form-error').textContent=error.message;}};
 async function deleteTask(id,dialog){
  const owner=project(),task=owner?.tasks.find(t=>t.id===id);if(!task)return;
  if(await confirmAction('Delete task?',`Delete "${task.title}"? This cannot be undone.`,'Delete task')){
   dialog.close();commit(()=>M.deleteTask(owner,id),'Task deleted');$('#add-category').focus({preventScroll:true});
  }
 }
 $('#delete-task').onclick=()=>deleteTask(editingTask,$('#task-dialog'));
 $('#view-delete').onclick=()=>deleteTask(viewingTask,$('#view-dialog'));
 $('#search').oninput=e=>{filter=e.target.value.trim().toLowerCase();render();};$('#priority-filter').onchange=e=>{priority=e.target.value;render();};$('#clear-filters').onclick=()=>{filter='';priority='all';tag='';$('#search').value='';$('#priority-filter').value='all';render();};
 $('#sample-project').onclick=()=>commit(()=>{const p=M.addProject(state,'A fresh start · sample');[{title:'Make this board your own',description:'This is an optional sample project. Rename it, change a task, or delete it and start fresh.',priority:'low',tags:['Content','AI Project']},{title:'Gather the loose ends',description:'Get ideas out of your head. Add a task for each next step.',status:'backlog',tags:['Design']},{title:'Give one thing your attention',description:'Drag this card forward, or open it and change its status.',status:'progress',priority:'high',tags:['AI Project','Design'],color:'amber'},{title:'Take a second look',description:'A little space to check the details before calling it done.',status:'review',tags:['Content']},{title:'Make room to begin',description:'You opened a board. That counts.',status:'done',priority:'low',tags:['Technical Content'],color:'teal'}].forEach(t=>M.saveTask(p,t));},'Sample project created');
 const swatches={vermilion:'#ad304b',forest:'#286448',cobalt:'#305da8',plum:'#85456f',ochre:'#795b17'};M.accents.forEach(accent=>{const label=el('label','accent-option'),input=document.createElement('input');input.type='radio';input.name='accent';input.value=accent;input.setAttribute('aria-label',accent[0].toUpperCase()+accent.slice(1));input.onchange=()=>{state.settings.accent=accent;applyTheme();persist();};const swatch=el('span');swatch.title=accent[0].toUpperCase()+accent.slice(1);if(accent==='custom'){label.classList.add('custom-option');input.addEventListener('click',()=>{try{$('#custom-accent').showPicker();}catch(err){}});}else swatch.style.setProperty('--swatch',swatches[accent]);label.append(input,swatch);$('#accent-options').append(label);});
 const bgStore=window.KanbaamBackground,bgImageLayer=$('.bg-image');let bgUrl=null;
 $('.bg-thumb-default').innerHTML=$('.bg-art').innerHTML.replaceAll('id="bg-','id="thumb-bg-').replaceAll('url(#bg-','url(#thumb-bg-').replaceAll('href="#bg-','href="#thumb-bg-');
 function applyBackground(){
  const root=document.documentElement,bg=state.settings.background,custom=bg.mode==='custom'&&!!bgUrl;
  root.dataset.bg=custom?'custom':'default';root.style.setProperty('--bg-dim',String(bg.dim/100));root.style.setProperty('--bg-blur',bg.blur+'px');
  bgImageLayer.style.backgroundImage=bgUrl?`url("${bgUrl}")`:'none';$('.bg-thumb-custom').style.backgroundImage=bgUrl?`url("${bgUrl}")`:'';
  $('#bg-default').checked=!custom;$('#bg-custom').checked=custom;$('#bg-custom').disabled=!bgUrl;$('#bg-remove').hidden=!bgUrl;
  $('#bg-dim').value=bg.dim;$('#bg-dim-value').textContent=bg.dim+'%';$('#bg-blur').value=bg.blur;$('#bg-blur-value').textContent=bg.blur+'px';
 }
 // Preferences (mode/dim/blur) live in state.settings.background, so they sync via the workspace JSON and any linked file.
 // The image itself and the file handle below stay device-local: they can't travel through JSON.
 function setBackground(changes,save=true){state.settings.background={...state.settings.background,...changes};applyBackground();if(save)persist();}
 document.documentElement.dataset.bg='pending';
 bgStore.getImage().then(blob=>{if(blob instanceof Blob&&!bgUrl)bgUrl=URL.createObjectURL(blob);}).catch(()=>{}).finally(applyBackground);
 setTimeout(()=>{if(document.documentElement.dataset.bg==='pending')applyBackground();},1000);
 $('#bg-choose').onclick=()=>$('#bg-file').click();
 $('#bg-file').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;const status=$('#bg-status');
  try{
   const blob=await bgStore.prepare(file);let stored=true;try{await bgStore.putImage(blob);}catch(err){stored=false;}
   if(bgUrl)URL.revokeObjectURL(bgUrl);bgUrl=URL.createObjectURL(blob);
   const bg=state.settings.background;setBackground({mode:'custom',dim:bg.mode==='custom'||bg.dim?bg.dim:25});
   status.textContent=stored?'Background saved on this device. It isn’t included in exports.':'This browser couldn’t store the image, so it will reset when Kanbaam closes.';announce('Custom background applied');
  }catch(err){status.textContent=err.message;}
 };
 $('#bg-default').onchange=()=>setBackground({mode:'default'});
 $('#bg-custom').onchange=()=>setBackground({mode:'custom'});
 $('#bg-remove').onclick=async()=>{try{await bgStore.deleteImage();}catch(err){$('#bg-status').textContent='Could not remove the stored image. Please try again.';return;}if(bgUrl)URL.revokeObjectURL(bgUrl);bgUrl=null;setBackground({mode:'default'});$('#bg-status').textContent='Custom image removed.';$('#bg-choose').focus();};
 for(const [id,key] of [['#bg-dim','dim'],['#bg-blur','blur']]){const input=$(id);input.addEventListener('input',()=>setBackground({[key]:Number(input.value)},false));input.addEventListener('change',()=>setBackground({[key]:Number(input.value)}));}
 const customInput=$('#custom-accent');
 customInput.addEventListener('input',()=>{state.settings.customAccent=customInput.value;state.settings.accent='custom';applyTheme();});
 customInput.addEventListener('change',()=>{state.settings.customAccent=customInput.value;state.settings.accent='custom';applyTheme();persist();announce('Custom accent color applied');});
 $('#settings-open').onclick=()=>{activateSettings('appearance');renderCategories();show($('#settings-dialog'));};$('#theme-mode').onchange=e=>{state.settings.mode=e.target.value;applyTheme();persist();};$('#motion').onchange=e=>{state.settings.motion=e.target.checked;applyTheme();persist();};
 function download(raw,name){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 $('#export').onclick=()=>{download(json(),'kanbaam.json');announce('Workspace export downloaded');};$('#export-backup').onclick=()=>{try{const raw=local.getItem(S.BACKUP);if(raw===null)throw Error('No previous backup exists yet.');download(raw,'kanbaam-previous-backup.json');}catch(e){actionError=e.message;renderNotice();$('#file-status').textContent=e.message;}};
 async function readFile(file){if(file.size>S.MAX_BYTES)throw Error('Workspace is too large (5 MB maximum).');return store.parse(await file.text());}
 async function replaceWorkspace(next,name){if(!await confirmAction('Replace workspace?',`Load “${name}” and replace all current projects and settings? The previous browser data will be backed up. Any linked file will be disconnected.`,'Replace workspace'))return false;store.replace(next);writer.disconnect();bgStore.deleteHandle().catch(()=>{});state=next;browserError='';actionError='';filter='';priority='all';tag='';$('#search').value='';$('#priority-filter').value='all';render();applyBackground();renderNotice();flip(new Map());announce('Workspace imported');return true;}
 function fileFailure(e){if(e.name==='AbortError')return;actionError=e.message;$('#file-status').textContent=e.message;renderNotice();}
 $('#import').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{await replaceWorkspace(await readFile(f),f.name);}catch(error){fileFailure(error);}};
 const supported=typeof window.showSaveFilePicker==='function'&&typeof window.showOpenFilePicker==='function';$('#file-capability').textContent=supported?'This browser can save changes directly to a JSON file you choose. Browser storage remains your fallback.':'Direct file linking is unavailable in this browser. Use Export JSON and Import JSON instead; your browser workspace still saves automatically.';$('#create-file').disabled=!supported;$('#open-file').disabled=!supported;
 const pickerTypes=[{description:'Kanbaam JSON workspace',accept:{'application/json':['.json']}}];
 // Remembering the handle (device-local, in IndexedDB) lets tryReconnectFile() resume the link after a reload
 // without the user re-picking the file every time, as long as the browser still grants permission silently.
 function linkFile(handle){writer.connect(handle);bgStore.putHandle(handle).catch(()=>{});}
 $('#create-file').onclick=async()=>{try{const handle=await window.showSaveFilePicker({suggestedName:'kanbaam.json',types:pickerTypes});linkFile(handle);await writer.enqueue(json());}catch(e){fileFailure(e);}};
 $('#open-file').onclick=async()=>{try{const [handle]=await window.showOpenFilePicker({types:pickerTypes,multiple:false});const next=await readFile(await handle.getFile());if(await replaceWorkspace(next,handle.name))linkFile(handle);}catch(e){fileFailure(e);}};
 $('#retry-file').onclick=()=>writer.retry(json());$('#disconnect-file').onclick=()=>{writer.disconnect();bgStore.deleteHandle().catch(()=>{});};
 let pendingHandle=null;
 async function tryReconnectFile(){
  let handle;try{handle=await bgStore.getHandle();}catch(e){return;}
  if(!handle||typeof handle.queryPermission!=='function')return;
  let permission;try{permission=await handle.queryPermission({mode:'readwrite'});}catch(e){bgStore.deleteHandle().catch(()=>{});return;}
  if(permission==='granted')linkFile(handle);
  else if(permission==='prompt'){pendingHandle=handle;$('#reconnect-file').hidden=false;$('#file-status').textContent='Linked file “'+handle.name+'” needs permission again. Click Reconnect to resume.';}
  else bgStore.deleteHandle().catch(()=>{});
 }
 $('#reconnect-file').onclick=async()=>{
  if(!pendingHandle)return;const handle=pendingHandle;
  try{const permission=await handle.requestPermission({mode:'readwrite'});if(permission==='granted'){pendingHandle=null;$('#reconnect-file').hidden=true;linkFile(handle);}else $('#file-status').textContent='Permission was not granted. Use Open & link file to relink.';}catch(e){fileFailure(e);}
 };
 tryReconnectFile();
 function celebrate(id){if(!animate())return;const card=[...document.querySelectorAll('.task-card')].find(n=>n.dataset.id===id);if(!card)return;const r=card.getBoundingClientRect();if(r.left>innerWidth||r.right<0)return;for(let i=0;i<16;i++){const p=el('i','particle');p.style.left=r.left+r.width/2+'px';p.style.top=r.top+20+'px';document.body.append(p);const angle=Math.PI*2*i/16,reach=40+Math.random()*55;const a=p.animate([{opacity:1,transform:'translate(0,0) rotate(0deg)'},{opacity:0,transform:`translate(${Math.cos(angle)*reach}px,${Math.sin(angle)*reach+35}px) rotate(${i*47}deg)`}],{duration:600+Math.random()*250,easing:'cubic-bezier(.12,.65,.25,1)'});a.onfinish=()=>p.remove();}}
 window.addEventListener('beforeunload',e=>{if(browserError||writer.pending||writer.error){e.preventDefault();e.returnValue='';}});
 function showSplash(){
  const splash=$('#splash');let seen=false;
  try{seen=sessionStorage.getItem('kanbaam.splash.seen')==='true';sessionStorage.setItem('kanbaam.splash.seen','true');}catch{}
  if(seen||!animate()){splash.remove();return;}
  let timer,closing=false;
  const finish=()=>{clearTimeout(timer);splash.close();splash.remove();};
  const dismiss=()=>{if(closing)return;closing=true;clearTimeout(timer);if(!animate()){finish();return;}splash.classList.add('splash-leaving');timer=setTimeout(finish,240);};
  $('#splash-enter').onclick=dismiss;
  splash.addEventListener('cancel',e=>{e.preventDefault();dismiss();});
  splash.showModal();timer=setTimeout(dismiss,1450);
 }
 render();renderNotice();flip(new Map());showSplash();
 window.Kanbaam={getState:()=>structuredClone(state),storageKey:S.KEY};
})();
