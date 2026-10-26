const express=require('express');
const http=require('http');
const path=require('path');
const {Server}=require('socket.io');
const app=express(),server=http.createServer(app);
const io=new Server(server,{cors:{origin:process.env.CLIENT_ORIGIN?process.env.CLIENT_ORIGIN.split(','):'*'},maxHttpBufferSize:1e5});
const PORT=Number(process.env.PORT||3000),MAX_PLAYERS=24;const MODE_SIZES={'1v1':1,'2v2':2,'3v3':3,'4v4':4,'5v5':5};
const players=new Map(),bots=new Map(),queues=new Map(),matches=new Map();let botSeq=0,matchSeq=0;
function lobbyInfo(room){const m=matches.get(room);if(!m)return;const members=[...players.entries()].filter(([,p])=>p.room===room);for(const [id] of members){const s=io.sockets.sockets.get(id);if(s)s.emit('mapLobby',{mode:m.mode,players:members.map(([pid,p])=>({id:pid,name:p.name,team:p.team})),maps:[{id:0,name:'INDUSTRIAL YARD'},{id:1,name:'DESERT OUTPOST'},{id:2,name:'FROST DEPOT'},{id:3,name:'ABANDONED WORKS'},{id:4,name:'OVERGROWN RUINS'},{id:5,name:'SKYBRIDGE'}],votes:Object.fromEntries(m.votes)});}}
function beginMatch(room){const m=matches.get(room);if(!m||m.started)return;m.started=true;const members=[...players.entries()].filter(([,p])=>p.room===room);const counts=[0,0];for(const [id,p] of members){p.map=m.map;p.health=100;p.shield=100*(1+(p.armor||0)*.03);p.x=(Math.random()-.5)*12;p.z=p.team===0?-12-Math.random()*4:12+Math.random()*4;while(positionBlocked(p.x,p.z,p.map,.6)){p.x=(Math.random()-.5)*10;p.z=p.team===0?-12-Math.random()*3:12+Math.random()*3;}const s=io.sockets.sockets.get(id);if(s)s.emit('matchStart',{map:m.map,mode:m.mode,team:p.team,x:p.x,z:p.z});counts[p.team]++;}syncBots(room);broadcast(room);}
function queuePlayer(id,mode){const p=players.get(id);if(!p)return;let q=queues.get(mode);if(!q){q=[];queues.set(mode,q);}if(!q.includes(id))q.push(id);p.mode=mode;p.room='queue:'+mode;const needed=(MODE_SIZES[mode]||1)*2;const waiting=q.map(pid=>players.get(pid)).filter(Boolean);for(const pid of q){const s=io.sockets.sockets.get(pid);if(s)s.emit('queueStatus',{mode,waiting:waiting.length,needed,message:'Waiting for '+needed+' real players to join '+mode+'.'});}if(waiting.length>=needed){const ids=q.splice(0,needed);const room='match:'+(++matchSeq);const m={room,mode,started:false,map:0,votes:new Map(),timer:null};matches.set(room,m);ids.forEach((pid,i)=>{const player=players.get(pid);if(!player)return;player.room=room;player.team=i%2;player.map=0;const s=io.sockets.sockets.get(pid);if(s){s.leave('queue:'+mode);s.join(room);}});lobbyInfo(room);m.timer=setTimeout(()=>{const tally=[0,0,0,0,0,0];for(const v of m.votes.values())tally[v]++;m.map=tally.indexOf(Math.max(...tally));beginMatch(room);},30000);}}
const WEAPON_COSTS=[0,300,900,400,650,700,1200,500];
const WEAPONS=[
 {mag:12,delay:190,damage:38,range:38,pellets:1,spread:.01},
 {mag:8,delay:300,damage:54,range:40,pellets:1,spread:.006},
 {mag:30,delay:82,damage:19,range:62,pellets:1,spread:.018},
 {mag:30,delay:115,damage:32,range:65,pellets:1,spread:.012},
 {mag:6,delay:620,damage:15,range:23,pellets:8,spread:.09},
 {mag:8,delay:460,damage:17,range:25,pellets:6,spread:.075},
 {mag:5,delay:950,damage:65,range:90,pellets:1,spread:.001},
 {mag:36,delay:68,damage:14,range:42,pellets:1,spread:.026}
];

const leaderboardMemory=new Map();
const leaderboardRate=new Map();
const hasSupabase=()=>!!(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY);
async function supabaseRequest(path,options={}){
 const base=process.env.SUPABASE_URL.replace(/\/+$/,'');
 const response=await fetch(base+'/rest/v1/'+path,{...options,headers:{apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json',Prefer:'return=representation',...(options.headers||{})}});
 if(!response.ok)throw new Error('Leaderboard database request failed: '+response.status);
 return response.status===204?[]:response.json();
}
function rankRows(rows){return rows.sort((a,b)=>(b.score-a.score)||(b.wins-a.wins)||(b.kills-a.kills)||a.name.localeCompare(b.name)).slice(0,50).map((p,i)=>({...p,rank:i+1}));}
async function getLeaderboard(){
 if(hasSupabase()){
  const rows=await supabaseRequest('browser_arena_leaderboard?select=name,score,kills,wins,updated_at&order=score.desc,wins.desc,kills.desc&limit=50');
  return rankRows(rows.map(p=>({name:cleanName(p.name),score:Number(p.score)||0,kills:Number(p.kills)||0,wins:Number(p.wins)||0,updatedAt:p.updated_at||null})));
 }
 return rankRows([...leaderboardMemory.values()].map(p=>({...p})));
}

app.use(express.json({limit:'8kb'}));
app.use(express.static(path.join(__dirname)));
app.get('/health',(_req,res)=>res.json({ok:true,players:players.size}));
app.get('/api/status',(_req,res)=>res.json({game:'Browser Arena',players:players.size,maxPlayers:MAX_PLAYERS}));
app.get('/api/leaderboard',async(_req,res)=>{try{res.set('Cache-Control','no-store');res.json({entries:await getLeaderboard(),persistent:hasSupabase()});}catch(err){console.error(err.message);res.status(503).json({error:'Leaderboard temporarily unavailable'});}});
app.post('/api/leaderboard',async(req,res)=>{
 const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim(),now=Date.now(),last=leaderboardRate.get(ip)||0;
 if(now-last<1500)return res.status(429).json({error:'Please wait before submitting again.'});
 leaderboardRate.set(ip,now);
 const name=cleanName(req.body?.name),score=Math.round(clamp(req.body?.score,0,1000000,0)),kills=Math.round(clamp(req.body?.kills,0,100000,0)),wins=Math.round(clamp(req.body?.wins,0,100000,0));
 if(!req.body||typeof req.body!=='object')return res.status(400).json({error:'Invalid score.'});
 try{
  if(hasSupabase()){
   await supabaseRequest('browser_arena_leaderboard?on_conflict=name',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({name,score,kills,wins,updated_at:new Date().toISOString()})});
  }else{
   const prev=leaderboardMemory.get(name)||{name,score:0,kills:0,wins:0};
   leaderboardMemory.set(name,{name,score:Math.max(prev.score,score),kills:Math.max(prev.kills,kills),wins:Math.max(prev.wins,wins),updatedAt:new Date().toISOString()});
  }
  res.json({ok:true,entries:await getLeaderboard(),persistent:hasSupabase()});
 }catch(err){console.error(err.message);res.status(503).json({error:'Could not save score. Check database configuration.'});}
});
function cleanName(v){return String(v||'Player').replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,18)||'Player';}
function clamp(v,min,max,fallback=0){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}

const MAP_LAYOUTS=[
 [[-18,-15,3.4,1.8,2.4],[18,-15,3.4,1.8,2.4],[-18,15,3.4,1.8,2.4],[18,15,3.4,1.8,2.4],[0,-24,1.2,3.2,1.2],[0,24,1.2,3.2,1.2],[-29,0,1.2,2.6,5],[29,0,1.2,2.6,5]],
 [[-25,-20,5,1.2,2],[-12,-10,2,2.5,2],[12,10,2,2.5,2],[25,20,5,1.2,2],[-25,20,2,2,5],[25,-20,2,2,5],[0,-27,8,1.1,1.2],[0,27,8,1.1,1.2]],
 [[-22,-22,2.5,2.4,2.5],[22,-22,2.5,2.4,2.5],[-22,22,2.5,2.4,2.5],[22,22,2.5,2.4,2.5],[-10,0,1.2,3.4,6],[10,0,1.2,3.4,6],[0,-28,5,1.1,1.2],[0,28,5,1.1,1.2]],
 [[-28,-24,4,2.2,2],[28,-24,4,2.2,2],[-28,24,4,2.2,2],[28,24,4,2.2,2],[-14,0,2,3.2,2],[14,0,2,3.2,2],[0,-18,1.2,3.4,7],[0,18,1.2,3.4,7]],
 [[-24,-22,3,2.8,3],[24,-22,3,2.8,3],[-24,22,3,2.8,3],[24,22,3,2.8,3],[-15,-8,2,2.4,5],[15,8,2,2.4,5],[-15,8,2,2.4,5],[15,-8,2,2.4,5]]
];
function mapObstacles(map){
 const id=Math.max(0,Math.min(4,Number(map)||0));
 const boxes=[[-0, -36,82,4,1],[0,36,82,4,1],[-41,0,1,4,72],[41,0,1,4,72]];
 for(const [x,z,w,h,d] of MAP_LAYOUTS[id])boxes.push([x,z,w,h,d]);
 for(const [x,z,w,h,d] of [[-14,-5,1.5,8,13],[14,5,1.5,8,13],[-3,-19,12,6.5,1.5],[3,19,12,6.5,1.5],[-31,0,1.5,7,12],[31,0,1.5,7,12]])boxes.push([x,z,w,h,d]);
 for(const [x,z] of [[-22,-12],[22,12],[-22,12],[22,-12]])boxes.push([x,z,3,5.6,3]);
 for(const [x,z,w,h,d] of [[-9,-22,3.8,2.2,1.25],[9,-22,3.8,2.2,1.25],[-9,22,3.8,2.2,1.25],[9,22,3.8,2.2,1.25],[-29,-8,1.4,2.4,4.2],[29,8,1.4,2.4,4.2],[-6,-7,2.4,1.8,1.4],[6,7,2.4,1.8,1.4],[-6,7,2.4,1.8,1.4],[6,-7,2.4,1.8,1.4],[-18,0,3.2,1.4,1.2],[18,0,3.2,1.4,1.2],[-34,10,2.4,1.8,1.6],[34,-10,2.4,1.8,1.6]])boxes.push([x,z,w,h,d]);
 for(let i=0;i<8;i++){const x=-30+i*8,z=(i%2===0?-14:14)+(id%2?3:-3),h=1.1+(i%3)*.35;boxes.push([x,z,1.4,h,1.35]);}
 return boxes;
}
function positionBlocked(x,z,map,radius=.55){return mapObstacles(map).some(([cx,cz,w,h,d])=>Math.abs(x-cx)<w/2+radius&&Math.abs(z-cz)<d/2+radius);}
function rayBlocked(ox,oy,oz,dx,dy,dz,maxT,map){
 for(const [cx,cz,w,h,d] of mapObstacles(map)){
  let lo=0,hi=maxT;
  for(const [o,v,min,max] of [[ox,dx,cx-w/2,cx+w/2],[oy,dy,0,h],[oz,dz,cz-d/2,cz+d/2]]){
   if(Math.abs(v)<1e-8){if(o<min||o>max){lo=Infinity;break;}}
   else{let a=(min-o)/v,b=(max-o)/v;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi){lo=Infinity;break;}}
  }
  if(lo<maxT&&hi>=0)return true;
 }
 return false;
}
function publicPlayer(id,p){return {id,name:p.name,x:p.x,z:p.z,yaw:p.yaw,health:p.health,shield:p.shield,kills:p.kills,deaths:p.deaths,cash:p.cash,weapons:p.weapons,hair:p.hair,uniform:p.uniform,skin:p.skin,shoes:p.shoes,armor:p.armor,armorColor:p.armorColor,team:p.team,map:p.map,mode:p.mode,isBot:!!p.isBot};}
function state(room){return {players:[...players.entries()].filter(([,p])=>!room||p.room===room).map(([id,p])=>publicPlayer(id,p)).concat([...bots.entries()].filter(([,b])=>!room||b.room===room).map(([id,b])=>publicPlayer(id,b)))};}
function broadcast(room){if(room){io.to(room).emit('state',state(room));return;}for(const roomName of new Set([...players.values()].map(p=>p.room)))io.to(roomName).emit('state',state(roomName));}
function syncBots(room){const humans=[...players.values()].filter(p=>p.room===room);if(!humans.length){for(const [id,b] of bots)if(b.room===room)bots.delete(id);return;}const size=MODE_SIZES[humans[0].mode]||1;for(let team=0;team<2;team++){const desired=Math.max(1,size-humans.filter(p=>p.team===team).length);let teamBots=[...bots.entries()].filter(([,b])=>b.room===room&&b.team===team);while(teamBots.length>desired)bots.delete(teamBots.pop()[0]);while(teamBots.length<desired){const id='bot-'+(++botSeq);const b={id,name:['Sparky','Rook','Nova','Viper','Echo','Pixel'][botSeq%6]+' BOT',x:(Math.random()-.5)*22,z:team===0?-10-Math.random()*10:10+Math.random()*10,yaw:team===0?Math.PI:0,health:100,shield:100,kills:0,deaths:0,cash:0,weapons:[0],hair:'#263332',team,map:humans[0].map,mode:humans[0].mode,room,isBot:true,lastShot:0,respawnAt:0};bots.set(id,b);teamBots.push([id,b]);}}}
function botRespawn(b){b.x=(Math.random()-.5)*22;b.z=b.team===0?-10-Math.random()*10:10+Math.random()*10;b.health=100;b.shield=100;b.respawnAt=0;}
function notice(socket,msg){socket.emit('notice',msg);}
function distanceToRay(origin,dir,point){const v={x:point.x-origin.x,y:1-origin.y,z:point.z-origin.z};const t=v.x*dir.x+v.y*dir.y+v.z*dir.z;if(t<0)return {t,dist:Infinity};return {t,dist:Math.hypot(v.x-t*dir.x,v.y-t*dir.y,v.z-t*dir.z)};}
function respawn(p){p.x=clamp((Math.random()-.5)*24,-12,12);p.z=clamp((Math.random()-.5)*24,-12,12);p.health=100;p.shield=100*(1+(p.armor||0)*.03);}
io.on('connection',socket=>{
 if(players.size>=MAX_PLAYERS){notice(socket,'Room is full. Try again later.');socket.disconnect(true);return;}
 players.set(socket.id,{name:'Player',x:0,z:8,yaw:0,health:100,shield:100,kills:0,deaths:0,cash:300,weapons:[0],hair:'#30241e',map:0,mode:'1v1',team:0,room:'queue:1v1',lastMove:0,lastShot:0});
 socket.on('join',data=>{const p=players.get(socket.id);if(!p)return;const mode=Object.hasOwn(MODE_SIZES,String(data?.mode))?String(data.mode):'1v1';const oldRoom=p.room;socket.leave(oldRoom);if(queues.has(p.mode)){const oldQ=queues.get(p.mode);const at=oldQ.indexOf(socket.id);if(at>=0)oldQ.splice(at,1);}p.name=cleanName(data?.name);p.hair=/^#[0-9a-f]{6}$/i.test(String(data?.hair||''))?data.hair:'#30241e';p.uniform=/^#[0-9a-f]{6}$/i.test(String(data?.uniform||''))?data.uniform:'#477f72';p.skin=/^#[0-9a-f]{6}$/i.test(String(data?.skin||''))?data.skin:'#b88d70';p.shoes=/^#[0-9a-f]{6}$/i.test(String(data?.shoes||''))?data.shoes:'#20292b';p.armor=Math.round(clamp(data?.armor,0,2,0));p.armorColor=['#477f72','#5b686b','#68716f'][p.armor];p.health=100;p.shield=100*(1+p.armor*.03);p.kills=0;p.deaths=0;queuePlayer(socket.id,mode);});
 socket.on('voteMap',data=>{const p=players.get(socket.id);if(!p)return;const m=matches.get(p.room);if(!m||m.started)return;const map=Math.round(clamp(data?.map,0,5,-1));if(map<0)return;m.votes.set(socket.id,map);lobbyInfo(p.room);const members=[...players.entries()].filter(([,q])=>q.room===p.room);if(members.length&&members.every(([id])=>m.votes.has(id))){const tally=[0,0,0,0,0,0];for(const v of m.votes.values())tally[v]++;m.map=tally.indexOf(Math.max(...tally));clearTimeout(m.timer);beginMatch(p.room);}});
 socket.on('buy',data=>{const p=players.get(socket.id);if(!p)return;const wi=Math.round(clamp(data?.weapon,0,WEAPON_COSTS.length-1,-1));if(wi<1||wi>=WEAPON_COSTS.length)return;if(p.weapons.includes(wi)){socket.emit('notice','You already own that weapon');return;}const cost=WEAPON_COSTS[wi];if(p.cash<cost){socket.emit('notice','Not enough cash for that weapon');return;}p.cash-=cost;p.weapons.push(wi);p.weapons.sort();socket.emit('purchased',{cash:p.cash,weapons:p.weapons,weapon:wi,message:'Purchased '+['Pulse Pistol','Heavy Pistol','AK-47','Arena Rifle','Pump Shotgun','Burst Scatter'][wi]});broadcast();});
 socket.on('equip',data=>{const p=players.get(socket.id);const wi=Math.round(clamp(data?.weapon,0,WEAPONS.length-1,-1));if(!p||wi<0||!p.weapons.includes(wi))return;p.weapon=wi;});
 socket.on('move',data=>{const p=players.get(socket.id);if(!p||!data||Date.now()-p.lastMove<30)return;const now=Date.now(),nx=clamp(data.x,-39,39),nz=clamp(data.z,-34,34);if(Math.hypot(nx-p.x,nz-p.z)>1.35)return;p.lastMove=now;if(!positionBlocked(nx,nz,p.map,.58)){p.x=nx;p.z=nz;}else{const xClear=!positionBlocked(nx,p.z,p.map,.58),zClear=!positionBlocked(p.x,nz,p.map,.58);if(xClear)p.x=nx;if(zClear)p.z=nz;}p.yaw=clamp(data.yaw,-Math.PI,Math.PI);broadcast(p.room);});
 socket.on('shoot',data=>{
  const p=players.get(socket.id);if(!p||!data||Date.now()-p.lastShot<80)return;
  const wi=Math.round(clamp(data.weapon,0,WEAPONS.length-1,0)),w=WEAPONS[wi],now=Date.now();if(!p.weapons.includes(wi)){notice(socket,'Buy that weapon in the armory first');return;}
  if(now-p.lastShot<w.delay*.82)return;p.lastShot=now;
  const ox=clamp(data.x,-30,30),oy=clamp(data.y,0,3),oz=clamp(data.z,-30,30);
  // Reject client origins far from the latest server-known player position.
  if(Math.hypot(ox-p.x,oz-p.z)>3.5)return;
  let dx=clamp(data.dx,-1,1),dy=clamp(data.dy,-1,1),dz=clamp(data.dz,-1,1),len=Math.hypot(dx,dy,dz)||1;dx/=len;dy/=len;dz/=len;
  let victim=null,bestT=w.range;
  for(const [id,target] of players){if(id===socket.id||target.health<=0||target.room!==p.room||target.team===p.team)continue;const hit=distanceToRay({x:ox,y:oy,z:oz},{x:dx,y:dy,z:dz},{x:target.x,z:target.z});if(hit.t>0&&hit.t<bestT&&hit.dist<.85&&!rayBlocked(ox,oy,oz,dx,dy,dz,hit.t,p.map)){bestT=hit.t;const hitY=oy+dy*hit.t;victim={id,p:target,headshot:wi===6&&hitY>=1.48&&hitY<=1.95};}}
  if(!victim)return;
  const dmg=victim.headshot?250:w.damage*(w.pellets>1?Math.max(1,Math.round(w.pellets*.45)):1);
  const absorbed=Math.min(victim.p.shield,dmg);victim.p.shield-=absorbed;victim.p.health=Math.max(0,victim.p.health-(dmg-absorbed));
  io.to(p.room).emit('combat',{type:'hit',target:victim.id,attacker:socket.id,attackerName:p.name,health:victim.p.health,shield:victim.p.shield,damage:dmg,headshot:!!victim.headshot});
  if(victim.p.health<=0){victim.p.deaths++;p.kills++;p.cash+=150;io.to(p.room).emit('combat',{type:'elimination',killer:socket.id,target:victim.id,kills:p.kills,cash:p.cash});if(victim.p.isBot)victim.p.respawnAt=Date.now()+1800;else setTimeout(()=>{const current=players.get(victim.id);if(current){respawn(current);broadcast(current.room);const targetSocket=io.sockets.sockets.get(victim.id);if(targetSocket)notice(targetSocket,'Respawned — HP 100 / Shield 100');}},1800);}
  broadcast(p.room);
 });
 socket.on('disconnect',()=>{const p=players.get(socket.id);const room=p?.room;if(p&&queues.has(p.mode)){const q=queues.get(p.mode),at=q.indexOf(socket.id);if(at>=0)q.splice(at,1);}players.delete(socket.id);if(room){if(matches.has(room)){const m=matches.get(room);m.votes.delete(socket.id);lobbyInfo(room);}syncBots(room);broadcast(room);}});
});
setInterval(()=>{const now=Date.now();for(const [id,b] of bots){if(b.respawnAt){if(now>=b.respawnAt){botRespawn(b);broadcast(b.room);}continue;}const enemies=[...players.entries()].filter(([,p])=>p.room===b.room&&p.team!==b.team&&p.health>0);if(!enemies.length)continue;let target=null,dist=Infinity;for(const [pid,p] of enemies){const d=Math.hypot(p.x-b.x,p.z-b.z);if(d<dist){dist=d;target={id:pid,p};}}if(!target)continue;const dx=target.p.x-b.x,dz=target.p.z-b.z;b.yaw=Math.atan2(dx,dz);if(dist>5&&dist<36){const nx=b.x+dx/(dist||1)*.85,nz=b.z+dz/(dist||1)*.85;if(!positionBlocked(nx,nz,b.map,.5)){b.x=nx;b.z=nz;}else if(!positionBlocked(nx,b.z,b.map,.5))b.x=nx;else if(!positionBlocked(b.x,nz,b.map,.5))b.z=nz;}if(dist<31&&now-b.lastShot>700+Math.random()*350&&!rayBlocked(b.x,1.45,b.z,(target.p.x-b.x)/(dist||1),(-.45)/(dist||1),(target.p.z-b.z)/(dist||1),dist,b.map)){b.lastShot=now;if(Math.random()<Math.max(.25,.78-dist*.012)){const dmg=11,absorbed=Math.min(target.p.shield,dmg);target.p.shield-=absorbed;target.p.health=Math.max(0,target.p.health-(dmg-absorbed));io.to(b.room).emit('combat',{type:'hit',target:target.id,attacker:id,attackerName:b.name,health:target.p.health,shield:target.p.shield,damage:dmg});if(target.p.health<=0){target.p.deaths++;b.kills++;io.to(b.room).emit('combat',{type:'elimination',killer:id,target:target.id,kills:b.kills,cash:target.p.cash});setTimeout(()=>{const current=players.get(target.id);if(current){respawn(current);broadcast(current.room);const ts=io.sockets.sockets.get(target.id);if(ts)notice(ts,'Respawned — HP 100 / Shield 100');}},1800);}}broadcast(b.room);}}},300);
server.listen(PORT,'0.0.0.0',()=>console.log('Browser Arena listening on port '+PORT));
