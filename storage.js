(function(root){'use strict';
 const KEY='kanbaam.workspace.v1',BACKUP=KEY+'.backup',MAX_BYTES=5*1024*1024;
 function create(storage,model){
  let blocked=false,expected=null,blockedReason='Original browser data is protected. Export your work, then import a valid workspace to recover.';
  const staleMessage='Browser workspace changed in another tab. Saving paused; export your work before reloading.';
  function hasConflict(){return blocked&&blockedReason===staleMessage||storage.getItem(KEY)!==expected;}
  function parse(raw){if(typeof raw!=='string'||raw.length>MAX_BYTES||new TextEncoder().encode(raw).length>MAX_BYTES)throw Error('Workspace is too large (5 MB maximum).');return model.validate(JSON.parse(raw));}
  function serialize(state){const raw=JSON.stringify(model.validate(state));if(new TextEncoder().encode(raw).length>MAX_BYTES)throw Error('Workspace is too large (5 MB maximum).');return raw;}
  function save(state){if(blocked)throw Error(blockedReason);const raw=serialize(state);if(hasConflict()){blocked=true;blockedReason=staleMessage;throw Error(blockedReason);}storage.setItem(KEY,raw);expected=raw;}
  function load(){try{const raw=storage.getItem(KEY);expected=raw;if(raw===null){const state=model.empty();save(state);return {state};}return {state:parse(raw)};}catch(error){blocked=true;return {state:model.empty(),error:'Browser storage could not be loaded. Original data is untouched. '+error.message};}}
  function replace(state){const raw=serialize(state);if(hasConflict())throw Error(staleMessage);const previous=storage.getItem(KEY);if(previous!==expected)throw Error(staleMessage);if(previous!==null)storage.setItem(BACKUP,previous);if(hasConflict())throw Error(staleMessage);storage.setItem(KEY,raw);expected=raw;blocked=false;}
  function pause(){blocked=true;blockedReason=staleMessage;}
  return {load,save,parse,replace,pause,hasConflict};
 }
 function writer(notify=()=>{}){
  let handle=null,chain=Promise.resolve(),error=null,generation=0,pending=0,expected=null,conflict=false;
  const emit=()=>notify({linked:!!handle,name:handle?.name??'',error,pending,conflict});
  function disconnect(){handle=null;generation++;error=null;pending=0;expected=null;conflict=false;emit();}
  function connect(next,baseline=null){disconnect();handle=next;expected=baseline;emit();}
  function enqueue(raw){if(!handle||error)return chain;if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_BYTES){error='Linked file could not be saved: Workspace is too large (5 MB maximum).';emit();return chain;}const target=handle,token=generation;pending++;emit();
   chain=chain.then(async()=>{if(token!==generation)return;let stream;try{if(error)return;if(expected!==null){const current=await (await target.getFile()).text();if(token!==generation)return;if(current!==expected){conflict=true;throw Error('Linked file changed outside Kanbaam. Export your work, then use Open & link file to resolve the conflict.');}}stream=await target.createWritable();if(token!==generation){await stream.abort();return;}await stream.write(raw);if(token!==generation){await stream.abort();return;}await stream.close();if(token===generation)expected=raw;}catch(e){if(token===generation)error='Linked file could not be saved: '+e.message;try{await stream?.abort();}catch(_){/* keep original error */}}finally{if(token===generation){pending--;emit();}}});return chain;
  }
  function retry(raw){if(conflict)return chain;error=null;return enqueue(raw);}
  return {connect,disconnect,enqueue,retry,get error(){return error;},get pending(){return pending;},get linked(){return !!handle;}};
 }
 const api={KEY,BACKUP,MAX_BYTES,create,writer};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KanbaamStorage=api;
})(typeof window!=='undefined'?window:globalThis);
