(function(){
 const $=id=>document.getElementById(id);
 const KEY='browserArenaSeasonV1',DAY=new Date().toISOString().slice(0,10);
 const fresh=()=>({day:DAY,matches:0,kills:0,wins:0,rating:1000,completed:[],unlocks:[]});
 function load(){try{const v=JSON.parse(localStorage.getItem(KEY)||'null');return v&&typeof v==='object'?{...fresh(),rating:Number(v.rating)||1000,...(v.day===DAY?v:{})}:fresh();}catch{return fresh();}}
 let data=load();
 const challenges=[{id:'matches',title:'Drop In',description:'Complete 3 matches today',goal:3},{id:'kills',title:'Elimination Run',description:'Earn 5 eliminations today',goal:5},{id:'wins',title:'Claim Victory',description:'Win 1 match today',goal:1}];
 const skins=[{level:2,name:'Solar Gold',value:'#b6a52f'},{level:4,name:'Plasma Violet',value:'#9e69d1'},{level:6,name:'Arctic Silver',value:'#dce5e8'},{level:8,name:'Volt Blue',value:'#2b9ce8'}];
 function career(){try{return JSON.parse(localStorage.getItem('browserArenaCareerV1')||'{}');}catch{return {};}}
 function level(){return Math.floor(Math.max(0,Number(career().xp)||0)/100)+1;}
 function save(){localStorage.setItem(KEY,JSON.stringify(data));render();}
 function ensurePanel(){if($('season-card'))return;const panel=document.createElement('section');panel.id='season-card';panel.className='season-card';panel.innerHTML='<div class="season-head"><div><span>SEASON 02 / DAILY OPS</span><h3>Ranked & rewards</h3></div><b id="season-rating">BRONZE · 1000</b></div><p>Build your rating, complete daily challenges, and unlock equipment colours as your career level rises.</p><div id="season-challenges" class="season-challenges"></div><div id="season-skins" class="season-rewards"></div>';const card=document.querySelector('.progress-card');if(card)card.insertAdjacentElement('afterend',panel);}
 function render(){ensurePanel();const host=$('season-challenges');if(!host)return;host.replaceChildren();const achieved=new Set(data.completed);for(const c of challenges){const n=Math.min(c.goal,Number(data[c.id])||0),done=n>=c.goal;const row=document.createElement('div');row.className='season-challenge';const title=document.createElement('b');title.textContent=(done?'✓ ':'')+c.title;const desc=document.createElement('small');desc.textContent=c.description+' · '+n+'/'+c.goal;const bar=document.createElement('div');bar.className='season-progress';const fill=document.createElement('span');fill.style.width=(n/c.goal*100)+'%';bar.append(fill);row.append(title,desc,bar);host.append(row);if(done&&!achieved.has(c.id)){data.completed.push(c.id);}}
 const rating=Math.max(0,Number(data.rating)||1000),division=rating>=1800?'DIAMOND':rating>=1500?'GOLD':rating>=1200?'SILVER':'BRONZE';$('season-rating').textContent=division+' · '+rating;
 const lv=level(),unlocked=skins.filter(s=>lv>=s.level);data.unlocks=unlocked.map(s=>s.name);$('season-skins').textContent='UNLOCKED SKINS: '+(unlocked.length?unlocked.map(s=>s.name).join(' · '):'Reach level 2 to unlock Solar Gold.');
 const select=$('gun-color');if(select){for(const skin of skins){let opt=[...select.options].find(o=>o.value===skin.value);if(!opt){opt=document.createElement('option');opt.value=skin.value;opt.textContent=skin.name+' · LVL '+skin.level;select.append(opt);}opt.disabled=lv<skin.level;opt.textContent=(lv<skin.level?'🔒 ':'')+skin.name+' · LVL '+skin.level;}}
 try{localStorage.setItem(KEY,JSON.stringify(data));}catch{}
 }
 window.addEventListener('browserarena:matchresult',e=>{const d=e.detail||{};data.matches++;data.kills+=Math.max(0,Number(d.kills)||0);const won=Number(d.wins)>0;if(won)data.wins++;data.rating=Math.max(0,data.rating+(won?24:-12)+Math.min(10,Math.max(0,Number(d.kills)||0)));save();});
 ensurePanel();render();
})();