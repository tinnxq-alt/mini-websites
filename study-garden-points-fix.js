(()=>{
  state.version=Math.max(Number(state.version)||0,13);

  // Completed tasks are locked from editing/deleting. Tap “已完成” to undo first.
  const previousEditTask=editTask;
  editTask=function(id){
    const task=state.tasks.find(x=>x.id===id);if(!task)return;
    if(task.completed){toast('已完成任务请先撤销完成，再进行编辑');return;}
    previousEditTask(id);
  };
  window.editTask=editTask;

  deleteTask=function(id){
    const task=state.tasks.find(x=>x.id===id);if(!task)return;
    if(task.completed){toast('已完成任务请先撤销完成，再进行删除');return;}
    if(!confirm(`确认删除任务“${task.title}”？`))return;
    state.tasks=state.tasks.filter(x=>x.id!==id);
    if(state.activeTaskId===id)state.activeTaskId=null;
    save();renderAll();toast('任务已删除');
  };
  window.deleteTask=deleteTask;

  renderTaskCard=function(t,home=false){
    const id=Number(t.id),points=Number(t.points)||0;
    const card=`<article class="task-card ${t.completed?'completed':''} ${t.completed?'':'task-swipe-content'}"><div class="task-top"><div><h4>${esc(t.title)}</h4><div class="task-meta"><span>${esc(t.type)}</span><span>${points>=0?'＋':''}${points} 积分</span>${t.auto?'<span class="auto-tag">排班生成</span>':''}${t.manualEdited?'<span class="auto-tag">已调整</span>':''}</div></div></div><div class="task-bottom"><span class="task-progress">${taskProgressText(t)}</span><div class="task-actions-inline">${t.completed?`<button class="task-action done" onclick="toggleTask(${id})">已完成</button>`:`<button class="task-action" onclick="startTask(${id})">开始专注</button><button class="complete-mini" onclick="toggleTask(${id})">完成</button>`}</div></div></article>`;
    if(t.completed)return card;
    return `<div class="task-swipe" data-task-id="${id}"><div class="task-swipe-actions"><button class="swipe-edit" type="button" onclick="editTask(${id})">编辑</button><button class="swipe-delete" type="button" onclick="deleteTask(${id})">删除</button></div>${card}</div>`;
  };
  window.renderTaskCard=renderTaskCard;

  // Points are a true balance and may go below zero. This enables reward advances.
  toggleTask=function(id){
    const t=state.tasks.find(x=>x.id===id);if(!t)return;
    const points=Number(t.points)||0;
    if(t.completed){
      t.completed=false;
      if(t.completionSnapshot){t.done=t.completionSnapshot.done;t.correct=t.completionSnapshot.correct;delete t.completionSnapshot;}
      state.points=(Number(state.points)||0)-points;
      state.ledger.unshift({text:`撤销完成「${t.title}」`,value:-points,time:'刚刚'});
      toast(`已撤销，${points>=0?'-':'+'}${Math.abs(points)}积分`);
    }else{
      t.completionSnapshot={done:t.done||0,correct:Number.isFinite(t.correct)?t.correct:null};
      t.completed=true;
      state.points=(Number(state.points)||0)+points;
      state.ledger.unshift({text:`完成「${t.title}」`,value:points,time:'刚刚'});
      toast(`完成任务，${points>=0?'+':''}${points}积分`);
    }
    save();renderAll();
  };
  window.toggleTask=toggleTask;

  redeem=function(id){
    const r=state.rewards.find(x=>x.id===id);if(!r)return;
    const cost=Math.max(0,Number(r.cost)||0);
    state.points=(Number(state.points)||0)-cost;
    state.ledger.unshift({text:`兑换「${r.name}」`,value:-cost,time:'刚刚'});
    save();renderRewards();
    toast(state.points<0?`已预支兑换：${r.name} · 当前 ${state.points} 积分`:`已兑换：${r.name}`);
  };
  window.redeem=redeem;

  const previousRenderRewards=renderRewards;
  renderRewards=function(){
    previousRenderRewards();
    const points=Number(state.points)||0;
    const rewardPoints=$('#rewardPoints'),headerPoints=$('#headerPoints');
    if(rewardPoints){rewardPoints.textContent=points;rewardPoints.style.color=points<0?'#9d6d64':'';}
    if(headerPoints)headerPoints.textContent=points;
    const label=document.querySelector('[data-page="rewards"] .points-total span');
    if(label)label.textContent=points<0?'预支积分':'当前积分';
  };
  window.renderRewards=renderRewards;

  save();renderAll();
})();