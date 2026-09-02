(()=>{
  // 专注仍由任务卡进入，但不再占用底部主导航。
  const focusNav=document.querySelector('[data-nav="focus"]');
  if(focusNav)focusNav.remove();
  const nav=document.querySelector('.bottom-nav');
  if(nav)nav.style.gridTemplateColumns='repeat(5,1fr)';

  const uiStyle=document.createElement('style');
  uiStyle.textContent=`
    .progress-section-heading{margin:2px 0 12px}
    .progress-section-heading.sub{margin-top:22px}
    .focus-summary-note{font-size:12px;color:var(--muted);margin:10px 0 0}
    .focus-trend .trend-line span{min-height:8px}
    .overall-summary-card{margin-bottom:18px}
  `;
  document.head.appendChild(uiStyle);

  const overviewTab=document.querySelector('[data-progress-tab="overview"]');
  const subjectsTab=document.querySelector('[data-progress-tab="subjects"]');
  const overviewPanel=document.querySelector('[data-progress-panel="overview"]');
  const subjectsPanel=document.querySelector('[data-progress-panel="subjects"]');
  if(overviewTab)overviewTab.textContent='专注统计';
  if(subjectsTab)subjectsTab.textContent='学科进度';
  if(overviewPanel){
    overviewPanel.innerHTML=`<div class="accuracy-hero"><div class="accuracy-metric"><strong id="focusTodayMinutes">0分钟</strong><span>今日专注</span></div><div class="accuracy-metric"><strong id="focusWeekMinutes">0分钟</strong><span>近7天专注</span></div><div class="accuracy-metric"><strong id="focusTotalMinutes">0分钟</strong><span>累计专注</span></div></div><article class="overview-card focus-trend"><div><span class="eyebrow">Focus</span><h3>近 7 天专注</h3></div><div class="trend-line" id="focusTrend"></div><div class="trend-labels" id="focusTrendLabels"></div><p class="focus-summary-note">专注由任务页的“开始专注”进入并自动记录。</p></article>`;
  }
  if(subjectsPanel){
    subjectsPanel.innerHTML=`<div class="section-title-row progress-section-heading"><h3>综合</h3><span class="soft-pill">当前项目</span></div><div class="accuracy-hero"><div class="accuracy-metric"><strong id="overallAccuracy">—</strong><span>综合刷题正确率</span></div><div class="accuracy-metric"><strong id="paperAverage">—</strong><span>套卷平均正确率</span></div><div class="accuracy-metric"><strong id="latestPaperAccuracy">—</strong><span>最近套卷</span></div></div><article class="overview-card overall-summary-card"><div><span class="eyebrow">Overall</span><h3>综合正确率趋势</h3></div><div class="trend-line" id="overallTrend"></div><div class="trend-labels" id="overallTrendLabels"></div></article><div class="section-title-row progress-section-heading sub"><h3>学科</h3></div><div id="subjectProgress" class="subject-list"></div>`;
  }

  function minutesText(value){
    const mins=Math.max(0,Math.round(Number(value)||0));
    if(mins<60)return `${mins}分钟`;
    const h=Math.floor(mins/60),m=mins%60;
    return m?`${h}小时${m}分`:`${h}小时`;
  }

  renderProgress=function(){
    const pid=state.activeProjectId;
    const overall=computedOverallAccuracy(pid);
    const projectPapers=state.papers.filter(p=>p.projectId===pid);
    const scored=projectPapers.filter(p=>Number.isFinite(p.accuracy));
    const avg=scored.length?Math.round(scored.reduce((n,p)=>n+p.accuracy,0)/scored.length):null;
    const latest=[...scored].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];

    const overallEl=$('#overallAccuracy'),paperAvgEl=$('#paperAverage'),latestEl=$('#latestPaperAccuracy');
    if(overallEl)overallEl.textContent=overall==null?'—':`${overall}%`;
    if(paperAvgEl)paperAvgEl.textContent=avg==null?'—':`${avg}%`;
    if(latestEl)latestEl.textContent=latest?`${latest.accuracy}%`:'—';

    const hist=[...(state.accuracyHistoryByProject?.[String(pid)]||[])];
    if(overall!=null&&hist[hist.length-1]!==overall)hist.push(overall);
    const last=hist.slice(-6),trend=$('#overallTrend'),trendLabels=$('#overallTrendLabels');
    if(trend)trend.innerHTML=last.length?last.map(v=>`<span style="height:${Math.max(18,Math.min(100,v))}%"></span>`).join(''):'<span style="height:18%"></span>';
    if(trendLabels)trendLabels.innerHTML=last.length?last.map((v,i)=>i===last.length-1?`<strong>${v}%</strong>`:`<span>${v}%</span>`).join(''):'<span>暂无数据</span>';

    const subjectRoot=$('#subjectProgress');
    if(subjectRoot)subjectRoot.innerHTML=state.subjects.map(s=>{
      const tasks=state.tasks.filter(t=>t.projectId===pid&&t.subject===s.name&&(t.done||0)>0&&Number.isFinite(t.correct));
      const questions=tasks.reduce((n,t)=>n+(t.done||0),0);
      const correct=tasks.reduce((n,t)=>n+Math.min(t.correct||0,t.done||0),0);
      const reviewed=tasks.filter(t=>t.type==='错题复盘').reduce((n,t)=>n+(t.done||0),0);
      const acc=questions?Math.round(correct/questions*100):null,width=acc==null?0:acc;
      return `<article class="subject-card"><div class="subject-row"><strong>${esc(s.name)}</strong><span>${acc==null?'—':acc+'%'}</span></div><div class="progress-track"><span style="width:${width}%"></span></div><div class="task-meta" style="margin-bottom:0"><span>${questions}题</span><span>正确 ${correct}题</span><span>已复盘 ${reviewed}</span></div></article>`;
    }).join('');

    const paperRoot=$('#paperProgress');
    if(paperRoot)paperRoot.innerHTML=projectPapers.map(p=>`<article class="paper-card" onclick="recordPaper(${Number(p.id)})"><div><h4>${esc(p.name)}</h4><p>${esc(p.date?p.date:p.note||'待记录')} · ${esc(p.kind)}</p></div><div class="paper-score"><strong>${p.accuracy==null?'—':p.accuracy+'%'}</strong><span>${p.accuracy==null?'点击记录':'正确率'}</span></div></article>`).join('');

    const sessions=(state.focusSessions||[]).filter(s=>s.projectId===pid);
    const today=todayStr(),todayMinutes=sessions.filter(s=>s.date===today).reduce((n,s)=>n+(Number(s.minutes)||0),0);
    const dates=Array.from({length:7},(_,i)=>{const d=parseDate(today);d.setDate(d.getDate()-(6-i));return fmtDate(d);});
    const daily=dates.map(ds=>sessions.filter(s=>s.date===ds).reduce((n,s)=>n+(Number(s.minutes)||0),0));
    const weekMinutes=daily.reduce((a,b)=>a+b,0),totalMinutes=sessions.reduce((n,s)=>n+(Number(s.minutes)||0),0);
    const ft=$('#focusTodayMinutes'),fw=$('#focusWeekMinutes'),fa=$('#focusTotalMinutes');
    if(ft)ft.textContent=minutesText(todayMinutes);if(fw)fw.textContent=minutesText(weekMinutes);if(fa)fa.textContent=minutesText(totalMinutes);
    const max=Math.max(1,...daily),focusTrend=$('#focusTrend'),focusLabels=$('#focusTrendLabels');
    if(focusTrend)focusTrend.innerHTML=daily.map(v=>`<span style="height:${v?Math.max(12,Math.round(v/max*100)):6}%"></span>`).join('');
    if(focusLabels)focusLabels.innerHTML=dates.map(ds=>`<span>${parseDate(ds).getMonth()+1}/${parseDate(ds).getDate()}</span>`).join('');
  };
  window.renderProgress=renderProgress;
  renderProgress();
})();