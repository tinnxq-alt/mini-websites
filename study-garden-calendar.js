(()=>{
  if(!Array.isArray(state.calendarEvents)) state.calendarEvents=[];
  state.version=Math.max(Number(state.version)||0,9);

  // 首页排班只显示班次，不显示学科/套卷内容。
  renderSchedule=function(){
    const ds=todayStr(),shift=shiftFor(ds),today=parseDate(ds);
    $('#todayShiftPill').textContent=`${shift}班`;
    $('#todayShiftBadge').textContent=shift;
    $('#scheduleHeadline').textContent=`今日 · ${shift}班`;
    $('#scheduleNote').textContent='仅显示排班；学习任务请在任务页查看。';
    $('#scheduleDays').innerHTML=Array.from({length:5},(_,i)=>{
      const d=new Date(today);d.setDate(today.getDate()+i);const sh=shiftFor(fmtDate(d));
      return `<div class="schedule-day ${i===0?'today':''}"><span>${d.getMonth()+1}/${d.getDate()}</span><strong>${esc(sh)}</strong></div>`;
    }).join('');
  };

  const scheduleHeading=[...document.querySelectorAll('.section-title-row h3')].find(x=>x.textContent.includes('排班学习安排'));
  if(scheduleHeading)scheduleHeading.textContent='排班';

  const style=document.createElement('style');
  style.textContent=`
    .bottom-nav{grid-template-columns:repeat(6,1fr)}
    .bottom-nav .focus-nav span{width:auto;height:auto;display:block;margin:0;background:transparent;color:inherit;border-radius:0;box-shadow:none}
    .calendar-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0 14px}
    .calendar-toolbar strong{font-size:18px}
    .calendar-nav-btn{border:1px solid var(--line);background:var(--card);color:var(--accent-dark);border-radius:12px;padding:8px 12px;font-weight:800}
    .calendar-weekdays,.calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
    .calendar-weekdays{margin-bottom:6px}.calendar-weekdays span{text-align:center;font-size:11px;color:var(--muted);padding:4px 0}
    .calendar-day{min-width:0;min-height:76px;border:1px solid var(--line);background:var(--card);border-radius:14px;padding:8px 5px;display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--text);overflow:hidden}
    .calendar-day.empty{border-color:transparent;background:transparent;pointer-events:none}
    .calendar-day.today{box-shadow:inset 0 0 0 1px var(--accent);background:#fff7ec}.calendar-day.selected{border-color:var(--accent-dark)}
    .calendar-number{font-size:11px;color:var(--muted);align-self:flex-start}.calendar-shift{font-size:16px;color:var(--accent-dark)}
    .calendar-event-preview{width:100%;font-size:9px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:2px 4px;border-radius:6px;background:#eee5d8;color:#756552}
    .calendar-more{font-size:9px;color:var(--muted)}
    .calendar-detail{margin-top:14px;background:var(--card);border-radius:var(--radius);padding:16px;box-shadow:var(--shadow)}
    .calendar-detail-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.calendar-detail-head h3{margin:0;font-size:17px}
    .calendar-event-item{display:flex;align-items:center;gap:10px;padding:11px 0;border-top:1px solid var(--line)}.calendar-event-item:first-of-type{border-top:0}
    .calendar-event-time{min-width:46px;font-size:12px;color:var(--accent-dark);font-weight:800}.calendar-event-copy{flex:1;min-width:0}.calendar-event-copy strong{font-size:14px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .calendar-mini-actions{display:flex;gap:5px}.calendar-mini-actions button{border:0;background:#eee5d8;color:var(--muted);border-radius:9px;padding:6px 8px;font-size:11px}.calendar-mini-actions .danger{background:#f2dfda;color:#9a6258}
    @media(max-width:480px){.bottom-nav{padding-left:6px;padding-right:6px}.bottom-nav small{font-size:9px}.calendar-grid,.calendar-weekdays{gap:4px}.calendar-day{min-height:70px;padding:6px 3px;border-radius:12px}}
  `;
  document.head.appendChild(style);

  let calendarCursor=new Date();calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth(),1);
  let selectedCalendarDate=todayStr();
  const calendarEventsFor=dateStr=>(state.calendarEvents||[]).filter(e=>e.date===dateStr).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
  const weekdayLabel=dateStr=>['日','一','二','三','四','五','六'][parseDate(dateStr).getDay()];

  function renderCalendar(){
    if(!document.querySelector('[data-page="calendar"]'))return;
    const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();
    $('#calendarMonthLabel').textContent=`${y}年 ${m+1}月`;
    const first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),offset=(first.getDay()+6)%7,cells=[];
    for(let i=0;i<offset;i++)cells.push('<div class="calendar-day empty"></div>');
    for(let day=1;day<=days;day++){
      const ds=fmtDate(new Date(y,m,day)),events=calendarEventsFor(ds),shift=shiftFor(ds);
      const preview=events[0]?`<small class="calendar-event-preview">${esc((events[0].time?events[0].time+' ':'')+events[0].title)}</small>`:'';
      const more=events.length>1?`<small class="calendar-more">+${events.length-1}</small>`:'';
      cells.push(`<button type="button" class="calendar-day ${ds===todayStr()?'today':''} ${ds===selectedCalendarDate?'selected':''}" data-calendar-date="${ds}"><span class="calendar-number">${day}</span><strong class="calendar-shift">${esc(shift)}</strong>${preview}${more}</button>`);
    }
    $('#calendarGrid').innerHTML=cells.join('');
    $$('[data-calendar-date]').forEach(b=>b.onclick=()=>{selectedCalendarDate=b.dataset.calendarDate;renderCalendar();});
    const events=calendarEventsFor(selectedCalendarDate);
    $('#calendarSelectedTitle').textContent=`${selectedCalendarDate} · 周${weekdayLabel(selectedCalendarDate)}`;
    $('#calendarSelectedShift').textContent=`${shiftFor(selectedCalendarDate)}班`;
    $('#calendarEventList').innerHTML=events.length?events.map(e=>`<div class="calendar-event-item"><span class="calendar-event-time">${esc(e.time||'日程')}</span><div class="calendar-event-copy"><strong>${esc(e.title)}</strong></div><div class="calendar-mini-actions"><button type="button" onclick="editCalendarEvent(${Number(e.id)})">编辑</button><button type="button" class="danger" onclick="deleteCalendarEvent(${Number(e.id)})">删除</button></div></div>`).join(''):'<p class="muted" style="margin:8px 0 0">当天暂无日程。</p>';
  }

  function openCalendarEventModal(dateStr,event=null){
    $('#modalTitle').textContent=event?'编辑日程':'添加日程';
    $('#modalBody').innerHTML=`<div class="modal-body"><label>日期</label><input id="calDate" type="date" value="${escAttr(event?.date||dateStr)}"><label>时间（可选）</label><input id="calTime" type="time" value="${escAttr(event?.time||'')}"><label>日程</label><input id="calTitle" value="${escAttr(event?.title||'')}" placeholder="例如：跳舞 / 复诊 / 聚餐"></div>`;
    $('#modalSaveBtn').onclick=e=>{e.preventDefault();const date=$('#calDate').value,title=$('#calTitle').value.trim(),time=$('#calTime').value;if(!date||!title)return toast('请填写日期和日程');if(event){event.date=date;event.title=title;event.time=time;}else state.calendarEvents.push({id:Date.now(),date,title,time});selectedCalendarDate=date;const d=parseDate(date);calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);save();renderCalendar();$('#modal').close();toast(event?'日程已更新':'日程已添加');};
    $('#modal').showModal();
  }
  window.editCalendarEvent=id=>{const e=state.calendarEvents.find(x=>x.id===id);if(e)openCalendarEventModal(e.date,e);};
  window.deleteCalendarEvent=id=>{const e=state.calendarEvents.find(x=>x.id===id);if(!e)return;if(!confirm(`确认删除日程“${e.title}”？`))return;state.calendarEvents=state.calendarEvents.filter(x=>x.id!==id);save();renderCalendar();toast('日程已删除');};

  if(!document.querySelector('[data-page="calendar"]')){
    const page=document.createElement('section');page.className='page';page.dataset.page='calendar';
    page.innerHTML=`<div class="page-head"><div><span class="eyebrow">Calendar</span><h2>日历</h2><p class="muted">先看排班；有日程时再显示日程。</p></div><button class="primary-small" id="newCalendarEventBtn">＋ 日程</button></div><div class="calendar-toolbar"><button class="calendar-nav-btn" id="calendarPrevBtn" type="button">‹</button><strong id="calendarMonthLabel"></strong><button class="calendar-nav-btn" id="calendarNextBtn" type="button">›</button></div><div class="calendar-weekdays"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="calendar-grid" id="calendarGrid"></div><article class="calendar-detail"><div class="calendar-detail-head"><div><h3 id="calendarSelectedTitle"></h3><span class="soft-pill" id="calendarSelectedShift"></span></div><button class="primary-small" id="calendarAddSelectedBtn" type="button">＋ 添加</button></div><div id="calendarEventList"></div></article>`;
    const projectsPage=document.querySelector('[data-page="projects"]');projectsPage.parentNode.insertBefore(page,projectsPage);
    const nav=document.querySelector('.bottom-nav'),homeBtn=nav.querySelector('[data-nav="home"]'),btn=document.createElement('button');
    btn.type='button';btn.dataset.nav='calendar';btn.innerHTML='<span>□</span><small>日历</small>';homeBtn.insertAdjacentElement('afterend',btn);
    btn.addEventListener('click',()=>{navigate('calendar');renderCalendar();});
    $('#calendarPrevBtn').onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar();};
    $('#calendarNextBtn').onclick=()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar();};
    $('#newCalendarEventBtn').onclick=()=>openCalendarEventModal(selectedCalendarDate);
    $('#calendarAddSelectedBtn').onclick=()=>openCalendarEventModal(selectedCalendarDate);
  }

  const baseRenderAll=renderAll;
  renderAll=function(){baseRenderAll();renderCalendar();};
  save();renderAll();
})();
