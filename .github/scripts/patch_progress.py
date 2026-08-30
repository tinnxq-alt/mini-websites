from pathlib import Path
import re

p = Path('xizong-study/app.js')
s = p.read_text()
original = s
s = s.replace("const V=14,", "const V=15,", 1)
s = s.replace("let state=load(),view='today',installPrompt=null,timerTaskId=null,timerTick=null,timerAlerted=false;", "let state=load(),view='today',installPrompt=null,timerTaskId=null,timerTick=null,timerAlerted=false,editingProgressSubject=null;", 1)

new_render = '''function renderPlan(){const a=activeSubjects(),n=nextPaper();return `<section class="card"><h2>学习安排</h2><p class="muted">任务只安排“学什么”，不提前规定每项学多久。开始任务时可自己选择正计时、倒计时或直接完成。</p><div class="callout">普通学习、刷题、错题复盘不记录题量和正确率；只有套卷保留 165 题与正确率。</div></section><div class="section"><h2>当前推进学科</h2><span class="small muted">可多选 · 单独保存</span></div><section class="card"><div class="subject-grid">${SUB.map(s=>`<label class="subject-choice"><input class="subject-check" type="checkbox" value="${s}" ${a.includes(s)?'checked':''}><span>${s}</span></label>`).join('')}</div><button class="btn primary" data-a="save-subjects">保存推进学科</button></section><div class="section"><h2>学科进度</h2><span class="small muted">一次只修改一科</span></div><section class="card">${SUB.map(s=>`<div class="range-row" data-row="${s}"><div class="listrow" style="padding:0 0 6px;border-bottom:0"><b>${s}</b><button class="recordbtn ${editingProgressSubject===s?'running':''}" data-a="edit-progress" data-subject="${s}">${editingProgressSubject===s?'保存':'修改'}</button></div><div class="range-wrap"><input class="prog-range" data-subject="${s}" type="range" min="0" max="100" step="1" value="${state.subjectProgress[s]||0}" ${editingProgressSubject===s?'':'disabled'}><output>${state.subjectProgress[s]||0}%</output></div></div>`).join('')}<div class="small muted" style="margin-top:10px">修改某一科时，其余学科保持锁定，保存后再修改下一科。</div></section><div class="section"><h2>套卷清单</h2><span class="small muted">可添加</span></div><section class="card"><div class="grid2" style="align-items:end"><label style="margin:0">套卷名称<input id="mockName" placeholder="如：2025 二刷 / 模拟卷 A"></label><button class="btn secondary" data-a="add-mock">＋ 添加套卷</button></div><div class="small muted" style="margin:9px 0 12px">套卷统一按 165 题管理；可计时并记录正确率。</div>${state.mockPapers.length?state.mockPapers.map(p=>`<div class="listrow"><div style="min-width:0"><b>${esc(p.name)}</b><div class="small muted">${p.done?'已完成':(n?.id===p.id?'下一套':'待安排')} · 165 题</div></div><div class="mock-actions"><button class="mockbtn ${n?.id===p.id&&!p.done?'done':''}" data-a="set-next-mock" data-id="${p.id}" ${p.done?'disabled':''}>${n?.id===p.id&&!p.done?'✓ 下一套':'设为下一套'}</button><button class="mockbtn ${p.done?'done':''}" data-a="toggle-mock" data-id="${p.id}">${p.done?'✓ 已完成':'标记完成'}</button><button class="xbtn" data-a="del-mock" data-id="${p.id}">×</button></div></div>`).join(''):'<div class="empty">还没有套卷</div>'}</section>`}'''
s, count = re.subn(r"function renderPlan\(\)\{.*?\nfunction recordHTML", new_render + "\nfunction recordHTML", s, count=1, flags=re.S)
if count != 1:
    raise SystemExit('renderPlan patch failed')

new_save = '''function saveSubjects(){const selected=$$('.subject-check:checked').map(x=>x.value).filter(x=>SUB.includes(x));if(!selected.length)return toast('至少选择 1 门学科');state.activeSubjects=selected;state.tasks=state.tasks.filter(t=>!(t.auto&&t.date===today()&&!t.done));save();render();toast('推进学科已保存')}
function editProgress(subject){if(!SUB.includes(subject))return;if(editingProgressSubject&&editingProgressSubject!==subject)return toast(`请先保存${editingProgressSubject}进度`);if(editingProgressSubject===subject){const input=document.querySelector(`.prog-range[data-subject="${subject}"]`);state.subjectProgress[subject]=clamp(Number(input?.value)||0,0,100);editingProgressSubject=null;save();render();toast(`${subject}进度已保存`);return}editingProgressSubject=subject;render();setTimeout(()=>document.querySelector(`.prog-range[data-subject="${subject}"]`)?.focus(),0)}'''
s, count = re.subn(r"function savePlan\(\)\{.*?\nfunction exportData", new_save + "\nfunction exportData", s, count=1, flags=re.S)
if count != 1:
    raise SystemExit('savePlan patch failed')

s = s.replace("if(nav){view=nav.dataset.view;render();return}", "if(nav){editingProgressSubject=null;view=nav.dataset.view;render();return}", 1)
s = s.replace("if(a==='save-plan')savePlan();", "if(a==='save-subjects')saveSubjects();if(a==='edit-progress')editProgress(b.dataset.subject);", 1)
s = s.replace('PWA v14', 'PWA v15')
if s == original:
    raise SystemExit('app.js unchanged')
p.write_text(s)

p = Path('xizong-study/index.html')
p.write_text(p.read_text().replace('?v=14', '?v=15'))

p = Path('xizong-study/sw.js')
s = p.read_text().replace("xizong-study-v14-20260830", "xizong-study-v15-20260830").replace('?v=14', '?v=15')
p.write_text(s)
