(()=>{
'use strict';
/*
 * Performance bridge for legacy enhancement scripts.
 * The app used several subtree MutationObservers that could trigger each other
 * after DOM decoration. Replace them with event-driven pulses so enhancement
 * callbacks run only after real user/app actions instead of continuously.
 */
const observers=new Set();
let pulseTimer=0;
class EventDrivenMutationObserver{
  constructor(callback){this.callback=callback;this.active=false}
  observe(){this.active=true;observers.add(this)}
  disconnect(){this.active=false;observers.delete(this)}
  takeRecords(){return []}
}
window.MutationObserver=EventDrivenMutationObserver;

function runObservers(){
  pulseTimer=0;
  for(const observer of [...observers]){
    if(!observer.active)continue;
    try{observer.callback([],observer)}catch(err){console.error('enhancement refresh failed',err)}
  }
}
function pulse(delay=36){
  clearTimeout(pulseTimer);
  pulseTimer=setTimeout(()=>requestAnimationFrame(runObservers),delay);
}
window.__xizongPulse=pulse;

// App renders synchronously in its event handlers. A short deferred pulse lets
// the base render finish first, then runs every legacy decorator exactly once.
for(const type of ['click','submit','change']){
  document.addEventListener(type,()=>pulse(type==='submit'?90:48),true);
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pulse(30)});
window.addEventListener('pageshow',()=>pulse(20));
window.addEventListener('online',()=>pulse(30));
window.addEventListener('offline',()=>pulse(30));

// Avoid 500ms full-page timer enhancement scans on mobile. Existing 1s app
// timer ticks stay unchanged; only sub-second enhancement polling is raised.
const nativeSetInterval=window.setInterval.bind(window);
window.setInterval=(fn,delay,...args)=>nativeSetInterval(fn,Number(delay)>0&&Number(delay)<1000?1000:delay,...args);
})();
