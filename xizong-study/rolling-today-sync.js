(()=>{
'use strict';
const STORE_KEY='xizong-study-v11',DB_NAME='xizong-study-v11-db';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const parse=s=>{const [y,m,d]=String(s||today()).split('-').map(Number);return new Date(y,m-1,d,12)};
const dayDiff=(a,b)=>Math.round((parse(b)-parse(a))/86400000);
const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=()=>{try{return JSON.parse(localStorage.getItem(STORE_KEY)||'null')}catch{return null}};
function mirror(state){try{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('state'))r.result.createObjectStore('state')};r.onsuccess=()=>{const tx=r.result.transaction('state','readwrite');tx.objectStore('state').put(JSON.parse(JSON.stringify(state)),'main')}}catch{}}
function write(state){localStorage.setItem(STORE_KEY,JSON.stringify(state));mirror(state)}
function findItem(state,id){return (state?.rollingReviews||[]).find(r=>r.id===id)}
function initialTasks(state){return (state?.tasks||[]).filter(t=>t.type==='rolling'&&t.rollingInitial&&!t.done&&t.date<=today()&&findItem(state,t.rollingId)&&!findItem(state,t.rollingId)?.paused)}
function dueCounts(state){let todayCount=0,overdue=0;for(const item of (state?.rollingReviews||[])){if(item.paused)continue;for(const node of item.nodes||[]){if(node.status!=='pending'||!node.date||node.date>today())continue;if(node.date===today())todayCount++;else overdue++}}for(const t of initialTasks(state)){if(t.date===today())todayCount++;else overdue++}return {todayCount,overdue}}
function initialRow(state,t){const item=findItem(state,t.rollingId);if(!item)return '';const late=Math.max(0,dayDiff(t.date,today())),status=late?`逾期${late}天`:'今日到期',cls=late?'overdue':'today';return `<div class="ux-due-row ux-initial-due" data-initial-task="${esc(t.id)}"><div class="ux-grow"><b>${esc(item.name)}</b><div class="small muted">${esc(item.subject||'综合')} · 当天学习 · 加入滚动</div></div><span class="ux-status ${cls}">${status}</span><div class="ux-inline-actions"><button data-initial-complete="${esc(t.id)}">完成</button></div></div>`}
function decorateRolling(){
  const nav=$('#nav [data-view="rolling"].active'),view=$('#view');if(!nav||!view)return;const state=read();if(!state)return;
  const card=view.querySelector('.ux-due-card');if(!card)return;
  card.querySelectorAll('.ux-initial-due').forEach(x=>x.remove());
  const initials=initialTasks(state);if(initials.length){const holder=document.createElement('div');holder.className='ux-initial-holder';holder.innerHTML=initials.map(t=>initialRow(state,t)).join('');const batch=card.querySelector('.ux-batch');if(batch)batch.after(holder);else card.prepend(holder)}
  const counts=dueCounts(state),stats=view.querySelectorAll('.ux-stats4 .stat');if(stats[0])stats[0].querySelector('b').textContent=counts.todayCount;if(stats[1])stats[1].querySelector('b').textContent=counts.overdue;
  const empty=card.querySelector('.empty');if(empty&&initials.length)empty.remove();
}
function decorateToday(){
  const nav=$('#nav [data-view="today"].active');if(!nav)return;const state=read();if(!state)return;
  for(const t of initialTasks(state)){
    const row=document.querySelector(`[data-swipe="${CSS.escape(t.id)}"]`),badge=row?.querySelector('.ux-task-status');if(badge){const late=Math.max(0,dayDiff(t.date,today()));badge.textContent=late?`逾期${late}天`:'今日到期';badge.classList.toggle('overdue',late>0);badge.classList.toggle('today',late===0)}
  }
}
function completeInitial(taskId){const state=read();if(!state)return;const t=(state.tasks||[]).find(x=>x.id===taskId&&x.type==='rolling'&&x.rollingInitial);if(!t)return;t.done=true;write(state);location.reload()}
document.addEventListener('click',e=>{const b=e.target.closest('[data-initial-complete]');if(!b)return;e.preventDefault();e.stopPropagation();completeInitial(b.dataset.initialComplete)},true);
function decorate(){decorateRolling();decorateToday()}
const observer=new MutationObserver(()=>decorate());observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(decorate,0);
})();
