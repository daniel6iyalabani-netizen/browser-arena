import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const $ = (id) => document.getElementById(id);
const root = $('game-root');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9db9bc);
scene.fog = new THREE.Fog(0x9db9bc, 28, 100);
const camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, 0.1, 160);
camera.position.set(0, 1.7, 8);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
root.appendChild(renderer.domElement);
const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const colliders = [];
const targets = [];
const remotePlayers = new Map();
const keys = new Set();
let running = false, online = false, socket = null, lastShot = 0, lastSync = 0, recoil = 0, bob = 0;
let health = 100, kills = 0, ammo = 30, reserve = 120, reloading = false, reloadUntil = 0;
let playerName = 'Rookie', lastHitTime = 0;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);

scene.add(new THREE.HemisphereLight(0xd8f2ff, 0x33413b, 2.1));
const sun = new THREE.DirectionalLight(0xffefcf, 3.0);
sun.position.set(-14, 25, 12); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -35; sun.shadow.camera.right = 35; sun.shadow.camera.top = 35; sun.shadow.camera.bottom = -35;
scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({color:0x59686a, roughness:.92}));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(100, 50, 0x9db4ae, 0x738582); grid.position.y = .012; scene.add(grid);

function box(x,y,z,sx,sy,sz,color,solid=true){
 const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), new THREE.MeshStandardMaterial({color,roughness:.82}));
 mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
 if(solid) colliders.push(new THREE.Box3().setFromObject(mesh));
 return mesh;
}
// Low cover and taller perimeter walls make a readable training arena.
box(0,2,-24,52,4,1,0x43565a); box(0,2,24,52,4,1,0x43565a);
box(-26,2,0,1,4,48,0x43565a); box(26,2,0,1,4,48,0x43565a);
for(const [x,z] of [[-10,-10],[10,-10],[-10,10],[10,10],[0,-15],[0,15],[-17,0],[17,0]]){
 box(x,.75,z,4,1.5,2,0x697d78);
}
for(let i=0;i<12;i++){
 const x=(Math.random()-.5)*40, z=(Math.random()-.5)*38;
 if(Math.abs(x)<5&&z>0) continue;
 const post=box(x,1.1,z,.6,2.2,.6, i%2?0x82918b:0x526a68);
 post.material.color.multiplyScalar(.92);
}
const weapon = new THREE.Group();
camera.add(weapon); weapon.position.set(.34,-.3,-.58);
const darkMat = new THREE.MeshStandardMaterial({color:0x20292b,metalness:.72,roughness:.32});
const bodyMat = new THREE.MeshStandardMaterial({color:0x52665f,metalness:.28,roughness:.52});
function gunPart(sx,sy,sz,x,y,z,mat=darkMat){
 const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat); m.position.set(x,y,z); m.castShadow=true; weapon.add(m); return m;
}
gunPart(.18,.16,.43,0,0,0,bodyMat);
gunPart(.105,.09,.46,0,.035,-.37);
gunPart(.075,.075,.36,0,.035,-.77);
gunPart(.12,.18,.17,0,-.14,.08,bodyMat);
gunPart(.09,.22,.12,0,-.27,.04);
gunPart(.06,.07,.16,0,.115,-.18);
gunPart(.025,.03,.1,0,.12,-.73,bodyMat);
const muzzle = new THREE.PointLight(0xffb66d,0,5); muzzle.position.set(0,.04,-.98); weapon.add(muzzle);
const flash = new THREE.Mesh(new THREE.ConeGeometry(.09,.28,8),new THREE.MeshBasicMaterial({color:0xffd38a,transparent:true,opacity:.9}));
flash.rotation.x=-Math.PI/2; flash.position.set(0,.035,-1.02); flash.visible=false; weapon.add(flash);

function makeBot(x,z,index){
 const group=new THREE.Group(); group.position.set(x,0,z); scene.add(group);
 const armor=new THREE.MeshStandardMaterial({color:index%2?0xd18b55:0x5b9f91,metalness:.35,roughness:.5});
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.42,.65,4,8),armor); torso.position.y=1.05; torso.castShadow=true; group.add(torso);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.25,12,10),new THREE.MeshStandardMaterial({color:0xd5dfd7,metalness:.15,roughness:.55})); head.position.y=1.72; head.castShadow=true; group.add(head);
 const visor=new THREE.Mesh(new THREE.BoxGeometry(.32,.075,.08),new THREE.MeshBasicMaterial({color:0xff694d})); visor.position.set(0,1.75,-.21); group.add(visor);
 const bot={group,torso,head,hp:100,alive:true,respawn:0,phase:Math.random()*7,fireAt:performance.now()+1000+Math.random()*2000,index};
 group.userData.bot=bot; targets.push(bot); return bot;
}
for(let i=0;i<7;i++) makeBot((Math.random()-.5)*34,-7-Math.random()*30,i);

function setMessage(text,ms=1300){$('message').textContent=text; setTimeout(()=>{if($('message').textContent===text)$('message').textContent='';},ms);}
function updateHud(){
 $('health').textContent=Math.max(0,Math.round(health));
 $('kills').textContent=kills;
 $('ammo').textContent=reloading?'RELOADING':ammo+' / '+reserve;
 $('connection').textContent=online?'ONLINE · '+(socket?.connected?'CONNECTED':'CONNECTING'):'OFFLINE TRAINING';
}
function startGame(useOnline){
 online=useOnline; running=true;
 $('start-screen').classList.add('hidden'); $('hud').style.display='block';
 if(useOnline) connectOnline();
 controls.lock();
 updateHud();
}
$('play-offline').addEventListener('click',()=>startGame(false));
$('play-online').addEventListener('click',()=>{
 const url=$('server-url').value.trim();
 if(!url){setMessage('Enter your deployed multiplayer server URL in the menu.',3500);return;}
 startGame(true);
});
controls.addEventListener('lock',()=>{});
controls.addEventListener('unlock',()=>{if(running){$('start-screen').classList.remove('hidden');}});
document.addEventListener('keydown',e=>{
 keys.add(e.code);
 if(e.code==='KeyR') reload();
});
document.addEventListener('keyup',e=>keys.delete(e.code));
document.addEventListener('mousedown',e=>{if(e.button===0&&running&&controls.isLocked) shoot();});
document.addEventListener('contextmenu',e=>e.preventDefault());

function reload(){
 if(reloading||ammo===30||reserve<=0)return;
 reloading=true; reloadUntil=performance.now()+1450; updateHud(); setMessage('RELOADING',1450);
}
function shoot(){
 const now=performance.now();
 if(reloading||now-lastShot<105)return;
 if(ammo<=0){setMessage('EMPTY — PRESS R TO RELOAD',1000);return;}
 lastShot=now; ammo--; recoil=Math.min(recoil+.065,.17); weapon.rotation.x=-recoil;
 flash.visible=true; muzzle.intensity=3.5;
 $('hitmarker').style.display='none';
 raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
 const candidates=[];
 for(const bot of targets) if(bot.alive){candidates.push(bot.torso,bot.head);}
 for(const obj of remotePlayers.values()) if(obj.mesh)candidates.push(obj.mesh);
 const hits=raycaster.intersectObjects(candidates,false);
 if(hits.length){
  const hit=hits[0], obj=hit.object;
  const bot=targets.find(b=>b.torso===obj||b.head===obj);
  if(bot){bot.hp-=obj===bot.head?55:34; bot.group.traverse(o=>{if(o.material?.emissive){o.material.emissive.set(0x553322);}}); $('hitmarker').style.display='block'; setTimeout(()=>$('hitmarker').style.display='none',120);
   if(bot.hp<=0){bot.alive=false;bot.group.visible=false;bot.respawn=performance.now()+2200;kills++;setMessage('BOT ELIMINATED');}
  } else if(online&&socket){socket.emit('shoot',{target:obj.userData.playerId||null});}
 }
 updateHud();
 if(online&&socket) socket.emit('shot',{x:camera.position.x,y:camera.position.y,z:camera.position.z,dx:direction.x,dz:direction.z});
}
function connectOnline(){
 if(typeof window.io!=='function'){setMessage('Socket.IO client unavailable. Run the server and refresh.',3000);return;}
 const url=$('server-url').value.trim().replace(/\/$/,'');
 socket=window.io(url,{transports:['websocket','polling']});
 socket.on('connect',()=>{socket.emit('join',{name:playerName});updateHud();setMessage('CONNECTED TO ARENA');});
 socket.on('disconnect',()=>updateHud());
 socket.on('state',state=>{
  const seen=new Set();
  for(const p of state.players||[]){
   if(p.id===socket.id)continue; seen.add(p.id);
   let item=remotePlayers.get(p.id);
   if(!item){
    const mesh=new THREE.Mesh(new THREE.CapsuleGeometry(.35,.85,4,8),new THREE.MeshStandardMaterial({color:0x64dcb0,roughness:.65}));
    mesh.position.y=1;mesh.castShadow=true;mesh.userData.playerId=p.id;scene.add(mesh);item={mesh,name:p.name||'Player'};remotePlayers.set(p.id,item);
   }
   item.mesh.position.set(p.x,1,p.z);item.mesh.rotation.y=p.yaw||0;item.name=p.name||item.name;
  }
  for(const [id,item] of remotePlayers)if(!seen.has(id)){scene.remove(item.mesh);remotePlayers.delete(id);}
  if(typeof state.kills==='object'&&state.kills[socket.id]!=null)kills=Math.max(kills,state.kills[socket.id]);
  updateHud();
 });
 socket.on('notice',msg=>setMessage(String(msg).slice(0,100),2000));
 socket.on('playerShot',()=>{});
 socket.on('connect_error',()=>{ $('connection').textContent='ONLINE · CONNECTION FAILED'; });
}
function movePlayer(dt){
 if(!controls.isLocked)return;
 const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?8.5:5.4;
 direction.set(0,0,0);
 if(keys.has('KeyW'))direction.z-=1;
 if(keys.has('KeyS'))direction.z+=1;
 if(keys.has('KeyA'))direction.x-=1;
 if(keys.has('KeyD'))direction.x+=1;
 direction.normalize();
 const before=controls.getObject().position.clone();
 controls.moveForward(-direction.z*speed*dt);
 controls.moveRight(direction.x*speed*dt);
 const p=controls.getObject().position;
 p.y=1.7;
 for(const b of colliders){
  const expanded=b.clone().expandByVector(new THREE.Vector3(.42,1,.42));
  if(expanded.containsPoint(p)){p.x=before.x;p.z=before.z;break;}
 }
 bob+=dt*(direction.lengthSq()?speed*.9:1.4);
 weapon.position.y=-.3+Math.sin(bob*2)*.006*(direction.lengthSq()?1:0);
 if(online&&socket&&socket.connected&&performance.now()-lastSync>50){
  lastSync=performance.now();const f=camera.getWorldDirection(new THREE.Vector3());
  socket.emit('move',{x:p.x,yaw:Math.atan2(f.x,-f.z),z:p.z});
 }
}
function updateBots(dt,now){
 for(const b of targets){
  if(!b.alive){if(now>=b.respawn){b.alive=true;b.hp=100;b.group.visible=true;b.group.position.set((Math.random()-.5)*34,0,-7-Math.random()*30);b.fireAt=now+1400;}continue;}
  const p=controls.getObject().position;
  const dx=p.x-b.group.position.x,dz=p.z-b.group.position.z,dist=Math.hypot(dx,dz);
  b.phase+=dt;
  if(dist>5&&dist<32){const pace=dist>12?1.25:.45;b.group.position.x+=dx/dist*pace*dt;b.group.position.z+=dz/dist*pace*dt;}
  b.group.rotation.y=Math.atan2(dx,dz);
  if(dist<20&&now>b.fireAt&&now-lastHitTime>400){b.fireAt=now+1200+Math.random()*1100;if(Math.random()<.3){health=Math.max(0,health-5);lastHitTime=now;setMessage('HIT · '+health+' HP',500);updateHud();if(health<=0){health=100;controls.getObject().position.set(0,1.7,8);setMessage('RESPAWNED');}}}
 }
}
function animate(){
 requestAnimationFrame(animate);
 const dt=Math.min(clock.getDelta(),.04),now=performance.now();
 if(reloading&&now>=reloadUntil){const amount=Math.min(30-ammo,reserve);ammo+=amount;reserve-=amount;reloading=false;updateHud();}
 if(running){movePlayer(dt);updateBots(dt,now);}
 recoil=Math.max(0,recoil-dt*.42);weapon.rotation.x=-recoil;
 flash.visible=now-lastShot<65;muzzle.intensity=flash.visible?3.5:0;
 renderer.render(scene,camera);
}
animate();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
window.addEventListener('beforeunload',()=>socket?.disconnect());
