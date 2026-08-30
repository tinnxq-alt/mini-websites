(()=>{
'use strict';
const CUSTOM='__custom__';
const $=s=>document.querySelector(s);
function categorySubject(){
  const v=$('#rollCatalogCategory')?.value;
  if(v==='surgery')return '外科';
  if(v==='biochem')return '生化';
  return '综合';
}
function ensureUI(){
  const sel=$('#rollPreset'),hidden=$('#rollCustomName'),subject=$('#rollSubject');
  if(!sel||!hidden)return;
  if(![...sel.options].some(o=>o.value===CUSTOM)){
    const o=document.createElement('option');o.value=CUSTOM;o.textContent='＋ 自己添加';sel.appendChild(o);
  }
  let wrap=$('#rollCustomVisibleWrap');
  if(!wrap){
    wrap=document.createElement('label');wrap.id='rollCustomVisibleWrap';wrap.className='hidden';wrap.innerHTML='自定义内容<input id="rollCustomVisible" type="text" maxlength="120" placeholder="输入章节、知识点或复习内容">';
    sel.closest('label')?.after(wrap);
  }
  if(subject){const want=categorySubject();if([...subject.options].some(o=>o.value===want||o.textContent===want))subject.value=want}
  sync();
}
function sync(){
  const sel=$('#rollPreset'),wrap=$('#rollCustomVisibleWrap'),input=$('#rollCustomVisible'),hidden=$('#rollCustomName'),subject=$('#rollSubject');
  if(!sel||!hidden)return;
  const custom=sel.value===CUSTOM;
  wrap?.classList.toggle('hidden',!custom);
  hidden.value=custom?(input?.value.trim()||''):'';
  if(subject&&custom){const want=categorySubject();if([...subject.options].some(o=>o.value===want||o.textContent===want))subject.value=want}
  if(custom)setTimeout(()=>input?.focus(),0);
}
document.addEventListener('click',e=>{if(e.target.closest('[data-a="add-rolling"]'))setTimeout(ensureUI,10)});
document.addEventListener('change',e=>{
  if(e.target.id==='rollCatalogCategory')setTimeout(()=>{ensureUI();sync()},0);
  if(e.target.id==='rollPreset')sync();
});
document.addEventListener('input',e=>{if(e.target.id==='rollCustomVisible')sync()});
document.addEventListener('submit',e=>{if(e.target.id==='rollingForm')sync()},true);
setTimeout(ensureUI,0);
})();
