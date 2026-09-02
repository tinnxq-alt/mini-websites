(()=>{
  const subjects=['病理','生化','外科','生理','内科'];

  function cleanAutoTaskTitle(task){
    if(!task||!task.auto||task.manualEdited)return false;
    const old=String(task.title||'');
    const type=String(task.type||'');
    let next=old;

    if(type==='模拟卷'||(/西综真题/.test(old)&&/(整套|模拟)/.test(old))){
      next='完整套卷训练';
    }else if(type==='套卷复盘'||/套卷复盘/.test(old)){
      next='套卷复盘 · 定位薄弱点';
    }else{
      const subject=task.subject||subjects.find(s=>old.includes(s));
      const part=old.match(/第\s*([123])\s*\/\s*3\s*批/);
      if(subject&&part){
        next=`${subject} · 真题训练 第 ${part[1]}/3 批`;
      }else{
        next=old
          .replace(/\b20\d{2}\b\s*/g,'')
          .replace(/2000\s*[–—-]\s*2016\s*/g,'')
          .replace(/\s{2,}/g,' ')
          .replace(/^[-·：:，,\s]+|[-·：:，,\s]+$/g,'')
          .trim();
      }
    }

    if(next&&next!==old){task.title=next;return true;}
    return false;
  }

  function cleanScheduleTasks(){
    if(!window.state||!Array.isArray(state.tasks))return false;
    let changed=false;
    state.tasks.forEach(t=>{if(cleanAutoTaskTitle(t))changed=true;});
    return changed;
  }

  const originalEnsure=typeof window.ensureScheduleTasks==='function'?window.ensureScheduleTasks:null;
  if(originalEnsure){
    window.ensureScheduleTasks=function(...args){
      const result=originalEnsure.apply(this,args);
      cleanScheduleTasks();
      return result;
    };
    try{ensureScheduleTasks=window.ensureScheduleTasks;}catch(_){ }
  }

  if(cleanScheduleTasks()&&typeof window.save==='function')save();
  if(typeof window.renderAll==='function')renderAll();
})();
