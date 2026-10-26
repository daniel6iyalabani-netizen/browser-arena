(function(){
 const el=id=>document.getElementById(id);
 function request(method,url,body,done){
  const x=new XMLHttpRequest();x.open(method,url);x.setRequestHeader('Content-Type','application/json');
  x.onload=()=>done(x.status>=200&&x.status<300?null:new Error('request failed'),x.responseText?JSON.parse(x.responseText):{});
  x.onerror=()=>done(new Error('network error'),{});x.send(body?JSON.stringify(body):null);
 }
 function refresh(){
  const list=el('global-leaderboard-list'),status=el('leaderboard-status');if(!list||!status)return;
  status.textContent='Loading rankings...';
  request('GET','/api/leaderboard',null,(err,data)=>{
   list.replaceChildren();
   if(err){const li=document.createElement('li');li.className='leaderboard-empty';li.textContent='Leaderboard offline. Try refreshing.';list.appendChild(li);status.textContent='CONNECTION UNAVAILABLE';return;}
   const entries=data.entries||[];
   if(!entries.length){const li=document.createElement('li');li.className='leaderboard-empty';li.textContent='No scores yet. Play a match to claim the first spot!';list.appendChild(li);}
   entries.slice(0,10).forEach(p=>{
    const li=document.createElement('li');li.className='leaderboard-entry';
    const who=document.createElement('span');who.className='leaderboard-player';
    const rank=document.createElement('b');rank.className='leaderboard-rank';rank.textContent=String(p.rank).padStart(2,'0');
    const name=document.createElement('span');name.textContent=p.name;who.append(rank,name);
    const score=document.createElement('b');score.textContent=Number(p.score||0).toLocaleString();
    const wins=document.createElement('span');wins.textContent=Number(p.wins||0).toLocaleString();
    li.append(who,score,wins);list.appendChild(li);
   });
   status.textContent=data.persistent?'GLOBAL RANKINGS · PERSISTENT DATABASE':'SHARED SERVER · RESETS ON RESTART';
  });
 }
 el('leaderboard-refresh')?.addEventListener('click',refresh);refresh();
 window.addEventListener('browserarena:matchresult',e=>{
  const d=e.detail||{};
  request('POST','/api/leaderboard',{name:d.name,kills:d.kills,wins:d.wins,score:(Number(d.kills)||0)+(Number(d.wins)||0)*10},err=>{
   if(err){const status=el('leaderboard-status');if(status)status.textContent='SCORE NOT SAVED · CHECK CONNECTION';return;}
   refresh();
  });
 });
})();
