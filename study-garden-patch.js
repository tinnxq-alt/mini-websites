(()=>{
  const PATCH_PLAN={subjectOrder:['病理','生化','外科','生理','内科'],mockStart:2017,mockEnd:2026};
  const defaultSchedule={anchor:'2026-08-31',anchorShift:'夜',cycle:['日','夜','出','休'],overrides:{}};
  if(!state.schedule||typeof state.schedule!=='object') state.schedule=JSON.parse(JSON.stringify(defaultSchedule));
  state.schedule.anchor=state.schedule.anchor||defaultSchedule.anchor;
  state.schedule.cycle=Array.isArray(state.schedule.cycle)&&state.schedule.cycle.length?state.schedule.cycle:['日','夜','出','休'];
  state.schedule.anchorShift=state.schedule.anchorShift||state.schedule.cycle[1]||state.schedule.cycle[0]||'日';
  if(!state.schedule.overrides||typeof state.schedule.overrides!=='object') state.schedule.overrides={};
  state.version=Math.max(Number(state.version)||0,8);

  const style=document.createElement('style');
  style.textContent='.project-footer{flex-wrap:wrap}.project-footer button{min-width:92px}.danger-btn{border:1px solid #d8b8b0;background:#f5e7e3;color:#9a6258;border-radius:14px;font-weight:700;padding:10px 13px}.row-actions{display:flex;align-items:center;gap:8px}.schedule-edit-btn{border:1px solid var(--line);background:#f8f0e5;color:var(--accent-dark);border-radius:999px;padding:8px 11px;font-size:12px;font-weight:700}.task-swipe{position:relative;overflow:hidden;border-radius:var(--radius);touch-action:pan-y}.task-swipe-actions{position:absolute;inset:0 0 0 auto;width:144px;display:grid;grid-template-columns:72px 72px;z-index:0}.task-swipe-actions button{border:0;font-size:13px;font-weight:800}.swipe-edit{background:#e8dfd2;color:var(--accent-dark)}.swipe-delete{background:#c98578;color:#fff}.task-swipe-content{position:relative;z-index:1;margin:0;transition:transform .2s ease;will-change:transform}.task-swipe.dragging .task-swipe-content{transition:none}.task-swipe.open .task-swipe-content{transform:translateX(-144px)}';
  document.head.appendChild(style);

  const scheduleConfig=()=>state.schedule||defaultSchedule;
  shiftFor=function(dateStr){const cfg=scheduleConfig();if(cfg.overrides?.[dateStr])return cfg.overrides[dateStr];const cycle=Array.isArray(cfg.cycle)&&cfg.cycle.length?cfg.cycle:defaultSchedule.cycle;const anchorIndex=Math.max(0,cycle.indexOf(cfg.anchorShift));const diff=dayDiff(cfg.anchor,dateStr);return cycle[((anchorIndex+diff)%cycle.length+cycle.length)%cycle.length];};
  subjectSlotFor=function(dateStr){let count=0,d=parseDate(scheduleConfig().anchor),target=parseDate(dateStr);while(d<=target){const ds=fmtDate(d),sh=shiftFor(ds);if(['日','夜','出'].includes(sh)){if(ds===dateStr)break;count++;}d.setDate(d.getDate()+1);}return{subject:PATCH_PLAN.subjectOrder[Math.floor(count/3)%PATCH_PLAN.subjectOrder.length],part:(count%3)+1};};
  scheduleDescriptor=function(dateStr){const shift=shiftFor(dateStr);if(isMockDay(dateStr))return{shift,kind:'mock',headline:'套卷日 · 完整套卷训练',note:'完整限时模拟 + 套卷复盘；今天不推送普通刷题。'};if(shift==='休')return{shift,kind:'review',headline:'恢复日 · 集中复盘',note:'本周错题集中复盘 + 薄弱点整理，不安排新的刷题批次。'};const slot=subjectSlotFor(dateStr);const intensity=shift==='夜'?'轻量':shift==='出'?'中量':'标准';return{shift,kind:'subject',...slot,headline:`${slot.subject} · 真题训练 第 ${slot.part}/3 批`,note:`${shift}班学习 · ${intensity}强度；主任务后做短时错题复盘。`};};

  taskTemplates=function(dateStr){
    const d=scheduleDescriptor(dateStr);
    if(d.kind==='mock') return [
      {title:'完整套卷训练',type:'模拟卷',subject:'综合',goal:180,points:40,auto:true},
      {title:'套卷复盘 · 定位薄弱点',type:'套卷复盘',subject:'综合',goal:1,points:20,auto:true}
    ];
    if(d.kind==='review') return [
      {title:'本周错题集中复盘',type:'错题复盘',subject:'综合',goal:1,points:15,auto:true},
      {title:'薄弱知识点整理',type:'整理',subject:'综合',goal:1,points:10,auto:true}
    ];
    const q=d.shift==='夜'?45:d.shift==='出'?55:65;
    return [
      {title:`${d.subject} · 真题训练 第 ${d.part}/3 批`,type:'刷题',subject:d.subject,goal:q,points:15,auto:true},
      {title:`${d.subject} · 当日错题复盘`,type:'错题复盘',subject:d.subject,goal:1,points:10,auto:true}
    ];
  };

  function regenerateFutureAutoTasks(){const project=activeProject();if(!project||project.autoPlan!=='xizong')return;const today=todayStr();state.tasks=state.tasks.filter(t=>!(t.projectId===project.id&&t.auto&&!t.manualEdited&&!t.completed&&(!t.actualDate||t.actualDate>=today)));ensureScheduleTasks();}

  deleteProject=function(id){const p=state.projects.find(x=>x.id===id);if(!p)return;const taskCount=state.tasks.filter(t=>t.projectId===id).length,focusCount=state.focusSessions.filter(x=>x.projectId===id).length,paperCount=state.papers.filter(x=>x.projectId===id).length;if(!confirm(`确认删除学习项目“${p.title}”？\n\n将同时删除：${taskCount} 个任务、${focusCount} 条专注记录、${paperCount} 条套卷记录。此操作无法撤销。`))return;state.projects=state.projects.filter(x=>x.id!==id);state.tasks=state.tasks.filter(x=>x.projectId!==id);state.focusSessions=state.focusSessions.filter(x=>x.projectId!==id);state.papers=state.papers.filter(x=>x.projectId!==id);delete state.accuracyHistoryByProject[String(id)];if(state.activeTaskId&&!state.tasks.some(t=>t.id===state.activeTaskId))state.activeTaskId=null;if(state.activeProjectId===id){const next=state.projects.find(x=>!x.archived)||state.projects[0]||null;state.activeProjectId=next?.id||null;}ensureScheduleTasks();save();renderAll();toast('学习项目已删除');};
  window.deleteProject=deleteProject;

  renderProjects=function(){const archived=currentProjectFilter==='archived',items=state.projects.filter(p=>p.archived===archived);$('#projectList').innerHTML=items.map(p=>{const st=projectStats(p.id),isCurrent=p.id===state.activeProjectId&&!p.archived;const reward=`${Number(p.rewardPoints)||0}积分${p.rewardText?' + '+esc(p.rewardText):''}`;return `<article class="project-card ${p.archived?'archived':''}"><div class="project-top"><div><span class="project-badge">${p.archived?'已归档':isCurrent?'当前项目':'进行中'}</span><h3 style="margin-top:10px">${esc(p.title)}</h3><p>${esc(p.goal||'未设置')}</p><p>${p.examDate?`考试 / 目标日期：${esc(p.examDate)}`:'考试 / 目标日期：未设置'}</p></div><strong>${Math.max(0,Math.min(100,Number(p.progress)||0))}%</strong></div><div class="progress-track"><span style="width:${Math.max(0,Math.min(100,Number(p.progress)||0))}%"></span></div><div class="project-stats"><div class="mini-stat"><strong>${formatMinutes(st.focusMinutes)}</strong><span>专注</span></div><div class="mini-stat"><strong>${st.questions}</strong><span>累计题量</span></div><div class="mini-stat"><strong>${st.accuracy==null?'—':st.accuracy+'%'}</strong><span>综合正确率</span></div></div><div class="ultimate-reward"><div><span class="reward-kicker">项目奖励</span><strong>${reward}</strong></div><span>${p.rewardClaimed?'✓':'🔒'}</span></div><div class="project-footer">${!p.archived&&!isCurrent?`<button class="secondary" onclick="setActiveProject(${Number(p.id)})">设为当前</button>`:''}<button class="secondary" onclick="editProject(${Number(p.id)})">编辑</button><button class="danger-btn" onclick="deleteProject(${Number(p.id)})">删除</button><button class="primary" onclick="archiveProject(${Number(p.id)})">${p.archived?'恢复项目':'完成并归档'}</button></div></article>`;}).join('')||'<p class="muted">这里还没有项目。</p>';};

  function scheduleOptions(v){return['日','夜','出','休'].map(s=>`<option ${s===v?'selected':''}>${s}</option>`).join('');}
  openScheduleModal=function(){const cfg=scheduleConfig(),cycle=(Array.isArray(cfg.cycle)&&cfg.cycle.length?cfg.cycle:defaultSchedule.cycle).slice(0,8);const rows=Object.entries(cfg.overrides||{}).sort(([a],[b])=>a.localeCompare(b)).map(([date,sh])=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)"><span>${esc(date)} · ${esc(sh)}班</span><button type="button" class="danger-btn" style="padding:6px 9px" onclick="removeScheduleOverride('${escAttr(date)}')">删除</button></div>`).join('')||'<p class="muted" style="font-size:12px">暂无临时改班。</p>';$('#modalTitle').textContent='编辑排班';$('#modalBody').innerHTML=`<div class="modal-body"><label>循环锚点日期</label><input id="sAnchor" type="date" value="${escAttr(cfg.anchor)}"><label>锚点当天班次</label><select id="sAnchorShift">${scheduleOptions(cfg.anchorShift)}</select><label>循环顺序</label><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${cycle.map((v,i)=>`<select class="cycleShift" aria-label="循环第${i+1}天">${scheduleOptions(v)}</select>`).join('')}</div><p class="muted" style="font-size:12px;margin-top:7px">例如：日 → 夜 → 出 → 休。修改后会重排未来自动任务。</p><label>临时改某一天班次（可选）</label><div style="display:grid;grid-template-columns:1.4fr 1fr;gap:8px"><input id="overrideDate" type="date"><select id="overrideShift">${scheduleOptions('休')}</select></div><div style="margin-top:10px">${rows}</div></div>`;$('#modalSaveBtn').onclick=e=>{e.preventDefault();const newCycle=$$('.cycleShift').map(x=>x.value).filter(Boolean);if(!$('#sAnchor').value||!newCycle.length)return toast('请填写排班锚点和循环');cfg.anchor=$('#sAnchor').value;cfg.anchorShift=$('#sAnchorShift').value;cfg.cycle=newCycle;const od=$('#overrideDate').value;if(od)cfg.overrides[od]=$('#overrideShift').value;regenerateFutureAutoTasks();save();renderAll();$('#modal').close();toast('排班已更新，未来任务已重新生成');};$('#modal').showModal();};
  removeScheduleOverride=function(date){if(!state.schedule?.overrides?.[date])return;delete state.schedule.overrides[date];regenerateFutureAutoTasks();save();renderAll();$('#modal').close();openScheduleModal();};
  window.openScheduleModal=openScheduleModal;window.removeScheduleOverride=removeScheduleOverride;

  deleteTask=function(id){
    const t=state.tasks.find(x=>x.id===id);if(!t)return;
    if(!confirm(`确认删除任务“${t.title}”？${t.completed?'\n\n该任务已完成，删除后会同时撤回本任务获得的积分。':''}`))return;
    const reward=t.completed?(Number(t.points)||0):0;
    if(reward&&state.points<reward){toast('该任务奖励积分已被使用，余额不足，暂时无法删除');return;}
    if(reward){state.points=Math.max(0,state.points-reward);state.ledger.unshift({text:`删除已完成任务「${t.title}」`,value:-reward,time:'刚刚'});}
    state.tasks=state.tasks.filter(x=>x.id!==id);
    if(state.activeTaskId===id)state.activeTaskId=null;
    save();renderAll();toast(reward?`任务已删除，-${reward}积分`:'任务已删除');
  };
  window.deleteTask=deleteTask;

  openTaskModal=function(task=null){
    $('#modalTitle').textContent=task?'编辑学习任务':'新增学习任务';
    const subjects=['综合',...PATCH_PLAN.subjectOrder];
    $('#modalBody').innerHTML=`<div class="modal-body"><label>任务名称</label><input id="fTitle" value="${escAttr(task?.title||'')}" placeholder="例如：病理真题 60 题"><label>类型</label><select id="fType"><option>刷题</option><option>错题复盘</option><option>模拟卷</option><option>套卷复盘</option><option>背诵</option><option>看课/教材</option><option>自主学习</option></select><label>学科</label><select id="fSubject">${subjects.map(s=>`<option>${esc(s)}</option>`).join('')}</select><label>目标题量 / 次数</label><input id="fGoal" type="number" min="1" value="${Number(task?.goal)||60}"><label>积分</label><input id="fPoints" type="number" min="0" value="${Number(task?.points)||10}"></div>`;
    if(task){$('#fType').value=task.type;$('#fSubject').value=task.subject||'综合';}
    $('#modalSaveBtn').onclick=e=>{e.preventDefault();const data={title:$('#fTitle').value.trim(),type:$('#fType').value,subject:$('#fSubject').value,goal:Math.max(1,+$('#fGoal').value||1),points:Math.max(0,+$('#fPoints').value||0)};if(!data.title)return toast('先填写任务名称');if(task){Object.assign(task,data);delete task.minutes;}else state.tasks.push({id:Date.now(),projectId:state.activeProjectId||activeProject()?.id||null,done:0,correct:null,completed:false,date:'today',actualDate:todayStr(),auto:false,...data});save();renderTasks();$('#modal').close();toast(task?'任务已更新':'任务已添加');};
    $('#modal').showModal();
  };
  window.openTaskModal=openTaskModal;

  const baseEditTask=editTask;
  editTask=function(id){
    const task=state.tasks.find(x=>x.id===id);if(!task)return;
    baseEditTask(id);
    const saveBtn=$('#modalSaveBtn'),baseSave=saveBtn.onclick;
    saveBtn.onclick=e=>{task.manualEdited=true;baseSave(e);};
  };
  window.editTask=editTask;

  renderTaskCard=function(t,home=false){
    const id=Number(t.id);
    return `<div class="task-swipe" data-task-id="${id}"><div class="task-swipe-actions"><button class="swipe-edit" type="button" onclick="editTask(${id})">编辑</button><button class="swipe-delete" type="button" onclick="deleteTask(${id})">删除</button></div><article class="task-card task-swipe-content ${t.completed?'completed':''}"><div class="task-top"><div><h4>${esc(t.title)}</h4><div class="task-meta"><span>${esc(t.type)}</span><span>＋${Number(t.points)||0} 积分</span>${t.auto?'<span class="auto-tag">排班生成</span>':''}${t.manualEdited?'<span class="auto-tag">已调整</span>':''}</div></div></div><div class="task-bottom"><span class="task-progress">${taskProgressText(t)}</span><div class="task-actions-inline">${t.completed?`<button class="task-action done" onclick="toggleTask(${id})">已完成</button>`:`<button class="task-action" onclick="startTask(${id})">开始专注</button><button class="complete-mini" onclick="toggleTask(${id})">完成</button>`}</div></div></article></div>`;
  };

  let swipeState=null;
  function closeTaskSwipes(except=null){document.querySelectorAll('.task-swipe.open').forEach(el=>{if(el!==except)el.classList.remove('open');});}
  document.addEventListener('pointerdown',e=>{
    const content=e.target.closest('.task-swipe-content');if(!content)return;
    const wrap=content.closest('.task-swipe');closeTaskSwipes(wrap);
    swipeState={wrap,content,startX:e.clientX,startY:e.clientY,dx:0,horizontal:false,pointerId:e.pointerId};
    wrap.classList.add('dragging');
  });
  document.addEventListener('pointermove',e=>{
    if(!swipeState||e.pointerId!==swipeState.pointerId)return;
    const dx=e.clientX-swipeState.startX,dy=e.clientY-swipeState.startY;
    if(!swipeState.horizontal){if(Math.abs(dx)<8&&Math.abs(dy)<8)return;if(Math.abs(dy)>Math.abs(dx)){swipeState.wrap.classList.remove('dragging');swipeState=null;return;}swipeState.horizontal=true;}
    swipeState.dx=Math.max(-144,Math.min(0,dx+(swipeState.wrap.classList.contains('open')?-144:0)));
    swipeState.content.style.transform=`translateX(${swipeState.dx}px)`;
  },{passive:true});
  function finishSwipe(e){
    if(!swipeState||e.pointerId!==swipeState.pointerId)return;
    const {wrap,content,dx,horizontal}=swipeState;wrap.classList.remove('dragging');content.style.transform='';
    if(horizontal&&dx<-48)wrap.classList.add('open');else wrap.classList.remove('open');
    swipeState=null;
  }
  document.addEventListener('pointerup',finishSwipe);document.addEventListener('pointercancel',finishSwipe);
  document.addEventListener('click',e=>{if(e.target.closest('.task-swipe-actions')){closeTaskSwipes();return;}if(!e.target.closest('.task-swipe'))closeTaskSwipes();});

  const titleRow=[...document.querySelectorAll('.section-title-row')].find(x=>x.textContent.includes('排班学习安排'));
  if(titleRow&&!document.getElementById('editScheduleBtn')){const pill=document.getElementById('todayShiftPill');const wrap=document.createElement('div');wrap.className='row-actions';const btn=document.createElement('button');btn.id='editScheduleBtn';btn.className='schedule-edit-btn';btn.textContent='编辑排班';btn.onclick=openScheduleModal;pill.parentNode.insertBefore(wrap,pill);wrap.append(btn,pill);}

  state.tasks.forEach(t=>{if(Object.prototype.hasOwnProperty.call(t,'minutes'))delete t.minutes;});
  if(!state.noTaskEstimateMigrated){regenerateFutureAutoTasks();state.noTaskEstimateMigrated=true;}
  save();renderAll();
})();