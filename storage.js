(function(root){'use strict';
 const KEY='kanbaam.workspace.v1',BACKUP=KEY+'.backup',MAX_BYTES=5*1024*1024;
 function create(storage,model){
  let blocked=false;
  function parse(raw){if(typeof raw!=='string'||raw.length>MAX_BYTES)throw Error('Workspace is too large (5 MB maximum).');return model.validate(JSON.parse(raw));}
  function serialize(state){const raw=JSON.stringify(model.validate(state));if(new TextEncoder().encode(raw).length>MAX_BYTES)throw Error('Workspace is too large (5 MB maximum).');return raw;}
  function save(state){if(blocked)throw Error('Original browser data is protected. Export your work, then import a valid workspace to recover.');storage.setItem(KEY,serialize(state));}
  function load(){try{const raw=storage.getItem(KEY);if(raw===null){const state=model.empty();save(state);return {state};}return {state:parse(raw)};}catch(error){blocked=true;return {state:model.empty(),error:'Browser storage could not be loaded. Original data is untouched. '+error.message};}}
  function replace(state){const raw=serialize(state);const previous=storage.getItem(KEY);if(previous!==null)storage.setItem(BACKUP,previous);storage.setItem(KEY,raw);blocked=false;}
  return {load,save,parse,replace};
 }
 function writer(notify=()=>{}){
  let handle=null,chain=Promise.resolve(),error=null,generation=0,pending=0;
  const emit=()=>notify({linked:!!handle,name:handle?.name??'',error,pending});
  function disconnect(){handle=null;generation++;error=null;pending=0;emit();}
  function connect(next){disconnect();handle=next;emit();}
  function enqueue(raw){if(!handle||error)return chain;const target=handle,token=generation;pending++;emit();
   chain=chain.then(async()=>{if(token!==generation)return;let stream;try{if(error)return;stream=await target.createWritable();if(token!==generation){await stream.abort();return;}await stream.write(raw);if(token!==generation){await stream.abort();return;}await stream.close();}catch(e){if(token===generation)error='Linked file could not be saved: '+e.message;try{await stream?.abort();}catch(_){/* keep original error */}}finally{if(token===generation){pending--;emit();}}});return chain;
  }
  function retry(raw){error=null;return enqueue(raw);}
  return {connect,disconnect,enqueue,retry,get error(){return error;},get pending(){return pending;},get linked(){return !!handle;}};
 }
 const api={KEY,BACKUP,MAX_BYTES,create,writer};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KanbaamStorage=api;
})(typeof window!=='undefined'?window:globalThis);
