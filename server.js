const express=require('express');
const http=require('http');
const path=require('path');
const {Server}=require('socket.io');
const app=express(),server=http.createServer(app);
const io=new Server(server,{cors:{origin:process.env.CLIENT_ORIGIN?process.env.CLIENT_ORIGIN.split(','):'*'},maxHttpBufferSize:1e5});
const PORT=Number(process.env.PORT||3000),MAX_PLAYERS=24;const MODE_SIZES={'1v1':1,'2v2':2,'3v3':3,'4v4':4,'5v5':5};
const players=new Map(),bots=new Map(),queues=new Map(),matches=new Map();let botSeq=0,matchSeq=0;
function lobbyInfo(room){const m=matches.get(room);if(!m)return;const members=[...players.entries()].filter(([,p])=>p.room===room);for(const [id] of members){const s=io.sockets.sockets.get(id);if(s)s.emit('mapLobby',{mode:m.mode,players:members.map(([pid,p])=>({id:pid,name:p.name,team:p.team})),maps:[{id:0,name:'NEON MEADOW'},{id:1,name:'DESERT CIRCUIT'},{id:2,name:'FROST YARD'},{id:3,name:'LAVA WORKS'},{id:4,name:'JUNGLE RUINS'}],votes:Object.fromEntries(m.votes)});}}
function beginMatch(room){const m=matches.get(room);if(!m||m.started)return;m.started=true;const members=[...players.entries()].filter(([,p])=>p.room===room);const counts=[0,0];for(const [id,p] of members){p.map=m.map;p.health=100;p.shield=100*(1+(p.armor||0)*.03);p.x=(Math.random()-.5)*12;p.z=p.team===0?-12-Math.random()*4:12+Math.random()*4;const s=io.sockets.sockets.get(id);if(s)s.emit('matchStart',{map:m.map,mode:m.mode,team:p.team});counts[p.team]++;}syncBots(room);broadcast(room);}
function queuePlayer(id,mode){const p=players.get(id);if(!p)return;let q=queues.get(mode);if(!q){q=[];queues.set(mode,q);}if(!q.includes(id))q.push(id);p.mode=mode;p.room='queue:'+mode;const needed=(MODE_SIZES[mode]||1)*2;const waiting=q.map(pid=>players.get(pid)).filter(Boolean);for(const pid of q){const s=io.sockets.sockets.get(pid);if(s)s.emit('queueStatus',{mode,waiting:waiting.length,needed,message:'Waiting for '+needed+' real players to join '+mode+'.'});}if(waiting.length>=needed){const ids=q.splice(0,needed);const room='match:'+(++matchSeq);const m={room,mode,started:false,map:0,votes:new Map(),timer:null};matches.set(room,m);ids.forEach((pid,i)=>{const player=players.get(pid);if(!player)return;player.room=room;player.team=i%2;player.map=0;const s=io.sockets.sockets.get(pid);if(s){s.leave('queue:'+mode);s.join(room);}});lobbyInfo(room);m.timer=setTimeout(()=>{const tally=[0,0,0,0,0];for(const v of m.votes.values())tally[v]++;m.map=tally.indexOf(Math.max(...tally));beginMatch(room);},30000);}}
const WEAPON_COSTS=[0,300,900,400,650,700];
const WEAPONS=[
 {mag:12,delay:190,damage:38,range:38,pellets:1,spread:.01},
 {mag:8,delay:300,damage:54,range:40,pellets:1,spread:.006},
 {mag:30,delay:82,damage:19,range:62,pellets:1,spread:.018},
 {mag:30,delay:115,damage:32,range:65,pellets:1,spread:.012},
 {mag:6,delay:620,damage:15,range:23,pellets:8,spread:.09},
 {mag:8,delay:460,damage:17,range:25,pellets:6,spread:.075}
];
app.use(express.static(path.join(__dirname)));
app.get('/health',(_req,res)=>res.json({ok:true,players:players.size}));
app.get('/api/status',(_req,res)=>res.json({game:'Browser Arena',players:players.size,maxPlayers:MAX_PLAYERS}));
function cleanName(v){return String(v||'Player').replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,18)||'Player';}
function clamp(v,min,max,fallback=0){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function publicPlayer(id,p){return {id,name:p.name,x:p.x,z:p.z,yaw:p.yaw,health:p.health,shield:p.shield,kills:p.kills,deaths:p.deaths,cash:p.cash,weapons:p.weapons,hair:p.hair,uniform:p.uniform,skin:p.skin,shoes:p.shoes,armor:p.armor,armorColor:p.armorColor,team:p.team,map:p.map,mode:p.mode,isBot:!!p.isBot};}
function state(room){return {players:[...players.entries()].filter(([,p])=>!room||p.room===room).map(([id,p])=>publicPlayer(id,p)).concat([...bots.entries()].filter(([,b])=>!room||b.room===room).map(([id,b])=>publicPlayer(id,b)))};}
function broadcast(room){if(room){io.to(room).emit('state',state(room));return;}for(const roomName of new Set([...players.values()].map(p=>p.room)))io.to(roomName).emit('state',state(roomName));}
function syncBots(room){const humans=[...players.values()].filter(p=>p.room===room);if(!humans.length){for(const [id,b] of bots)if(b.room===room)bots.delete(id);return;}const size=MODE_SIZES[humans[0].mode]||1;for(let team=0;team<2;team++){const desired=Math.max(0,size-humans.filter(p=>p.team===team).length);let teamBots=[...bots.entries()].filter(([,b])=>b.room===room&&b.team===team);while(teamBots.length>desired)bots.delete(teamBots.pop()[0]);while(teamBots.length<desired){const id='bot-'+(++botSeq);const b={id,name:['Sparky','Rook','Nova','Viper','Echo','Pixel'][botSeq%6]+' BOT',x:(Math.random()-.5)*22,z:team===0?-10-Math.random()*10:10+Math.random()*10,yaw:team===0?Math.PI:0,health:100,shield:100,kills:0,deaths:0,cash:0,weapons:[0],hair:'#263332',team,map:humans[0].map,mode:humans[0].mode,room,isBot:true,lastShot:0,respawnAt:0};bots.set(id,b);teamBots.push([id,b]);}}}
function botRespawn(b){b.x=(Math.random()-.5)*22;b.z=b.team===0?-10-Math.random()*10:10+Math.random()*10;b.health=100;b.shield=100;b.respawnAt=0;}
function notice(socket,msg){socket.emit('notice',msg);}
function distanceToRay(origin,dir,point){const v={x:point.x-origin.x,y:1-origin.y,z:point.z-origin.z};const t=v.x*dir.x+v.y*dir.y+v.z*dir.z;if(t<0)return {t,dist:Infinity};return {t,dist:Math.hypot(v.x-t*dir.x,v.y-t*dir.y,v.z-t*dir.z)};}
function respawn(p){p.x=clamp((Math.random()-.5)*24,-12,12);p.z=clamp((Math.random()-.5)*24,-12,12);p.health=100;p.shield=100*(1+(p.armor||0)*.03);}
io.on('connection',socket=>{
 if(players.size>=MAX_PLAYERS){notice(socket,'Room is full. Try again later.');socket.disconnect(true);return;}
 players.set(socket.id,{name:'Player',x:0,z:8,yaw:0,health:100,shield:100,kills:0,deaths:0,cash:300,weapons:[0],hair:'#30241e',map:0,mode:'1v1',team:0,room:'queue:1v1',lastMove:0,lastShot:0});
 socket.on('join',data=>{const p=players.get(socket.id);if(!p)return;const mode=Object.hasOwn(MODE_SIZES,String(data?.mode))?String(data.mode):'1v1';const oldRoom=p.room;socket.leave(oldRoom);if(queues.has(p.mode)){const oldQ=queues.get(p.mode);const at=oldQ.indexOf(socket.id);if(at>=0)oldQ.splice(at,1);}p.name=cleanName(data?.name);p.hair=/^#[0-9a-f]{6}$/i.test(String(data?.hair||''))?data.hair:'#30241e';p.uniform=/^#[0-9a-f]{6}$/i.test(String(data?.uniform||''))?data.uniform:'#477f72';p.skin=/^#[0-9a-f]{6}$/i.test(String(data?.skin||''))?data.skin:'#b88d70';p.shoes=/^#[0-9a-f]{6}$/i.test(String(data?.shoes||''))?data.shoes:'#20292b';p.armor=Math.round(clamp(data?.armor,0,2,0));p.armorColor=['#477f72','#5b686b','#68716f'][p.armor];p.health=100;p.shield=100*(1+p.armor*.03);p.kills=0;p.deaths=0;queuePlayer(socket.id,mode);});
 socket.on('voteMap',data=>{const p=players.get(socket.id);if(!p)return;const m=matches.get(p.room);if(!m||m.started)return;const map=Math.round(clamp(data?.map,0,4,-1));if(map<0)return;m.votes.set(socket.id,map);lobbyInfo(p.room);const members=[...players.entries()].filter(([,q])=>q.room===p.room);if(members.length&&members.every(([id])=>m.votes.has(id))){const tally=[0,0,0,0,0];for(const v of m.votes.values())tally[v]++;m.map=tally.indexOf(Math.max(...tally));clearTimeout(m.timer);beginMatch(p.room);}});
 socket.on('buy',data=>{const p=players.get(socket.id);if(!p)return;const wi=Math.round(clamp(data?.weapon,0,WEAPON_COSTS.length-1,-1));if(wi<1||wi>=WEAPON_COSTS.length)return;if(p.weapons.includes(wi)){socket.emit('notice','You already own that weapon');return;}const cost=WEAPON_COSTS[wi];if(p.cash<cost){socket.emit('notice','Not enough cash for that weapon');return;}p.cash-=cost;p.weapons.push(wi);p.weapons.sort();socket.emit('purchased',{cash:p.cash,weapons:p.weapons,weapon:wi,message:'Purchased '+['Pulse Pistol','Heavy Pistol','AK-47','Arena Rifle','Pump Shotgun','Burst Scatter'][wi]});broadcast();});
 socket.on('equip',data=>{const p=players.get(socket.id);const wi=Math.round(clamp(data?.weapon,0,WEAPONS.length-1,-1));if(!p||wi<0||!p.weapons.includes(wi))return;p.weapon=wi;});
 socket.on('move',data=>{const p=players.get(socket.id);if(!p||!data||Date.now()-p.lastMove<30)return;p.lastMove=Date.now();p.x=clamp(data.x,-24,24);p.z=clamp(data.z,-22,22);p.yaw=clamp(data.yaw,-Math.PI,Math.PI);broadcast(p.room);});
 socket.on('shoot',data=>{
  const p=players.get(socket.id);if(!p||!data||Date.now()-p.lastShot<80)return;
  const wi=Math.round(clamp(data.weapon,0,WEAPONS.length-1,0)),w=WEAPONS[wi],now=Date.now();if(!p.weapons.includes(wi)){notice(socket,'Buy that weapon in the armory first');return;}
  if(now-p.lastShot<w.delay*.82)return;p.lastShot=now;
  const ox=clamp(data.x,-30,30),oy=clamp(data.y,0,3),oz=clamp(data.z,-30,30);
  // Reject client origins far from the latest server-known player position.
  if(Math.hypot(ox-p.x,oz-p.z)>3.5)return;
  let dx=clamp(data.dx,-1,1),dy=clamp(data.dy,-1,1),dz=clamp(data.dz,-1,1),len=Math.hypot(dx,dy,dz)||1;dx/=len;dy/=len;dz/=len;
  let victim=null,bestT=w.range;
  for(const [id,target] of players){if(id===socket.id||target.health<=0||target.room!==p.room||target.team===p.team)continue;const hit=distanceToRay({x:ox,y:oy,z:oz},{x:dx,y:dy,z:dz},{x:target.x,z:target.z});if(hit.t>0&&hit.t<bestT&&hit.dist<.85){bestT=hit.t;victim={id,p:target};}}
  if(!victim)return;
  const dmg=w.damage*(w.pellets>1?Math.max(1,Math.round(w.pellets*.45)):1);
  const absorbed=Math.min(victim.p.shield,dmg);victim.p.shield-=absorbed;victim.p.health=Math.max(0,victim.p.health-(dmg-absorbed));
  io.to(p.room).emit('combat',{type:'hit',target:victim.id,attacker:socket.id,attackerName:p.name,health:victim.p.health,shield:victim.p.shield,damage:dmg});
  if(victim.p.health<=0){victim.p.deaths++;p.kills++;p.cash+=150;io.to(p.room).emit('combat',{type:'elimination',killer:socket.id,target:victim.id,kills:p.kills,cash:p.cash});if(victim.p.isBot)victim.p.respawnAt=Date.now()+1800;else setTimeout(()=>{const current=players.get(victim.id);if(current){respawn(current);broadcast(current.room);const targetSocket=io.sockets.sockets.get(victim.id);if(targetSocket)notice(targetSocket,'Respawned — HP 100 / Shield 100');}},1800);}
  broadcast(p.room);
 });
 socket.on('disconnect',()=>{const p=players.get(socket.id);const room=p?.room;if(p&&queues.has(p.mode)){const q=queues.get(p.mode),at=q.indexOf(socket.id);if(at>=0)q.splice(at,1);}players.delete(socket.id);if(room){if(matches.has(room)){const m=matches.get(room);m.votes.delete(socket.id);lobbyInfo(room);}syncBots(room);broadcast(room);}});
});
setInterval(()=>{const now=Date.now();for(const [id,b] of bots){if(b.respawnAt){if(now>=b.respawnAt){botRespawn(b);broadcast(b.room);}continue;}const enemies=[...players.entries()].filter(([,p])=>p.room===b.room&&p.team!==b.team&&p.health>0);if(!enemies.length)continue;let target=null,dist=Infinity;for(const [pid,p] of enemies){const d=Math.hypot(p.x-b.x,p.z-b.z);if(d<dist){dist=d;target={id:pid,p};}}if(!target)continue;const dx=target.p.x-b.x,dz=target.p.z-b.z;b.yaw=Math.atan2(dx,dz);if(dist>5&&dist<36){b.x+=dx/(dist||1)*.85;b.z+=dz/(dist||1)*.85;}if(dist<31&&now-b.lastShot>700+Math.random()*350){b.lastShot=now;if(Math.random()<Math.max(.25,.78-dist*.012)){const dmg=11,absorbed=Math.min(target.p.shield,dmg);target.p.shield-=absorbed;target.p.health=Math.max(0,target.p.health-(dmg-absorbed));io.to(b.room).emit('combat',{type:'hit',target:target.id,attacker:id,attackerName:b.name,health:target.p.health,shield:target.p.shield,damage:dmg});if(target.p.health<=0){target.p.deaths++;b.kills++;io.to(b.room).emit('combat',{type:'elimination',killer:id,target:target.id,kills:b.kills,cash:target.p.cash});setTimeout(()=>{const current=players.get(target.id);if(current){respawn(current);broadcast(current.room);const ts=io.sockets.sockets.get(target.id);if(ts)notice(ts,'Respawned — HP 100 / Shield 100');}},1800);}}broadcast(b.room);}}},300);
server.listen(PORT,'0.0.0.0',()=>console.log('Browser Arena listening on port '+PORT));
