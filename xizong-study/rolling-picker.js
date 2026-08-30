(()=>{
'use strict';
const $=s=>document.querySelector(s);
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
const SUBJECT_ORDER=['病理','生化','外科','生理','内科','综合'];
let mode='preset';
function activeSubjects(){try{const x=JSON.parse(localStorage.getItem('xizong-study-v11')||'{}');return Array.isArray(x.activeSubjects)?x.activeSubjects:[]}catch{return []}}
function setOptions(el,items,valueFn=x=>x,labelFn=x=>x){if(!el)return;el.innerHTML='';items.forEach(x=>{const o=document.createElement('option');o.value=valueFn(x);o.textContent=labelFn(x);el.appendChild(o)})}
function preview(){const id=$('#rollPreset')?.value,item=CATALOG.find(x=>x.id===id),box=$('#rollPresetPreview');if(!box)return;if(!item){box.innerHTML='<span class="small muted">当前没有可选章节</span>';return}box.innerHTML=`<div class="small muted">已选章节</div><b>${item.name}</b><div class="small muted" style="margin-top:4px">${item.subject==='综合'?'综合 · 跨学科':item.subject} · ${item.group}</div>`}
function syncChapters(){const subject=$('#rollCatalogSubject')?.value,group=$('#rollGroup')?.value;const items=CATALOG.filter(x=>x.subject===subject&&x.group===group);setOptions($('#rollPreset'),items,x=>x.id,x=>x.name);preview()}
function syncGroups(){const subject=$('#rollCatalogSubject')?.value;const groups=[...new Set(CATALOG.filter(x=>x.subject===subject).map(x=>x.group))];setOptions($('#rollGroup'),groups);syncChapters()}
function syncSubjects(){const available=new Set(CATALOG.map(x=>x.subject));const items=SUBJECT_ORDER.filter(x=>available.has(x));setOptions($('#rollCatalogSubject'),items,x=>x,x=>x==='综合'?'综合（跨学科）':x);const preferred=activeSubjects().find(x=>items.includes(x));if(preferred)$('#rollCatalogSubject').value=preferred;syncGroups()}
function setMode(next){mode=next==='custom'?'custom':'preset';const preset=$('#rollPresetPanel'),custom=$('#rollCustomPanel'),input=$('#rollCustomName');preset?.classList.toggle('hidden',mode==='custom');custom?.classList.toggle('hidden',mode!=='custom');document.querySelectorAll('.roll-mode').forEach(b=>b.classList.toggle('active',b.dataset.rollMode===mode));if(input){input.required=mode==='custom';if(mode==='preset')input.value=''}if(mode==='custom'){const a=activeSubjects();if(a[0]&&$('#rollSubject'))$('#rollSubject').value=a[0]}}
function prepare(){if(!$('#rollingDialog')||!$('#rollCatalogSubject'))return;syncSubjects();setMode('preset');const input=$('#rollCustomName');if(input)input.value='';preview()}
document.addEventListener('click',e=>{const modeBtn=e.target.closest('[data-roll-mode]');if(modeBtn){e.preventDefault();setMode(modeBtn.dataset.rollMode);return}const add=e.target.closest('[data-a="add-rolling"]');if(add)setTimeout(prepare,0)});
document.addEventListener('change',e=>{if(e.target.id==='rollCatalogSubject')syncGroups();else if(e.target.id==='rollGroup')syncChapters();else if(e.target.id==='rollPreset')preview()});
const form=$('#rollingForm');if(form)form.addEventListener('submit',e=>{if(mode==='custom'&&!$('#rollCustomName').value.trim()){e.preventDefault();e.stopImmediatePropagation();$('#rollCustomName').focus();$('#rollCustomName').reportValidity()}},{capture:true});
prepare();
})();