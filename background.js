/* Device-local storage: the background image and the linked-file handle both live in IndexedDB, tied to this
   browser profile. Background preferences (mode/dim/blur) live in the workspace instead, so they travel with
   the JSON; only the image bytes and the file handle itself cannot be shared that way. */
(function(root){
 'use strict';
 const DB='kanbaam-assets',STORE='files',IMAGE='background',HANDLE='linked-file-handle',MAX_SIDE=2560,MAX_BYTES=25*1024*1024;
 function open(){return new Promise((resolve,reject)=>{if(!root.indexedDB)return reject(Error('This browser cannot store data.'));const req=root.indexedDB.open(DB,1);req.onupgradeneeded=()=>req.result.createObjectStore(STORE);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Local storage is unavailable.'));});}
 async function run(mode,action){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),req=action(tx.objectStore(STORE));tx.oncomplete=()=>resolve(req.result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Local storage failed.'));});}finally{db.close();}}
 const getImage=()=>run('readonly',s=>s.get(IMAGE));
 const putImage=blob=>run('readwrite',s=>s.put(blob,IMAGE));
 const deleteImage=()=>run('readwrite',s=>s.delete(IMAGE));
 const getHandle=()=>run('readonly',s=>s.get(HANDLE));
 const putHandle=handle=>run('readwrite',s=>s.put(handle,HANDLE));
 const deleteHandle=()=>run('readwrite',s=>s.delete(HANDLE));
 async function prepare(file){
  if(!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type))throw Error('Choose a PNG, JPEG, WebP, GIF or AVIF image.');
  if(file.size>MAX_BYTES)throw Error('Image is too large (25 MB maximum).');
  let bitmap;try{bitmap=await createImageBitmap(file);}catch(e){throw Error('That image could not be read.');}
  const scale=Math.min(1,MAX_SIDE/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('That image could not be processed.')),'image/webp',.9));
 }
 root.KanbaamBackground={getImage,putImage,deleteImage,getHandle,putHandle,deleteHandle,prepare};
})(window);
