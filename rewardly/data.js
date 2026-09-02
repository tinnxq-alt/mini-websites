const COLORS=['sage','blue','pink','apricot','lav'];
const TYPES={daily:'每日',weekly:'每周',challenge:'挑战',once:'一次性'};
const TYPE_HINT={daily:8,weekly:15,challenge:20,once:30};
const LEVELS=[
 {min:0,max:199,name:'Lv.1 起步者'},{min:200,max:499,name:'Lv.2 行动者'},{min:500,max:999,name:'Lv.3 稳定成长者'},
 {min:1000,max:1799,name:'Lv.4 自律玩家'},{min:1800,max:2999,name:'Lv.5 长期主义者'},{min:3000,max:Infinity,name:'Lv.6 人生升级者'}
];
const DEFAULT={
 points:0,checkedDate:'',streak:0,bestStreak:0,bestCoreStreak:0,
 tasks:[
  {id:101,title:'完成今日计划学习',desc:'完成今天最重要的一段学习',reward:8,category:'study',type:'daily',icon:'📚',color:'sage',active:true,core:true},
  {id:102,title:'完成当天刷题目标',desc:'按自己设定的题量完成，不要求完美',reward:8,category:'study',type:'daily',icon:'✍️',color:'blue',active:true,core:true},
  {id:103,title:'错题复盘',desc:'整理并理解今天的关键错题',reward:10,category:'study',type:'daily',icon:'🧠',color:'pink',active:true,core:true},
  {id:104,title:'无手机专注 30 分钟',desc:'完整专注一段时间',reward:5,category:'growth',type:'daily',icon:'📵',color:'lav',active:true,core:false},
  {id:105,title:'整理环境 15 分钟',desc:'桌面、房间或生活杂务任选',reward:4,category:'life',type:'daily',icon:'🧹',color:'apricot',active:true,core:false},
  {id:106,title:'完成一次运动',desc:'力量、跑步、舞蹈或快走均可',reward:8,category:'life',type:'daily',icon:'🏃',color:'sage',active:true,core:false},
  {id:201,title:'完成一套模拟卷 / 整套训练',desc:'高价值深度任务',reward:20,category:'study',type:'weekly',icon:'🎯',color:'pink',active:true,core:false},
  {id:202,title:'完成本周复盘',desc:'总结本周完成、问题与下周重点',reward:15,category:'growth',type:'weekly',icon:'📝',color:'blue',active:true,core:false},
  {id:203,title:'整理下一周计划',desc:'提前确定下周最重要的事情',reward:10,category:'growth',type:'weekly',icon:'🗓️',color:'sage',active:true,core:false},
  {id:301,title:'完成拖延超过 7 天的事情',desc:'专门奖励突破长期拖延',reward:15,category:'growth',type:'challenge',icon:'⚡',color:'apricot',active:true,core:false},
  {id:302,title:'完成一个阶段目标',desc:'里程碑式成果，而不是普通待办',reward:30,category:'growth',type:'challenge',icon:'🏁',color:'lav',active:true,core:false},
  {id:401,title:'完成一个月度目标',desc:'月度级成果奖励',reward:50,category:'growth',type:'once',icon:'🏆',color:'pink',active:true,core:false}
 ],
 rewards:[
  {id:1,title:'快乐奶茶',desc:'一杯完全不用纠结的奖励。',cost:150,icon:'🧋',color:'pink',active:true},
  {id:2,title:'自由娱乐 2 小时',desc:'安心玩，不把它算作拖延。',cost:250,icon:'🎮',color:'blue',active:true},
  {id:3,title:'看一场电影',desc:'电影、展览或一次小型娱乐。',cost:350,icon:'🎬',color:'lav',active:true},
  {id:4,title:'外出吃自助',desc:'认真努力后，好好吃一顿。',cost:600,icon:'🍲',color:'apricot',active:true},
  {id:5,title:'心愿小物',desc:'给自己买一个喜欢的小东西。',cost:1000,icon:'🎁',color:'sage',active:true},
  {id:6,title:'特别奖励',desc:'旅行、体验课或更大的心愿。',cost:2000,icon:'✨',color:'lav',active:true},
  {id:7,title:'一杯咖啡',desc:'选一杯自己真正想喝的。',cost:120,icon:'☕',color:'sage',active:true},
  {id:8,title:'喜欢的甜品',desc:'蛋糕、冰淇淋或其他小甜点。',cost:180,icon:'🍰',color:'pink',active:true},
  {id:9,title:'自由点一次外卖',desc:'今天不纠结性价比，点想吃的。',cost:300,icon:'🥡',color:'apricot',active:true},
  {id:10,title:'买一本喜欢的书',desc:'纸质书、电子书都可以。',cost:400,icon:'📖',color:'blue',active:true},
  {id:11,title:'吃一顿火锅',desc:'和喜欢的人，或者自己去吃。',cost:500,icon:'🍲',color:'pink',active:true},
  {id:12,title:'半天完全休息',desc:'半天不安排学习和工作任务。',cost:450,icon:'🌿',color:'sage',active:true},
  {id:13,title:'按摩 / 足疗一次',desc:'把恢复体力也当作正式奖励。',cost:700,icon:'💆',color:'lav',active:true},
  {id:14,title:'买件喜欢的小物',desc:'小饰品、文具、桌面小物等。',cost:800,icon:'🛍️',color:'apricot',active:true},
  {id:15,title:'买一件喜欢的衣服',desc:'非刚需，纯粹因为喜欢。',cost:1200,icon:'👕',color:'blue',active:true},
  {id:16,title:'周末一日小旅行',desc:'给自己安排一次真正的出门放松。',cost:1500,icon:'🚃',color:'sage',active:true},
  {id:17,title:'兴趣体验一次',desc:'舞蹈、手作、展览或体验课。',cost:900,icon:'🎨',color:'lav',active:true},
  {id:18,title:'大餐自由选择',desc:'不用看价格先选最想吃的。',cost:1000,icon:'🍽️',color:'apricot',active:true}
 ],
 completions:{},weeklyCompletions:{},onceCompletions:[],completionRewards:{},weeklyCompletionRewards:{},onceCompletionRewards:{},
 coreDays:[],bonusesAwarded:{},history:[],redeems:[]
};
let data=load(),currentFilter='all';