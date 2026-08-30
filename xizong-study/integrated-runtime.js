(()=>{
'use strict';
const STORE_KEY='xizong-study-v11',DB_NAME='xizong-study-v11-db',CUSTOM='__custom__';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const parse=s=>{const [y,m,d]=String(s||today()).split('-').map(Number);return new Date(y,m-1,d,12)};
const add=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+Number(n||0));return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const dayDiff=(a,b)=>Math.round((parse(b)-parse(a))/86400000);
const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=(p='ux')=>`${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
function read(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||'null')}catch{return null}}
function mirror(state){try{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('state'))r.result.createObjectStore('state')};r.onsuccess=()=>{const tx=r.result.transaction('state','readwrite');tx.objectStore('state').put(JSON.parse(JSON.stringify(state)),'main')}}catch{}}
function write(state){localStorage.setItem(STORE_KEY,JSON.stringify(state));mirror(state)}
function commitState(state,renderBase=true){write(state);window.__xizongSyncState?.(state);if(renderBase)window.__xizongRender?.();refresh(0)}
function findItem(state,id){return (state?.rollingReviews||[]).find(r=>r.id===id)}
function findNode(item,index){return item?.nodes?.find(n=>Number(n.index)===Number(index))}
function taskKey(id,index){return `${id}:${Number(index)}`}
function toast(msg){let el=$('#uxToast');if(!el){el=document.createElement('div');el.id='uxToast';el.className='ux-toast';document.body.appendChild(el)}el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200)}

/* ---------- single state synchronization layer ---------- */
function convertTimerRecord(state,task,item,node=null){
  state.records=Array.isArray(state.records)?state.records:[];
  const existing=state.records.find(r=>r.rollingTaskId===task.id||(node&&r.rollingId===item.id&&Number(r.rollingIndex)===Number(node.index)));
  if(existing)return Number(existing.minutes)||0;
  const now=Date.now();
  const candidate=[...state.records].reverse().find(r=>r.type==='study'&&!r.rollingId&&r.createdAt&&Math.abs(now-new Date(r.createdAt).getTime())<20000&&(r.subject||'综合')===(task.subject||item.subject||'综合'));
  const note=node?`${item.name} · 第${node.index}轮`:task.rollingInitial?`${item.name} · 加入滚动`:`${item.name} · 滚动复习`;
  if(candidate){candidate.type='rolling';candidate.subject=item.subject||task.subject||'综合';candidate.note=note;candidate.rollingId=item.id;candidate.rollingIndex=node?Number(node.index):null;candidate.rollingTaskId=task.id;return Number(candidate.minutes)||0}
  state.records.push({id:uid('rollrec'),date:today(),type:'rolling',subject:item.subject||task.subject||'综合',year:null,total:0,correct:0,minutes:0,note,createdAt:new Date().toISOString(),rollingId:item.id,rollingIndex:node?Number(node.index):null,rollingTaskId:task.id});
  return 0;
}
function syncLinkedTasks(state){
  if(!state)return false;state.tasks=Array.isArray(state.tasks)?state.tasks:[];let changed=false;
  for(let i=state.tasks.length-1;i>=0;i--){
    const task=state.tasks[i];if(task.type!=='rolling'||!task.rollingId)continue;
    const item=findItem(state,task.rollingId);
    if(!item){if(!task.done){state.tasks.splice(i,1);changed=true}continue}
    if(item.paused&&!task.done){state.tasks.splice(i,1);changed=true;continue}
    const node=task.rollingIndex?findNode(item,task.rollingIndex):null;
    if(task.rollingIndex&&!node)continue;
    if(node){
      if(task.done&&node.status==='pending'){const minutes=convertTimerRecord(state,task,item,node);node.status='done';node.completedAt=new Date().toISOString();node.minutes=minutes;changed=true}
      else if(node.status!=='pending'&&!task.done){task.done=true;changed=true}
      if(task.rollingAuto&&!task.done&&node.status==='pending'){const wanted=node.date&&node.date>today()?node.date:today();if(task.date!==wanted){task.date=wanted;changed=true}}
    }else if(task.done&&!task.rollingRecordSynced){convertTimerRecord(state,task,item,null);task.rollingRecordSynced=true;changed=true}
  }
  return changed;
}
function ensureInitialTasks(state){
  if(!state||!Array.isArray(state.rollingReviews))return false;state.tasks=Array.isArray(state.tasks)?state.tasks:[];let changed=false;
  for(const item of state.rollingReviews){
    if(item.paused)continue;
    if(state.tasks.some(t=>t.type==='rolling'&&t.rollingId===item.id&&t.rollingInitial))continue;
    state.tasks.push({id:uid('rolltask'),date:today(),type:'rolling',name:`滚动复习 · ${item.name}`,subject:item.subject||'综合',done:false,auto:false,rollingAuto:false,rollingInitial:true,rollingId:item.id,order:70});changed=true;
  }
  return changed;
}
function ensureDueTasks(state){
  if(!state||!Array.isArray(state.rollingReviews))return false;state.tasks=Array.isArray(state.tasks)?state.tasks:[];let changed=false;
  const existing=new Set(state.tasks.filter(t=>t.type==='rolling'&&t.rollingId&&t.rollingIndex).map(t=>taskKey(t.rollingId,t.rollingIndex))),ds=today();
  for(const item of state.rollingReviews){
    if(item.paused||!Array.isArray(item.nodes))continue;
    for(const node of item.nodes){
      if(node.status!=='pending'||!node.date||node.date>ds)continue;
      const key=taskKey(item.id,node.index);if(existing.has(key))continue;
      state.tasks.push({id:uid('rolltask'),date:ds,type:'rolling',name:`滚动复习 · ${item.name}`,subject:item.subject||'综合',done:false,auto:false,rollingAuto:true,rollingId:item.id,rollingIndex:Number(node.index),order:80});existing.add(key);changed=true;
    }
  }
  return changed;
}
function cleanupLegacyLabels(state){let changed=false;for(const r of (state.records||[])){if(r.type==='rolling'&&String(r.note||'').includes('额外复习')){r.note=String(r.note).replace(/额外复习/g,'滚动复习');changed=true}}return changed}
function syncPersistentState(){const state=read();if(!state)return false;const changed=cleanupLegacyLabels(state)|syncLinkedTasks(state)|ensureInitialTasks(state)|ensureDueTasks(state);if(changed)write(state);return !!changed}
// Runs before app.js loads, so the base engine reads already-synchronized tasks.
syncPersistentState();

/* ---------- rolling catalog picker ---------- */
const CATALOG=[
['生理','血液','跨膜转运、细胞电活动、骨骼肌收缩①'],['生理','血液','骨骼肌收缩②、心肌电活动'],['生理','血液','细胞信号转导'],['生理','血液','血型、血液特性、生理止血'],['内科','血液','缺铁性贫血、再障、溶血性贫血'],['内科','血液','出血性疾病、淋巴瘤'],['内科','血液','白血病、MDS'],
['内科','循环','骨髓瘤、心脏杂音、血压①'],['生理','循环','血压②、微循环和冠脉循环、心血管调节①'],['综合','循环','心血管调节②、心肌疾病'],['综合','循环','感染性心内膜炎、心包疾病'],['综合','循环','高血压、风湿病、动脉粥样硬化'],['内科','循环','瓣膜疾病'],['内科','循环','冠心病'],['内科','循环','心律失常①'],['内科','循环','心律失常②'],['内科','循环','收缩性心衰、心脏骤停'],
['综合','消化','消化概述、口腔/食管消化、胃内消化；胃炎、消化性溃疡'],['内科','消化','胃炎、胃食管反流、消化性溃疡'],['综合','消化','肠内消化、肠内吸收；肠结核、炎症性肠病、肠易激'],['综合','消化','病毒性肝炎、肝硬化、消化道肿瘤、肝性脑病'],['综合','消化','消化道肿瘤、原发性肝癌、肝硬化'],['综合','消化','胰腺、胰腺炎'],
['综合','泌尿','肾小球滤过、泌尿总论'],['内科','泌尿','原发性肾小球疾病①'],['综合','泌尿','原发性肾小球疾病②、小管重吸收和分泌'],['内科','泌尿','中毒、尿路感染、肾衰竭'],
['生理','呼吸','通气功能评价、肺通气、肺换气、呼吸调节'],['病理','呼吸','慢支、肺气肿、肺心病、硅肺'],['内科','呼吸','COPD、肺动脉高压'],['综合','呼吸','支气管肺炎、肺栓塞、间质肺疾病、支扩、急性肺脓肿'],['综合','呼吸','肺炎、肺结核'],['内科','呼吸','肺结核、ARDS、呼衰'],['综合','呼吸','胸膜疾病、肺癌'],
['综合','内分泌','内分泌概述、钙调节激素、甲状腺激素、内分泌病理'],['内科','内分泌','内分泌总论、Graves病、甲减'],['综合','内分泌','胰岛素、糖尿病'],['综合','内分泌','生长激素、糖皮质激素、原醛、库欣、嗜铬细胞瘤'],
['综合','风湿免疫','免疫性疾病、风湿总论、SLE'],['内科','风湿免疫','类风湿关节炎、原发性干燥综合征、系统性血管炎'],
['生理','其他基础','绪论、视觉、听觉、其他感觉、能量代谢与体温'],['生理','其他基础','神经元、突触传递、递质和受体、神经调控躯体运动①'],['生理','其他基础','神经调控躯体运动②、脑电波、生殖①'],['综合','其他基础','生殖②、生殖系统疾病、乳腺疾病、其他传染病'],['病理','其他基础','损伤修复、适应损伤、局部血液循环'],['病理','其他基础','炎症、肿瘤'],
['外科','颈胸','颈部疾病、食管、乳房、胃肿瘤、腹腔感染'],['外科','腹部/泌尿外科','腹部损伤、肠梗阻、阑尾炎、大肠癌'],['外科','腹部/泌尿外科','其他大肠肛管疾病、腹外疝、细菌性肝脓肿、门脉高压'],['外科','腹部/泌尿外科','胆管疾病'],['外科','腹部/泌尿外科','胰腺肿瘤、周围血管疾病、泌外感染和肿瘤、泌外梗阻和损伤'],['外科','运动系统','运动畸形、慢性损伤、手外伤、骨关节感染、非化脓性关节炎、骨肿瘤'],['外科','运动系统','躯干骨损伤、脊髓损伤、颈腰椎退行性疾病'],['外科','运动系统','四肢骨脱位、骨折概论'],['外科','外科总论','输血、体液失衡、营养代谢、烧伤、围手术期'],['外科','外科总论','感染、麻醉、休克、其他外总'],
['生化','生化','糖代谢Ⅰ：无氧/有氧氧化、磷酸戊糖、糖原、糖异生'],['生化','生化','脂质与能量代谢：氧化磷酸化、胆固醇、胆汁酸、脂肪代谢'],['生化','生化','含氮代谢：氨基酸代谢、核苷酸代谢'],['生化','生化','综合代谢：氨基酸、脂蛋白、蛋白质、生物转化、维生素、胆色素'],['生化','生化','酶与核酸①：酶、核酸、DNA合成'],['生化','生化','核酸②：转录、翻译'],['生化','生化','基因调控：基因表达调控、真核基因、DNA损伤']
].map((x,i)=>({id:`preset-${i+1}`,subject:x[0],group:x[1],name:x[2]}));
window.__xizongRollingCatalog=CATALOG;
const PICKER_GROUPS=[
{id:'core',label:'病理 + 生理 + 内科',subjects:['病理','生理','内科','综合']},
{id:'surgery',label:'外科',subjects:['外科']},
{id:'biochem',label:'生化',subjects:['生化']}
];
function categorySubject(){const v=$('#rollCatalogCategory')?.value;return v==='surgery'?'外科':v==='biochem'?'生化':'综合'}
function setCategories(){const el=$('#rollCatalogCategory');if(!el)return;const current=el.value;el.innerHTML=PICKER_GROUPS.map(g=>`<option value="${g.id}">${g.label}</option>`).join('');if(PICKER_GROUPS.some(g=>g.id===current))el.value=current}
function setContents(){
  const cat=PICKER_GROUPS.find(g=>g.id===$('#rollCatalogCategory')?.value)||PICKER_GROUPS[0],el=$('#rollPreset');if(!el)return;
  const items=CATALOG.filter(x=>cat.subjects.includes(x.subject)),groups=[...new Set(items.map(x=>x.group))];
  el.innerHTML='';for(const group of groups){const og=document.createElement('optgroup');og.label=group;for(const x of items.filter(i=>i.group===group)){const o=document.createElement('option');o.value=x.id;o.textContent=x.name;og.appendChild(o)}el.appendChild(og)}
  const o=document.createElement('option');o.value=CUSTOM;o.textContent='＋ 自己添加';el.appendChild(o);syncCustomUI();
}
function ensureCustomUI(){
  const sel=$('#rollPreset');if(!sel)return;let wrap=$('#rollCustomVisibleWrap');if(!wrap){wrap=document.createElement('label');wrap.id='rollCustomVisibleWrap';wrap.className='hidden';wrap.innerHTML='自定义内容<input id="rollCustomVisible" type="text" maxlength="120" placeholder="输入章节、知识点或复习内容">';sel.closest('label')?.after(wrap)}
}
function syncCustomUI(){
  ensureCustomUI();const sel=$('#rollPreset'),wrap=$('#rollCustomVisibleWrap'),input=$('#rollCustomVisible'),hidden=$('#rollCustomName'),subject=$('#rollSubject');if(!sel||!hidden)return;
  const custom=sel.value===CUSTOM;wrap?.classList.toggle('hidden',!custom);hidden.value=custom?(input?.value.trim()||''):'';
  if(subject){const want=categorySubject();if([...subject.options].some(o=>o.value===want||o.textContent===want))subject.value=want}
}
function preparePicker(){
  if(!$('#rollingDialog'))return;setCategories();if(!$('#rollCatalogCategory').value)$('#rollCatalogCategory').value='core';
  const subject=$('#rollSubject');if(subject)subject.innerHTML=['病理','生化','外科','生理','内科','综合'].map(x=>`<option>${x}</option>`).join('');
  const custom=$('#rollCustomName');if(custom)custom.value='';const input=$('#rollCustomVisible');if(input)input.value='';setContents();if($('#rollStart')&&!$('#rollStart').value)$('#rollStart').value=today();
}

/* ---------- rolling presentation ---------- */
function dueLabel(date){const d=dayDiff(date,today());if(d===0)return {text:'今日到期',cls:'today'};if(d>0)return {text:`逾期${d}天`,cls:'overdue'};return {text:`还有${Math.abs(d)}天`,cls:'future'}}
function groupFor(item){return item.subject==='外科'?'surgery':item.subject==='生化'?'biochem':'core'}
const VIEW_GROUPS=[['core','病理 + 生理 + 内科'],['surgery','外科'],['biochem','生化']];
function pendingInitialTasks(state){return (state.tasks||[]).filter(t=>t.type==='rolling'&&t.rollingInitial&&!t.done&&t.date<=today()&&findItem(state,t.rollingId)&&!findItem(state,t.rollingId)?.paused)}
function dueNodes(state){return (state.rollingReviews||[]).filter(r=>!r.paused).flatMap(item=>(item.nodes||[]).filter(n=>n.status==='pending'&&n.date<=today()).map(node=>({item,node}))).sort((a,b)=>a.node.date.localeCompare(b.node.date))}
function tomorrowDate(){return add(today(),1)}
function tomorrowInitialTasks(state){const ds=tomorrowDate();return (state.tasks||[]).filter(t=>t.type==='rolling'&&t.rollingInitial&&!t.done&&t.date===ds&&findItem(state,t.rollingId)&&!findItem(state,t.rollingId)?.paused)}
function tomorrowNodes(state){const ds=tomorrowDate();return (state.rollingReviews||[]).filter(r=>!r.paused).flatMap(item=>(item.nodes||[]).filter(n=>n.status==='pending'&&n.date===ds).map(node=>({item,node}))).sort((a,b)=>a.node.date.localeCompare(b.node.date))}
function tomorrowInitialRow(state,t){const item=findItem(state,t.rollingId);if(!item)return '';const delayed=t.uxDelayedFrom===today();return `<div class="ux-project-row"><div class="ux-grow"><b>${esc(item.name)}</b><div class="small muted">${esc(item.subject||'综合')} · 当天学习 · ${t.date}</div></div><span class="ux-status ${delayed?'today':'future'}">${delayed?'今日顺延':'明日计划'}</span><button class="ux-mini" data-ux="early-complete-initial" data-task-id="${esc(t.id)}">提前完成</button></div>`}
function tomorrowNodeRow(item,node){const delayed=node.uxDelayedFrom===today();return `<div class="ux-project-row"><div class="ux-grow"><b>${esc(item.name)}</b><div class="small muted">${esc(item.subject||'综合')} · 第${node.index}轮 · ${node.date}</div></div><span class="ux-status ${delayed?'today':'future'}">${delayed?'今日顺延':'明日计划'}</span><button class="ux-mini" data-ux="early-complete-one" data-id="${esc(item.id)}" data-index="${node.index}">提前完成</button></div>`}
function selectedDue(){return $$('.ux-due-check:checked').map(x=>({kind:x.dataset.kind,id:x.dataset.id,index:Number(x.dataset.index||0),taskId:x.dataset.taskId||''}))}
function rollingRecord(state,item,node,minutes=0){state.records=Array.isArray(state.records)?state.records:[];if(state.records.some(r=>r.rollingId===item.id&&Number(r.rollingIndex)===Number(node.index)))return;state.records.push({id:uid('rollrec'),date:today(),type:'rolling',subject:item.subject||'综合',year:null,total:0,correct:0,minutes:Number(minutes)||0,note:`${item.name} · 第${node.index}轮`,createdAt:new Date().toISOString(),rollingId:item.id,rollingIndex:Number(node.index)})}
function markLinkedTask(state,item,node,done=true){for(const t of state.tasks||[]){if(t.type==='rolling'&&t.rollingId===item.id&&Number(t.rollingIndex)===Number(node.index))t.done=done}}
function shiftPendingAfter(item,index,delta){delta=Number(delta)||0;if(!item||!delta)return;for(const n of item.nodes||[]){if(n.status==='pending'&&Number(n.index)>Number(index))n.date=add(n.date,delta)}}
function shiftPendingFrom(item,index,delta){delta=Number(delta)||0;if(!item||!delta)return;for(const n of item.nodes||[]){if(n.status==='pending'&&Number(n.index)>=Number(index))n.date=add(n.date,delta)}}
function shiftInitialPlan(item,delta){delta=Number(delta)||0;if(!item||!delta)return;if(item.startDate)item.startDate=add(item.startDate,delta);for(const n of item.nodes||[]){if(n.status==='pending')n.date=add(n.date,delta)}}
function initialRow(state,t){const item=findItem(state,t.rollingId),s=dueLabel(t.date);if(!item)return '';return `<div class="ux-due-row ux-initial-due"><label class="ux-check"><input class="ux-due-check" type="checkbox" data-kind="initial" data-id="${esc(item.id)}" data-task-id="${esc(t.id)}"><span></span></label><div class="ux-grow"><b>${esc(item.name)}</b><div class="small muted">${esc(item.subject||'综合')} · 当天学习 · 加入滚动</div></div><span class="ux-status ${s.cls}">${s.text}</span><div class="ux-inline-actions"><button data-ux="complete-initial" data-task-id="${esc(t.id)}">完成</button></div></div>`}
function nodeRow(item,node){const s=dueLabel(node.date);return `<div class="ux-due-row"><label class="ux-check"><input class="ux-due-check" type="checkbox" data-kind="node" data-id="${esc(item.id)}" data-index="${node.index}"><span></span></label><div class="ux-grow"><b>${esc(item.name)}</b><div class="small muted">${esc(item.subject||'综合')} · 第${node.index}轮 · 原定 ${node.date}</div></div><span class="ux-status ${s.cls}">${s.text}</span><div class="ux-inline-actions"><button data-ux="complete-one" data-id="${esc(item.id)}" data-index="${node.index}">完成</button><button data-ux="delay-one" data-id="${esc(item.id)}" data-index="${node.index}">+1天</button><button data-ux="skip-one" data-id="${esc(item.id)}" data-index="${node.index}">跳过</button></div></div>`}
function projectRow(state,item){
  const initial=(state.tasks||[]).find(t=>t.type==='rolling'&&t.rollingInitial&&t.rollingId===item.id&&!t.done),next=(item.nodes||[]).find(n=>n.status==='pending')||null,done=(item.nodes||[]).filter(n=>n.status==='done').length,skip=(item.nodes||[]).filter(n=>n.status==='skipped').length;
  const nextText=initial?` · 当天学习待完成`:next?` · 下次 ${next.date}`:' · 已完成全部轮次',status=initial?dueLabel(initial.date):next?dueLabel(next.date):null;
  return `<div class="ux-project-row"><div class="ux-grow"><b>${esc(item.name)}</b><div class="small muted">${esc(item.group||'')} · 完成 ${done}/${(item.nodes||[]).length}${skip?` · 跳过 ${skip}`:''}${nextText}</div></div>${status?`<span class="ux-status ${status.cls}">${status.text}</span>`:'<span class="ux-status done">已完成</span>'}<button class="ux-mini" data-ux="pause-project" data-id="${esc(item.id)}">${item.paused?'继续':'暂停'}</button><button class="ux-mini danger" data-ux="delete-project" data-id="${esc(item.id)}">删除</button></div>`;
}
function renderRollingEnhanced(){
  const nav=$('#nav [data-view="rolling"].active'),view=$('#view');if(!nav||!view)return;const state=read();if(!state)return;
  const initials=pendingInitialTasks(state),nodes=dueNodes(state),all=[...initials.map(t=>({kind:'initial',date:t.date,t})),...nodes.map(x=>({kind:'node',date:x.node.date,...x}))].sort((a,b)=>a.date.localeCompare(b.date)),over=all.filter(x=>x.date<today()),expanded=sessionStorage.getItem('ux-roll-expanded')==='1',shown=expanded?all:all.slice(0,5),tomorrowInitials=tomorrowInitialTasks(state),tomorrowNodeList=tomorrowNodes(state),tomorrowPlans=[...tomorrowInitials.map(t=>({kind:'initial',date:t.date,t})),...tomorrowNodeList.map(x=>({kind:'node',date:x.node.date,...x}))].sort((a,b)=>a.date.localeCompare(b.date)),tomorrowDelayed=tomorrowPlans.filter(x=>x.kind==='initial'?x.t.uxDelayedFrom===today():x.node.uxDelayedFrom===today()).length;
  const stamp=[all.length,over.length,tomorrowPlans.length,tomorrowDelayed,(state.rollingReviews||[]).length,(state.records||[]).length,expanded?1:0,...(state.rollingReviews||[]).map(r=>`${r.id}:${r.paused?1:0}:${(r.nodes||[]).map(n=>`${n.index}${n.status}${n.date}${n.uxDelayedFrom||''}`).join(',')}`),...(state.tasks||[]).filter(t=>t.type==='rolling'&&t.rollingInitial&&!t.done).map(t=>`${t.id}:${t.date}:${t.uxDelayedFrom||''}`)].join('|');
  if(view.querySelector('.ux-rolling-root')&&view.dataset.uxStamp===stamp)return;view.dataset.uxStamp=stamp;
  const groups=VIEW_GROUPS.map(([id,label])=>{const items=(state.rollingReviews||[]).filter(r=>groupFor(r)===id).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));return `<details class="ux-group" ${id==='core'?'open':''}><summary>${label}<span>${items.length}</span></summary>${items.length?items.map(item=>projectRow(state,item)).join(''):'<div class="empty">暂无项目</div>'}</details>`}).join(''),tomorrowHtml=`<details class="ux-group ux-tomorrow"><summary><div><b>明日滚动</b><div class="small muted">明日计划 ${tomorrowPlans.length-tomorrowDelayed} · 今日顺延 ${tomorrowDelayed}</div></div><span>${tomorrowPlans.length}</span></summary>${tomorrowPlans.length?tomorrowPlans.map(x=>x.kind==='initial'?tomorrowInitialRow(state,x.t):tomorrowNodeRow(x.item,x.node)).join(''):'<div class="empty">明天暂无滚动安排</div>'}</details>`;
  view.innerHTML=`<div class="ux-rolling-root"><div class="stats ux-stats3"><div class="stat"><span class="small muted">今日到期</span><b>${all.length-over.length}</b></div><div class="stat"><span class="small muted">逾期</span><b>${over.length}</b></div><div class="stat"><span class="small muted">滚动项目</span><b>${(state.rollingReviews||[]).length}</b></div></div><div class="section"><h2>今日滚动</h2><button data-a="add-rolling">＋ 添加</button></div><section class="card ux-due-card">${all.length?`<div class="ux-batch"><button data-ux="select-all">全选</button><button data-ux="batch-complete">批量完成</button><button data-ux="batch-delay">顺延1天</button></div>${shown.map(x=>x.kind==='initial'?initialRow(state,x.t):nodeRow(x.item,x.node)).join('')}${all.length>5?`<button class="ux-more" data-ux="toggle-due">${expanded?'收起':'查看全部 '+all.length+' 项'}</button>`:''}`:'<div class="empty">今天没有到期或逾期的滚动复习</div>'}</section>${tomorrowHtml}<div class="section"><h2>滚动项目</h2><span class="small muted">按三大类折叠</span></div>${groups}<button class="btn primary" data-a="add-rolling">＋ 添加滚动复习</button></div>`;
}
function todayRollingEnhance(){
  const nav=$('#nav [data-view="today"].active');if(!nav)return;const state=read();if(!state)return;const rows=[];
  for(const task of (state.tasks||[]).filter(t=>t.date===today()&&t.type==='rolling')){
    const row=document.querySelector(`[data-swipe="${CSS.escape(task.id)}"]`);if(!row)continue;rows.push({task,row});const item=findItem(state,task.rollingId),node=findNode(item,task.rollingIndex),meta=row.querySelector('.meta');if(meta){const phase=node?`第${node.index}轮`:task.rollingInitial?'加入滚动':'滚动复习';meta.textContent=`↻ 滚动复习 · ${phase}${item?.subject?` · ${item.subject}`:''}`}
    if(!row.querySelector('.ux-task-status')){const s=task.done&&task.uxEarlyCompletedFrom?{text:'已完成',cls:'done'}:node?dueLabel(node.date):dueLabel(task.date),badge=document.createElement('span');badge.className=`ux-task-status ux-status ${s.cls}`;badge.textContent=s.text;row.querySelector('.task')?.insertBefore(badge,row.querySelector('[data-a="start-task"], [data-a="record"]')||null)}
  }
  $$('.section h2').forEach(h=>{if(h.textContent.trim()==='今日滚动复习'){const sec=h.closest('.section'),card=sec?.nextElementSibling;if(card?.classList.contains('rolling-alert'))card.remove();sec?.remove()}});
  const pending=rows.filter(x=>!x.task.done);if(pending.length<=5)return;const expanded=sessionStorage.getItem('ux-today-roll-expanded')==='1';pending.slice(5).forEach(x=>x.row.classList.toggle('ux-hidden',!expanded));const card=rows[0]?.row.closest('.card');if(card&&!card.querySelector('.ux-backlog')){const overdue=pending.filter(x=>{const item=findItem(state,x.task.rollingId),node=findNode(item,x.task.rollingIndex),date=node?.date||x.task.date;return date<today()}).length,bar=document.createElement('div');bar.className='ux-backlog';bar.innerHTML=`<div><b>滚动复习 ${pending.length} 项</b><div class="small muted">${overdue?`逾期 ${overdue} 项 · `:''}默认先显示前 5 项</div></div><button data-ux="toggle-today">${expanded?'收起':'展开全部'}</button>`;card.insertBefore(bar,card.firstChild)}
}

/* ---------- operations ---------- */
function completeInitial(taskId){const state=read(),task=(state?.tasks||[]).find(t=>t.id===taskId&&t.type==='rolling'&&t.rollingInitial);if(!state||!task)return;task.done=true;syncLinkedTasks(state);commitState(state)}
function earlyCompleteInitial(taskId){const state=read(),task=(state?.tasks||[]).find(t=>t.id===taskId&&t.type==='rolling'&&t.rollingInitial),item=task?findItem(state,task.rollingId):null;if(!state||!task||!item)return;const scheduled=task.date,delta=dayDiff(scheduled,today());task.uxEarlyCompletedFrom=scheduled;task.date=today();task.done=true;shiftInitialPlan(item,delta);syncLinkedTasks(state);commitState(state)}
function ensureEarlyCompletedTask(state,item,node){let task=(state.tasks||[]).find(t=>t.type==='rolling'&&t.rollingId===item.id&&Number(t.rollingIndex)===Number(node.index));if(task){task.uxEarlyCompletedFrom=task.date||node.date;task.date=today();task.done=true;return task}task={id:uid('rolltask'),date:today(),type:'rolling',name:`滚动复习 · ${item.name}`,subject:item.subject||'综合',done:true,auto:false,rollingAuto:true,rollingId:item.id,rollingIndex:Number(node.index),order:80,uxEarlyCompletedFrom:node.date};state.tasks=Array.isArray(state.tasks)?state.tasks:[];state.tasks.push(task);return task}
function earlyCompleteOne(id,index){const state=read(),item=findItem(state,id),node=findNode(item,index);if(!state||!item||!node)return;const raw=prompt('本次复习用时（分钟，可留空）','');if(raw===null)return;const minutes=Math.max(0,Number(raw)||0),scheduled=node.date,delta=dayDiff(scheduled,today());node.status='done';node.completedAt=new Date().toISOString();node.minutes=minutes;shiftPendingAfter(item,node.index,delta);rollingRecord(state,item,node,minutes);ensureEarlyCompletedTask(state,item,node);syncLinkedTasks(state);commitState(state)}
function mutateOne(action,id,index){const state=read(),item=findItem(state,id),node=findNode(item,index);if(!state||!item||!node)return;if(action==='complete'){const raw=prompt('本次复习用时（分钟，可留空）','');if(raw===null)return;const minutes=Math.max(0,Number(raw)||0);node.status='done';node.completedAt=new Date().toISOString();node.minutes=minutes;rollingRecord(state,item,node,minutes);markLinkedTask(state,item,node,true)}else if(action==='delay'){node.uxDelayedFrom=today();shiftPendingFrom(item,node.index,1);syncLinkedTasks(state)}else{node.status='skipped';node.completedAt=new Date().toISOString();markLinkedTask(state,item,node,true)}commitState(state)}
function mutateSelected(kind){
  const picks=selectedDue();if(!picks.length)return toast('先选择要处理的滚动项目');const state=read();if(!state)return;
  if(kind==='delay') {
    const byItem=new Map();
    for(const p of picks){const item=findItem(state,p.id);if(!item)continue;const entry=byItem.get(p.id)||{item,initial:null,indices:[]};if(p.kind==='initial'){entry.initial=(state.tasks||[]).find(t=>t.id===p.taskId)||entry.initial}else entry.indices.push(Number(p.index));byItem.set(p.id,entry)}
    for(const {item,initial,indices} of byItem.values()){
      if(initial){initial.uxDelayedFrom=today();initial.date=add(initial.date,1);shiftInitialPlan(item,1);for(const idx of indices){const n=findNode(item,idx);if(n)n.uxDelayedFrom=today()}}
      else if(indices.length){const first=Math.min(...indices);for(const idx of indices){const n=findNode(item,idx);if(n)n.uxDelayedFrom=today()}shiftPendingFrom(item,first,1)}
    }
    syncLinkedTasks(state);commitState(state);return;
  }
  for(const p of picks){
    if(p.kind==='initial'){const task=(state.tasks||[]).find(t=>t.id===p.taskId),item=findItem(state,p.id);if(!task||!item)continue;if(kind==='complete')task.done=true;continue}
    const item=findItem(state,p.id),node=findNode(item,p.index);if(!item||!node)continue;if(kind==='complete'){node.status='done';node.completedAt=new Date().toISOString();node.minutes=0;rollingRecord(state,item,node,0);markLinkedTask(state,item,node,true)}
  }
  syncLinkedTasks(state);commitState(state);
}
function togglePause(id){const state=read(),item=findItem(state,id);if(!item)return;item.paused=!item.paused;if(item.paused)state.tasks=(state.tasks||[]).filter(t=>!(t.type==='rolling'&&t.rollingId===id&&!t.done));else ensureDueTasks(state);write(state);window.__xizongSyncState?.(state);refresh(0)}
function deleteRollingProject(id){const state=read(),item=findItem(state,id);if(!item)return;if(!confirm(`删除这条滚动复习？\n${item.name}`))return;state.rollingReviews=(state.rollingReviews||[]).filter(r=>r.id!==id);state.tasks=(state.tasks||[]).filter(t=>t.rollingId!==id||t.done);commitState(state)}
function contextualDeleteTask(id){const state=read(),task=(state?.tasks||[]).find(t=>t.id===id);if(!task)return;if(task.type==='rolling')return toast('滚动任务请在“滚动复习”页完成、顺延或暂停');if(!confirm(`删除“${task.name}”？\n日期：${task.date}${task.done?'\n该任务已完成。':''}`))return;if(state.activeTimer?.taskId===id)state.activeTimer=null;if(task.auto){state.customizedDates=state.customizedDates||{};state.customizedDates[task.date]=true}state.tasks=state.tasks.filter(t=>t.id!==id);commitState(state)}

/* ---------- records / backup ---------- */
function mockTrendEnhance(){const nav=$('#nav [data-view="records"].active'),view=$('#view');if(!nav||!view||view.querySelector('.ux-mock-trend'))return;const state=read();if(!state)return;const mocks=(state.records||[]).filter(r=>r.type==='mock'&&Number(r.total)>0).sort((a,b)=>(a.date||'').localeCompare(b.date||'')).slice(-10);if(!mocks.length)return;const sec=document.createElement('section');sec.className='card ux-mock-trend';sec.innerHTML=`<div class="ux-card-title"><h2>套卷正确率趋势</h2><span class="small muted">最近 ${mocks.length} 套</span></div>${mocks.map(r=>{const acc=Math.round((Number(r.correct)||0)/(Number(r.total)||165)*100);return `<div class="ux-trend-row"><span>${esc(r.year||r.date||'套卷')}</span><div class="ux-trend"><i style="width:${acc}%"></i></div><b>${acc}%</b><small>${Number(r.minutes)||0} min</small></div>`}).join('')}`;view.querySelector('.stats')?.after(sec)}
function backupAndCsvEnhance(){const nav=$('#nav [data-view="me"].active');if(!nav)return;const state=read();if(!state)return;const card=$$('#view .card').find(c=>c.querySelector('h2')?.textContent.trim()==='本机数据');if(!card||card.dataset.uxData==='1')return;card.dataset.uxData='1';const last=state.lastBackupAt?new Date(state.lastBackupAt):null,days=last?Math.floor((Date.now()-last.getTime())/86400000):Infinity,meaningful=(state.records||[]).length+(state.tasks||[]).length+(state.rollingReviews||[]).length;if(meaningful&&days>=14){const box=document.createElement('div');box.className='ux-backup-reminder';box.innerHTML=`<b>${last?`距上次备份已 ${days} 天`:'还没有导出过备份'}</b><div class="small muted">建议定期保存 JSON 备份，避免浏览器数据被清理后无法恢复。</div><button class="ux-mini" data-a="export">立即备份</button>`;card.insertBefore(box,card.querySelector('button'))}const btn=document.createElement('button');btn.className='btn secondary';btn.dataset.ux='export-csv';btn.style.marginBottom='9px';btn.textContent='导出学习记录 CSV';const importBtn=[...card.querySelectorAll('button')].find(b=>b.dataset.a==='import');card.insertBefore(btn,importBtn||null)}
function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`}
function exportCsv(){const state=read();if(!state)return;const rows=[['日期','类型','学科','内容/备注','用时(分钟)','套卷题数','正确数','正确率']];for(const r of (state.records||[]).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''))){const type=r.type==='mock'?'套卷':r.type==='rolling'?'滚动复习':r.type==='review'?'错题复盘':'学习',acc=r.type==='mock'&&Number(r.total)>0?`${Math.round((Number(r.correct)||0)/Number(r.total)*100)}%`:'';rows.push([r.date,type,r.subject||'综合',r.note||'',Number(r.minutes)||0,r.type==='mock'?(r.total||165):'',r.type==='mock'?(r.correct??''):'',acc])}const csv='\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`西综学习记录-${today()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('CSV 已导出')}

/* ---------- timer ---------- */
let timerLoop=0;
function timerSeconds(timer){if(!timer)return 0;const now=timer.paused&&timer.pausedAt?Number(timer.pausedAt):Date.now();return Math.max(0,Math.floor((now-Number(timer.startedAt))/1000))}
function timerText(timer){const sec=timer.mode==='down'?Math.max(0,Number(timer.durationSec||0)-timerSeconds(timer)):timerSeconds(timer);return `${pad(Math.floor(sec/60))}:${pad(sec%60)}`}
function renderFloatingTimer(state=read()){let bar=$('#uxTimerBar'),timer=state?.activeTimer;if(!timer){bar?.remove();return false}const task=(state.tasks||[]).find(t=>t.id===timer.taskId);if(!bar){bar=document.createElement('button');bar.id='uxTimerBar';bar.className='ux-timer-bar';bar.dataset.ux='open-timer';document.body.appendChild(bar)}bar.innerHTML=`<span class="ux-timer-dot">${timer.paused?'Ⅱ':'●'}</span><span class="ux-timer-name">${esc(task?.name||'学习计时')}</span><b>${timerText(timer)}</b><small>${timer.paused?'已暂停':timer.mode==='down'?'倒计时':'正计时'}</small>`;return true}
function enhanceTimer(){const state=read(),timer=state?.activeTimer,run=$('#timerRunning');if(run&&!run.querySelector('[data-ux="pause-timer"]')){const finish=run.querySelector('[data-timer="finish"]'),btn=document.createElement('button');btn.type='button';btn.className='btn secondary ux-pause-btn';btn.dataset.ux='pause-timer';btn.style.marginTop='9px';finish?.after(btn)}const btn=run?.querySelector('[data-ux="pause-timer"]');if(btn)btn.textContent=timer?.paused?'继续计时':'暂停';const finish=run?.querySelector('[data-timer="finish"]');if(timer?.paused){const clock=$('#timerClock');if(clock)clock.textContent=timerText(timer);const status=$('#timerStatus');if(status)status.textContent='已暂停；继续后再完成本次学习';if(finish)finish.disabled=true}else if(finish)finish.disabled=false;const active=renderFloatingTimer(state);if(active&&!timerLoop)timerLoop=window.setInterval(()=>{const s=read();if(!s?.activeTimer){clearInterval(timerLoop);timerLoop=0;$('#uxTimerBar')?.remove();return}renderFloatingTimer(s);if(s.activeTimer.paused&&$('#timerDialog')?.open){const c=$('#timerClock');if(c)c.textContent=timerText(s.activeTimer)}},1000);if(!active&&timerLoop){clearInterval(timerLoop);timerLoop=0}}
function toggleTimerPause(){const state=read(),timer=state?.activeTimer;if(!timer)return;if(!timer.paused){timer.paused=true;timer.pausedAt=Date.now();timer.uxPauseUsed=true}else{const delta=Date.now()-Number(timer.pausedAt||Date.now());timer.startedAt=Number(timer.startedAt)+Math.max(0,delta);delete timer.pausedAt;timer.paused=false}write(state);window.__xizongSyncState?.(state);window.__xizongRefreshTimer?.();enhanceTimer();if(timer.paused)toast('计时已暂停')}
function reopenTimerIfNeeded(){if(sessionStorage.getItem('ux-reopen-timer')!=='1')return;const state=read(),timer=state?.activeTimer;if(!timer){sessionStorage.removeItem('ux-reopen-timer');return}const btn=document.querySelector(`[data-a="start-task"][data-id="${CSS.escape(timer.taskId)}"]`);if(btn){sessionStorage.removeItem('ux-reopen-timer');btn.click()}}
function openFloatingTimer(){sessionStorage.setItem('ux-reopen-timer','1');$('#nav [data-view="today"]')?.click();setTimeout(reopenTimerIfNeeded,60)}
function restoreView(){const v=sessionStorage.getItem('ux-restore-view');if(!v)return;sessionStorage.removeItem('ux-restore-view');setTimeout(()=>{$(`#nav [data-view="${v}"]`)?.click();refresh(0)},0)}

/* ---------- lightweight page enhancements ---------- */
function removeLegacyStudyOption(){const sel=$('#tType');if(!sel)return;sel.querySelector('option[value="study"]')?.remove();if(!sel.value)sel.value='practice'}
function autoTaskName(){const type=$('#tType')?.value,name=$('#tName');if(!name)return;const map={practice:'今日学习',review:'错题复盘',mock:'套卷'},known=['今日学习','错题复盘','套卷'];if(map[type]&&(!name.value.trim()||name.dataset.uxAuto==='1'||known.includes(name.value.trim()))){name.value=map[type];name.dataset.uxAuto='1'}}
let refreshTimer=0;
function refresh(delay=20){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>requestAnimationFrame(()=>{removeLegacyStudyOption();renderRollingEnhanced();todayRollingEnhance();mockTrendEnhance();backupAndCsvEnhance();enhanceTimer();reopenTimerIfNeeded();}),delay)}
function syncAfterBaseAction(){setTimeout(()=>{const state=read();if(!state)return;const changed=syncLinkedTasks(state)|ensureInitialTasks(state)|ensureDueTasks(state);if(changed){commitState(state)}else refresh(0)},35)}

/* ---------- one event system, no DOM observer ---------- */
document.addEventListener('click',e=>{
  const aEl=e.target.closest('[data-a]'),a=aEl?.dataset.a,id=aEl?.dataset.id;
  if(a==='del-task'){e.preventDefault();e.stopImmediatePropagation();contextualDeleteTask(id);return}
  if(a==='rolling-delete'){e.preventDefault();e.stopImmediatePropagation();deleteRollingProject(id);return}
  if(a==='toggle-rolling-pause'){e.preventDefault();e.stopImmediatePropagation();togglePause(id);return}
  
},true);

document.addEventListener('click',e=>{
  const uxEl=e.target.closest('[data-ux]'),ux=uxEl?.dataset.ux,a=e.target.closest('[data-a]')?.dataset.a;
  if(ux){e.preventDefault();
    if(ux==='select-all'){const checks=$$('.ux-due-check'),on=checks.some(x=>!x.checked);checks.forEach(x=>x.checked=on);return}
    if(ux==='batch-complete')return mutateSelected('complete');if(ux==='batch-delay')return mutateSelected('delay');
    if(ux==='toggle-due'){sessionStorage.setItem('ux-roll-expanded',sessionStorage.getItem('ux-roll-expanded')==='1'?'0':'1');return refresh(0)}
    if(ux==='complete-initial')return completeInitial(uxEl.dataset.taskId);if(ux==='early-complete-initial')return earlyCompleteInitial(uxEl.dataset.taskId);
    if(ux==='complete-one')return mutateOne('complete',uxEl.dataset.id,uxEl.dataset.index);if(ux==='early-complete-one')return earlyCompleteOne(uxEl.dataset.id,uxEl.dataset.index);if(ux==='delay-one')return mutateOne('delay',uxEl.dataset.id,uxEl.dataset.index);if(ux==='skip-one')return mutateOne('skip',uxEl.dataset.id,uxEl.dataset.index);
    if(ux==='pause-project')return togglePause(uxEl.dataset.id);if(ux==='delete-project')return deleteRollingProject(uxEl.dataset.id);
    if(ux==='toggle-today'){sessionStorage.setItem('ux-today-roll-expanded',sessionStorage.getItem('ux-today-roll-expanded')==='1'?'0':'1');return refresh(0)}
    if(ux==='export-csv')return exportCsv();if(ux==='pause-timer')return toggleTimerPause();if(ux==='open-timer')return openFloatingTimer();
  }
  if(a==='add-rolling')setTimeout(preparePicker,10);
  if(a==='add-task')setTimeout(()=>{removeLegacyStudyOption();autoTaskName()},10);
  const timer=e.target.closest('[data-timer]')?.dataset.timer;
  if(['direct','finish'].includes(timer)||['toggle','rolling-complete','rolling-delay','rolling-skip'].includes(a))syncAfterBaseAction();else refresh(24);
});
document.addEventListener('change',e=>{if(e.target.id==='rollCatalogCategory'){setContents();syncCustomUI()}else if(e.target.id==='rollPreset')syncCustomUI();else if(e.target.id==='tType')autoTaskName();refresh(20)});
document.addEventListener('input',e=>{if(e.target.id==='rollCustomVisible')syncCustomUI();if(e.target.id==='tName'&&e.isTrusted)e.target.dataset.uxAuto='0'});
document.addEventListener('submit',e=>{if(e.target.id==='rollingForm'){syncCustomUI();setTimeout(()=>refresh(0),30)}else refresh(50)},true);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){syncAfterBaseAction();refresh(0)}});window.addEventListener('pageshow',()=>refresh(0));window.addEventListener('online',()=>refresh(0));window.addEventListener('offline',()=>refresh(0));

// app.js executes immediately after this file. This deferred pass runs after its first render.
setTimeout(()=>{restoreView();refresh(0)},30);
})();
