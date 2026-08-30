(()=>{
'use strict';
const STORE_KEY='xizong-study-v11',DB_NAME='xizong-study-v11-db';
const $=s=>document.querySelector(s),pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const read=()=>{try{return JSON.parse(localStorage.getItem(STORE_KEY)||'null')}catch{return null}};
function mirror(state){try{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('state'))r.result.createObjectStore('state')};r.onsuccess=()=>{const tx=r.result.transaction('state','readwrite');tx.objectStore('state').put(JSON.parse(JSON.stringify(state)),'main')}}catch{}}
function write(state){localStorage.setItem(STORE_KEY,JSON.stringify(state));mirror(state)}
function findItem(state,id){return (state.rollingReviews||[]).find(r=>r.id===id)}
function findNode(item,index){return item?.nodes?.find(n=>Number(n.index)===Number(index))}
function nextPending(item){return item?.nodes?.find(n=>n.status==='pending')||null}
function taskKey(id,index){return `${id}:${Number(index)}`}
function uid(){return 'rolltask-'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}

function syncDueTasks(){
  const state=read();if(!state||!Array.isArray(state.rollingReviews))return false;
  state.tasks=Array.isArray(state.tasks)?state.tasks:[];const ds=today();let changed=false;
  const existing=new Set(state.tasks.filter(t=>t.type==='rolling'&&t.rollingId&&t.rollingIndex).map(t=>taskKey(t.rollingId,t.rollingIndex)));
  for(const item of state.rollingReviews){
    if(item.paused||!Array.isArray(item.nodes))continue;
    for(const node of item.nodes){
      if(node.status!=='pending'||!node.date||node.date>ds)continue;
      const key=taskKey(item.id,node.index);if(existing.has(key))continue;
      state.tasks.push({id:uid(),date:ds,type:'rolling',name:`滚动复习 · ${item.name}`,subject:item.subject||'综合',done:false,auto:false,rollingAuto:true,userCustomized:false,rollingId:item.id,rollingIndex:Number(node.index),order:80});
      existing.add(key);changed=true;
    }
  }
  if(changed)write(state);return changed;
}

function convertTimerRecord(state,task,item,node){
  state.records=Array.isArray(state.records)?state.records:[];
  const already=state.records.find(r=>r.rollingTaskId===task.id||((r.rollingId===item.id)&&Number(r.rollingIndex)===Number(node.index)));
  if(already)return Number(already.minutes)||0;
  const now=Date.now();
  const candidate=[...state.records].reverse().find(r=>r.type==='study'&&!r.rollingId&&r.createdAt&&Math.abs(now-new Date(r.createdAt).getTime())<15000&&(r.subject||'综合')===(task.subject||item.subject||'综合'));
  if(candidate){
    candidate.type='rolling';candidate.subject=item.subject||task.subject||'综合';candidate.note=`${item.name} · 第${node.index}轮`;candidate.rollingId=item.id;candidate.rollingIndex=Number(node.index);candidate.rollingTaskId=task.id;
    return Number(candidate.minutes)||0;
  }
  state.records.push({id:'rollrec-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),date:today(),type:'rolling',subject:item.subject||task.subject||'综合',year:null,total:0,correct:0,minutes:0,note:`${item.name} · 第${node.index}轮`,createdAt:new Date().toISOString(),rollingId:item.id,rollingIndex:Number(node.index),rollingTaskId:task.id});
  return 0;
}

function syncLinkedTasks(){
  const state=read();if(!state)return false;state.tasks=Array.isArray(state.tasks)?state.tasks:[];let changed=false;
  for(let i=state.tasks.length-1;i>=0;i--){
    const task=state.tasks[i];if(task.type!=='rolling'||!task.rollingId||!task.rollingIndex)continue;
    const item=findItem(state,task.rollingId);
    if(!item){if(!task.done){state.tasks.splice(i,1);changed=true}continue}
    const node=findNode(item,task.rollingIndex);if(!node)continue;
    if(task.done&&node.status==='pending'){
      const minutes=convertTimerRecord(state,task,item,node);node.status='done';node.completedAt=new Date().toISOString();node.minutes=minutes;changed=true;
    }else if(node.status!=='pending'&&!task.done){task.done=true;changed=true}
    if(task.rollingAuto&&!task.done&&node.status==='pending'){
      const wanted=node.date&&node.date>today()?node.date:today();if(task.date!==wanted){task.date=wanted;changed=true}
    }
  }
  if(changed)write(state);return changed;
}

syncLinkedTasks();syncDueTasks();

function rollingChoices(currentTask=null){
  const state=read(),out=[];if(!state)return out;
  for(const item of state.rollingReviews||[]){
    if(item.paused)continue;
    let node=nextPending(item);
    if(currentTask?.rollingId===item.id){node=findNode(item,currentTask.rollingIndex)||node}
    if(node)out.push({item,node});
  }
  return out;
}
function populateRollingTaskSelect(){
  const sel=$('#tRollingItem');if(!sel)return;const state=read(),editId=$('#taskId')?.value,current=state?.tasks?.find(t=>t.id===editId)||null,choices=rollingChoices(current);
  sel.innerHTML='';
  if(!choices.length){const o=document.createElement('option');o.value='';o.textContent='暂无可复习的滚动项目';sel.appendChild(o);sel.disabled=true;return}
  sel.disabled=false;for(const {item,node} of choices){const o=document.createElement('option');o.value=`${item.id}:${node.index}`;o.textContent=`${item.name} · 第${node.index}轮${node.date?` · ${node.date}`:''}`;sel.appendChild(o)}
  if(current?.rollingId&&current?.rollingIndex){const v=`${current.rollingId}:${current.rollingIndex}`;if([...sel.options].some(o=>o.value===v))sel.value=v}
}
function selectedRolling(){
  const v=$('#tRollingItem')?.value;if(!v)return null;const cut=v.lastIndexOf(':'),id=v.slice(0,cut),index=Number(v.slice(cut+1)),state=read(),item=findItem(state,id),node=findNode(item,index);return item&&node?{state,item,node}:null;
}
function syncTaskDialog(){
  const rolling=$('#tType')?.value==='rolling',box=$('#rollingTaskFields');box?.classList.toggle('hidden',!rolling);
  if(!rolling)return;populateRollingTaskSelect();const x=selectedRolling();if(x&&$('#tName'))$('#tName').value=`滚动复习 · ${x.item.name}`;
}
function scheduleDialogSync(){setTimeout(syncTaskDialog,0)}

document.addEventListener('change',e=>{
  if(e.target.id==='tType')syncTaskDialog();
  if(e.target.id==='tRollingItem'){const x=selectedRolling();if(x&&$('#tName'))$('#tName').value=`滚动复习 · ${x.item.name}`}
});
document.addEventListener('click',e=>{
  const action=e.target.closest('[data-a]')?.dataset.a,timer=e.target.closest('[data-timer]')?.dataset.timer;
  if(action==='add-task'||action==='edit-task')scheduleDialogSync();
  if(['toggle','rolling-complete','rolling-skip','rolling-delay','rolling-delete'].includes(action)||timer==='direct'||timer==='finish')setTimeout(()=>{const a=syncLinkedTasks(),b=syncDueTasks();if(a||b)location.reload()},40);
});

const taskForm=$('#taskForm');
if(taskForm)taskForm.addEventListener('submit',e=>{
  const type=$('#tType')?.value,editId=$('#taskId')?.value||'',date=$('#tDate')?.value||today();
  if(type!=='rolling'){
    if(editId)setTimeout(()=>{const s=read(),t=s?.tasks?.find(x=>x.id===editId);if(t&&(t.rollingId||t.rollingIndex)){delete t.rollingId;delete t.rollingIndex;delete t.rollingAuto;write(s);location.reload()}},20);
    return;
  }
  const x=selectedRolling();if(!x){e.preventDefault();e.stopImmediatePropagation();alert('请先选择一个滚动复习项目');return}
  const dup=(x.state.tasks||[]).find(t=>t.type==='rolling'&&!t.done&&t.id!==editId&&t.rollingId===x.item.id&&Number(t.rollingIndex)===Number(x.node.index));
  if(dup){e.preventDefault();e.stopImmediatePropagation();alert('这个滚动复习轮次已经安排在任务中了');return}
  const name=`滚动复习 · ${x.item.name}`;$('#tName').value=name;
  setTimeout(()=>{
    const s=read();if(!s)return;let t=editId?s.tasks?.find(z=>z.id===editId):null;
    if(!t)t=[...(s.tasks||[])].reverse().find(z=>z.type==='rolling'&&z.date===date&&z.name===name&&!z.rollingId);
    if(!t)return;t.rollingId=x.item.id;t.rollingIndex=Number(x.node.index);t.subject=x.item.subject||'综合';t.rollingAuto=false;t.userCustomized=true;write(s);location.reload();
  },30);
},true);

const rollingForm=$('#rollingForm');if(rollingForm)rollingForm.addEventListener('submit',()=>setTimeout(()=>{if(syncDueTasks())location.reload()},50),true);

function decorate(){
  const state=read();if(!state)return;
  for(const task of state.tasks||[]){
    if(task.type!=='rolling')continue;const row=document.querySelector(`[data-swipe="${CSS.escape(task.id)}"]`),meta=row?.querySelector('.meta');if(!meta)continue;
    const item=findItem(state,task.rollingId),node=findNode(item,task.rollingIndex);const text=`↻ 滚动复习${node?` · 第${node.index}轮`:''}${item?.subject?` · ${item.subject}`:''}`;if(meta.textContent!==text)meta.textContent=text;
  }
  document.querySelectorAll('.section h2').forEach(h=>{if(h.textContent.trim()==='今日滚动复习'){const sec=h.closest('.section'),card=sec?.nextElementSibling;if(card?.classList.contains('rolling-alert'))card.remove();sec?.remove()}});
}
const observer=new MutationObserver(()=>decorate());observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(decorate,0);
})();