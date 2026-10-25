const express=require('express');
const http=require('http');
const path=require('path');
const {Server}=require('socket.io');
const app=express(),server=http.createServer(app);
const io=new Server(server,{cors:{origin:process.env.CLIENT_ORIGIN?process.env.CLIENT_ORIGIN.split(','):'*'},maxHttpBufferSize:1e5});
const PORT=Number(process.env.PORT||3000),MAX_PLAYERS=24;const MODE_SIZES={'1v1':1,'2v2':2,'3v3':3,'4v4':4,'5v5':5};
const players=new Map();
const WEAPON_COSTS=[0,400,700];
const WEAPONS=[
 {mag:12,delay:260,damage:42,range:42,pellets:1,spread:.008},
 {mag:30,delay:115,damage:34,range:65,pellets:1,spread:.012},
 {mag:8,delay:520,damage:18,range:24,pellets:6,spread:.075}
];
app.use(express.static(path.join(__dirname)));
app.get('/health',(_req,res)=>res.json({ok:true,players:players.size}));
app.get('/api/status',(_req,res)=>res.json({game:'Browser Arena',players:players.size,maxPlayers:MAX_PLAYERS}));
function cleanName(v){return String(v||'Player').replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,18)||'Player';}
function clamp(v,min,max,fallback=0){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function state(room){return {players:[...players.entries()].filter(([,p])=>!room||p.room===room).map(([id,p])=>({id,name:p.name,x:p.x,z:p.z,yaw:p.yaw,health:p.health,shield:p.shield,kills:p.kills,deaths:p.deaths,cash:p.cash,weapons:p.weapons,hair:p.hair,team:p.team,map:p.map,mode:p.mode}))};}
function broadcast(room){if(room){io.to(room).emit('state',state(room));return;}for(const roomName of new Set([...players.values()].map(p=>p.room)))io.to(roomName).emit('state',state(roomName));}
function notice(socket,msg){socket.emit('notice',msg);}
function distanceToRay(origin,dir,point){const v={x:point.x-origin.x,y:1-origin.y,z:point.z-origin.z};const t=v.x*dir.x+v.y*dir.y+v.z*dir.z;if(t<0)return {t,dist:Infinity};return {t,dist:Math.hypot(v.x-t*dir.x,v.y-t*dir.y,v.z-t*dir.z)};}
function respawn(p){p.x=clamp((Math.random()-.5)*24,-12,12);p.z=clamp((Math.random()-.5)*24,-12,12);p.health=100;p.shield=100;}
io.on('connection',socket=>{
 if(players.size>=MAX_PLAYERS){notice(socket,'Room is full. Try again later.');socket.disconnect(true);return;}
 players.set(socket.id,{name:'Player',x:0,z:8,yaw:0,health:100,shield:100,kills:0,deaths:0,cash:300,weapons:[0],hair:'#30241e',map:0,mode:'1v1',team:0,room:'1v1:0',lastMove:0,lastShot:0});
 socket.on('join',data=>{const p=players.get(socket.id);if(!p)return;const mode=Object.hasOwn(MODE_SIZES,String(data?.mode))?String(data.mode):'1v1',map=Math.round(clamp(data?.map,0,4,0)),room=mode+':'+map;const max=MODE_SIZES[mode]*2;const members=[...players.entries()].filter(([id,q])=>id!==socket.id&&q.room===room);if(members.length>=max){notice(socket,'That '+mode+' lobby is full. Choose another mode or map.');socket.disconnect(true);return;}socket.leave(p.room);p.room=room;p.mode=mode;p.map=map;p.team=members.filter(([,q])=>q.team===0).length<=members.filter(([,q])=>q.team===1).length?0:1;p.name=cleanName(data?.name);p.hair=/^#[0-9a-f]{6}$/i.test(String(data?.hair||''))?data.hair:'#30241e';p.health=100;p.shield=100;socket.join(room);notice(socket,'Joined '+mode+' · Map '+(map+1)+' · Team '+(p.team+1));broadcast(room);});
 socket.on('buy',data=>{const p=players.get(socket.id);if(!p)return;const wi=Math.round(clamp(data?.weapon,0,WEAPON_COSTS.length-1,-1));if(wi<1||wi>=WEAPON_COSTS.length)return;if(p.weapons.includes(wi)){socket.emit('notice','You already own that weapon');return;}const cost=WEAPON_COSTS[wi];if(p.cash<cost){socket.emit('notice','Not enough cash for that weapon');return;}p.cash-=cost;p.weapons.push(wi);p.weapons.sort();socket.emit('purchased',{cash:p.cash,weapons:p.weapons,weapon:wi,message:'Purchased '+['Pulse Pistol','Arena Rifle','Burst Scatter'][wi]});broadcast();});
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
  const dmg=w.damage*(wi===2?Math.max(1,Math.round(w.pellets*.45)):1);
  const absorbed=Math.min(victim.p.shield,dmg);victim.p.shield-=absorbed;victim.p.health=Math.max(0,victim.p.health-(dmg-absorbed));
  io.to(p.room).emit('combat',{type:'hit',target:victim.id,attacker:socket.id,attackerName:p.name,health:victim.p.health,shield:victim.p.shield,damage:dmg});
  if(victim.p.health<=0){victim.p.deaths++;p.kills++;p.cash+=150;io.to(p.room).emit('combat',{type:'elimination',killer:socket.id,target:victim.id,kills:p.kills,cash:p.cash});setTimeout(()=>{const current=players.get(victim.id);if(current){respawn(current);broadcast(current.room);const targetSocket=io.sockets.sockets.get(victim.id);if(targetSocket)notice(targetSocket,'Respawned — HP 100 / Shield 100');}},1800);}
  broadcast(p.room);
 });
 socket.on('disconnect',()=>{const p=players.get(socket.id);const room=p?.room;players.delete(socket.id);if(room)broadcast(room);});
});
server.listen(PORT,'0.0.0.0',()=>console.log('Browser Arena listening on port '+PORT));
