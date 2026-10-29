import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
const $=id=>document.getElementById(id), root=$('game-root');
const DEFAULT_SERVER_URL='https://browser-arena-cw84.onrender.com';
$('server-url').value=DEFAULT_SERVER_URL;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xa8b9c0);scene.fog=new THREE.Fog(0xa8b9c0,58,230);
const camera=new THREE.PerspectiveCamera(76,innerWidth/innerHeight,.1,320);camera.position.set(0,1.7,8);
const renderer=new THREE.WebGLRenderer({antialias:innerWidth>700,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.25:1.75));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;root.appendChild(renderer.domElement);
const controls=new PointerLockControls(camera,document.body);scene.add(controls.getObject());
const clock=new THREE.Clock(),raycaster=new THREE.Raycaster(),colliders=[],solidMeshes=[],targets=[],remotePlayers=new Map(),keys=new Set();
let running=false,online=false,aiming=false,socket=null,lastShot=0,lastSync=0,recoil=0,flashDuration=65,bob=0,firing=false,health=100,shield=100,kills=0,cash=300,ownedWeapons=new Set([0]),ammo=12,reserve=60,reloading=false,reloadUntil=0,playerName='Rookie',lastHitTime=0,weaponIndex=0,targetBot=0,difficulty='medium',mapIndex=0,matchMode='1v1',hairColor='#30241e',gunColor='#52665f',uniformColor='#477f72',skinColor='#b88d70',shoeColor='#20292b',armorLevel=0,playerRoundScore=0,botRoundScore=0,matchOver=false;
let jumpVelocity=0,jumpOffset=0,slideRemaining=0,slideCooldown=0,slideDirection=new THREE.Vector3(),slideMessageAt=0,sprintStamina=100,killStreak=0,sprintingNow=false,movementAmount=0;
const weaponCosts=[0,300,900,400,650,700,1200,500];
const direction=new THREE.Vector3(),botShotEffects=[],movementVelocity=new THREE.Vector3();
const weapons=[
 {name:'PULSE PISTOL',mag:12,reserve:60,delay:190,reload:900,damage:38,range:38,pellets:1,spread:.01,color:0x72c9ff},
 {name:'HEAVY PISTOL',mag:8,reserve:48,delay:300,reload:1050,damage:54,range:40,pellets:1,spread:.006,color:0xffcf78},
 {name:'AK-47',mag:30,reserve:150,delay:82,reload:1350,damage:19,range:62,pellets:1,spread:.018,color:0xe58b58},
 {name:'ARENA RIFLE',mag:30,reserve:120,delay:115,reload:1450,damage:32,range:65,pellets:1,spread:.012,color:0x80e9bd},
 {name:'PUMP SHOTGUN',mag:6,reserve:36,delay:620,reload:1550,damage:15,range:23,pellets:8,spread:.09,color:0xffa36b},
 {name:'BURST SCATTER',mag:8,reserve:48,delay:460,reload:1450,damage:17,range:25,pellets:6,spread:.075,color:0xffb36b},
 {name:'SNIPER RIFLE',mag:5,reserve:25,delay:950,reload:1800,damage:65,range:90,pellets:1,spread:.001,color:0xb5d7e8},
 {name:'VOLT SMG',mag:36,reserve:180,delay:68,reload:1250,damage:14,range:42,pellets:1,spread:.026,color:0x9d8cff}
];
scene.add(new THREE.HemisphereLight(0xcbd4d5,0x343a35,0.92));const sun=new THREE.DirectionalLight(0xffe7c5,2.55);sun.position.set(-14,25,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-100;sun.shadow.camera.right=100;sun.shadow.camera.top=100;sun.shadow.camera.bottom=-100;scene.add(sun);
function makeSurfaceTexture(base='#c8c8bd',seed=17){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle=base;ctx.fillRect(0,0,512,512);let n=seed;const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};for(let i=0;i<15000;i++){const v=Math.floor(95+rand()*130);ctx.fillStyle='rgba('+v+','+v+','+Math.max(85,v-5)+','+(0.025+rand()*.12)+')';const size=1+rand()*3;ctx.fillRect(rand()*512,rand()*512,size,size);}for(let i=0;i<85;i++){const x=rand()*512,y=rand()*512;ctx.strokeStyle='rgba(54,58,54,'+(0.035+rand()*.08)+')';ctx.lineWidth=.4+rand()*.8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rand()-.5)*45,y+(rand()-.5)*45);ctx.stroke();}const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;}
const groundTexture=makeSurfaceTexture('#bcbcb0',41);groundTexture.repeat.set(12,12);const concreteTexture=makeSurfaceTexture('#d2d0c6',73);concreteTexture.repeat.set(1.5,1.5);
function makeRealisticSurface(base,seed,kind){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle=base;ctx.fillRect(0,0,512,512);let n=seed;
 const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
 for(let i=0;i<24000;i++){const v=Math.floor(55+rand()*175),a=.025+rand()*.12;ctx.fillStyle='rgba('+v+','+Math.max(0,v-(kind==='sand'?10:kind==='moss'?24:4))+','+Math.max(0,v-(kind==='rust'?30:kind==='moss'?35:kind==='snow'?-5:8))+','+a+')';const s=kind==='sand'?1+rand()*2.5:.6+rand()*2.1;ctx.fillRect(rand()*512,rand()*512,s,s);}
 for(let i=0;i<120;i++){const x=rand()*512,y=rand()*512,r=5+rand()*42;const grad=ctx.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,'rgba(25,27,25,'+(kind==='moss'?.12:.075)+')');grad.addColorStop(1,'rgba(25,27,25,0)');ctx.fillStyle=grad;ctx.fillRect(x-r,y-r,r*2,r*2);}
 if(kind==='concrete'||kind==='rust'||kind==='metal'){ctx.strokeStyle=kind==='metal'?'rgba(20,25,26,.28)':'rgba(35,37,34,.19)';ctx.lineWidth=1;for(let y=64;y<512;y+=128){ctx.beginPath();ctx.moveTo(0,y+(rand()-0.5)*7);ctx.lineTo(512,y+(rand()-0.5)*7);ctx.stroke();}for(let x=128;x<512;x+=128){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,512);ctx.stroke();}}
 if(kind==='concrete'||kind==='rust'){for(let i=0;i<18;i++){let x=rand()*512,y=rand()*512;ctx.strokeStyle='rgba(30,31,29,'+(.12+rand()*.16)+')';ctx.lineWidth=.5+rand()*1.4;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<3;j++){x+=(rand()-.5)*18;y+=rand()*16;ctx.lineTo(x,y);}ctx.stroke();}}
 if(kind==='sand'){for(let i=0;i<170;i++){ctx.strokeStyle='rgba(77,60,42,'+(0.035+rand()*.08)+')';ctx.lineWidth=.5+rand();ctx.beginPath();const x=rand()*512,y=rand()*512;ctx.moveTo(x,y);ctx.lineTo(x+3+rand()*18,y-1+rand()*3);ctx.stroke();}}
 if(kind==='moss'){for(let i=0;i<90;i++){ctx.fillStyle='rgba(44,65,39,'+(0.04+rand()*.1)+')';ctx.beginPath();ctx.ellipse(rand()*512,rand()*512,3+rand()*15,2+rand()*8,rand()*Math.PI,0,Math.PI*2);ctx.fill();}}
 const color=new THREE.CanvasTexture(canvas);color.wrapS=color.wrapT=THREE.RepeatWrapping;color.colorSpace=THREE.SRGBColorSpace;color.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const bump=color.clone();bump.colorSpace=THREE.NoColorSpace;bump.needsUpdate=true;
 return {color,bump,roughness:kind==='metal'?.68:kind==='snow'?.96:kind==='sand'?.98:.93,metalness:kind==='metal'?.24:kind==='rust'?.12:.025};
}
const realisticSurfaces=[
 makeRealisticSurface('#77766f',91,'concrete'),
 makeRealisticSurface('#9b8768',123,'sand'),
 makeRealisticSurface('#aab8bd',155,'snow'),
 makeRealisticSurface('#5f5b57',187,'rust'),
 makeRealisticSurface('#59644f',219,'moss'),
 makeRealisticSurface('#596b79',251,'metal')
];
let activeSurfaceSet=realisticSurfaces[0];
const floorMat=new THREE.MeshStandardMaterial({color:0x77766f,map:groundTexture,bumpMap:concreteTexture,bumpScale:.055,roughness:.96,metalness:.015});const floor=new THREE.Mesh(new THREE.PlaneGeometry(160,160),floorMat);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);const grid=new THREE.GridHelper(160,80,0x74786f,0x74786f);grid.position.y=.012;grid.material.transparent=true;grid.material.opacity=.012;scene.add(grid);const mapPads=[],arenaObjects=[];
// Bright arena pads and coloured landmark structures make the battlefield easier to read.
for(const [x,z,sx,sz,col] of [[-23,-20,10,7,0x3bbbd0],[23,-20,10,7,0xf4bd54],[-23,20,10,7,0xc77be8],[23,20,10,7,0x52d6a0],[0,0,8,8,0xf07b68]]){const pad=new THREE.Mesh(new THREE.PlaneGeometry(sx,sz),new THREE.MeshStandardMaterial({color:col,roughness:.8,side:THREE.DoubleSide}));pad.rotation.x=-Math.PI/2;pad.position.set(x,.025,z);pad.visible=false;scene.add(pad);mapPads.push(pad);}

const mapThemes=[{name:'INDUSTRIAL YARD',sky:0x9aaeb8,floor:0x77766f,grid:0x77766f,pads:[0x77766f,0x77766f,0x77766f,0x77766f,0x77766f]},{name:'DESERT OUTPOST',sky:0xc1ad8d,floor:0x9b8768,grid:0x9b8768,pads:[0x9b8768,0x9b8768,0x9b8768,0x9b8768,0x9b8768]},{name:'FROST DEPOT',sky:0xaebfc8,floor:0xaab8bd,grid:0xaab8bd,pads:[0xaab8bd,0xaab8bd,0xaab8bd,0xaab8bd,0xaab8bd]},{name:'ABANDONED WORKS',sky:0x8b8883,floor:0x5f5b57,grid:0x5f5b57,pads:[0x5f5b57,0x5f5b57,0x5f5b57,0x5f5b57,0x5f5b57]},{name:'OVERGROWN RUINS',sky:0x9cae96,floor:0x59644f,grid:0x59644f,pads:[0x59644f,0x59644f,0x59644f,0x59644f,0x59644f]},{name:'SKYBRIDGE',sky:0x8fa6bd,floor:0x596b79,grid:0x596b79,pads:[0x596b79,0x596b79,0x596b79,0x596b79,0x596b79]}];function applyMap(id){const mapId=Math.max(0,Math.min(5,Number(id)||0)),t=mapThemes[mapId];activeSurfaceSet=realisticSurfaces[mapId];scene.background.setHex(t.sky);scene.fog.color.setHex(t.sky);floorMat.color.setHex(t.floor);grid.material.color.setHex(t.grid);if(floorMat.map&&floorMat.map!==groundTexture)floorMat.map.dispose();if(floorMat.bumpMap&&floorMat.bumpMap!==concreteTexture)floorMat.bumpMap.dispose();floorMat.map=activeSurfaceSet.color.clone();floorMat.map.repeat.set(12,12);floorMat.bumpMap=activeSurfaceSet.bump.clone();floorMat.bumpMap.repeat.set(12,12);floorMat.bumpScale=.065;floorMat.needsUpdate=true;mapPads.forEach((p,i)=>p.material.color.setHex(t.pads[i]));$('map-name').textContent=t.name+(rainMapIds.has(mapId)?' · RAIN':'');rainGroup.visible=rainMapIds.has(mapId);buildMapGeometry(mapId);}
function box(x,y,z,sx,sy,sz,color,solid=true){const m=new THREE.Mesh(new THREE.BoxGeometry(sx*2,sy,sz*2),new THREE.MeshStandardMaterial({color,map:activeSurfaceSet.color,bumpMap:activeSurfaceSet.bump,bumpScale:.085,roughness:activeSurfaceSet.roughness,metalness:activeSurfaceSet.metalness}));m.position.set(x*2,y,z*2);m.castShadow=true;m.receiveShadow=true;scene.add(m);arenaObjects.push(m);if(solid){colliders.push(new THREE.Box3().setFromObject(m));solidMeshes.push(m);}return m;}
function accentBox(x,y,z,sx,sy,sz,color,intensity=.65){const mat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:Math.min(.10,intensity*.12),roughness:.76,metalness:.06});const m=new THREE.Mesh(new THREE.BoxGeometry(sx*2,sy,sz*2),mat);m.position.set(x*2,y,z*2);m.castShadow=false;m.receiveShadow=false;scene.add(m);arenaObjects.push(m);return m;}
function buildMapGeometry(id){
 for(const o of arenaObjects)scene.remove(o);arenaObjects.length=0;colliders.length=0;solidMeshes.length=0;
 // Arena perimeter and varied cover. Each map has its own silhouette and palette.
 box(0,2,-36,82,4,1,0x43565a);box(0,2,36,82,4,1,0x43565a);box(-41,2,0,1,4,72,0x43565a);box(41,2,0,1,4,72,0x43565a);
 const layouts=[
  [[-18,-15,3.4,1.8,2.4], [18,-15,3.4,1.8,2.4],[-18,15,3.4,1.8,2.4],[18,15,3.4,1.8,2.4],[0,-24,1.2,3.2,1.2],[0,24,1.2,3.2,1.2],[-29,0,1.2,2.6,5],[29,0,1.2,2.6,5]],
  [[-25,-20,5,1.2,2],[-12,-10,2,2.5,2],[12,10,2,2.5,2],[25,20,5,1.2,2],[-25,20,2,2,5],[25,-20,2,2,5],[0,-27,8,1.1,1.2],[0,27,8,1.1,1.2]],
  [[-22,-22,2.5,2.4,2.5],[22,-22,2.5,2.4,2.5],[-22,22,2.5,2.4,2.5],[22,22,2.5,2.4,2.5],[-10,0,1.2,3.4,6],[10,0,1.2,3.4,6],[0,-28,5,1.1,1.2],[0,28,5,1.1,1.2]],
  [[-28,-24,4,2.2,2], [28,-24,4,2.2,2],[-28,24,4,2.2,2],[28,24,4,2.2,2],[-14,0,2,3.2,2],[14,0,2,3.2,2],[0,-18,1.2,3.4,7],[0,18,1.2,3.4,7]],
  [[-24,-22,3,2.8,3],[24,-22,3,2.8,3],[-24,22,3,2.8,3],[24,22,3,2.8,3],[-15,-8,2,2.4,5],[15,8,2,2.4,5],[-15,8,2,2.4,5],[15,-8,2,2.4,5]],
   [[-28,-12,8,1.4,1.5],[28,12,8,1.4,1.5],[-18,0,1.5,3.8,9],[18,0,1.5,3.8,9],[-8,-24,5,1.2,1.5],[8,24,5,1.2,1.5],[-5,15,2,2.2,2],[5,-15,2,2.2,2],[0,0,7,1.1,1.5]],
 ];
 const colors=[0x697d78,0xb18b61,0x8aaeb7,0x765d62,0x557c52,0x6a86b5],accent=mapThemes[id].pads;
 (layouts[id]||layouts[0]).forEach(([x,z,sx,sy,sz],i)=>box(x,sy/2,z,sx,sy,sz,i%3===0?accent[i%accent.length]:colors[id]));
 // Tall warehouse-style walls and concrete towers create genuine line-of-sight breaks.
 const tallMat=[0x59635f,0x9b7954,0x718a96,0x654d55,0x3d6747,0x48677f][id];
 for(const [x,z,w,h,d] of [[-14,-5,1.5,8,13],[14,5,1.5,8,13],[-3,-19,12,6.5,1.5],[3,19,12,6.5,1.5],[-31,0,1.5,7,12],[31,0,1.5,7,12]]){const wall=box(x,h/2,z,w,h,d,tallMat);wall.material.roughness=.94;wall.material.metalness=.04;for(let y=1.2;y<h;y+=1.8){const seam=box(x,y,z,w+.025,.055,d+.025,0x353f3d,false);seam.material.roughness=1;}}
 for(const [x,z] of [[-22,-12],[22,12],[-22,12],[22,-12]]){box(x,2.8,z,3,5.6,3,tallMat);box(x,5.7,z,3.3,.2,3.3,0x4b5550,false);}
 // Functional concrete service pad with worn painted lane marks instead of a glowing neon plinth.
 box(0,.16,0,8,.32,8,0x686a65,false);
 const markingMat=new THREE.MeshStandardMaterial({color:0xc0b99e,roughness:.94,metalness:0});
 for(const [x,z,sx,sz] of [[0,-3.25,5.8,.045],[0,3.25,5.8,.045],[-3.25,0,.045,5.8],[3.25,0,.045,5.8]]){
  const mark=new THREE.Mesh(new THREE.PlaneGeometry(sx*2,sz*2),markingMat);mark.rotation.x=-Math.PI/2;mark.position.set(x*2,.337,z*2);mark.receiveShadow=true;scene.add(mark);arenaObjects.push(mark);
 }
 // Low-profile steel corner posts and fasteners make the central cover read as built infrastructure.
 for(const [x,z] of [[-7,-7],[7,-7],[-7,7],[7,7]]){
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,.42,8),new THREE.MeshStandardMaterial({color:0x454b49,metalness:.48,roughness:.58}));post.position.set(x*2,.21,z*2);post.castShadow=true;scene.add(post);arenaObjects.push(post);
 }
 // Subtle painted hazard marks are kept non-emissive and limited to service edges.
 for(const [x,z] of [[-34,-20],[34,-20],[-34,20],[34,20]]){
  box(x,3.05,z,1.1,.05,1.1,0x817b6d,false);
 }
 // Layered cover lanes: tall concrete blocks, waist-high barricades and supply crates.
 // These are solid for movement and block shots, creating genuine peek-and-hide routes.
 const coverPalette=[0x666a65,0x777065,0x505a55,0x6b6259,0x898173,0x626e78];
 const cover=[[-9,-22,3.8,2.2,1.25],[9,-22,3.8,2.2,1.25],[-9,22,3.8,2.2,1.25],[9,22,3.8,2.2,1.25],[-29,-8,1.4,2.4,4.2],[29,8,1.4,2.4,4.2],[-6,-7,2.4,1.8,1.4],[6,7,2.4,1.8,1.4],[-6,7,2.4,1.8,1.4],[6,-7,2.4,1.8,1.4],[-18,0,3.2,1.4,1.2],[18,0,3.2,1.4,1.2],[-34,10,2.4,1.8,1.6],[34,-10,2.4,1.8,1.6]];
 cover.forEach(([x,z,sx,sy,sz],i)=>box(x,sy/2,z,sx,sy,sz,coverPalette[(i+id)%coverPalette.length]));
 // Smaller offset crates make the approach routes less symmetrical.
 for(let i=0;i<8;i++){const x=-30+i*8,z=(i%2===0?-14:14)+(id%2?3:-3),h=1.1+(i%3)*.35;box(x,h/2,z,1.4,h,1.35,[0x6c6c63,0x79766a,0x5d625c,0x777064][i%4]);}
 // Original environmental set dressing: practical props vary by location rather than relying on neon landmarks.
 function propCylinder(x,y,z,radius,height,color,metalness=.12,roughness=.86){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius*2,radius*2,height,10),new THREE.MeshStandardMaterial({color,map:activeSurfaceSet.color,bumpMap:activeSurfaceSet.bump,bumpScale:.035,metalness,roughness}));
  mesh.position.set(x*2,y,z*2);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);arenaObjects.push(mesh);return mesh;
 }
 function propTire(x,y,z,radius=.62){
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(radius*2*.72,radius*2*.28,7,12),new THREE.MeshStandardMaterial({color:0x292c2b,roughness:.98,metalness:0}));
  mesh.rotation.x=Math.PI/2;mesh.position.set(x*2,y,z*2);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);arenaObjects.push(mesh);return mesh;
 }
 if(id===0||id===3){
  // Industrial and abandoned sites: battered drums, timber pallets and low utility runs.
  for(const [x,z,c] of [[-34,-5,0x6a5b48],[-32,-5,0x777064],[33,5,0x4d5b5a],[31,5,0x6b6254]])propCylinder(x,.62,z,.34,1.24,c,.22,.78);
  for(const [x,z] of [[-25,-14],[25,14],[-25,14],[25,-14]]){
   for(let i=0;i<4;i++)box(x,.13+i*.11,z-1.1+i*.72,1.35,.12,.12,0x766d5d,false);
   box(x,.24,z,1.45,.13,.12,0x4e514d,false);
  }
 }
 if(id===1){
  // Desert outpost: low sandbag lips and sun-faded supply drums.
  for(const [x,z,dir] of [[-31,0,0],[31,0,0],[-12,24,1],[12,-24,1]]){
   for(let i=0;i<5;i++){const bag=box(x+(dir?i*1.05-2.1:0),.28,z+(dir?0:i*1.05-2.1),.56,.28,.38, i%2?0x8d7a5b:0x9b8768,false);bag.rotation.y=dir?0:Math.PI/2;}
  }
  for(const [x,z] of [[-34,25],[34,-25]])propCylinder(x,.55,z,.31,1.1,0x71634e,.08,.94);
 }
 if(id===2){
  // Frost depot: snow-dulled crates and dark rubber stacks at the edges of lanes.
  for(const [x,z] of [[-33,-16],[33,16],[-33,16],[33,-16]]){
   box(x,.52,z,1.05,1.04,.92,0x7c8585,false);box(x,.99,z,1.08,.07,.95,0x59615f,false);
   propTire(x+1.35,.42,z,.52);propTire(x+1.35,1.12,z,.52);
  }
 }
 if(id===4){
  // Overgrown ruins: fractured masonry and restrained ground cover at wall bases.
  for(const [x,z] of [[-33,-25],[33,-25],[-33,25],[33,25],[-11,28],[11,-28]]){
   for(let i=0;i<4;i++){const rubble=box(x+(i%2)*.55,.16+(i%3)*.08,z+Math.floor(i/2)*.58,.38,.25+(i%2)*.12,.34,[0x555c4c,0x68695b,0x777566][i%3],false);rubble.rotation.y=(i*.43);}
  }
  for(const [x,z] of [[-37,-13],[37,13],[-37,13],[37,-13]])propCylinder(x,.3,z,.22,.6,0x4a5145,.02,.98);
 }
 if(id===5){
  // Skybridge: restrained service equipment and cable-tray supports, not glowing sci-fi trim.
  for(const [x,z] of [[-34,-24],[34,-24],[-34,24],[34,24]]){
   box(x,.48,z,1.15,.96,.78,0x555e62,false);box(x,1.02,z,1.2,.08,.82,0x343c3e,false);
   for(let j=0;j<3;j++)box(x-0.65+j*.65,1.15,z,.035,.18,.035,0x8a8c83,false);
  }
 }
 // Four wrecked cars (five on alternating maps) create solid, waist-high cover in the outer lanes.
 const wrecks=[[-29,-27],[29,-25],[-31,19],[30,22]];if(id%2===0)wrecks.push([0,-30]);
 wrecks.forEach(([x,z],i)=>{
  const rust=[0x59463b,0x5c5148,0x465252,0x625047,0x4e4c46][(i+id)%5];
  const shell=box(x,.88,z,3.7,1.76,1.72,rust,true);shell.material.roughness=.98;shell.material.metalness=.18;
  // Missing roof panels, broken glass and bent bodywork make each wreck read as abandoned.
  const hood=box(x-1.08,1.84,z,1.2,.18,1.62,0x3b4545,false);hood.rotation.z=(i%2?-.08:.06);
  const trunk=box(x+1.18,1.8,z,1.05,.18,1.6,0x353f40,false);trunk.rotation.z=(i%2?.07:-.05);
  const glass=box(x-.08,2.0,z,1.12,.12,1.35,0x263d43,false);glass.material.transparent=true;glass.material.opacity=.7;
  const wheelMat=new THREE.MeshStandardMaterial({color:0x171b1c,roughness:.98});
  for(const wx of [-1.15,1.15])for(const wz of [-.83,.83]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.39,.39,.24,10),wheelMat);wheel.rotation.z=Math.PI/2;wheel.position.set(x*2+wx*2,.38,z*2+wz*2);wheel.rotation.x=(i%2?-.06:.04);wheel.castShadow=true;scene.add(wheel);arenaObjects.push(wheel);}
  const door=box(x+(i%2?.45:-.5),.88,z+(i%2?.9:-.9),1.05,.72,.08,0x4a4037,false);door.rotation.z=i%2?.14:-.12;
  const lamp=box(x-1.65,.86,z-.45,.12,.12,.18,0x75654f,false);lamp.material.emissive.setHex(0x241b11);lamp.material.emissiveIntensity=.035;
 });
 // Drain grates and expansion joints break up large empty floor planes.
 for(const [x,z] of [[-18,-5],[18,5],[-30,0],[30,0],[0,-28],[0,28]]){
  const grate=new THREE.Mesh(new THREE.BoxGeometry(2.8,.035,.62),new THREE.MeshStandardMaterial({color:0x353b3a,metalness:.42,roughness:.82}));
  grate.position.set(x*2,.025,z*2);grate.receiveShadow=true;scene.add(grate);arenaObjects.push(grate);
  for(let j=-5;j<=5;j++){const bar=new THREE.Mesh(new THREE.BoxGeometry(.035,.04,.55),new THREE.MeshStandardMaterial({color:0x737873,metalness:.55,roughness:.65}));bar.position.set(x*2+j*.23,.048,z*2);scene.add(bar);arenaObjects.push(bar);}
 }
 // Repeated concrete control joints, with subtle chipped paint at lane edges.
 for(const z of [-32,-16,16,32])for(const x of [-24,-8,8,24]){
  const seam=new THREE.Mesh(new THREE.PlaneGeometry(.035,18),new THREE.MeshStandardMaterial({color:0x343a37,roughness:1,transparent:true,opacity:.42,side:THREE.DoubleSide}));
  seam.rotation.x=-Math.PI/2;seam.position.set(x*2,.012,z*2);scene.add(seam);arenaObjects.push(seam);
 }
 // Short utility conduits follow the inside of the perimeter wall.
 for(const z of [-34,34]){
  const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,144,8),new THREE.MeshStandardMaterial({color:0x555c5a,metalness:.55,roughness:.62}));
  pipe.rotation.z=Math.PI/2;pipe.position.set(0,1.05,z*2);pipe.castShadow=true;scene.add(pipe);arenaObjects.push(pipe);
  for(let x=-34;x<=34;x+=8){const clamp=new THREE.Mesh(new THREE.BoxGeometry(.12,.28,.2),new THREE.MeshStandardMaterial({color:0x393f3e,metalness:.62,roughness:.5}));clamp.position.set(x*2,1.05,z*2);scene.add(clamp);arenaObjects.push(clamp);}
 }
}

const weapon=new THREE.Group();camera.add(weapon);weapon.position.set(.34,-.3,-.58);
const darkMat=new THREE.MeshStandardMaterial({color:0x20292b,metalness:.72,roughness:.32}),bodyMat=new THREE.MeshStandardMaterial({color:0x52665f,metalness:.28,roughness:.52});
const weaponAccentMat=new THREE.MeshStandardMaterial({color:0x72c9ff,emissive:0x164c66,emissiveIntensity:.8,metalness:.18,roughness:.34});
function gunPart(sx,sy,sz,x,y,z,mat=darkMat){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat);m.position.set(x,y,z);m.castShadow=true;weapon.add(m);return m;}
const gunBody=gunPart(.18,.16,.43,0,0,0,bodyMat),gunBarrel=gunPart(.105,.09,.46,0,.035,-.37),gunFront=gunPart(.075,.075,.36,0,.035,-.77),gunGrip=gunPart(.12,.18,.17,0,-.14,.08,bodyMat);
// Bright, weapon-specific side panels and top rail give the first-person model a colourful arena finish.
const weaponSideL=gunPart(.018,.075,.25,-.098,.012,-.025,weaponAccentMat),weaponSideR=gunPart(.018,.075,.25,.098,.012,-.025,weaponAccentMat),weaponRail=gunPart(.055,.018,.25,0,.094,-.13,weaponAccentMat),weaponMuzzleRing=gunPart(.115,.105,.035,0,.035,-.62,weaponAccentMat);
const gloveMat=new THREE.MeshStandardMaterial({color:0x252b2a,roughness:.82}),sleeveMat=new THREE.MeshStandardMaterial({color:0x3c4940,roughness:.9});
const gloveL=new THREE.Mesh(new THREE.BoxGeometry(.14,.105,.17),gloveMat);gloveL.position.set(-.12,-.08,-.43);gloveL.rotation.x=-.16;weapon.add(gloveL);
const gloveR=new THREE.Mesh(new THREE.BoxGeometry(.13,.11,.15),gloveMat);gloveR.position.set(.065,-.14,.045);gloveR.rotation.x=-.12;weapon.add(gloveR);
const supportSleeve=new THREE.Mesh(new THREE.CapsuleGeometry(.075,.34,4,8),sleeveMat);supportSleeve.position.set(-.25,-.25,-.25);supportSleeve.rotation.z=-.62;supportSleeve.rotation.x=-.35;weapon.add(supportSleeve);
const firingSleeve=new THREE.Mesh(new THREE.CapsuleGeometry(.078,.3,4,8),sleeveMat);firingSleeve.position.set(.23,-.29,.12);firingSleeve.rotation.z=.5;firingSleeve.rotation.x=.22;weapon.add(firingSleeve);
const genericLower=gunPart(.09,.22,.12,0,-.27,.04),genericSightBase=gunPart(.06,.07,.16,0,.115,-.18),genericFrontDetail=gunPart(.025,.03,.1,0,.12,-.73,bodyMat);
const rifleSight=gunPart(.045,.055,.09,0,.14,-.22),shotgunBarrel=gunPart(.065,.065,.36,.07,.035,-.75),rifleStock=gunPart(.14,.11,.23,0,-.01,.29,bodyMat);
const akSteel=new THREE.MeshStandardMaterial({color:0x303638,metalness:.72,roughness:.38}),akEdge=new THREE.MeshStandardMaterial({color:0x69706d,metalness:.82,roughness:.31}),akWood=new THREE.MeshStandardMaterial({color:0x754323,roughness:.78}),akWoodLight=new THREE.MeshStandardMaterial({color:0x9a6233,roughness:.82}),akBlack=new THREE.MeshStandardMaterial({color:0x191e1e,metalness:.36,roughness:.5});
const akParts=[];
function akPart(sx,sy,sz,x,y,z,mat){const m=gunPart(sx,sy,sz,x,y,z,mat);m.visible=false;akParts.push(m);return m;}
akPart(.19,.16,.42,0,.005,-.015,akSteel);
akPart(.195,.055,.38,0,.102,-.02,akEdge);
akPart(.12,.045,.27,0,.145,-.11,akBlack);
akPart(.105,.075,.27,0,.025,-.39,akWood);
akPart(.11,.035,.26,0,.07,-.39,akWoodLight);
akPart(.13,.105,.27,0,-.015,.29,akWood);
akPart(.14,.028,.24,0,-.018,.31,akWoodLight);
akPart(.105,.19,.13,0,-.13,.09,akWood);
akPart(.105,.075,.12,0,-.19,.035,akWoodLight);
akPart(.105,.12,.13,0,-.15,-.045,akSteel);
const akMag1=akPart(.105,.105,.12,0,-.245,-.035,akSteel);akMag1.rotation.x=-.12;
const akMag2=akPart(.10,.10,.115,0,-.326,.005,akSteel);akMag2.rotation.x=-.25;
const akMag3=akPart(.095,.085,.105,0,-.397,.055,akSteel);akMag3.rotation.x=-.38;
akPart(.045,.04,.34,0,.075,-.4,akSteel);
const akBarrel=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.43,10),akSteel);akBarrel.rotation.x=Math.PI/2;akBarrel.position.set(0,.035,-.635);akBarrel.visible=false;weapon.add(akBarrel);akParts.push(akBarrel);
akPart(.07,.12,.09,0,.06,-.61,akSteel);
akPart(.055,.11,.055,0,.135,-.035,akBlack);
akPart(.022,.12,.025,0,.13,-.68,akBlack);
akPart(.09,.085,.07,0,.035,-.76,akSteel);
akPart(.07,.075,.08,0,.035,-.84,akBlack);
for(let i=0;i<4;i++)akPart(.012,.012,.17,-.057+i*.038,.035,-.39,akWoodLight);
const akTrigger=new THREE.Mesh(new THREE.TorusGeometry(.045,.009,5,12),akBlack);akTrigger.position.set(0,-.115,.045);akTrigger.rotation.x=Math.PI/2;akTrigger.visible=false;weapon.add(akTrigger);akParts.push(akTrigger);
// Distinct, material-led first-person models for the full weapon roster.
const variantSteel=new THREE.MeshStandardMaterial({color:0x353a3b,metalness:.78,roughness:.34});
const variantEdge=new THREE.MeshStandardMaterial({color:0x707775,metalness:.82,roughness:.29});
const polymer=new THREE.MeshStandardMaterial({color:0x202625,metalness:.18,roughness:.74});
const polymerOlive=new THREE.MeshStandardMaterial({color:0x454b40,metalness:.12,roughness:.8});
const walnut=new THREE.MeshStandardMaterial({color:0x704324,roughness:.8});
const walnutLight=new THREE.MeshStandardMaterial({color:0x966038,roughness:.82});
const opticGlass=new THREE.MeshStandardMaterial({color:0x173b3c,metalness:.25,roughness:.2,emissive:0x071c1c});
const variantParts=Array.from({length:8},()=>[]);
function variantPart(index,sx,sy,sz,x,y,z,mat=variantSteel,rotX=0,rotY=0,rotZ=0){const m=gunPart(sx,sy,sz,x,y,z,mat);m.rotation.set(rotX,rotY,rotZ);m.visible=false;variantParts[index].push(m);return m;}
function variantCylinder(index,rTop,rBottom,length,x,y,z,mat=variantSteel,axis='z'){const m=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBottom,length,12),mat);if(axis==='z')m.rotation.x=Math.PI/2;else if(axis==='x')m.rotation.z=Math.PI/2;m.position.set(x,y,z);m.castShadow=true;m.visible=false;weapon.add(m);variantParts[index].push(m);return m;}
function variantRing(index,r,t,x,y,z,mat=variantSteel){const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,6,16),mat);m.position.set(x,y,z);m.visible=false;weapon.add(m);variantParts[index].push(m);return m;}
// 0 — compact service pistol: slide, barrel, textured grip, sights and trigger guard.
variantPart(0,.15,.105,.31,0,.005,-.12,variantSteel);
variantPart(0,.155,.035,.28,0,.064,-.12,variantEdge);
variantCylinder(0,.025,.025,.18,0,.018,-.39,variantSteel);
variantPart(0,.105,.19,.12,0,-.115,.045,polymer,-.16);
variantPart(0,.11,.035,.09,0,-.202,.065,polymerOlive,-.16);
variantPart(0,.045,.025,.05,0,.071,-.17,polymer);
variantPart(0,.025,.035,.04,0,.09,-.27,variantEdge);
variantRing(0,.035,.007,0,-.085,-.015,variantSteel);
// 1 — heavy pistol with a longer squared slide and pronounced muzzle.
variantPart(1,.18,.13,.36,0,.015,-.12,variantSteel);
variantPart(1,.185,.035,.32,0,.084,-.12,variantEdge);
variantCylinder(1,.033,.033,.19,0,.025,-.405,variantSteel);
variantPart(1,.12,.21,.14,0,-.13,.045,polymer,-.12);
variantPart(1,.125,.035,.11,0,-.226,.065,polymerOlive,-.12);
variantPart(1,.07,.025,.08,0,.094,-.16,variantSteel);
variantPart(1,.03,.035,.045,0,.112,-.26,variantEdge);
variantRing(1,.045,.008,0,-.095,-.02,variantSteel);
// 3 — modern service rifle with polymer handguard, adjustable stock, curved magazine and optic.
variantPart(3,.19,.15,.4,0,.005,-.015,variantSteel);
variantPart(3,.20,.045,.34,0,.098,-.015,variantEdge);
variantPart(3,.115,.08,.3,0,.018,-.39,polymerOlive);
variantPart(3,.13,.045,.25,0,.065,-.39,polymer);
variantCylinder(3,.022,.022,.48,0,.04,-.72,variantSteel);
variantPart(3,.12,.18,.13,0,-.13,.07,polymer,-.14);
variantPart(3,.11,.12,.12,0,-.16,-.04,variantSteel,-.12);
variantPart(3,.10,.11,.12,0,-.25,-.015,variantSteel,-.25);
variantPart(3,.14,.09,.23,0,-.005,.29,polymerOlive);
variantPart(3,.13,.07,.17,0,-.005,.48,polymer);
variantPart(3,.13,.07,.12,0,.145,-.13,polymer);
variantPart(3,.10,.045,.08,0,.19,-.13,opticGlass);
variantPart(3,.035,.04,.04,0,.14,-.27,variantEdge);
// 4 — pump shotgun with wooden furniture, long barrel and under-barrel tube.
variantPart(4,.18,.14,.34,0,.005,.015,variantSteel);
variantPart(4,.14,.10,.24,0,-.01,.28,walnut);
variantPart(4,.15,.035,.21,0,.035,.28,walnutLight);
variantPart(4,.105,.07,.22,0,.02,-.36,walnut);
variantPart(4,.11,.035,.19,0,.063,-.36,walnutLight);
variantCylinder(4,.03,.03,.62,0,.045,-.67,variantSteel);
variantCylinder(4,.022,.022,.48,0,-.035,-.56,variantEdge);
variantPart(4,.12,.17,.12,0,-.13,.10,polymer,-.14);
variantPart(4,.075,.06,.07,0,.13,-.20,variantSteel);
// 5 — tactical burst scattergun with twin front tubes and a compact stock.
variantPart(5,.19,.15,.34,0,.005,-.015,variantSteel);
variantPart(5,.12,.085,.25,0,.015,-.36,polymer);
variantCylinder(5,.027,.027,.55,-.045,.04,-.67,variantSteel);
variantCylinder(5,.027,.027,.55,.045,.04,-.67,variantEdge);
variantPart(5,.10,.18,.13,0,-.13,.08,polymerOlive,-.14);
variantPart(5,.13,.08,.20,0,-.01,.28,polymer);
variantPart(5,.10,.10,.12,0,-.13,-.08,variantSteel,-.13);
variantPart(5,.11,.035,.20,0,.07,-.36,polymerOlive);
variantPart(5,.10,.045,.13,0,.135,-.14,variantSteel);
variantPart(5,.07,.05,.07,0,.16,-.14,opticGlass);
// 6 — precision sniper rifle with long barrel, cheek rest, scope and bipod.
variantPart(6,.18,.14,.43,0,.005,.005,variantSteel);
variantPart(6,.15,.11,.32,0,-.01,.32,polymerOlive);
variantPart(6,.16,.035,.25,0,.045,.30,polymer);
variantPart(6,.11,.075,.28,0,.015,-.39,polymer);
variantCylinder(6,.022,.022,.88,0,.04,-.91,variantSteel);
variantPart(6,.12,.12,.16,0,.12,-.19,variantSteel);
variantCylinder(6,.048,.048,.27,0,.19,-.23,variantSteel);
variantCylinder(6,.036,.036,.12,0,.19,-.23,opticGlass);
variantPart(6,.055,.065,.08,0,.17,-.23,polymer);
variantPart(6,.13,.035,.15,0,.08,.13,polymer);
variantPart(6,.018,.18,.025,-.06,-.12,-.42,variantEdge,-.18);
variantPart(6,.018,.18,.025,.06,-.12,-.42,variantEdge,.18);
// 7 — compact SMG with short barrel, folding stock, top rail and compact magazine.
variantPart(7,.18,.15,.34,0,.005,-.015,variantSteel);
variantPart(7,.12,.075,.21,0,.015,-.30,polymerOlive);
variantCylinder(7,.022,.022,.30,0,.035,-.58,variantSteel);
variantPart(7,.11,.18,.13,0,-.13,.065,polymer,-.13);
variantPart(7,.10,.12,.10,0,-.22,-.045,variantSteel,-.18);
variantPart(7,.10,.10,.10,0,-.30,-.005,variantSteel,-.30);
variantPart(7,.13,.045,.18,0,.115,-.10,variantSteel);
variantPart(7,.035,.04,.06,0,.15,-.14,polymer);
variantPart(7,.12,.08,.22,0,-.005,.27,polymerOlive);
variantPart(7,.035,.04,.08,0,-.005,.42,variantEdge);
const muzzle=new THREE.PointLight(0xffb66d,0,5);muzzle.position.set(0,.04,-.98);weapon.add(muzzle);const flash=new THREE.Mesh(new THREE.ConeGeometry(.09,.28,8),new THREE.MeshBasicMaterial({color:0xffd38a,transparent:true,opacity:.9}));flash.rotation.x=-Math.PI/2;flash.position.set(0,.035,-1.02);flash.visible=false;weapon.add(flash);
function applyWeapon(){const w=weapons[weaponIndex],isAK=weaponIndex===2;gunBody.visible=gunBarrel.visible=gunFront.visible=gunGrip.visible=false;genericLower.visible=genericSightBase.visible=genericFrontDetail.visible=false;rifleSight.visible=shotgunBarrel.visible=rifleStock.visible=false;for(const part of variantParts.flat())part.visible=false;if(weaponIndex!==2)for(const part of variantParts[weaponIndex])part.visible=true;for(const part of akParts)part.visible=isAK;weaponSideL.visible=weaponSideR.visible=weaponRail.visible=weaponMuzzleRing.visible=false;bodyMat.color.set(gunColor);weaponAccentMat.color.setHex(w.color);weaponAccentMat.emissive.setHex(w.color).multiplyScalar(.22);muzzle.color.setHex(w.color);flash.material.color.setHex(w.color);flash.position.z=weaponIndex===6? -1.25:weaponIndex===4||weaponIndex===5?-.95:isAK?-.9:-.85;flashDuration=weaponIndex===4||weaponIndex===5?82:weaponIndex===6?90:weaponIndex===0?45:65;flash.scale.setScalar(weaponIndex===4||weaponIndex===5?1.35:weaponIndex===6?1.5:weaponIndex===0?.72:1);ammo=w.mag;reserve=w.reserve;reloading=false;$('weapon-name').textContent=w.name;updateHud();setMessage('EQUIPPED '+w.name,850);}
function makeBot(x,z,index){
 x*=2;z*=2;const group=new THREE.Group();group.position.set(x,0,z);if(index===8)group.scale.setScalar(1.28);scene.add(group);
 const armor=new THREE.MeshStandardMaterial({color:index%2?0x75664f:0x56645a,map:concreteTexture,metalness:.08,roughness:.94});
 const dark=new THREE.MeshStandardMaterial({color:0x20292b,metalness:.48,roughness:.42});
 const plate=new THREE.MeshStandardMaterial({color:index%2?0x454b4b:0x3d4844,map:concreteTexture,metalness:.18,roughness:.8});
 const trim=new THREE.MeshStandardMaterial({color:index%3===0?0x9a8159:0x68736a,metalness:.08,roughness:.86});
 const skin=new THREE.MeshStandardMaterial({color:0xb88d70,roughness:.72});
 const visorMat=new THREE.MeshStandardMaterial({color:0x323a3b,metalness:.25,roughness:.32});
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.32,.58,5,10),armor);torso.position.y=1.2;torso.castShadow=true;group.add(torso);
 const chest=new THREE.Mesh(new THREE.BoxGeometry(.52,.42,.22),plate);chest.position.set(0,1.26,-.18);chest.castShadow=true;group.add(chest);
 const chestStripe=new THREE.Mesh(new THREE.BoxGeometry(.36,.055,.235),trim);chestStripe.position.set(0,1.37,-.3);group.add(chestStripe);
 const abdomen=new THREE.Mesh(new THREE.BoxGeometry(.39,.22,.2),dark);abdomen.position.set(0,.91,-.16);group.add(abdomen);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.205,18,14),skin);head.position.y=1.84;head.castShadow=true;group.add(head);
 const helmet=new THREE.Mesh(new THREE.SphereGeometry(.255,18,12,0,Math.PI*2,0,Math.PI*.57),dark);helmet.position.y=1.94;helmet.castShadow=true;group.add(helmet);
 const helmetFront=new THREE.Mesh(new THREE.BoxGeometry(.32,.065,.12),plate);helmetFront.position.set(0,1.91,-.19);group.add(helmetFront);
 const visor=new THREE.Mesh(new THREE.BoxGeometry(.29,.075,.045),visorMat);visor.position.set(0,1.83,-.203);group.add(visor);
 const headset=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.12,10),dark);headset.rotation.z=Math.PI/2;headset.position.set(.215,1.82,0);group.add(headset);
 const armGeo=new THREE.CapsuleGeometry(.105,.36,4,9),legGeo=new THREE.CapsuleGeometry(.12,.39,4,9);
 const leftArm=new THREE.Group(),rightArm=new THREE.Group(),leftLeg=new THREE.Group(),rightLeg=new THREE.Group();
 leftArm.position.set(-.39,1.39,0);rightArm.position.set(.39,1.39,0);leftLeg.position.set(-.18,.68,0);rightLeg.position.set(.18,.68,0);
 for(const [pivot,geo,mat,y] of [[leftArm,armGeo,armor,-.2],[rightArm,armGeo,armor,-.2],[leftLeg,legGeo,dark,-.22],[rightLeg,legGeo,dark,-.22]]){const limb=new THREE.Mesh(geo,mat);limb.position.y=y;limb.castShadow=true;pivot.add(limb);group.add(pivot);}
 for(const side of [-1,1]){
  const shoulder=new THREE.Mesh(new THREE.SphereGeometry(.17,12,10),plate);shoulder.position.set(side*.42,1.47,-.015);shoulder.castShadow=true;group.add(shoulder);
  const shoulderMark=new THREE.Mesh(new THREE.BoxGeometry(.15,.045,.16),trim);shoulderMark.position.set(side*.42,1.51,-.14);group.add(shoulderMark);
  const knee=new THREE.Mesh(new THREE.BoxGeometry(.23,.17,.14),plate);knee.position.set(side*.18,.49,-.11);group.add(knee);
  const boot=new THREE.Mesh(new THREE.BoxGeometry(.22,.16,.36),dark);boot.position.set(side*.18,.12,-.055);boot.castShadow=true;group.add(boot);
 }
 const belt=new THREE.Mesh(new THREE.BoxGeometry(.48,.12,.24),dark);belt.position.set(0,.78,-.02);group.add(belt);
 const buckle=new THREE.Mesh(new THREE.BoxGeometry(.11,.09,.04),trim);buckle.position.set(0,.78,-.15);group.add(buckle);
 const pack=new THREE.Mesh(new THREE.BoxGeometry(.34,.46,.2),plate);pack.position.set(0,1.25,.23);pack.castShadow=true;group.add(pack);
 const packTop=new THREE.Mesh(new THREE.BoxGeometry(.24,.08,.22),dark);packTop.position.set(0,1.51,.23);group.add(packTop);
 // Detailed rifle with stock, receiver, magazine, handguard, sight and muzzle.
 const botGun=new THREE.Group();botGun.position.set(.38,1.18,-.34);group.add(botGun);
 const gunBody=new THREE.Mesh(new THREE.BoxGeometry(.15,.14,.4),dark);gunBody.castShadow=true;botGun.add(gunBody);
 const gunTop=new THREE.Mesh(new THREE.BoxGeometry(.11,.045,.34),plate);gunTop.position.set(0,.085,-.03);botGun.add(gunTop);
 const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.027,.027,.38,10),dark);barrel.rotation.x=Math.PI/2;barrel.position.set(0,.02,-.36);botGun.add(barrel);
 const muzzleDevice=new THREE.Mesh(new THREE.CylinderGeometry(.04,.03,.09,10),trim);muzzleDevice.rotation.x=Math.PI/2;muzzleDevice.position.set(0,.02,-.57);botGun.add(muzzleDevice);
 const magazine=new THREE.Mesh(new THREE.BoxGeometry(.09,.23,.13),plate);magazine.position.set(0,-.16,-.04);magazine.rotation.x=-.12;botGun.add(magazine);
 const stock=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.22),plate);stock.position.set(0,.015,.27);botGun.add(stock);
 const sight=new THREE.Mesh(new THREE.BoxGeometry(.07,.075,.08),dark);sight.position.set(0,.14,-.12);botGun.add(sight);
 const grip=new THREE.Mesh(new THREE.BoxGeometry(.08,.16,.1),dark);grip.position.set(0,-.13,.06);grip.rotation.x=-.15;botGun.add(grip);
 const botMuzzle=new THREE.Mesh(new THREE.ConeGeometry(.085,.25,8),new THREE.MeshBasicMaterial({color:0xffc15c,transparent:true,opacity:.95}));botMuzzle.rotation.x=-Math.PI/2;botMuzzle.position.set(0,.02,-.68);botMuzzle.visible=false;botGun.add(botMuzzle);
 const targetRing=new THREE.Mesh(new THREE.TorusGeometry(.72,.055,6,28),new THREE.MeshBasicMaterial({color:0xffef72,transparent:true,opacity:.95}));targetRing.rotation.x=Math.PI/2;targetRing.position.y=.08;targetRing.visible=false;group.add(targetRing);
 const laneAngle=(index/9)*Math.PI*2+(Math.random()-.5)*.32;
 const isBoss=index===8;if(isBoss){trim.color.set(0xffc857);plate.color.set(0x553c20);targetRing.material.color.set(0xff8a3d);targetRing.scale.setScalar(1.65);}
  const bot={group,torso,head,leftArm,rightArm,leftLeg,rightLeg,targetRing,botMuzzle,botGun,muzzleUntil:0,hp:isBoss?450:100,maxHp:isBoss?450:100,shield:isBoss?220:100,maxShield:isBoss?220:100,isBoss,alive:true,respawn:0,phase:Math.random()*7,fireAt:performance.now()+1000+Math.random()*2200,index,anchorX:x,anchorZ:z,strafe:Math.random()<.5?-1:1,laneAngle,preferredRange:(isBoss?8:10+Math.random()*9)*2,shotSeed:Math.random()};
 group.userData.bot=bot;targets.push(bot);return bot;
}
for(let i=0;i<9;i++)makeBot((Math.random()-.5)*74,(Math.random()-.5)*62,i);

const PROGRESSION_KEY='browserArenaCareerV1';
const rankNames=['ROOKIE','RECRUIT','CONTENDER','SPECIALIST','VANGUARD','ELITE','CHAMPION','LEGEND'];
const freshCareer=()=>({xp:0,matches:0,minutes:0,careerDays:0,lastPlayedDay:''});
function loadCareer(){try{const raw=JSON.parse(localStorage.getItem(PROGRESSION_KEY)||'null');return raw&&typeof raw==='object'?{...freshCareer(),...raw}:freshCareer();}catch{return freshCareer();}}
let career=loadCareer(),matchStartedAt=0,matchRecorded=false;
function careerLevel(xp=career.xp){return Math.floor(Math.max(0,xp)/100)+1;}
function updateProgressUI(){
 const level=careerLevel(),inLevel=career.xp%100,rank=rankNames[Math.min(rankNames.length-1,Math.floor((level-1)/2))];
 const put=(id,value)=>{const el=$(id);if(el)el.textContent=String(value);};
 put('profile-level',String(level).padStart(2,'0'));put('profile-rank',rank);put('profile-xp-label',career.xp+' XP EARNED');put('profile-total-xp',career.xp.toLocaleString());put('profile-xp-current',inLevel+' / 100 XP');put('profile-next-level',(100-inLevel)+' XP TO LEVEL '+(level+1));put('profile-matches',career.matches);put('profile-minutes',Math.floor(career.minutes)+'m');put('profile-streak',career.careerDays);
 const fill=$('profile-xp-fill'),track=fill?.parentElement;if(fill)fill.style.width=inLevel+'%';if(track)track.setAttribute('aria-valuenow',String(inLevel));
}
function saveCareer(){try{localStorage.setItem(PROGRESSION_KEY,JSON.stringify(career));}catch{}updateProgressUI();}
function beginCareerMatch(){matchStartedAt=Date.now();matchRecorded=false;careerMatchStartXP=career.xp;}
let careerMatchStartXP=0;
function completeCareerMatch(){
 if(matchRecorded||!matchStartedAt)return null;
 matchRecorded=true;
 const minutes=Math.max(0,(Date.now()-matchStartedAt)/60000);
 const timeBonus=Math.min(20,Math.floor(minutes));
 const earned=100+timeBonus;
 const day=new Date().toISOString().slice(0,10);
 const previousXP=career.xp,previousLevel=careerLevel(previousXP);
 career.xp+=earned;career.matches+=1;career.minutes=Math.round((career.minutes+minutes)*10)/10;
 if(career.lastPlayedDay!==day){career.careerDays+=1;career.lastPlayedDay=day;}
 const level=careerLevel(),levelUp=level>previousLevel;
 saveCareer();
 return {earned,minutes,previousXP,totalXP:career.xp,previousLevel,level,levelUp,rank:rankNames[Math.min(rankNames.length-1,Math.floor((level-1)/2))],kills:Math.max(0,kills),playerRoundScore,botRoundScore,online};
}
function showMatchResults(resultLabel,detail){
 const summary=completeCareerMatch();
 if(!summary)return;
 window.dispatchEvent(new CustomEvent('browserarena:matchresult',{detail:{name:playerName,kills:summary.kills,wins:resultLabel.toLowerCase().includes('victory')?1:0}}));
 running=false;firing=false;toggleShop(false);$('score-panel')?.classList.remove('visible');
 controls.unlock();$('hud').style.display='none';$('map-lobby').classList.add('hidden');$('start-screen').classList.add('hidden');
 const el=(id)=>$(id);
 el('results-screen').classList.remove('hidden');
 el('results-match-type').textContent=summary.online?'ONLINE MATCH · '+matchMode:'OFFLINE TRAINING · '+matchMode;
 el('results-eyebrow').textContent=summary.levelUp?'CAREER LEVEL UP':'MATCH REPORT';
 el('results-title').innerHTML=summary.levelUp?'LEVEL<br><span>UP!</span>':'MATCH<br><span>COMPLETE.</span>';
 el('results-subtitle').textContent=detail;
 el('results-outcome-label').textContent=resultLabel;
 el('results-outcome-icon').textContent=resultLabel.toLowerCase().includes('victory')?'✦':resultLabel.toLowerCase().includes('defeat')?'↻':'◆';
 el('results-eliminations').textContent=String(summary.kills);
 el('results-earned-xp').textContent='+'+summary.earned;
 el('results-level-change').textContent=summary.levelUp?'LEVEL '+summary.previousLevel+' → '+summary.level:'LEVEL '+String(summary.level).padStart(2,'0');
 const inLevel=summary.totalXP%100;
 el('results-xp-fill').style.width=inLevel+'%';
 el('results-xp-progress').textContent=inLevel+' / 100 XP';
 el('results-xp-next').textContent=(100-inLevel)+' XP TO LEVEL '+(summary.level+1);
 el('results-level-up').classList.toggle('hidden',!summary.levelUp);
 el('results-level').textContent=String(summary.level).padStart(2,'0');
 el('results-total-xp').textContent=summary.totalXP.toLocaleString();
 const seconds=Math.floor(summary.minutes*60);
 el('results-time').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
 el('results-rematch').textContent='PLAY AGAIN ↗';
}


function announceKillstreak(streak,reward=0){const el=$('killstreak-banner');if(!el)return;const names={3:'HOT STREAK',5:'ON FIRE',8:'UNSTOPPABLE',10:'DOMINATING',15:'LEGENDARY',20:'ARENA LEGEND'};el.textContent=(names[streak]||streak+' ELIMINATIONS')+(reward?' · +$'+reward:'');el.classList.remove('show');void el.offsetWidth;el.classList.add('show');setMessage('KILLSTREAK '+streak+' · BONUS CASH '+(reward?'$'+reward:'AWARDED'),1900);}
 function setMessage(text,ms=1300){$('message').textContent=text;setTimeout(()=>{if($('message').textContent===text)$('message').textContent='';},ms);}
const DAILY_KEY='browserArenaDailyMissionsV1';
function dailyKey(){return new Date().toISOString().slice(0,10);}
function freshDaily(){return {day:dailyKey(),progress:{elims:0,boss:0,streak:0},claimed:[]};}
function loadDaily(){try{const d=JSON.parse(localStorage.getItem(DAILY_KEY)||'null');return d&&d.day===dailyKey()?{...freshDaily(),...d,progress:{...freshDaily().progress,...d.progress},claimed:Array.isArray(d.claimed)?d.claimed:[]}:freshDaily();}catch{return freshDaily();}}
let daily=loadDaily();
const dailyMissions=[{id:'elims',title:'Bot Breaker',desc:'Eliminate 5 bots',goal:5,reward:250},{id:'boss',title:'Boss Hunter',desc:'Defeat the Arena Boss once',goal:1,reward:500},{id:'streak',title:'Hot Hands',desc:'Reach a 3-elimination streak',goal:3,reward:200}];
function saveDaily(){try{localStorage.setItem(DAILY_KEY,JSON.stringify(daily));}catch{}}
function renderDaily(){const el=$('daily-missions');if(!el)return;el.innerHTML=dailyMissions.map(m=>{const p=Math.min(m.goal,daily.progress[m.id]||0),done=p>=m.goal,claimed=daily.claimed.includes(m.id);return '<div class="daily-mission"><div class="daily-mission-head"><b>'+m.title+'</b><span>'+(claimed?'CLAIMED':done?'READY':'$'+m.reward)+'</span></div><small>'+m.desc+'</small><div class="daily-track"><i style="width:'+Math.round(p/m.goal*100)+'%"></i></div><button type="button" data-daily-claim="'+m.id+'" '+(!done||claimed?'disabled':'')+'>'+(claimed?'COMPLETED':done?'CLAIM REWARD':'PROGRESS '+p+'/'+m.goal)+'</button></div>';}).join('');}
function dailyProgress(id,amount=1){if(!running||online)return;daily.progress[id]=Math.min(dailyMissions.find(m=>m.id===id).goal,(daily.progress[id]||0)+amount);saveDaily();renderDaily();}
$('daily-missions')?.addEventListener('click',e=>{const btn=e.target.closest('[data-daily-claim]');if(!btn)return;const m=dailyMissions.find(q=>q.id===btn.dataset.dailyClaim);if(!m||daily.claimed.includes(m.id)||(daily.progress[m.id]||0)<m.goal)return;daily.claimed.push(m.id);cash+=m.reward;saveDaily();renderDaily();updateHud();setMessage('DAILY MISSION COMPLETE · +$'+m.reward,2200);});
renderDaily();
const ACHIEVEMENT_KEY='browserArenaAchievementsV1';
const achievementDefs=[
 {id:'first_blood',title:'FIRST BLOOD',desc:'Get your first elimination',test:s=>s.kills>=1},
 {id:'veteran',title:'VETERAN',desc:'Reach 25 career eliminations',test:s=>s.kills>=25},
 {id:'boss_slayer',title:'BOSS SLAYER',desc:'Defeat the Arena Boss',test:s=>s.bosses>=1},
 {id:'on_fire',title:'ON FIRE',desc:'Reach a 5-elimination streak',test:s=>s.bestStreak>=5},
 {id:'collector',title:'COLLECTOR',desc:'Own 4 different weapons',test:s=>s.weapons>=4}
];
function loadAchievements(){try{const a=JSON.parse(localStorage.getItem(ACHIEVEMENT_KEY)||'null');return a&&typeof a==='object'?{kills:0,bosses:0,bestStreak:0,weapons:ownedWeapons.size,unlocked:[],...a,unlocked:Array.isArray(a.unlocked)?a.unlocked:[]}:{kills:0,bosses:0,bestStreak:0,weapons:ownedWeapons.size,unlocked:[]};}catch{return {kills:0,bosses:0,bestStreak:0,weapons:ownedWeapons.size,unlocked:[]};}}
let achievements=loadAchievements();
function saveAchievements(){try{localStorage.setItem(ACHIEVEMENT_KEY,JSON.stringify(achievements));}catch{}}
function renderAchievements(){const el=$('achievement-list'),count=$('achievement-count');if(!el)return;if(count)count.textContent=achievements.unlocked.length+'/'+achievementDefs.length+' UNLOCKED';el.innerHTML=achievementDefs.map(a=>{const unlocked=achievements.unlocked.includes(a.id);return '<div class="achievement-item '+(unlocked?'unlocked':'locked')+'"><span class="achievement-icon">'+(unlocked?'✦':'◇')+'</span><div><b>'+a.title+'</b><small>'+a.desc+'</small></div><strong>'+(unlocked?'UNLOCKED':'LOCKED')+'</strong></div>';}).join('');}
function checkAchievements(){const fresh=[];for(const a of achievementDefs)if(!achievements.unlocked.includes(a.id)&&a.test(achievements)){achievements.unlocked.push(a.id);fresh.push(a);}if(fresh.length){saveAchievements();renderAchievements();const el=$('achievement-toast');if(el){el.textContent='BADGE UNLOCKED · '+fresh[0].title;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}setMessage('ACHIEVEMENT UNLOCKED · '+fresh[0].title,2300);}else{saveAchievements();renderAchievements();}}
function trackAchievement(event){if(online)return;if(event==='kill')achievements.kills++;if(event==='boss')achievements.bosses++;if(event==='streak')achievements.bestStreak=Math.max(achievements.bestStreak,killStreak);if(event==='weapons')achievements.weapons=ownedWeapons.size;checkAchievements();}
renderAchievements();
function updateHud(){$('health').textContent=Math.max(0,Math.round(health));$('shield').textContent=Math.max(0,Math.round(shield));const vignette=$('health-vignette'),warning=$('low-health-warning');if(vignette){vignette.style.opacity=String(Math.min(.68,Math.max(0,(45-health)/45)*.68));vignette.setAttribute('aria-hidden',String(health>0));}if(warning){warning.classList.toggle('active',health>0&&health<=30);warning.setAttribute('aria-hidden',String(health>30||health<=0));}const selected=targets.find(b=>targetBot>0&&b.index===targetBot-1);$('target-status').textContent=selected?((selected.isBoss?'ARENA BOSS':'BOT '+targetBot)+' · HP '+Math.round(selected.hp)+' / '+Math.round(selected.maxHp)+' · SHIELD '+Math.round(selected.shield)):'TARGET: ANY BOT';$('kills').textContent=kills;$('cash').textContent='$'+cash;const ammoLabel=$('ammo');ammoLabel.textContent=reloading?'RELOADING':ammo+' / '+reserve;const ammoWrap=ammoLabel.closest('.stats span');if(ammoWrap){ammoWrap.classList.toggle('low-ammo',!reloading&&ammo>0&&ammo<=Math.max(3,Math.ceil(weapons[weaponIndex].mag*.25)));ammoWrap.classList.toggle('empty-ammo',!reloading&&ammo===0);ammoWrap.classList.toggle('reloading-ammo',reloading);}$('connection').textContent=online?'ONLINE · '+(socket?.connected?'CONNECTED':'CONNECTING'):'OFFLINE TRAINING';$('scoreboard').textContent=online?[...remotePlayers.values()].length+1+' PLAYERS':'BOT TRAINING';updateShop();}
function startGame(useOnline){if(daily.day!==dailyKey()){daily=freshDaily();saveDaily();renderDaily();}beginCareerMatch();$('results-screen').classList.add('hidden');playerName=($('player-name').value.trim()||'Rookie').slice(0,18);online=useOnline;difficulty=$('difficulty').value;targetBot=Number($('bot-target').value);for(const b of targets)b.targetRing.visible=targetBot>0&&b.index===targetBot-1;mapIndex=0;matchMode=$('match-mode').value;hairColor=$('hair-color').value;gunColor=$('gun-color').value;uniformColor=$('uniform-color').value;skinColor=$('skin-color').value;shoeColor=$('shoe-color').value;armorLevel=Number($('armor-color').value)||0;playerRoundScore=0;botRoundScore=0;matchOver=false;killStreak=0;$('player-round-score').textContent='0';$('bot-round-score').textContent='0';health=100;shield=100*(1+armorLevel*.03);bodyMat.color.set(gunColor);for(const b of targets){b.group.visible=!useOnline;b.hp=b.maxHp;b.shield=b.maxShield;}$('start-screen').classList.add('hidden');if(useOnline){running=false;$('hud').style.display='none';$('map-lobby').classList.remove('hidden');$('lobby-title').textContent='FINDING PLAYERS';$('lobby-status').textContent='Connecting to matchmaking…';$('map-votes').innerHTML='';connectOnline();}else{running=true;applyMap(mapIndex);$('map-lobby').classList.add('hidden');$('hud').style.display='block';controls.lock();}updateHud();}
$('bot-target').addEventListener('change',e=>{targetBot=Number(e.target.value);for(const b of targets)b.targetRing.visible=targetBot>0&&b.index===targetBot-1;});$('play-offline').addEventListener('click',()=>startGame(false));$('play-online').addEventListener('click',()=>{if(!$('server-url').value.trim())$('server-url').value=DEFAULT_SERVER_URL;startGame(true);});
controls.addEventListener('unlock',()=>{if(running)setMessage('CLICK THE GAME TO CAPTURE THE MOUSE',2200);});
renderer.domElement.addEventListener('click',()=>{if(running&&!controls.isLocked)controls.lock();});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.repeat){e.preventDefault();return;}keys.add(e.code);if((e.code==='Tab'||e.code==='KeyZ'||e.code==='ControlLeft'||e.code==='ControlRight')&&running)e.preventDefault();if(e.code==='KeyB'&&running){toggleShop();e.preventDefault();}if(e.code==='Escape')toggleShop(false);if(e.code==='KeyR')reload();if(e.code==='Digit1')switchWeapon(0);if(e.code==='Digit2')switchWeapon(1);if(e.code==='Digit3')switchWeapon(2);if(e.code==='Digit4')switchWeapon(3);if(e.code==='Digit5')switchWeapon(4);if(e.code==='Digit6')switchWeapon(5);if(e.code==='Digit7')switchWeapon(6);if(e.code==='Digit8')switchWeapon(7);if(e.code==='KeyK'&&running){e.preventDefault();$('score-panel').classList.toggle('visible');}});
function setAiming(value){aiming=Boolean(value)&&running;$('hud').classList.toggle('aiming',aiming);$('touch-aim')?.classList.toggle('active',aiming);}\ncontrols.addEventListener('unlock',()=>setAiming(false));\ndocument.addEventListener('keyup',e=>keys.delete(e.code));document.addEventListener('mousedown',e=>{if(e.button===0&&running&&controls.isLocked){firing=true;shoot();}if(e.button===2&&running&&controls.isLocked)setAiming(true);});document.addEventListener('mouseup',e=>{if(e.button===0)firing=false;if(e.button===2)setAiming(false);});window.addEventListener('blur',()=>{firing=false;setAiming(false);});document.addEventListener('contextmenu',e=>e.preventDefault());
function switchWeapon(i){if(i<0||i>=weapons.length||i===weaponIndex)return;if(!ownedWeapons.has(i)){setMessage('BUY '+weapons[i].name+' IN ARMORY (B) · $'+weaponCosts[i],1800);toggleShop(true);return;}weaponIndex=i;applyWeapon();updateWeaponSelector();if(online&&socket?.connected)socket.emit('equip',{weapon:i});}
function updateWeaponSelector(){const el=$('weapon-selector');if(!el)return;el.querySelectorAll('[data-weapon]').forEach(item=>{const i=Number(item.dataset.weapon);item.classList.toggle('active',i===weaponIndex);item.classList.toggle('locked',!ownedWeapons.has(i));});}
function updateShop(){const el=$('shop-items');if(!el)return;el.querySelectorAll('[data-buy]').forEach(button=>{const i=Number(button.dataset.buy),owned=ownedWeapons.has(i);button.disabled=owned||cash<weaponCosts[i];button.textContent=owned?'OWNED':cash<weaponCosts[i]?'NEED $'+weaponCosts[i]:'BUY · $'+weaponCosts[i];});}
function toggleShop(force){const el=$('shop-panel');if(!el)return;const open=force===undefined?!el.classList.contains('visible'):force;el.classList.toggle('visible',open);if(open)updateShop();}
function buyWeapon(i){if(ownedWeapons.has(i)||cash<weaponCosts[i]){setMessage(ownedWeapons.has(i)?'ALREADY OWNED':'NOT ENOUGH CASH',1000);return;}if(online&&socket?.connected){socket.emit('buy',{weapon:i});return;}cash-=weaponCosts[i];ownedWeapons.add(i);trackAchievement('weapons');setMessage('PURCHASED '+weapons[i].name);updateHud();updateWeaponSelector();toggleShop(true);}
document.querySelectorAll('[data-buy]').forEach(button=>button.addEventListener('click',()=>buyWeapon(Number(button.dataset.buy))));
addEventListener('wheel',e=>{if(!running||!controls.isLocked)return;e.preventDefault();switchWeapon((weaponIndex+(e.deltaY>0?1:weapons.length-1))%weapons.length);},{passive:false});
function reload(){const w=weapons[weaponIndex];if(reloading||ammo===w.mag||reserve<=0)return;reloading=true;reloadUntil=performance.now()+w.reload;updateHud();setMessage('RELOADING',w.reload);}
function showHit(headshot=false,elimination=false){const h=$('hitmarker');h.classList.toggle('headshot',headshot);h.classList.toggle('elimination',elimination);h.setAttribute('aria-label',elimination?'Elimination confirmed':headshot?'Headshot confirmed':'Hit confirmed');h.style.display='block';h.classList.remove('hit-pop');void h.offsetWidth;h.classList.add('hit-pop');setTimeout(()=>{h.style.display='none';h.classList.remove('hit-pop');},170);}
function shoot(){if($('shop-panel')?.classList.contains('visible'))return;const now=performance.now(),w=weapons[weaponIndex];if(reloading||now-lastShot<w.delay)return;if(ammo<=0){setMessage('EMPTY — PRESS R TO RELOAD',1000);return;}lastShot=now;ammo--;recoil=Math.min(recoil+(weaponIndex===2?.11:weaponIndex===6?.16:.065),.22);weapon.rotation.x=-recoil;flash.visible=true;muzzle.intensity=3.5;
const origin=camera.getWorldPosition(new THREE.Vector3()),aim=camera.getWorldDirection(new THREE.Vector3());let botHit=false,headshotHit=false,eliminationHit=false;
for(let pellet=0;pellet<w.pellets;pellet++){const spreadPenalty=(aiming ? 0.62 : 1)*(1+movementAmount*.55+(sprintingNow?1.15:0)+(jumpOffset>.12?.8:0));const spread=new THREE.Vector3(aim.x+(Math.random()-.5)*w.spread*spreadPenalty,aim.y+(Math.random()-.5)*w.spread*spreadPenalty,aim.z+(Math.random()-.5)*w.spread*spreadPenalty).normalize();raycaster.set(origin,spread);raycaster.far=w.range;const candidates=[];if(!online)for(const b of targets)if(b.alive&&(!targetBot||b.index===targetBot-1))candidates.push(b.torso,b.head);const hit=raycaster.intersectObjects(candidates,false)[0];const obstruction=raycaster.intersectObjects(solidMeshes,false)[0];if(hit&&(!obstruction||obstruction.distance>hit.distance)){const b=targets.find(q=>q.torso===hit.object||q.head===hit.object);if(b){if(hit.object===b.head)headshotHit=true;let damage=weaponIndex===6&&hit.object===b.head?250:(hit.object===b.head?w.damage*1.5:w.damage);const absorbed=Math.min(b.shield,damage);b.shield-=absorbed;damage-=absorbed;b.hp=Math.max(0,b.hp-damage);botHit=true;if(b.hp<=0){eliminationHit=true;b.alive=false;b.group.visible=false;b.respawn=now+2200;kills++;killStreak++;cash+=b.isBoss?650:150;dailyProgress('elims');if(b.isBoss)dailyProgress('boss');if(killStreak===3)dailyProgress('streak');trackAchievement('kill');if(b.isBoss)trackAchievement('boss');if(killStreak>=5)trackAchievement('streak');playerRoundScore++;$('player-round-score').textContent=String(playerRoundScore);if(killStreak>=3&&[3,5,8,10,15,20].includes(killStreak)){const reward=50+Math.floor(killStreak/5)*25;cash+=reward;announceKillstreak(killStreak,reward);}else setMessage(b.isBoss?'BOSS ELIMINATED · +$650':'BOT ELIMINATED · +$150');if(b.isBoss){announceKillstreak(killStreak,650);setMessage('ARENA BOSS DEFEATED · +$650 BONUS',2400);}if(playerRoundScore>=5){matchOver=true;showMatchResults('VICTORY','You reached five eliminations first. Great round.');}}}}}
if(botHit){showHit(headshotHit,eliminationHit);v2Tone(headshotHit?920:720,.045,.018,'square');}
if(online&&socket?.connected){socket.emit('shoot',{x:origin.x,y:origin.y,z:origin.z,dx:aim.x,dy:aim.y,dz:aim.z,weapon:weaponIndex});}
updateHud();}
function connectOnline(){const url=($('server-url').value.trim()||DEFAULT_SERVER_URL).replace(/\/$/,'');const init=()=>{if(typeof window.io!=='function'){setMessage('Could not load Socket.IO client.',3000);return;}socket=window.io(url,{transports:['websocket','polling'],auth:{accessToken:sessionStorage.getItem('browserArenaAccessToken')||''}});socket.on('connect',()=>{socket.emit('join',{name:playerName,mode:matchMode,hair:hairColor,uniform:uniformColor,skin:skinColor,shoes:shoeColor,armor:armorLevel});updateHud();});socket.on('disconnect',()=>{updateHud();if(online&&!running){$('lobby-status').textContent='Disconnected. Check the server URL and try again.';}});socket.on('queueStatus',info=>{if(!running){$('lobby-title').textContent='WAITING FOR PLAYERS · '+info.mode;$('lobby-status').textContent=info.message+' ('+info.waiting+'/'+info.needed+')';$('map-votes').innerHTML='';}});socket.on('mapLobby',info=>{if(running)return;$('map-lobby').classList.remove('hidden');$('lobby-title').textContent='MATCH LOBBY · '+info.mode;$('lobby-status').textContent='Everyone in this match votes for the map. The fight starts after all players vote or 30 seconds.';const el=$('map-votes');el.innerHTML='';for(const m of info.maps){const btn=document.createElement('button');btn.className='map-vote';const count=Object.values(info.votes||{}).filter(v=>v===m.id).length;btn.textContent=m.name+' · '+count+' vote'+(count===1?'':'s');btn.addEventListener('click',()=>{socket.emit('voteMap',{map:m.id});$('lobby-status').textContent='Vote submitted: '+m.name+'. Waiting for the other players…';});el.appendChild(btn);}const roster=$('lobby-players');roster.innerHTML='';for(const p of info.players||[]){const row=document.createElement('div');row.className='lobby-player';row.textContent=(p.team===0?'TEAM A · ':'TEAM B · ')+p.name;roster.appendChild(row);}});socket.on('matchStart',info=>{beginCareerMatch();mapIndex=Number(info.map)||0;matchMode=info.mode||matchMode;applyMap(mapIndex);const p=controls.getObject().position;p.x=Number.isFinite(info.x)?info.x:0;p.z=Number.isFinite(info.z)?info.z:(info.team===0?-12:12);p.y=1.7;health=100;shield=100*(1+armorLevel*.03);running=true;$('map-lobby').classList.add('hidden');$('hud').style.display='block';updateHud();setMessage('MATCH START · CLICK GAME TO PLAY',3000);});socket.on('state',state=>{const seen=new Set();for(const p of state.players||[]){if(p.id===socket.id){health=p.health??health;shield=p.shield??shield;kills=p.kills??kills;cash=p.cash??cash;if(Array.isArray(p.weapons))ownedWeapons=new Set(p.weapons);updateWeaponSelector();updateHud();seen.add(p.id);continue;}seen.add(p.id);let item=remotePlayers.get(p.id);if(!item){item=createRemoteAvatar(p);item.name=p.name||'Player';scene.add(item.group);remotePlayers.set(p.id,item);}item.group.position.set(p.x,0,p.z);item.group.rotation.y=p.yaw||0;item.name=p.name||item.name;if(item.hair&&p.hair)item.hair.material.color.set(p.hair);if(item.mesh&&p.uniform)item.mesh.material.color.set(p.uniform);if(item.skinMat&&p.skin)item.skinMat.color.set(p.skin);if(item.boots&&p.shoes)for(const boot of item.boots)boot.material.color.set(p.shoes);}for(const [id,item] of remotePlayers)if(!seen.has(id)){scene.remove(item.group);remotePlayers.delete(id);}renderScoreboard(state.players||[]);updateHud();});socket.on('combat',event=>{if(event.type==='hit'&&event.target===socket.id){health=event.health??health;shield=event.shield??shield;showHit();setMessage('HIT BY '+(event.attackerName||'PLAYER')+' · HP '+health+' / SHIELD '+shield,700);updateHud();if(health<=0)dieAndRestart();}if(event.type==='elimination'&&event.killer===socket.id){kills=event.kills??kills;cash=event.cash??cash;setMessage('ELIMINATION +$150');updateHud();}});socket.on('purchased',data=>{if(data?.cash!==undefined)cash=data.cash;if(Array.isArray(data?.weapons))ownedWeapons=new Set(data.weapons);if(Number.isInteger(data?.weapon)){weaponIndex=data.weapon;applyWeapon();updateWeaponSelector();}updateHud();toggleShop(true);setMessage(data?.message||'ARMORY UPDATED',1500);});socket.on('notice',m=>setMessage(String(m).slice(0,100),2000));socket.on('connect_error',()=>{$('connection').textContent='ONLINE · CONNECTION FAILED';setMessage('Could not connect. Check the server URL.',2500);});};if(typeof window.io==='function'){init();return;}const sc=document.createElement('script');sc.src=url+'/socket.io/socket.io.js';sc.onload=init;sc.onerror=()=>setMessage('Socket.IO client failed to load.',3000);document.head.appendChild(sc);}function createRemoteAvatar(p){
 const group=new THREE.Group();
 const teamMat=new THREE.MeshStandardMaterial({color:p.uniform|| (p.team===0?0x477f72:0x995c43),map:concreteTexture,metalness:.08,roughness:.92});
 const armorMat=new THREE.MeshStandardMaterial({color:p.armorColor|| (p.team===0?0x3f504b:0x514744),map:concreteTexture,metalness:.22,roughness:.78});
 const darkMat=new THREE.MeshStandardMaterial({color:0x20292b,metalness:.45,roughness:.42});
 const trimMat=new THREE.MeshStandardMaterial({color:p.team===0?0x65796e:0x88715b,roughness:.82,metalness:.08});
 const skinMat=new THREE.MeshStandardMaterial({color:p.skin||'#b88d70',roughness:.72});const boots=[];
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.31,.58,5,10),teamMat);torso.position.y=1.2;torso.castShadow=true;group.add(torso);
 const chest=new THREE.Mesh(new THREE.BoxGeometry(.51,.4,.2),armorMat);chest.position.set(0,1.25,-.17);chest.castShadow=true;group.add(chest);
 const stripe=new THREE.Mesh(new THREE.BoxGeometry(.32,.05,.22),trimMat);stripe.position.set(0,1.36,-.285);group.add(stripe);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.2,16,12),skinMat);head.position.y=1.84;head.castShadow=true;group.add(head);
 const helmet=new THREE.Mesh(new THREE.SphereGeometry(.25,16,12,0,Math.PI*2,0,Math.PI*.57),darkMat);helmet.position.y=1.94;helmet.castShadow=true;group.add(helmet);
 const hair=new THREE.Mesh(new THREE.SphereGeometry(.238,14,10,0,Math.PI*2,0,Math.PI*.55),new THREE.MeshStandardMaterial({color:p.hair||'#30241e',roughness:.82}));hair.position.y=1.9;group.add(hair);
 const visor=new THREE.Mesh(new THREE.BoxGeometry(.28,.065,.045),trimMat);visor.position.set(0,1.83,-.2);group.add(visor);
 for(const side of [-1,1]){
  const shoulder=new THREE.Mesh(new THREE.SphereGeometry(.16,12,10),armorMat);shoulder.position.set(side*.4,1.45,-.01);group.add(shoulder);
  const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.095,.38,4,8),teamMat);arm.position.set(side*.4,1.18,-.015);arm.rotation.z=side*.1;arm.castShadow=true;group.add(arm);
  const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.42,4,8),darkMat);leg.position.set(side*.17,.52,0);leg.castShadow=true;group.add(leg);
  const boot=new THREE.Mesh(new THREE.BoxGeometry(.22,.15,.34),new THREE.MeshStandardMaterial({color:p.shoes||'#20292b',roughness:.82}));boot.position.set(side*.17,.12,-.055);boot.castShadow=true;group.add(boot);boots.push(boot);
 }
 const pack=new THREE.Mesh(new THREE.BoxGeometry(.31,.42,.18),armorMat);pack.position.set(0,1.23,.22);group.add(pack);
 const rifle=new THREE.Group();rifle.position.set(.36,1.16,-.28);group.add(rifle);
 const receiver=new THREE.Mesh(new THREE.BoxGeometry(.13,.13,.4),darkMat);rifle.add(receiver);
 const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.36,8),darkMat);barrel.rotation.x=Math.PI/2;barrel.position.set(0,.02,-.34);rifle.add(barrel);
 const magazine=new THREE.Mesh(new THREE.BoxGeometry(.075,.2,.12),armorMat);magazine.position.set(0,-.14,-.03);rifle.add(magazine);
 return {group,mesh:torso,name:p.name||'Player',hair,skinMat,boots};
}
function renderScoreboard(players){const el=$('score-list');if(!el)return;el.innerHTML='';for(const p of [...players].sort((a,b)=>(b.kills||0)-(a.kills||0))){const row=document.createElement('div');row.className='score-row';const n=document.createElement('span');n.textContent=p.name||'Player';const score=document.createElement('b');score.textContent=(p.kills||0)+' K / '+(p.deaths||0)+' D';row.append(n,score);el.appendChild(row);}}
function movePlayer(dt){
 const p=controls.getObject().position;
 slideCooldown=Math.max(0,slideCooldown-dt);
 const wantsSlide=keys.has('KeyZ');
 const moving=keys.has('KeyW')||keys.has('KeyA')||keys.has('KeyS')||keys.has('KeyD');
 if(wantsSlide&&moving&&slideRemaining<=0&&slideCooldown<=0&&jumpOffset<=0.001){
  slideRemaining=.68;slideCooldown=1.15;
  const view=camera.getWorldDirection(new THREE.Vector3());view.y=0;view.normalize();
  const right=new THREE.Vector3().crossVectors(view,new THREE.Vector3(0,1,0)).normalize();
  slideDirection.copy(view).multiplyScalar((keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)).add(right.multiplyScalar((keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)));
  if(slideDirection.lengthSq()<.01)slideDirection.copy(view);slideDirection.normalize();
  if(performance.now()-slideMessageAt>900){setMessage('SLIDE · RELEASE CROUCH TO RECOVER',850);slideMessageAt=performance.now();}
 }
 if(keys.has('Tab')&&jumpOffset<=0.001&&slideRemaining<=0){jumpVelocity=7.1;keys.delete('Tab');}
 const sprintHeld=keys.has('ControlLeft')||keys.has('ControlRight');
 if(sprintHeld&&sprintStamina>0&&slideRemaining<=0&&(keys.has('KeyW')||keys.has('KeyS')||keys.has('KeyA')||keys.has('KeyD'))){sprintStamina=Math.max(0,sprintStamina-30*dt);}else{sprintStamina=Math.min(100,sprintStamina+22*dt);}
 const sprinting=sprintHeld&&sprintStamina>0&&slideRemaining<=0;
 sprintingNow=sprinting&&moving;movementAmount=moving?1:0;
 const speed=slideRemaining>0?11.2:(sprinting?8.5:5.4);
 const staminaFill=$('sprint-stamina-fill'),staminaLabel=$('sprint-stamina-label');if(staminaFill)staminaFill.style.width=sprintStamina+'%';if(staminaLabel)staminaLabel.textContent=Math.round(sprintStamina)+'%';
 const forwardInput=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);
 const sideInput=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
 const forward=camera.getWorldDirection(new THREE.Vector3());forward.y=0;forward.normalize();
 const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
 const desired=slideRemaining>0?slideDirection.clone():forward.multiplyScalar(forwardInput).add(right.multiplyScalar(sideInput));
 if(desired.lengthSq()>1)desired.normalize();
 const slideProgress=slideRemaining>0?slideRemaining/.68:0;
 const targetSpeed=slideRemaining>0?11.2*(.78+.22*slideProgress):(sprinting?8.5:5.4);
 if(desired.lengthSq()>.001)desired.multiplyScalar(targetSpeed);else desired.set(0,0,0);
 // Frame-rate-independent acceleration gives starts, stops and direction changes a more deliberate feel.
 const response=slideRemaining>0?18:(desired.lengthSq()>.001?(sprinting?16:20):24);
 movementVelocity.x=THREE.MathUtils.damp(movementVelocity.x,desired.x,response,dt);
 movementVelocity.z=THREE.MathUtils.damp(movementVelocity.z,desired.z,response,dt);
 const delta=new THREE.Vector3(movementVelocity.x*dt,0,movementVelocity.z*dt);
 if(slideRemaining>0)slideRemaining=Math.max(0,slideRemaining-dt);
 jumpVelocity-=18*dt;jumpOffset=Math.max(0,jumpOffset+jumpVelocity*dt);if(jumpOffset===0)jumpVelocity=0;
 const targetHeight=slideRemaining>0?1.05:1.7;
 p.y=THREE.MathUtils.damp(p.y,targetHeight+jumpOffset,slideRemaining>0?16:12,dt);
 const blocked=(x,z)=>x<-80.1||x>80.1||z<-70.1||z>70.1||colliders.some(c=>c.clone().expandByVector(new THREE.Vector3(.58,1,.58)).containsPoint(new THREE.Vector3(x,1.7,z)));
 // Resolve X and Z separately so the player slides along walls instead of sticking or passing through them.
 const nextX=p.x+delta.x;if(!blocked(nextX,p.z))p.x=nextX;else movementVelocity.x=0;
 const nextZ=p.z+delta.z;if(!blocked(p.x,nextZ))p.z=nextZ;else movementVelocity.z=0;
 const actualSpeed=Math.hypot(delta.x,delta.z)/Math.max(dt,.0001);
 bob+=dt*(actualSpeed>.035?actualSpeed*.9:1.4);const movingNow=actualSpeed>.035;weapon.position.y=-.3+(slideRemaining>0?-.12:0)+Math.sin(bob*2)*(.006+(sprintingNow?.012:0))*(movingNow?1:0);weapon.position.x=Math.sin(bob)*(.003+(sprintingNow?.012:0))*(movingNow?1:0);
 if(online&&socket?.connected&&performance.now()-lastSync>50){lastSync=performance.now();const f=camera.getWorldDirection(new THREE.Vector3());socket.emit('move',{x:p.x,yaw:Math.atan2(f.x,-f.z),z:p.z});}
}
function dieAndRestart(){if(!running)return;killStreak=0;health=0;shield=0;firing=false;reloading=false;if(!online){botRoundScore++;$('bot-round-score').textContent=String(botRoundScore);if(botRoundScore>=5){matchOver=true;showMatchResults('DEFEAT','The bots reached five points first. Queue up and try again.');return;}health=100;shield=100*(1+armorLevel*.03);const p=controls.getObject().position;p.set((Math.random()-.5)*10,1.7,Math.random()<.5?-12:12);lastHitTime=performance.now();updateHud();setMessage('RESPAWN · BOTS '+botRoundScore+' / 5',1500);return;}showMatchResults('DEFEAT','You were eliminated. Review your career reward and jump back in.');}
function spawnBotShot(b,target,now){
 const origin=b.botGun.getWorldPosition(new THREE.Vector3());origin.y+=.02;
 const end=target.clone();end.y=Math.max(1.15,end.y);
 const geometry=new THREE.BufferGeometry().setFromPoints([origin,end]);
 const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xffb65e,transparent:true,opacity:.95}));
 scene.add(line);botShotEffects.push({line,expires:now+105});
 b.muzzleUntil=now+95;
}
function updateBotShotEffects(now){
 for(let i=botShotEffects.length-1;i>=0;i--){const fx=botShotEffects[i];if(now>=fx.expires){scene.remove(fx.line);fx.line.geometry.dispose();fx.line.material.dispose();botShotEffects.splice(i,1);}}
}
function updateBots(dt,now){
 const p=controls.getObject().position;
 for(const b of targets){
  if(b.botMuzzle)b.botMuzzle.visible=now<b.muzzleUntil;
  if(!b.alive){
   if(now>=b.respawn){b.alive=true;b.hp=b.maxHp;b.shield=b.maxShield;b.group.visible=true;b.group.position.set((Math.random()-.5)*76,0,(Math.random()-.5)*64);b.fireAt=now+900+Math.random()*1200;}
   continue;
  }
  const dx=p.x-b.group.position.x,dz=p.z-b.group.position.z,dist=Math.hypot(dx,dz);b.phase+=dt;
  const level={easy:{cool:1650,accuracy:.5,damage:5,speed:.9,strafe:.35},medium:{cool:1180,accuracy:.67,damage:7,speed:1.12,strafe:.62},hard:{cool:850,accuracy:.8,damage:9,speed:1.32,strafe:.9}}[difficulty]||{cool:1180,accuracy:.67,damage:7,speed:1.12,strafe:.62};
  if(b.lastPlayerX!==undefined){const pvx=(p.x-b.lastPlayerX)/Math.max(dt,.001),pvz=(p.z-b.lastPlayerZ)/Math.max(dt,.001);b.playerVx=THREE.MathUtils.clamp(pvx,-8,8);b.playerVz=THREE.MathUtils.clamp(pvz,-8,8);}
  b.lastPlayerX=p.x;b.lastPlayerZ=p.z;
  // Each bot owns a different lane and preferred range, so they fan out instead of piling onto the player.
  const lane=b.laneAngle+Math.sin(b.phase*.31+b.index)*.55+b.phase*.045,ring=b.preferredRange;
  const tx=p.x+Math.cos(lane)*ring,tz=p.z+Math.sin(lane)*ring;
  let mx=tx-b.group.position.x,mz=tz-b.group.position.z,md=Math.hypot(mx,mz)||1;
  let vx=mx/md, vz=mz/md;
  const lateral=dist<25?level.strafe:level.strafe*.25;
  vx+=(-dz/(dist||1))*Math.sin(b.phase*2.4+b.index)*lateral;
  vz+=(dx/(dist||1))*Math.sin(b.phase*2.4+b.index)*lateral;
  if(now-lastShot<260){vx+=(-dz/(dist||1))*b.strafe*.85;vz+=(dx/(dist||1))*b.strafe*.85;}
  // Keep a little distance from nearby bots and make their paths less synchronized.
  for(const other of targets){if(other===b||!other.alive)continue;const sx=b.group.position.x-other.group.position.x,sz=b.group.position.z-other.group.position.z,sd=Math.hypot(sx,sz);if(sd>0&&sd<4.8){vx+=sx/sd*(4.8-sd)*.32;vz+=sz/sd*(4.8-sd)*.32;}}
  const vl=Math.hypot(vx,vz)||1;vx/=vl;vz/=vl;
  const moveSpeed=(md>1.8?level.speed*(b.isBoss?1.12:1)*(md>8?1.15:.75):.18);
  // Bots collide with cover instead of walking through it; try sliding along one axis to find a route around it.
  const nextX=b.group.position.x+vx*moveSpeed*dt,nextZ=b.group.position.z+vz*moveSpeed*dt;
  const blockedAt=(x,z)=>{const point=new THREE.Vector3(x,.95,z);return colliders.some(c=>c.clone().expandByVector(new THREE.Vector3(.38,.95,.38)).containsPoint(point));};
  if(!blockedAt(nextX,nextZ)){b.group.position.x=nextX;b.group.position.z=nextZ;}
  else if(!blockedAt(nextX,b.group.position.z)){b.group.position.x=nextX;}
  else if(!blockedAt(b.group.position.x,nextZ)){b.group.position.z=nextZ;}
  else {b.strafe*=-1;b.group.position.x+=Math.cos(b.phase*2)*moveSpeed*dt*.35;b.group.position.z+=Math.sin(b.phase*2)*moveSpeed*dt*.35;}
  // Turn toward the player; the rifle points along the character's local -Z axis.
  b.group.rotation.y=Math.atan2(-dx,-dz);
  b.botGun.rotation.x=THREE.MathUtils.clamp((1.35-p.y)*.12,-.12,.12);
  const moving=md>1.8,swing=moving?Math.sin(b.phase*5.5)*.22:Math.sin(b.phase*2.2)*.035;
  b.leftArm.rotation.x=swing-.35;b.rightArm.rotation.x=-swing-.42;
  b.leftArm.rotation.z=.06;b.rightArm.rotation.z=-.06;
  b.leftLeg.rotation.x=moving?-swing:0;b.rightLeg.rotation.x=moving?swing:0;
  // Bots fire visible tracer shots, with difficulty affecting cadence, accuracy and damage.
  if(!online&&dist<58&&now>b.fireAt&&now-lastHitTime>160){
   const muzzleOrigin=b.botGun.getWorldPosition(new THREE.Vector3());const toPlayer=new THREE.Vector3(p.x,p.y-.12,p.z).sub(muzzleOrigin);const sightDistance=toPlayer.length();toPlayer.normalize();raycaster.set(muzzleOrigin,toPlayer);raycaster.far=Math.max(0,sightDistance-.35);const hasCover=raycaster.intersectObjects(solidMeshes,false).length>0;raycaster.far=Infinity;if(hasCover){b.fireAt=now+260+Math.random()*320;continue;}
   b.fireAt=now+level.cool+Math.random()*level.cool*.45;
   const lead=Math.min(.42,sightDistance/65);
   const targetPoint=new THREE.Vector3(p.x+(b.playerVx||0)*lead,p.y-.12,p.z+(b.playerVz||0)*lead);
   const accuracy=Math.max(.22,level.accuracy-dist*.0055);
   const hit=Math.random()<accuracy;
   if(!hit){targetPoint.x+=(Math.random()-.5)*(3.2+dist*.2);targetPoint.y+=(Math.random()-.5)*(1.6+dist*.065);targetPoint.z+=(Math.random()-.5)*(3.2+dist*.2);}
   spawnBotShot(b,targetPoint,now);
   if(hit){
    let damage=level.damage*(b.isBoss?1.35:1);const absorbed=Math.min(shield,damage);shield-=absorbed;damage-=absorbed;health=Math.max(0,health-damage);lastHitTime=now;
    setMessage('BOT HIT · SHIELD '+Math.round(shield)+' · HP '+Math.round(health),700);updateHud();if(health<=0)dieAndRestart();
   }
  }
 }
}
// Browser Arena 2.0: atmospheric set dressing, optional audio, and touch-friendly controls.
const v2Decor=new THREE.Group();scene.add(v2Decor);
// Two maps get a lightweight animated rain pass; the other maps stay clear for visual variety.
const rainMapIds=new Set([1,4]);
const rainGroup=new THREE.Group();scene.add(rainGroup);
const rainCount=460,rainPositions=new Float32Array(rainCount*6),rainDrops=[];
for(let i=0;i<rainCount;i++){const x=(Math.random()-.5)*190,y=Math.random()*34+2,z=(Math.random()-.5)*150,wind=.3+Math.random()*.5;rainDrops.push({x,y,z,wind});const k=i*6;rainPositions[k]=x;rainPositions[k+1]=y;rainPositions[k+2]=z;rainPositions[k+3]=x+wind*.09;rainPositions[k+4]=y-1.05;rainPositions[k+5]=z+.025;}
const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
const rainMaterial=new THREE.LineBasicMaterial({color:0x9dc9dc,transparent:true,opacity:.38,depthWrite:false});
rainGroup.add(new THREE.LineSegments(rainGeometry,rainMaterial));rainGroup.visible=false;
function animateRain(dt){if(!rainGroup.visible)return;for(let i=0;i<rainCount;i++){const d=rainDrops[i];d.y-=dt*(23+d.wind*7);d.x+=dt*d.wind*1.6;if(d.y<0){d.y=24+Math.random()*16;d.x=(Math.random()-.5)*190;d.z=(Math.random()-.5)*150;}const k=i*6;rainPositions[k]=d.x;rainPositions[k+1]=d.y;rainPositions[k+2]=d.z;rainPositions[k+3]=d.x+d.wind*.09;rainPositions[k+4]=d.y-1.05;rainPositions[k+5]=d.z+.025;}rainGeometry.attributes.position.needsUpdate=true;}
const v2Motes=[],v2Lights=[];
function buildV2Atmosphere(){
 while(v2Decor.children.length){const o=v2Decor.children.pop();if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}}
 v2Motes.length=0;v2Lights.length=0;
 // Practical perimeter floodlights replace floating particles and glowing sci-fi rails.
 for(const [x,z] of [[-36,-30],[36,-30],[-36,30],[36,30]]){
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.075,.11,6.4,8),new THREE.MeshStandardMaterial({color:0x3d4546,metalness:.62,roughness:.48}));
  pole.position.set(x*2,3.2,z*2);pole.castShadow=true;v2Decor.add(pole);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(1.05,.09,.09),new THREE.MeshStandardMaterial({color:0x4a5050,metalness:.58,roughness:.5}));
  arm.position.set(x*2+(x<0?.42:-.42),6.15,z*2);v2Decor.add(arm);
  const fixture=new THREE.Mesh(new THREE.BoxGeometry(.38,.12,.24),new THREE.MeshStandardMaterial({color:0x686d68,metalness:.42,roughness:.42}));
  fixture.position.set(x*2+(x<0?.82:-.82),6.05,z*2);fixture.castShadow=true;v2Decor.add(fixture);
  const lens=new THREE.Mesh(new THREE.PlaneGeometry(.24,.1),new THREE.MeshStandardMaterial({color:0xe4d5ac,emissive:0xbca77c,emissiveIntensity:.18,roughness:.55,side:THREE.DoubleSide}));
  lens.position.set(fixture.position.x,5.98,z*2);lens.rotation.x=-Math.PI/5;v2Decor.add(lens);
  const lamp=new THREE.PointLight(0xffdfb0,.42,24,2);lamp.position.set(fixture.position.x,5.9,z*2);v2Decor.add(lamp);
 }
}
function animateV2(dt,now){
 animateRain(dt);
 if(v2Audio&&v2Audio.ctx&&v2Audio.ctx.state==='running'&&v2Audio.enabled&&now-v2Audio.lastAmbient>9000){v2Audio.lastAmbient=now;v2Tone(110,.055,.012,'sine');}
}
let v2Audio={ctx:null,enabled:false,lastAmbient:0};
function v2Tone(freq=440,duration=.07,volume=.025,type='sine'){
 if(!v2Audio.enabled)return;
 try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!v2Audio.ctx)v2Audio.ctx=new Ctx();if(v2Audio.ctx.state==='suspended')v2Audio.ctx.resume();const o=v2Audio.ctx.createOscillator(),gain=v2Audio.ctx.createGain();o.type=type;o.frequency.value=freq;gain.gain.setValueAtTime(volume,v2Audio.ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,v2Audio.ctx.currentTime+duration);o.connect(gain);gain.connect(v2Audio.ctx.destination);o.start();o.stop(v2Audio.ctx.currentTime+duration);}catch{}
}
function setupV2Touch(){
 const controlsEl=$('touch-controls'),stick=$('touch-stick'),nub=$('touch-nub'),look=$('touch-look');
 if(!controlsEl||!stick||!nub||!look)return;
 const touchMode=()=>matchMedia('(pointer:coarse)').matches||innerWidth<800;
 function sync(){controlsEl.classList.toggle('touch-enabled',touchMode());}
 sync();addEventListener('resize',sync);
 let stickId=null,lookId=null,origin=null,lastLook=null;
 const setKey=(code,on)=>{if(on)keys.add(code);else keys.delete(code);};
 const bindAction=(id,code)=>{const el=$(id);if(!el)return;const down=e=>{e.preventDefault();setKey(code,true);};const up=e=>{e.preventDefault();setKey(code,false);};el.addEventListener('pointerdown',down);['pointerup','pointercancel','pointerleave'].forEach(ev=>el.addEventListener(ev,up));};
 bindAction('touch-jump','Tab');bindAction('touch-slide','KeyZ');\n const aimButton=$('touch-aim');if(aimButton){const down=e=>{e.preventDefault();setAiming(true);},up=e=>{e.preventDefault();setAiming(false);};aimButton.addEventListener('pointerdown',down);['pointerup','pointercancel','pointerleave'].forEach(ev=>aimButton.addEventListener(ev,up));}
 stick.addEventListener('pointerdown',e=>{if(!touchMode())return;stickId=e.pointerId;stick.setPointerCapture(stickId);const r=stick.getBoundingClientRect();origin={x:r.left+r.width/2,y:r.top+r.height/2};moveStick(e);});
 function moveStick(e){if(e.pointerId!==stickId||!origin)return;const dx=e.clientX-origin.x,dy=e.clientY-origin.y,len=Math.hypot(dx,dy),scale=Math.min(1,len/40),x=len?dx/len*scale:0,y=len?dy/len*scale:0;nub.style.transform='translate('+x*34+'px,'+y*34+'px)';setKey('KeyA',x<-.22);setKey('KeyD',x>.22);setKey('KeyW',y<-.22);setKey('KeyS',y>.22);}
 stick.addEventListener('pointermove',moveStick);
 function releaseStick(e){if(e.pointerId!==stickId)return;stickId=null;origin=null;nub.style.transform='translate(0,0)';['KeyA','KeyD','KeyW','KeyS'].forEach(k=>setKey(k,false));}
 stick.addEventListener('pointerup',releaseStick);stick.addEventListener('pointercancel',releaseStick);
 look.addEventListener('pointerdown',e=>{if(!touchMode()||e.target.closest('button,#touch-stick'))return;lookId=e.pointerId;lastLook={x:e.clientX,y:e.clientY};look.setPointerCapture(lookId);});
 look.addEventListener('pointermove',e=>{if(e.pointerId!==lookId||!lastLook||!running)return;const dx=e.clientX-lastLook.x,dy=e.clientY-lastLook.y;lastLook={x:e.clientX,y:e.clientY};const yaw=controls.getObject();yaw.rotation.y-=dx*.0042;camera.rotation.x=THREE.MathUtils.clamp(camera.rotation.x-dy*.0042,-Math.PI/2,Math.PI/2);});
 const endLook=e=>{if(e.pointerId===lookId){lookId=null;lastLook=null;}};look.addEventListener('pointerup',endLook);look.addEventListener('pointercancel',endLook);
$('touch-sprint')?.addEventListener('pointerdown',()=>setKey('ControlLeft',true));['pointerup','pointercancel','pointerleave'].forEach(ev=>$('touch-sprint')?.addEventListener(ev,()=>setKey('ControlLeft',false)));
 // Lobby navigation keeps the main Play view intact while taking players directly to customization.
document.querySelectorAll('[data-lobby-tab]').forEach(tab=>tab.addEventListener('click',()=>{
 document.querySelectorAll('[data-lobby-tab]').forEach(item=>{item.classList.toggle('active',item===tab);item.setAttribute('aria-current',item===tab?'page':'false');});
 const target=tab.dataset.lobbyTab;
 if(target==='loadout'||target==='operators'){
  const drawer=document.querySelector('.customize-drawer');if(drawer)drawer.open=true;
  if(target==='operators')$('uniform-color')?.focus({preventScroll:true});
  drawer?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
 }else if(target==='armory'){
  toggleShop(true);
 }else{
  $('start-screen')?.scrollTo({top:0,behavior:'smooth'});
 }
}));
$('audio-toggle')?.addEventListener('click',()=>{v2Audio.enabled=!v2Audio.enabled;$('audio-toggle').textContent=v2Audio.enabled?'SOUND: ON':'SOUND: OFF';if(v2Audio.enabled)v2Tone(660,.12,.035,'sine');});
}
buildV2Atmosphere();setupV2Touch();initOperatorPreview();
$('reset-progress')?.addEventListener('click',()=>{if(confirm('Reset your local XP and career stats? This cannot be undone.')){career=freshCareer();saveCareer();setMessage('CAREER RESET',1400);}});updateProgressUI();

$('results-lobby')?.addEventListener('click',()=>{$('results-screen').classList.add('hidden');$('start-screen').classList.remove('hidden');$('hud').style.display='none';$('map-lobby').classList.add('hidden');});
$('results-rematch')?.addEventListener('click',()=>{$('results-screen').classList.add('hidden');$('start-screen').classList.remove('hidden');$('hud').style.display='none';$('map-lobby').classList.add('hidden');setMessage('CHOOSE QUICK PLAY OR TRAINING TO START AGAIN',2600);});

/* Lobby operator showcase: a separate lightweight real-time 3D scene. */
let operatorPreview=null;
function initOperatorPreview(){
 const canvas=$('operator-preview-canvas');if(!canvas||operatorPreview)return;
 const pScene=new THREE.Scene();pScene.background=new THREE.Color(0x242b2b);pScene.fog=new THREE.Fog(0x242b2b,10,29);
 const pCamera=new THREE.PerspectiveCamera(34,1,.1,80);pCamera.position.set(0,2.45,8.9);pCamera.lookAt(.25,1.48,0);
 let pRenderer;
 try{pRenderer=new THREE.WebGLRenderer({canvas,antialias:innerWidth>700,alpha:false,powerPreference:'low-power'});}catch(e){canvas.parentElement.classList.add('preview-fallback');return;}
 pRenderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));pRenderer.shadowMap.enabled=true;pRenderer.shadowMap.type=THREE.PCFSoftShadowMap;pRenderer.outputColorSpace=THREE.SRGBColorSpace;pRenderer.toneMapping=THREE.ACESFilmicToneMapping;pRenderer.toneMappingExposure=1.08;
 pScene.add(new THREE.HemisphereLight(0xc9d8d7,0x373b35,1.7));
 const key=new THREE.DirectionalLight(0xffdfb0,3.2);key.position.set(-3,7,5);key.castShadow=true;key.shadow.mapSize.set(512,512);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=7;key.shadow.camera.bottom=-3;pScene.add(key);
 const rim=new THREE.DirectionalLight(0x8caeb2,2.1);rim.position.set(4,4,-4);pScene.add(rim);
 const mat=(color,roughness=.8,metalness=.05)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const concrete=mat(0x555b57,.95),wall=mat(0x454d4b,.94),darkMetal=mat(0x202726,.65,.45),olive=mat(0x4c5947,.92),cloth=mat(0x626a58,.98),armor=mat(0x343c37,.82,.12),rubber=mat(0x202422,.98),tan=mat(0x8b8069,.93),glass=mat(0x182627,.25,.5);
 // Reuse the game's procedural PBR surface library so the showcase shares its concrete,
 // weathering and metal language with the playable maps instead of looking like a flat mock-up.
 concrete.map=realisticSurfaces[0].color;concrete.bumpMap=realisticSurfaces[0].bump;concrete.bumpScale=.075;
 wall.map=realisticSurfaces[0].color;wall.bumpMap=realisticSurfaces[0].bump;wall.bumpScale=.045;
 darkMetal.map=realisticSurfaces[5].color;darkMetal.bumpMap=realisticSurfaces[5].bump;darkMetal.bumpScale=.025;
 olive.map=realisticSurfaces[4].color;olive.bumpMap=realisticSurfaces[4].bump;olive.bumpScale=.035;
 cloth.map=realisticSurfaces[0].color;cloth.bumpMap=realisticSurfaces[0].bump;cloth.bumpScale=.018;
 for(const material of [concrete,wall,darkMetal,olive,cloth])material.needsUpdate=true;
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(34,28),concrete);ground.rotation.x=-Math.PI/2;ground.position.y=-.04;ground.receiveShadow=true;pScene.add(ground);
 function box(parent,x,y,z,sx,sy,sz,material,rotY=0){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);m.position.set(x,y,z);m.rotation.y=rotY;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function cyl(parent,x,y,z,r1,r2,h,material,rotZ=0){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,10),material);m.position.set(x,y,z);m.rotation.z=rotZ;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 // A layered industrial training bay with concrete structure, utility pipes and stacked freight.
 box(pScene,0,2.8,-5.8,13,5.7,.55,wall);box(pScene,-6.1,2.6,-1.5,.6,5,9,wall);box(pScene,6.1,2.6,-1.5,.6,5,9,wall);
 box(pScene,-2.7,2.15,-5.48,2.7,4.2,.12,darkMetal);box(pScene,-2.7,4.35,-5.39,2.9,.14,.14,mat(0x777c73,.9));
 for(let i=0;i<5;i++){box(pScene,-3.75+i*.52,2.1,-5.36,.035,3.8,.035,mat(0x777b70,.88));}
 for(let i=0;i<4;i++){cyl(pScene,4.6,1.1+i*.48,-5.1,.075,.075,7,darkMetal,Math.PI/2);}
 // Floor expansion seams and a worn yellow safety stripe.
 for(let z=-4;z<5;z+=2.4)box(pScene,0,-.018,z,12,.012,.018,mat(0x343a36,.95));
 box(pScene,-3.9,-.01,1.7,2.3,.014,.09,mat(0x9d8b4e,.95),-.02);
 box(pScene,-4.6,.65,-1.7,1.25,1.25,1.15,mat(0x5b5e55,.96),-.12);box(pScene,-4.4,1.38,-1.8,1.45,.16,1.3,darkMetal,-.12);
 box(pScene,4.6,.45,-.2,1.2,.9,1.2,mat(0x5c6258,.94),.08);box(pScene,4.6,.94,-.2,1.3,.1,1.25,darkMetal,.08);
 // Operator rig: original field specialist silhouette, layered gear and a low-ready prop rifle.
 const op=new THREE.Group();op.position.set(1.35,0,.05);pScene.add(op);
 const body=new THREE.Group();op.add(body);
 // boots and articulated legs
 box(body,-.19,.12,.015,.31,.22,.47,rubber,-.04);box(body,.19,.12,.015,.31,.22,.47,rubber,-.04);
 const leftLeg=new THREE.Mesh(new THREE.CapsuleGeometry(.115,.58,4,8),olive);leftLeg.position.set(-.19,.58,0);leftLeg.castShadow=true;body.add(leftLeg);
 const rightLeg=new THREE.Mesh(new THREE.CapsuleGeometry(.115,.58,4,8),cloth);rightLeg.position.set(.19,.58,0);rightLeg.castShadow=true;body.add(rightLeg);
 box(body,-.19,.58,.09,.22,.2,.26,armor);box(body,.19,.58,.09,.22,.2,.26,armor);
 // torso, neck and head
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.29,.58,5,10),cloth);torso.position.set(0,1.47,0);torso.castShadow=true;body.add(torso);
 box(body,0,1.48,.245,.49,.59,.16,armor);
 box(body,0,1.53,.337,.33,.32,.035,mat(0x515b4d,.82));
 box(body,0,1.82,.21,.35,.13,.12,olive);
 cyl(body,0,1.94,0,.105,.105,.16,tan);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.19,14,12),mat(0x9b765e,.9));head.position.set(0,2.16,0);head.scale.set(.86,1.08,.88);head.castShadow=true;body.add(head);
 // helmet, rim, rails, goggles
 const helmet=new THREE.Mesh(new THREE.SphereGeometry(.225,16,10,0,Math.PI*2,0,Math.PI*.62),olive);helmet.position.set(0,2.28,-.015);helmet.scale.set(1.05,.82,1.03);helmet.castShadow=true;body.add(helmet);
 box(body,0,2.21,.185,.35,.045,.08,darkMetal);
 box(body,0,2.17,.208,.25,.055,.025,glass);
 box(body,-.22,2.25,0,.045,.14,.09,darkMetal);box(body,.22,2.25,0,.045,.14,.09,darkMetal);
 // shoulder pads, sleeves, forearms and gloves
 const limb=(x,y,z,rx,ry,rz,material)=>{const m=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.35,4,8),material);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=true;body.add(m);return m;};
 limb(-.39,1.52,0,0,0,-.22,olive);limb(.39,1.52,0,0,0,.22,olive);
 const foreL=limb(-.48,1.22,.16,0,0,-.12,cloth),foreR=limb(.47,1.22,.18,0,0,.18,cloth);
 box(body,-.49,1.04,.23,.19,.13,.18,rubber);box(body,.48,1.04,.25,.19,.13,.18,rubber);
 // vest webbing, magazine pouches, radio, belt and backpack
 box(body,0,1.38,-.19,.43,.53,.2,olive);box(body,0,1.48,.34,.39,.36,.07,armor);
 for(let i=0;i<3;i++){box(body,-.14+i*.14,1.31,.39,.105,.17,.075,darkMetal);box(body,-.14+i*.14,1.4,.433,.095,.025,.018,tan);}
 box(body,-.28,1.51,.02,.12,.27,.14,armor);box(body,-.3,1.68,.03,.14,.12,.12,darkMetal);
 box(body,0,1.08,.02,.49,.11,.3,darkMetal);box(body,0,1.08,.18,.11,.08,.04,tan);
 // small hydration pack and straps
 box(body,0,1.52,-.32,.39,.48,.2,olive);box(body,.01,1.72,-.43,.21,.17,.12,armor);
 box(body,-.19,1.55,.02,.06,.47,.08,tan,-.12);box(body,.19,1.55,.02,.06,.47,.08,tan,.12);
 // compact stylized rifle held across the chest (visual-only prop)
 const rifle=new THREE.Group();rifle.position.set(.35,1.22,.31);rifle.rotation.z=-.16;rifle.rotation.y=-.08;body.add(rifle);
 box(rifle,0,0,0,.58,.105,.13,darkMetal);box(rifle,-.05,.005,.08,.28,.075,.055,armor);box(rifle,-.19,-.1,.015,.14,.2,.1,rubber,-.2);
 box(rifle,.32,.015,0,.43,.045,.045,darkMetal);box(rifle,.49,.015,0,.035,.07,.055,mat(0x111716,.7,.35));
 box(rifle,.04,.1,0,.12,.08,.08,olive);box(rifle,.1,-.105,.015,.09,.19,.07,rubber,.08);
 cyl(rifle,.03,.12,.005,.025,.025,.2,darkMetal,Math.PI/2);
 // Small cloth seams / shoulder insignia keep the silhouette readable at lobby scale.
 box(body,-.39,1.56,.09,.13,.13,.045,tan);box(body,.39,1.56,.09,.13,.13,.045,mat(0x777c6b,.9));
 op.rotation.y=-.1;
 operatorPreview={scene:pScene,camera:pCamera,renderer:pRenderer,canvas,operator:op,body,resize(){const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);pRenderer.setSize(w,h,false);pCamera.aspect=w/h;pCamera.updateProjectionMatrix();}};
 operatorPreview.resize();
}
function renderOperatorPreview(dt){
 if(!operatorPreview)return;
 const stage=operatorPreview.canvas.parentElement;
 if(!stage||stage.offsetWidth===0||stage.offsetHeight===0)return;
 const t=performance.now()*.00035;operatorPreview.operator.rotation.y=-.12+Math.sin(t)*.055;
 operatorPreview.body.position.y=Math.sin(t*2)*.008;
 operatorPreview.renderer.render(operatorPreview.scene,operatorPreview.camera);
}

function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04),now=performance.now();const targetFov=running&&sprintingNow?82:running&&aiming?57:76;if(Math.abs(camera.fov-targetFov)>.05){camera.fov=THREE.MathUtils.damp(camera.fov,targetFov,7,dt);camera.updateProjectionMatrix();}weapon.position.x=THREE.MathUtils.damp(weapon.position.x,aiming ? .02 : .34,15,dt);weapon.position.y=THREE.MathUtils.damp(weapon.position.y,aiming?-.24:-.3,15,dt);weapon.position.z=THREE.MathUtils.damp(weapon.position.z,aiming?-.43:-.58,15,dt);$('hud').classList.toggle('aiming',aiming);if(reloading&&now>=reloadUntil){const w=weapons[weaponIndex],amount=Math.min(w.mag-ammo,reserve);ammo+=amount;reserve-=amount;reloading=false;updateHud();}updateBotShotEffects(now);animateV2(dt,now);renderOperatorPreview(dt);if(running){movePlayer(dt);if(!online)updateBots(dt,now);if(firing&&ammo>0&&!reloading&&controls.isLocked)shoot();}recoil=Math.max(0,recoil-dt*.42);weapon.rotation.x=-recoil;const shotAge=now-lastShot,kick=shotAge<360?Math.exp(-shotAge/82):0;let reloadRoll=0,reloadYaw=0;if(reloading){const w=weapons[weaponIndex],progress=THREE.MathUtils.clamp((now-(reloadUntil-w.reload))/w.reload,0,1),swing=Math.sin(progress*Math.PI);reloadRoll=swing*.48;reloadYaw=-swing*.09;}weapon.rotation.z=reloadRoll+kick*(weaponIndex%2?-.055:.055);weapon.rotation.y=reloadYaw-kick*.035;flash.visible=shotAge<flashDuration;muzzle.intensity=flash.visible?3.5:0;const crosshair=$('crosshair');if(crosshair){const spread=20+Math.min(18,movementAmount*7)+(sprintingNow?8:0)+(jumpOffset>.12?7:0)+(firing?3:0);crosshair.style.width=spread+'px';crosshair.style.height=spread+'px';}renderer.render(scene,camera);}
animate();applyWeapon();updateWeaponSelector();applyMap(0);$('gun-color').addEventListener('input',e=>bodyMat.color.set(e.target.value));$('hair-color').addEventListener('input',e=>{hairColor=e.target.value;for(const item of remotePlayers.values())if(item.hair)item.hair.material.color.set(hairColor);});addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.25:1.75));renderer.setSize(innerWidth,innerHeight);});window.addEventListener('beforeunload',()=>socket?.disconnect());
