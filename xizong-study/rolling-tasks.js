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

function convertTimerRecord(state,task,item,node=null){
  state.records=Array.isArray(state.records)?state.records:[];
  const already=state.records.find(r=>r.rollingTaskId===task.id||(node&&r.rollingId===item.id&&Number(r.rollingIndex)===Number(node.index)));
  if(already)return Number(already.minutes)||0;
  const now=Date.now();
  const candidate=[...state.records].reverse().find(r=>r.type==='study'&&!r.rollingId&&r.createdAt&&Math.abs(now-new Date(r.createdAt).getTime())<15000&&(r.subject||'综合')===(task.subject||item.subject||'综合'));
  const note=node?`${item.name} · 第${node.index}轮`:`${item.name} · 额外复习`;
  if(candidate){
    candidate.type='rolling';candidate.subject=item.subject||task.subject||'综合';candidate.note=note;candidate.rollingId=item.id;candidate.rollingIndex=node?Number(node.index):null;candidate.rollingTaskId=task.id;
    return Number(candidate.minutes)||0;
  }
  state.records.push({id:'rollrec-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),date:today(),type:'rolling',subject:item.subject||task.subject||'综合',year:null,total:0,correct:0,minutes:0,note,createdAt:new Date().toISOString(),rollingId:item.id,rollingIndex:node?Number(node.index):null,rollingTaskId:task.id});
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
    }else if(task.done&&!task.rollingExtraRecorded){
      convertTimerRecord(state,task,item,null);task.rollingExtraRecorded=true;changed=true;
    }
  }
  if(changed)write(state);return changed;
}

syncLinkedTasks();syncDueTasks();

function rollingProjects(currentTask=null){
  const state=read(),out=[];if(!state)return out;
  for(const item of state.rollingReviews||[]){
    let node=null;
    if(currentTask?.rollingId===item.id&&currentTask.rollingIndex)node=findNode(item,currentTask.rollingIndex)||null;
    if(!node)node=nextPending(item);
    out.push({item,node});
  }
  return out;
}
function projectLabel(item,node){
  if(node)return `${item.name} · 下一轮第${node.index}轮${node.date?` · ${node.date}`:''}${item.paused?' · 已暂停':''}`;
  return `${item.name} · 已完成全部轮次 · 可额外复习${item.paused?' · 已暂停':''}`;
}
function populateRollingTaskSelect(){
  const sel=$('#tRollingItem');if(!sel)return;const state=read(),editId=$('#taskId')?.value,current=state?.tasks?.find(t=>t.id===editId)||null,choices=rollingProjects(current);
  sel.innerHTML='';
  if(!choices.length){const o=document.createElement('option');o.value='';o.textContent='还没有滚动复习项目';sel.appendChild(o);sel.disabled=true;return}
  sel.disabled=false;for(const {item,node} of choices){const o=document.createElement('option');o.value=item.id;o.textContent=projectLabel(item,node);sel.appendChild(o)}
  if(current?.rollingId&&[...sel.options].some(o=>o.value===current.rollingId))sel.value=current.rollingId;
}
function selectedRolling(){
  const id=$('#tRollingItem')?.value;if(!id)return null;const state=read(),item=findItem(state,id);if(!item)return null;
  const editId=$('#taskId')?.value,current=state?.tasks?.find(t=>t.id===editId)||null;
  let node=current?.rollingId===item.id&&current.rollingIndex?findNode(item,current.rollingIndex):null;
  if(!node)node=nextPending(item);
  return {state,item,node};
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
  if(['toggle','rolling-complete','rolling-skip','rolling-delay','rolling-delete','toggle-rolling-pause'].includes(action)||timer==='direct'||timer==='finish')setTimeout(()=>{const a=syncLinkedTasks(),b=syncDueTasks();if(a||b)location.reload()},40);
});

const taskForm=$('#taskForm');
if(taskForm)taskForm.addEventListener('submit',e=>{
  const type=$('#tType')?.value,editId=$('#taskId')?.value||'',date=$('#tDate')?.value||today();
  if(type!=='rolling'){
    if(editId)setTimeout(()=>{const s=read(),t=s?.tasks?.find(x=>x.id===editId);if(t&&(t.rollingId||t.rollingIndex)){delete t.rollingId;delete t.rollingIndex;delete t.rollingAuto;delete t.rollingExtraRecorded;write(s);location.reload()}},20);
    return;
  }
  const x=selectedRolling();if(!x){e.preventDefault();e.stopImmediatePropagation();alert('请先在“滚动复习”里添加项目');return}
  const name=`滚动复习 · ${x.item.name}`;$('#tName').value=name;
  setTimeout(()=>{
    const s=read();if(!s)return;let t=editId?s.tasks?.find(z=>z.id===editId):null;
    if(!t)t=[...(s.tasks||[])].reverse().find(z=>z.type==='rolling'&&z.date===date&&z.name===name&&!z.rollingId);
    if(!t)return;t.rollingId=x.item.id;t.subject=x.item.subject||'综合';t.rollingAuto=false;t.userCustomized=true;t.rollingExtraRecorded=false;
    if(x.node)t.rollingIndex=Number(x.node.index);else delete t.rollingIndex;
    write(s);location.reload();
  },30);
},true);

const rollingForm=$('#rollingForm');if(rollingForm)rollingForm.addEventListener('submit',()=>setTimeout(()=>{syncDueTasks();populateRollingTaskSelect()},50),true);

function decorate(){
  const state=read();if(!state)return;
  for(const task of state.tasks||[]){
    if(task.type!=='rolling')continue;const row=document.querySelector(`[data-swipe="${CSS.escape(task.id)}"]`),meta=row?.querySelector('.meta');if(!meta)continue;
    const item=findItem(state,task.rollingId),node=findNode(item,task.rollingIndex);const text=`↻ 滚动复习${node?` · 第${node.index}轮`:' · 额外复习'}${item?.subject?` · ${item.subject}`:''}`;if(meta.textContent!==text)meta.textContent=text;
  }
  document.querySelectorAll('.section h2').forEach(h=>{if(h.textContent.trim()==='今日滚动复习'){const sec=h.closest('.section'),card=sec?.nextElementSibling;if(card?.classList.contains('rolling-alert'))card.remove();sec?.remove()}});
}
const observer=new MutationObserver(()=>decorate());observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(decorate,0);
})();