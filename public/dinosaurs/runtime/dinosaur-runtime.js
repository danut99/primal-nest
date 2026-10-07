const runtimeLoads=new Map();
function ensureRuntime(base){
 if(window.DragonPackSpine)return Promise.resolve(window.DragonPackSpine);
 const url=new URL(base+'/runtime/spine-player.js',document.baseURI).href;
 if(!runtimeLoads.has(url)){const promise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=url;script.async=true;script.onload=()=>window.DragonPackSpine?resolve(window.DragonPackSpine):reject(new Error('Runtime Spine indisponibil.'));script.onerror=()=>{script.remove();reject(new Error('Runtime-ul nu se poate încărca.'));};document.head.append(script);});runtimeLoads.set(url,promise);promise.catch(()=>runtimeLoads.delete(url));}return runtimeLoads.get(url);
}
export async function createDinosaurPlayer(host,{baseUrl='/dinosaurs',model='astravor',animation='idle',loop,speed=1,paused=false,bones=false,bonesOnly=false,backgroundColor='#00000000',signal,onReady,onError}={}){
 const base=baseUrl.replace(/\/+$/,''),[catalog,spine]=await Promise.all([fetch(base+'/manifest.json',{signal}).then(r=>{if(!r.ok)throw new Error('Catalogul nu se poate încărca.');return r.json();}),ensureRuntime(base)]);
 if(signal?.aborted)return null;const entry=catalog.models.find(m=>m.id===model);if(!entry)throw new Error('Dinozaur necunoscut: '+model);
 const names=entry.animations.map(a=>a.name);let current=names.includes(animation)?animation:names[0],raw=null,disposed=false;const element=document.createElement('div');element.className='dinosaur-spine-host';host.append(element);
 const isLooping=()=>loop??entry.animations.find(a=>a.name===current)?.loop??true;
 const bounds=()=>entry.animationBounds?.[current]||entry.bounds;
 const player={model:entry,get raw(){return raw;},get loaded(){return !!raw?.loaded&&!disposed;},get canvas(){return raw?.canvas;},get animation(){return current;},get looping(){return isLooping();},
  setAnimation(name){if(!names.includes(name))throw new Error('Animație necunoscută: '+name);current=name;if(raw?.loaded){Object.assign(raw.config.viewport,bounds());raw.setAnimation(name,isLooping());if(paused)raw.drawFrame(false);}},
  setLoop(value){loop=value;if(raw?.loaded){const track=raw.animationState.getCurrent(0),next=isLooping();if(track.loop&&!next)track.trackTime%=track.animation.duration;track.loop=next;}},
  setPaused(value){paused=!!value;if(raw?.loaded){paused?raw.pause():raw.play();}},setSpeed(value){if(!Number.isFinite(value)||value<0)throw new Error('Viteză invalidă.');speed=value;if(raw)raw.speed=value;},
  setBones(value,only=false){bones=!!value;bonesOnly=!!only;if(raw?.loaded){raw.config.debug.bones=bones||bonesOnly;raw.skeleton.color.a=bonesOnly?0:1;raw.drawFrame(false);}},
  seek(time){if(!raw?.loaded)return;player.setPaused(true);const track=raw.animationState.getCurrent(0);track.trackTime=Math.max(0,Math.min(track.animation.duration-.0001,time));track.mixDuration=0;raw.skeleton.setToSetupPose();raw.animationState.apply(raw.skeleton);raw.skeleton.updateWorldTransform();raw.viewportTransitionStart=performance.now()-10000;raw.drawFrame(false);},
  snapshot(){if(!raw?.loaded)throw new Error('Dinozaurul se încarcă.');raw.drawFrame(false);return new Promise(resolve=>raw.canvas.toBlob(resolve));},
  dispose(){if(disposed)return;disposed=true;signal?.removeEventListener('abort',abort);raw?.dispose();element.remove();}
 };function abort(){player.dispose();}signal?.addEventListener('abort',abort,{once:true});
 raw=new spine.SpinePlayer(element,{jsonUrl:base+'/'+entry.skeleton,atlasUrl:base+'/'+entry.atlas,animation:current,premultipliedAlpha:false,showControls:false,backgroundColor,alpha:backgroundColor.length===9,debug:{bones:bones||bonesOnly},viewport:{...bounds(),padLeft:'2%',padRight:'2%',padTop:'2%',padBottom:'2%'},success:ready=>{raw=ready;if(disposed||signal?.aborted){ready.dispose();return;}raw.speed=speed;raw.skeleton.color.a=bonesOnly?0:1;raw.setAnimation(current,isLooping());if(paused)raw.pause();queueMicrotask(()=>{if(!disposed&&!signal?.aborted)onReady?.(player);});},error:(_,message)=>{if(disposed)return;player.dispose();onError?.(new Error(String(message)));}});
 if(signal?.aborted)player.dispose();return player;
}
