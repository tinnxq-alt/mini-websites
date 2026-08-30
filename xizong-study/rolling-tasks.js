(()=>{
'use strict';
const STORE_KEY='xizong-study-v11',DB_NAME='xizong-study-v11-db';
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const read=()=>{try{return JSON.parse(localStorage.getItem(STORE_KEY)||'null')}catch{return null}};
function mirror(state){try{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('state'))r.result.createObjectStore('state')};r.onsuccess=()=>{const tx=r.result.transaction('state','readwrite');tx.objectStore('state').put(JSON.parse(JSON.stringify(state)),'main')}}catch{}}
function write(state){localStorage.setItem(STORE_KEY,JSON.stringify(state));mirror(state)}
function findItem(state,id){return (state.rollingReviews||[]).find(r=>r.id===id)}
function findNode(item,index){return item?.nodes?.find(n=>Number(n.index)===Number(index))}
function taskKey(id,index){return `${id}:${Number(index)}`}
function uid(prefix='rolltask'){return `${prefix}-`+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}

function addInitialTask(state,item){
  state.tasks=Array.isArray(state.tasks)?state.tasks:[];
  if(state.tasks.some(t=>t.type==='rolling'&&t.rollingId===item.id&&t.rollingInitial))return false;
  state.tasks.push({
    id:uid(),date:today(),type:'rolling',name:`滚动复习 · ${item.name}`,
    subject:item.subject||'综合',done:false,auto:false,rollingAuto:false,
    rollingInitial:true,rollingId:item.id,order:70
  });
  return true;
}

function syncNewRollingProjectTasks(beforeIds){
  const state=read();if(!state||!Array.isArray(state.rollingReviews))return false;
  const known=new Set(beforeIds||[]);let changed=false;
  for(const item of state.rollingReviews){if(!known.has(item.id))changed=addInitialTask(state,item)||changed}
  if(changed)write(state);return changed;
}

function syncDueTasks(){
  const state=read();if(!state||!Array.isArray(state.rollingReviews))return false;
  state.tasks=Array.isArray(state.tasks)?state.tasks:[];const ds=today();let changed=false;
  const existing=new Set(state.tasks.filter(t=>t.type==='rolling'&&t.rollingId&&t.rollingIndex).map(t=>taskKey(t.rollingId,t.rollingIndex)));
  for(const item of state.rollingReviews){
    if(item.paused||!Array.isArray(item.nodes))continue;
    for(const node of item.nodes){
      if(node.status!=='pending'||!node.date||node.date>ds)continue;
      const key=taskKey(item.id,node.index);if(existing.has(key))continue;
      state.tasks.push({id:uid(),date:ds,type:'rolling',name:`滚动复习 · ${item.name}`,subject:item.subject||'综合',done:false,auto:false,rollingAuto:true,rollingId:item.id,rollingIndex:Number(node.index),order:80});
      existing.add(key);changed=true;
    }
  }
  if(changed)write(state);return changed;
}

function convertTimerRecord(state,task,item,node=null){
  state.records=Array.isArray(state.records)?state.records:[];
  const already=state.records.find(r=>r.rollingTaskId===task.id||(node&&r.rollingId===item.id&&Number(r.rollingIndex)===Number(node.index)));
  if(already)return Number(already.minutes)||0;
  const now=Date.now();
  const candidate=[...state.records].reverse().find(r=>r.type==='study'&&!r.rollingId&&r.createdAt&&Math.abs(now-new Date(r.createdAt).getTime())<15000&&(r.subject||'综合')===(task.subject||item.subject||'综合'));
  const note=node?`${item.name} · 第${node.index}轮`:task.rollingInitial?`${item.name} · 加入滚动`:`${item.name} · 额外复习`;
  if(candidate){
    candidate.type='rolling';candidate.subject=item.subject||task.subject||'综合';candidate.note=note;candidate.rollingId=item.id;candidate.rollingIndex=node?Number(node.index):null;candidate.rollingTaskId=task.id;
    return Number(candidate.minutes)||0;
  }
  state.records.push({id:uid('rollrec'),date:today(),type:'rolling',subject:item.subject||task.subject||'综合',year:null,total:0,correct:0,minutes:0,note,createdAt:new Date().toISOString(),rollingId:item.id,rollingIndex:node?Number(node.index):null,rollingTaskId:task.id});
  return 0;
}

function syncLinkedTasks(){
  const state=read();if(!state)return false;state.tasks=Array.isArray(state.tasks)?state.tasks:[];let changed=false;
  for(let i=state.tasks.length-1;i>=0;i--){
    const task=state.tasks[i];if(task.type!=='rolling'||!task.rollingId)continue;
    const item=findItem(state,task.rollingId);
    if(!item){if(!task.done){state.tasks.splice(i,1);changed=true}continue}
    const node=task.rollingIndex?findNode(item,task.rollingIndex):null;
    if(task.rollingIndex&&!node)continue;
    if(node){
      if(task.done&&node.status==='pending'){
        const minutes=convertTimerRecord(state,task,item,node);node.status='done';node.completedAt=new Date().toISOString();node.minutes=minutes;changed=true;
      }else if(node.status!=='pending'&&!task.done){task.done=true;changed=true}
      if(task.rollingAuto&&!task.done&&node.status==='pending'){
        const wanted=node.date&&node.date>today()?node.date:today();if(task.date!==wanted){task.date=wanted;changed=true}
      }
    }else if(task.done&&!task.rollingRecordSynced){
      convertTimerRecord(state,task,item,null);task.rollingRecordSynced=true;changed=true;
    }
  }
  if(changed)write(state);return changed;
}

syncLinkedTasks();syncDueTasks();

const rollingForm=document.querySelector('#rollingForm');
if(rollingForm)rollingForm.addEventListener('submit',()=>{
  const before=(read()?.rollingReviews||[]).map(r=>r.id);
  setTimeout(()=>{
    const a=syncNewRollingProjectTasks(before),b=syncDueTasks();
    if(a||b)location.reload();
  },80);
},true);

document.addEventListener('click',e=>{
  const action=e.target.closest('[data-a]')?.dataset.a,timer=e.target.closest('[data-timer]')?.dataset.timer;
  if(action==='edit-task'){
    const row=e.target.closest('[data-swipe]'),id=row?.dataset.swipe,state=read(),task=state?.tasks?.find(t=>t.id===id);
    if(task?.type==='rolling'){
      e.preventDefault();e.stopImmediatePropagation();alert('滚动复习任务由“滚动复习”页面自动管理');return;
    }
  }
  if(['toggle','rolling-complete','rolling-skip','rolling-delay','rolling-delete','toggle-rolling-pause'].includes(action)||timer==='direct'||timer==='finish'){
    setTimeout(()=>{const a=syncLinkedTasks(),b=syncDueTasks();if(a||b)location.reload()},40);
  }
},true);

function decorate(){
  const state=read();if(!state)return;
  for(const task of state.tasks||[]){
    if(task.type!=='rolling')continue;
    const row=document.querySelector(`[data-swipe="${CSS.escape(task.id)}"]`),meta=row?.querySelector('.meta');
    if(!meta)continue;
    const item=findItem(state,task.rollingId),node=findNode(item,task.rollingIndex);
    const phase=node?`第${node.index}轮`:task.rollingInitial?'加入滚动':'额外复习';
    const text=`↻ 滚动复习 · ${phase}${item?.subject?` · ${item.subject}`:''}`;
    if(meta.textContent!==text)meta.textContent=text;
  }
  document.querySelectorAll('.section h2').forEach(h=>{
    if(h.textContent.trim()==='今日滚动复习'){
      const sec=h.closest('.section'),card=sec?.nextElementSibling;
      if(card?.classList.contains('rolling-alert'))card.remove();sec?.remove();
    }
  });
}
const observer=new MutationObserver(()=>decorate());observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(decorate,0);
})();
