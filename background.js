/* Custom backgrounds stay on this device: the image lives in IndexedDB, preferences in localStorage, neither in the workspace export. */
(function(root){
 'use strict';
 const DB='kanbaam-assets',STORE='files',IMAGE='background',PREFS='kanbaam.background.v1',MAX_SIDE=2560,MAX_BYTES=25*1024*1024;
 const defaults={custom:false,dim:0,blur:0};
 function clamp(value,min,max,fallback){return Number.isFinite(value)?Math.min(max,Math.max(min,Math.round(value))):fallback;}
 function loadPrefs(storage){try{const p=JSON.parse(storage.getItem(PREFS)||'{}');return {custom:p.custom===true,dim:clamp(p.dim,0,80,0),blur:clamp(p.blur,0,30,0)};}catch(e){return {...defaults};}}
 function savePrefs(storage,prefs){try{storage.setItem(PREFS,JSON.stringify(prefs));return true;}catch(e){return false;}}
 function open(){return new Promise((resolve,reject)=>{if(!root.indexedDB)return reject(Error('This browser cannot store images.'));const req=root.indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Image storage is unavailable.'));});}
 async function run(mode,action){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),req=action(tx.objectStore(STORE));tx.oncomplete=()=>resolve(req.result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Image storage failed.'));});}finally{db.close();}}
 const getImage=()=>run('readonly',s=>s.get(IMAGE));
 const putImage=blob=>run('readwrite',s=>s.put(blob,IMAGE));
 const deleteImage=()=>run('readwrite',s=>s.delete(IMAGE));
 async function prepare(file){
  if(!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type))throw Error('Choose a PNG, JPEG, WebP, GIF or AVIF image.');
  if(file.size>MAX_BYTES)throw Error('Image is too large (25 MB maximum).');
  let bitmap;try{bitmap=await createImageBitmap(file);}catch(e){throw Error('That image could not be read.');}
  const scale=Math.min(1,MAX_SIDE/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('That image could not be processed.')),'image/webp',.9));
 }
 root.KanbaamBackground={loadPrefs,savePrefs,getImage,putImage,deleteImage,prepare};
})(window);
