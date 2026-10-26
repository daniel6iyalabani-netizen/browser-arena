import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
const $=id=>document.getElementById(id), root=$('game-root');
const DEFAULT_SERVER_URL='https://browser-arena-cw84.onrender.com';
$('server-url').value=DEFAULT_SERVER_URL;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xa8b9c0);scene.fog=new THREE.Fog(0xa8b9c0,42,145);
const camera=new THREE.PerspectiveCamera(76,innerWidth/innerHeight,.1,220);camera.position.set(0,1.7,8);
const renderer=new THREE.WebGLRenderer({antialias:innerWidth>700,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.25:1.75));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;root.appendChild(renderer.domElement);
const controls=new PointerLockControls(camera,document.body);scene.add(controls.getObject());
const clock=new THREE.Clock(),raycaster=new THREE.Raycaster(),colliders=[],solidMeshes=[],targets=[],remotePlayers=new Map(),keys=new Set();
let running=false,online=false,socket=null,lastShot=0,lastSync=0,recoil=0,bob=0,firing=false,health=100,shield=100,kills=0,cash=300,ownedWeapons=new Set([0]),ammo=12,reserve=60,reloading=false,reloadUntil=0,playerName='Rookie',lastHitTime=0,weaponIndex=0,targetBot=0,difficulty='medium',mapIndex=0,matchMode='1v1',hairColor='#30241e',gunColor='#52665f',uniformColor='#477f72',skinColor='#b88d70',shoeColor='#20292b',armorLevel=0,playerRoundScore=0,botRoundScore=0,matchOver=false;
const weaponCosts=[0,300,900,400,650,700];
const direction=new THREE.Vector3(),botShotEffects=[];
const weapons=[
 {name:'PULSE PISTOL',mag:12,reserve:60,delay:190,reload:900,damage:38,range:38,pellets:1,spread:.01,color:0x72c9ff},
 {name:'HEAVY PISTOL',mag:8,reserve:48,delay:300,reload:1050,damage:54,range:40,pellets:1,spread:.006,color:0xffcf78},
 {name:'AK-47',mag:30,reserve:150,delay:82,reload:1350,damage:19,range:62,pellets:1,spread:.018,color:0xe58b58},
 {name:'ARENA RIFLE',mag:30,reserve:120,delay:115,reload:1450,damage:32,range:65,pellets:1,spread:.012,color:0x80e9bd},
 {name:'PUMP SHOTGUN',mag:6,reserve:36,delay:620,reload:1550,damage:15,range:23,pellets:8,spread:.09,color:0xffa36b},
 {name:'BURST SCATTER',mag:8,reserve:48,delay:460,reload:1450,damage:17,range:25,pellets:6,spread:.075,color:0xffb36b},
 {name:'SNIPER RIFLE',mag:5,reserve:25,delay:950,reload:1800,damage:65,range:90,pellets:1,spread:.001,color:0xb5d7e8}
];
scene.add(new THREE.HemisphereLight(0xd8dcd8,0x3c413d,1.35));const sun=new THREE.DirectionalLight(0xfff1dc,2.2);sun.position.set(-14,25,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-48;sun.shadow.camera.right=48;sun.shadow.camera.top=48;sun.shadow.camera.bottom=-48;scene.add(sun);
function makeSurfaceTexture(base='#c8c8bd',seed=17){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle=base;ctx.fillRect(0,0,512,512);let n=seed;const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};for(let i=0;i<15000;i++){const v=Math.floor(95+rand()*130);ctx.fillStyle='rgba('+v+','+v+','+Math.max(85,v-5)+','+(0.025+rand()*.12)+')';const size=1+rand()*3;ctx.fillRect(rand()*512,rand()*512,size,size);}for(let i=0;i<85;i++){const x=rand()*512,y=rand()*512;ctx.strokeStyle='rgba(54,58,54,'+(0.035+rand()*.08)+')';ctx.lineWidth=.4+rand()*.8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rand()-.5)*45,y+(rand()-.5)*45);ctx.stroke();}const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;return tex;}
const groundTexture=makeSurfaceTexture('#bcbcb0',41);groundTexture.repeat.set(12,12);const concreteTexture=makeSurfaceTexture('#d2d0c6',73);concreteTexture.repeat.set(1.5,1.5);
const floorMat=new THREE.MeshStandardMaterial({color:0x77776d,map:groundTexture,roughness:1,metalness:0});const floor=new THREE.Mesh(new THREE.PlaneGeometry(160,160),floorMat);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);const grid=new THREE.GridHelper(160,80,0x74786f,0x74786f);grid.position.y=.012;grid.material.transparent=true;grid.material.opacity=.055;scene.add(grid);const mapPads=[],arenaObjects=[];
// Bright arena pads and coloured landmark structures make the battlefield easier to read.
for(const [x,z,sx,sz,col] of [[-23,-20,10,7,0x3bbbd0],[23,-20,10,7,0xf4bd54],[-23,20,10,7,0xc77be8],[23,20,10,7,0x52d6a0],[0,0,8,8,0xf07b68]]){const pad=new THREE.Mesh(new THREE.PlaneGeometry(sx,sz),new THREE.MeshStandardMaterial({color:col,roughness:.8,side:THREE.DoubleSide}));pad.rotation.x=-Math.PI/2;pad.position.set(x,.025,z);scene.add(pad);mapPads.push(pad);}

const mapThemes=[{name:'INDUSTRIAL YARD',sky:0xa8b9c0,floor:0x77776d,grid:0x77776d,pads:[0x77776d,0x77776d,0x77776d,0x77776d,0x77776d]},{name:'DESERT OUTPOST',sky:0xc5b9a6,floor:0xa18c6b,grid:0xa18c6b,pads:[0xa18c6b,0xa18c6b,0xa18c6b,0xa18c6b,0xa18c6b]},{name:'FROST DEPOT',sky:0xb9cbd0,floor:0x9ca9aa,grid:0x9ca9aa,pads:[0x9ca9aa,0x9ca9aa,0x9ca9aa,0x9ca9aa,0x9ca9aa]},{name:'ABANDONED WORKS',sky:0x867c7b,floor:0x5f5955,grid:0x5f5955,pads:[0x5f5955,0x5f5955,0x5f5955,0x5f5955,0x5f5955]},{name:'OVERGROWN RUINS',sky:0xa3b09b,floor:0x52634e,grid:0x52634e,pads:[0x52634e,0x52634e,0x52634e,0x52634e,0x52634e]}];function applyMap(id){const mapId=Math.max(0,Math.min(4,Number(id)||0)),t=mapThemes[mapId];scene.background.setHex(t.sky);scene.fog.color.setHex(t.sky);floorMat.color.setHex(t.floor);grid.material.color.setHex(t.grid);mapPads.forEach((p,i)=>p.material.color.setHex(t.pads[i]));$('map-name').textContent=t.name;buildMapGeometry(mapId);}
function box(x,y,z,sx,sy,sz,color,solid=true){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),new THREE.MeshStandardMaterial({color,map:concreteTexture,roughness:.94,metalness:.02}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);arenaObjects.push(m);if(solid){colliders.push(new THREE.Box3().setFromObject(m));solidMeshes.push(m);}return m;}
function buildMapGeometry(id){
 for(const o of arenaObjects)scene.remove(o);arenaObjects.length=0;colliders.length=0;solidMeshes.length=0;
 // Arena perimeter and varied cover. Each map has its own silhouette and palette.
 box(0,2,-36,82,4,1,0x43565a);box(0,2,36,82,4,1,0x43565a);box(-41,2,0,1,4,72,0x43565a);box(41,2,0,1,4,72,0x43565a);
 const layouts=[
  [[-18,-15,3.4,1.8,2.4], [18,-15,3.4,1.8,2.4],[-18,15,3.4,1.8,2.4],[18,15,3.4,1.8,2.4],[0,-24,1.2,3.2,1.2],[0,24,1.2,3.2,1.2],[-29,0,1.2,2.6,5],[29,0,1.2,2.6,5]],
  [[-25,-20,5,1.2,2],[-12,-10,2,2.5,2],[12,10,2,2.5,2],[25,20,5,1.2,2],[-25,20,2,2,5],[25,-20,2,2,5],[0,-27,8,1.1,1.2],[0,27,8,1.1,1.2]],
  [[-22,-22,2.5,2.4,2.5],[22,-22,2.5,2.4,2.5],[-22,22,2.5,2.4,2.5],[22,22,2.5,2.4,2.5],[-10,0,1.2,3.4,6],[10,0,1.2,3.4,6],[0,-28,5,1.1,1.2],[0,28,5,1.1,1.2]],
  [[-28,-24,4,2.2,2], [28,-24,4,2.2,2],[-28,24,4,2.2,2],[28,24,4,2.2,2],[-14,0,2,3.2,2],[14,0,2,3.2,2],[0,-18,1.2,3.4,7],[0,18,1.2,3.4,7]],
  [[-24,-22,3,2.8,3],[24,-22,3,2.8,3],[-24,22,3,2.8,3],[24,22,3,2.8,3],[-15,-8,2,2.4,5],[15,8,2,2.4,5],[-15,8,2,2.4,5],[15,-8,2,2.4,5]]
 ];
 const colors=[0x697d78,0xb18b61,0x8aaeb7,0x765d62,0x557c52],accent=mapThemes[id].pads;
 (layouts[id]||layouts[0]).forEach(([x,z,sx,sy,sz],i)=>box(x,sy/2,z,sx,sy,sz,i%3===0?accent[i%accent.length]:colors[id]));
 // Tall warehouse-style walls and concrete towers create genuine line-of-sight breaks.
 const tallMat=[0x59635f,0x9b7954,0x718a96,0x654d55,0x3d6747][id];
 for(const [x,z,w,h,d] of [[-14,-5,1.5,8,13],[14,5,1.5,8,13],[-3,-19,12,6.5,1.5],[3,19,12,6.5,1.5],[-31,0,1.5,7,12],[31,0,1.5,7,12]]){const wall=box(x,h/2,z,w,h,d,tallMat);wall.material.roughness=.94;wall.material.metalness=.04;for(let y=1.2;y<h;y+=1.8){const seam=box(x,y,z,w+.025,.055,d+.025,0x353f3d,false);seam.material.roughness=1;}}
 for(const [x,z] of [[-22,-12],[22,12],[-22,12],[22,-12]]){box(x,2.8,z,3,5.6,3,tallMat);box(x,5.7,z,3.3,.2,3.3,0x4b5550,false);}
 // Raised-looking central plinth and subdued perimeter markers.
 box(0,.32,0,8,.64,8,accent[4],false);
 for(const [x,z,sx,sz] of [[0,-4.1,8.5,.16],[0,4.1,8.5,.16],[-4.1,0,.16,8.5],[4.1,0,.16,8.5]])box(x,.12,z,sx,.24,sz,accent[0],false);
 for(let i=0;i<4;i++){const x=i%2?34:-34,z=i<2?-20:20;box(x,1.4,z,2.8,2.8,2.8,accent[i],false);box(x,2.92,z,3.1,.18,3.1,0xf5f7df,false);box(x,3.3,z,1.4,.55,1.4,accent[(i+2)%accent.length],false);}
 // Layered cover lanes: tall concrete blocks, waist-high barricades and supply crates.
 // These are solid for movement and block shots, creating genuine peek-and-hide routes.
 const coverPalette=[0x68716f,0x8b7962,0x53665f,0x74665b,0x9a8c73];
 const cover=[[-9,-22,3.8,2.2,1.25],[9,-22,3.8,2.2,1.25],[-9,22,3.8,2.2,1.25],[9,22,3.8,2.2,1.25],[-29,-8,1.4,2.4,4.2],[29,8,1.4,2.4,4.2],[-6,-7,2.4,1.8,1.4],[6,7,2.4,1.8,1.4],[-6,7,2.4,1.8,1.4],[6,-7,2.4,1.8,1.4],[-18,0,3.2,1.4,1.2],[18,0,3.2,1.4,1.2],[-34,10,2.4,1.8,1.6],[34,-10,2.4,1.8,1.6]];
 cover.forEach(([x,z,sx,sy,sz],i)=>box(x,sy/2,z,sx,sy,sz,coverPalette[(i+id)%coverPalette.length]));
 // Smaller offset crates make the approach routes less symmetrical.
 for(let i=0;i<8;i++){const x=-30+i*8,z=(i%2===0?-14:14)+(id%2?3:-3),h=1.1+(i%3)*.35;box(x,h/2,z,1.4,h,1.35,accent[(i+2)%accent.length]);}
}

const weapon=new THREE.Group();camera.add(weapon);weapon.position.set(.34,-.3,-.58);
const darkMat=new THREE.MeshStandardMaterial({color:0x20292b,metalness:.72,roughness:.32}),bodyMat=new THREE.MeshStandardMaterial({color:0x52665f,metalness:.28,roughness:.52});
function gunPart(sx,sy,sz,x,y,z,mat=darkMat){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat);m.position.set(x,y,z);m.castShadow=true;weapon.add(m);return m;}
const gunBody=gunPart(.18,.16,.43,0,0,0,bodyMat),gunBarrel=gunPart(.105,.09,.46,0,.035,-.37),gunFront=gunPart(.075,.075,.36,0,.035,-.77),gunGrip=gunPart(.12,.18,.17,0,-.14,.08,bodyMat);const gloveMat=new THREE.MeshStandardMaterial({color:0x303a39,roughness:.72});const gloveL=new THREE.Mesh(new THREE.BoxGeometry(.13,.12,.18),gloveMat);gloveL.position.set(-.16,-.12,-.19);weapon.add(gloveL);const gloveR=new THREE.Mesh(new THREE.BoxGeometry(.13,.12,.18),gloveMat);gloveR.position.set(.15,-.14,.035);weapon.add(gloveR);gunPart(.09,.22,.12,0,-.27,.04);gunPart(.06,.07,.16,0,.115,-.18);gunPart(.025,.03,.1,0,.12,-.73,bodyMat);const rifleSight=gunPart(.045,.055,.09,0,.14,-.22),shotgunBarrel=gunPart(.065,.065,.36,.07,.035,-.75),rifleStock=gunPart(.14,.11,.23,0,-.01,.29,bodyMat);
const muzzle=new THREE.PointLight(0xffb66d,0,5);muzzle.position.set(0,.04,-.98);weapon.add(muzzle);const flash=new THREE.Mesh(new THREE.ConeGeometry(.09,.28,8),new THREE.MeshBasicMaterial({color:0xffd38a,transparent:true,opacity:.9}));flash.rotation.x=-Math.PI/2;flash.position.set(0,.035,-1.02);flash.visible=false;weapon.add(flash);
function applyWeapon(){const w=weapons[weaponIndex];gunBody.scale.setScalar(weaponIndex===0?.75:weaponIndex===2?1.2:weaponIndex===6?1.28:1);gunBarrel.scale.z=weaponIndex===0?.7:weaponIndex===2?1.25:1;gunFront.scale.z=weaponIndex===2?1.2:1;gunGrip.scale.setScalar(weaponIndex===0?.85:1);rifleSight.visible=weaponIndex===2||weaponIndex===3||weaponIndex===6;shotgunBarrel.visible=weaponIndex===4||weaponIndex===5;rifleStock.visible=weaponIndex===2||weaponIndex===3||weaponIndex===6;bodyMat.color.set(gunColor);ammo=w.mag;reserve=w.reserve;reloading=false;$('weapon-name').textContent=w.name;updateHud();setMessage('EQUIPPED '+w.name,850);}
function makeBot(x,z,index){
 const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
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
 const bot={group,torso,head,leftArm,rightArm,leftLeg,rightLeg,targetRing,botMuzzle,botGun,muzzleUntil:0,hp:100,shield:100,alive:true,respawn:0,phase:Math.random()*7,fireAt:performance.now()+1000+Math.random()*2200,index,anchorX:x,anchorZ:z,strafe:Math.random()<.5?-1:1,laneAngle,preferredRange:10+Math.random()*9,shotSeed:Math.random()};
 group.userData.bot=bot;targets.push(bot);return bot;
}
for(let i=0;i<9;i++)makeBot((Math.random()-.5)*62,-5-Math.random()*28,i);

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


function setMessage(text,ms=1300){$('message').textContent=text;setTimeout(()=>{if($('message').textContent===text)$('message').textContent='';},ms);}
function updateHud(){$('health').textContent=Math.max(0,Math.round(health));$('shield').textContent=Math.max(0,Math.round(shield));const selected=targets.find(b=>targetBot>0&&b.index===targetBot-1);$('target-status').textContent=selected?('BOT '+targetBot+' · HP '+Math.round(selected.hp)+' / SHIELD '+Math.round(selected.shield)):'TARGET: ANY BOT';$('kills').textContent=kills;$('cash').textContent='$'+cash;$('ammo').textContent=reloading?'RELOADING':ammo+' / '+reserve;$('connection').textContent=online?'ONLINE · '+(socket?.connected?'CONNECTED':'CONNECTING'):'OFFLINE TRAINING';$('scoreboard').textContent=online?[...remotePlayers.values()].length+1+' PLAYERS':'BOT TRAINING';updateShop();}
function startGame(useOnline){if(!useOnline)beginCareerMatch();$('results-screen').classList.add('hidden');playerName=($('player-name').value.trim()||'Rookie').slice(0,18);online=useOnline;difficulty=$('difficulty').value;targetBot=Number($('bot-target').value);for(const b of targets)b.targetRing.visible=targetBot>0&&b.index===targetBot-1;mapIndex=0;matchMode=$('match-mode').value;hairColor=$('hair-color').value;gunColor=$('gun-color').value;uniformColor=$('uniform-color').value;skinColor=$('skin-color').value;shoeColor=$('shoe-color').value;armorLevel=Number($('armor-color').value)||0;playerRoundScore=0;botRoundScore=0;matchOver=false;$('player-round-score').textContent='0';$('bot-round-score').textContent='0';health=100;shield=100*(1+armorLevel*.03);bodyMat.color.set(gunColor);for(const b of targets){b.group.visible=!useOnline;b.hp=100;b.shield=100;}$('start-screen').classList.add('hidden');if(useOnline){running=false;$('hud').style.display='none';$('map-lobby').classList.remove('hidden');$('lobby-title').textContent='FINDING PLAYERS';$('lobby-status').textContent='Connecting to matchmaking…';$('map-votes').innerHTML='';connectOnline();}else{running=true;applyMap(mapIndex);$('map-lobby').classList.add('hidden');$('hud').style.display='block';controls.lock();}updateHud();}
$('bot-target').addEventListener('change',e=>{targetBot=Number(e.target.value);for(const b of targets)b.targetRing.visible=targetBot>0&&b.index===targetBot-1;});$('play-offline').addEventListener('click',()=>startGame(false));$('play-online').addEventListener('click',()=>{if(!$('server-url').value.trim())$('server-url').value=DEFAULT_SERVER_URL;startGame(true);});
controls.addEventListener('unlock',()=>{if(running)setMessage('CLICK THE GAME TO CAPTURE THE MOUSE',2200);});
renderer.domElement.addEventListener('click',()=>{if(running&&!controls.isLocked)controls.lock();});
document.addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='KeyB'&&running){toggleShop();e.preventDefault();}if(e.code==='Escape')toggleShop(false);if(e.code==='KeyR')reload();if(e.code==='Digit1')switchWeapon(0);if(e.code==='Digit2')switchWeapon(1);if(e.code==='Digit3')switchWeapon(2);if(e.code==='Digit4')switchWeapon(3);if(e.code==='Digit5')switchWeapon(4);if(e.code==='Digit6')switchWeapon(5);if(e.code==='Digit7')switchWeapon(6);if(e.code==='Tab'&&running){e.preventDefault();$('score-panel').classList.toggle('visible');}});
document.addEventListener('keyup',e=>keys.delete(e.code));document.addEventListener('mousedown',e=>{if(e.button===0&&running&&controls.isLocked){firing=true;shoot();}});document.addEventListener('mouseup',e=>{if(e.button===0)firing=false;});window.addEventListener('blur',()=>{firing=false;});document.addEventListener('contextmenu',e=>e.preventDefault());
function switchWeapon(i){if(i<0||i>=weapons.length||i===weaponIndex)return;if(!ownedWeapons.has(i)){setMessage('BUY '+weapons[i].name+' IN ARMORY (B) · $'+weaponCosts[i],1800);toggleShop(true);return;}weaponIndex=i;applyWeapon();updateWeaponSelector();if(online&&socket?.connected)socket.emit('equip',{weapon:i});}
function updateWeaponSelector(){const el=$('weapon-selector');if(!el)return;el.querySelectorAll('[data-weapon]').forEach(item=>{const i=Number(item.dataset.weapon);item.classList.toggle('active',i===weaponIndex);item.classList.toggle('locked',!ownedWeapons.has(i));});}
function updateShop(){const el=$('shop-items');if(!el)return;el.querySelectorAll('[data-buy]').forEach(button=>{const i=Number(button.dataset.buy),owned=ownedWeapons.has(i);button.disabled=owned||cash<weaponCosts[i];button.textContent=owned?'OWNED':cash<weaponCosts[i]?'NEED $'+weaponCosts[i]:'BUY · $'+weaponCosts[i];});}
function toggleShop(force){const el=$('shop-panel');if(!el)return;const open=force===undefined?!el.classList.contains('visible'):force;el.classList.toggle('visible',open);if(open)updateShop();}
function buyWeapon(i){if(ownedWeapons.has(i)||cash<weaponCosts[i]){setMessage(ownedWeapons.has(i)?'ALREADY OWNED':'NOT ENOUGH CASH',1000);return;}if(online&&socket?.connected){socket.emit('buy',{weapon:i});return;}cash-=weaponCosts[i];ownedWeapons.add(i);setMessage('PURCHASED '+weapons[i].name);updateHud();updateWeaponSelector();toggleShop(true);}
document.querySelectorAll('[data-buy]').forEach(button=>button.addEventListener('click',()=>buyWeapon(Number(button.dataset.buy))));
addEventListener('wheel',e=>{if(!running||!controls.isLocked)return;e.preventDefault();switchWeapon((weaponIndex+(e.deltaY>0?1:weapons.length-1))%weapons.length);},{passive:false});
function reload(){const w=weapons[weaponIndex];if(reloading||ammo===w.mag||reserve<=0)return;reloading=true;reloadUntil=performance.now()+w.reload;updateHud();setMessage('RELOADING',w.reload);}
function showHit(){const h=$('hitmarker');h.style.display='block';setTimeout(()=>h.style.display='none',120);}
function shoot(){if($('shop-panel')?.classList.contains('visible'))return;const now=performance.now(),w=weapons[weaponIndex];if(reloading||now-lastShot<w.delay)return;if(ammo<=0){setMessage('EMPTY — PRESS R TO RELOAD',1000);return;}lastShot=now;ammo--;recoil=Math.min(recoil+(weaponIndex===2?.11:weaponIndex===6?.16:.065),.22);weapon.rotation.x=-recoil;flash.visible=true;muzzle.intensity=3.5;
const origin=camera.getWorldPosition(new THREE.Vector3()),aim=camera.getWorldDirection(new THREE.Vector3());let botHit=false;
for(let pellet=0;pellet<w.pellets;pellet++){const spread=new THREE.Vector3(aim.x+(Math.random()-.5)*w.spread,aim.y+(Math.random()-.5)*w.spread,aim.z+(Math.random()-.5)*w.spread).normalize();raycaster.set(origin,spread);raycaster.far=w.range;const candidates=[];if(!online)for(const b of targets)if(b.alive&&(!targetBot||b.index===targetBot-1))candidates.push(b.torso,b.head);const hit=raycaster.intersectObjects(candidates,false)[0];const obstruction=raycaster.intersectObjects(solidMeshes,false)[0];if(hit&&(!obstruction||obstruction.distance>hit.distance)){const b=targets.find(q=>q.torso===hit.object||q.head===hit.object);if(b){let damage=weaponIndex===6&&hit.object===b.head?250:(hit.object===b.head?w.damage*1.5:w.damage);const absorbed=Math.min(b.shield,damage);b.shield-=absorbed;damage-=absorbed;b.hp=Math.max(0,b.hp-damage);botHit=true;if(b.hp<=0){b.alive=false;b.group.visible=false;b.respawn=now+2200;kills++;cash+=150;playerRoundScore++;$('player-round-score').textContent=String(playerRoundScore);setMessage('BOT ELIMINATED · +$150');if(playerRoundScore>=5){matchOver=true;showMatchResults('VICTORY','You reached five eliminations first. Great round.');}}}}}
if(botHit)showHit();
if(online&&socket?.connected){socket.emit('shoot',{x:origin.x,y:origin.y,z:origin.z,dx:aim.x,dy:aim.y,dz:aim.z,weapon:weaponIndex});}
updateHud();}
function connectOnline(){const url=($('server-url').value.trim()||DEFAULT_SERVER_URL).replace(/\/$/,'');const init=()=>{if(typeof window.io!=='function'){setMessage('Could not load Socket.IO client.',3000);return;}socket=window.io(url,{transports:['websocket','polling']});socket.on('connect',()=>{socket.emit('join',{name:playerName,mode:matchMode,hair:hairColor,uniform:uniformColor,skin:skinColor,shoes:shoeColor,armor:armorLevel});updateHud();});socket.on('disconnect',()=>{updateHud();if(online&&!running){$('lobby-status').textContent='Disconnected. Check the server URL and try again.';}});socket.on('queueStatus',info=>{if(!running){$('lobby-title').textContent='WAITING FOR PLAYERS · '+info.mode;$('lobby-status').textContent=info.message+' ('+info.waiting+'/'+info.needed+')';$('map-votes').innerHTML='';}});socket.on('mapLobby',info=>{if(running)return;$('map-lobby').classList.remove('hidden');$('lobby-title').textContent='MATCH LOBBY · '+info.mode;$('lobby-status').textContent='Everyone in this match votes for the map. The fight starts after all players vote or 30 seconds.';const el=$('map-votes');el.innerHTML='';for(const m of info.maps){const btn=document.createElement('button');btn.className='map-vote';const count=Object.values(info.votes||{}).filter(v=>v===m.id).length;btn.textContent=m.name+' · '+count+' vote'+(count===1?'':'s');btn.addEventListener('click',()=>{socket.emit('voteMap',{map:m.id});$('lobby-status').textContent='Vote submitted: '+m.name+'. Waiting for the other players…';});el.appendChild(btn);}const roster=$('lobby-players');roster.innerHTML='';for(const p of info.players||[]){const row=document.createElement('div');row.className='lobby-player';row.textContent=(p.team===0?'TEAM A · ':'TEAM B · ')+p.name;roster.appendChild(row);}});socket.on('matchStart',info=>{beginCareerMatch();mapIndex=Number(info.map)||0;matchMode=info.mode||matchMode;applyMap(mapIndex);const p=controls.getObject().position;p.x=Number.isFinite(info.x)?info.x:0;p.z=Number.isFinite(info.z)?info.z:(info.team===0?-12:12);p.y=1.7;health=100;shield=100*(1+armorLevel*.03);running=true;$('map-lobby').classList.add('hidden');$('hud').style.display='block';updateHud();setMessage('MATCH START · CLICK GAME TO PLAY',3000);});socket.on('state',state=>{const seen=new Set();for(const p of state.players||[]){if(p.id===socket.id){health=p.health??health;shield=p.shield??shield;kills=p.kills??kills;cash=p.cash??cash;if(Array.isArray(p.weapons))ownedWeapons=new Set(p.weapons);updateWeaponSelector();updateHud();seen.add(p.id);continue;}seen.add(p.id);let item=remotePlayers.get(p.id);if(!item){item=createRemoteAvatar(p);item.name=p.name||'Player';scene.add(item.group);remotePlayers.set(p.id,item);}item.group.position.set(p.x,0,p.z);item.group.rotation.y=p.yaw||0;item.name=p.name||item.name;if(item.hair&&p.hair)item.hair.material.color.set(p.hair);if(item.mesh&&p.uniform)item.mesh.material.color.set(p.uniform);if(item.skinMat&&p.skin)item.skinMat.color.set(p.skin);if(item.boots&&p.shoes)for(const boot of item.boots)boot.material.color.set(p.shoes);}for(const [id,item] of remotePlayers)if(!seen.has(id)){scene.remove(item.group);remotePlayers.delete(id);}renderScoreboard(state.players||[]);updateHud();});socket.on('combat',event=>{if(event.type==='hit'&&event.target===socket.id){health=event.health??health;shield=event.shield??shield;showHit();setMessage('HIT BY '+(event.attackerName||'PLAYER')+' · HP '+health+' / SHIELD '+shield,700);updateHud();if(health<=0)dieAndRestart();}if(event.type==='elimination'&&event.killer===socket.id){kills=event.kills??kills;cash=event.cash??cash;setMessage('ELIMINATION +$150');updateHud();}});socket.on('purchased',data=>{if(data?.cash!==undefined)cash=data.cash;if(Array.isArray(data?.weapons))ownedWeapons=new Set(data.weapons);if(Number.isInteger(data?.weapon)){weaponIndex=data.weapon;applyWeapon();updateWeaponSelector();}updateHud();toggleShop(true);setMessage(data?.message||'ARMORY UPDATED',1500);});socket.on('notice',m=>setMessage(String(m).slice(0,100),2000));socket.on('connect_error',()=>{$('connection').textContent='ONLINE · CONNECTION FAILED';setMessage('Could not connect. Check the server URL.',2500);});};if(typeof window.io==='function'){init();return;}const sc=document.createElement('script');sc.src=url+'/socket.io/socket.io.js';sc.onload=init;sc.onerror=()=>setMessage('Socket.IO client failed to load.',3000);document.head.appendChild(sc);}function createRemoteAvatar(p){
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
 const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight'))?8.5:5.4;
 const forwardInput=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0);
 const sideInput=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0);
 const before=controls.getObject().position.clone();
 const forward=camera.getWorldDirection(new THREE.Vector3());forward.y=0;forward.normalize();
 const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
 const delta=forward.multiplyScalar(forwardInput).add(right.multiplyScalar(sideInput));
 if(delta.lengthSq()>1)delta.normalize();
 delta.multiplyScalar(speed*dt);
 const p=controls.getObject().position;
 const blocked=(x,z)=>x<-39.1||x>39.1||z<-34.1||z>34.1||colliders.some(c=>c.clone().expandByVector(new THREE.Vector3(.58,1,.58)).containsPoint(new THREE.Vector3(x,1.7,z)));
 // Resolve X and Z separately so the player slides along walls instead of sticking or passing through them.
 const nextX=p.x+delta.x;if(!blocked(nextX,p.z))p.x=nextX;
 const nextZ=p.z+delta.z;if(!blocked(p.x,nextZ))p.z=nextZ;
 p.y=1.7;
 bob+=dt*(delta.lengthSq()>.001?speed*.9:1.4);weapon.position.y=-.3+Math.sin(bob*2)*.006*(delta.lengthSq()>.001?1:0);
 if(online&&socket?.connected&&performance.now()-lastSync>50){lastSync=performance.now();const f=camera.getWorldDirection(new THREE.Vector3());socket.emit('move',{x:p.x,yaw:Math.atan2(f.x,-f.z),z:p.z});}
}
function dieAndRestart(){if(!running)return;health=0;shield=0;firing=false;reloading=false;if(!online){botRoundScore++;$('bot-round-score').textContent=String(botRoundScore);if(botRoundScore>=5){matchOver=true;showMatchResults('DEFEAT','The bots reached five points first. Queue up and try again.');return;}health=100;shield=100*(1+armorLevel*.03);const p=controls.getObject().position;p.set((Math.random()-.5)*10,1.7,Math.random()<.5?-12:12);lastHitTime=performance.now();updateHud();setMessage('RESPAWN · BOTS '+botRoundScore+' / 5',1500);return;}showMatchResults('DEFEAT','You were eliminated. Review your career reward and jump back in.');}
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
   if(now>=b.respawn){b.alive=true;b.hp=100;b.shield=100;b.group.visible=true;b.group.position.set((Math.random()-.5)*48,0,(Math.random()-.5)*48);b.fireAt=now+900+Math.random()*1200;}
   continue;
  }
  const dx=p.x-b.group.position.x,dz=p.z-b.group.position.z,dist=Math.hypot(dx,dz);b.phase+=dt;
  const level={easy:{cool:1750,accuracy:.48,damage:5,speed:.85},medium:{cool:1320,accuracy:.63,damage:7,speed:1.05},hard:{cool:980,accuracy:.76,damage:9,speed:1.25}}[difficulty]||{cool:1320,accuracy:.63,damage:7,speed:1.05};
  // Each bot owns a different lane and preferred range, so they fan out instead of piling onto the player.
  const lane=b.laneAngle+b.phase*.025,ring=b.preferredRange;
  const tx=p.x+Math.cos(lane)*ring,tz=p.z+Math.sin(lane)*ring;
  let mx=tx-b.group.position.x,mz=tz-b.group.position.z,md=Math.hypot(mx,mz)||1;
  let vx=mx/md, vz=mz/md;
  // Keep a little distance from nearby bots and make their paths less synchronized.
  for(const other of targets){if(other===b||!other.alive)continue;const sx=b.group.position.x-other.group.position.x,sz=b.group.position.z-other.group.position.z,sd=Math.hypot(sx,sz);if(sd>0&&sd<4.8){vx+=sx/sd*(4.8-sd)*.32;vz+=sz/sd*(4.8-sd)*.32;}}
  const vl=Math.hypot(vx,vz)||1;vx/=vl;vz/=vl;
  const moveSpeed=(md>1.8?level.speed*(md>8?1.15:.75):.18);
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
  if(!online&&dist<42&&now>b.fireAt&&now-lastHitTime>160){
   const muzzleOrigin=b.botGun.getWorldPosition(new THREE.Vector3());const toPlayer=new THREE.Vector3(p.x,p.y-.12,p.z).sub(muzzleOrigin);const sightDistance=toPlayer.length();toPlayer.normalize();raycaster.set(muzzleOrigin,toPlayer);raycaster.far=Math.max(0,sightDistance-.35);const hasCover=raycaster.intersectObjects(solidMeshes,false).length>0;raycaster.far=Infinity;if(hasCover){b.fireAt=now+260+Math.random()*320;continue;}
   b.fireAt=now+level.cool+Math.random()*level.cool*.45;
   const targetPoint=new THREE.Vector3(p.x,p.y-.12,p.z);
   const accuracy=Math.max(.24,level.accuracy-dist*.006);
   const hit=Math.random()<accuracy;
   if(!hit){targetPoint.x+=(Math.random()-.5)*(4+dist*.24);targetPoint.y+=(Math.random()-.5)*(2+dist*.08);targetPoint.z+=(Math.random()-.5)*(4+dist*.24);}
   spawnBotShot(b,targetPoint,now);
   if(hit){
    let damage=level.damage;const absorbed=Math.min(shield,damage);shield-=absorbed;damage-=absorbed;health=Math.max(0,health-damage);lastHitTime=now;
    setMessage('BOT HIT · SHIELD '+Math.round(shield)+' · HP '+Math.round(health),700);updateHud();if(health<=0)dieAndRestart();
   }
  }
 }
}
// Browser Arena 2.0: atmospheric set dressing, optional audio, and touch-friendly controls.
const v2Decor=new THREE.Group();scene.add(v2Decor);
const v2Motes=[],v2Lights=[];
function buildV2Atmosphere(){
 while(v2Decor.children.length){const o=v2Decor.children.pop();if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}}
 v2Motes.length=0;v2Lights.length=0;
 const colors=[0x80e9bd,0x76d8ff,0xffd18a,0xc77be8];
 for(let i=0;i<42;i++){
  const x=(Math.random()-.5)*72,z=(Math.random()-.5)*62,y=.5+Math.random()*7;
  const geo=new THREE.SphereGeometry(.035+Math.random()*.035,6,6);
  const mat=new THREE.MeshBasicMaterial({color:colors[i%colors.length],transparent:true,opacity:.25+Math.random()*.35});
  const mote=new THREE.Mesh(geo,mat);mote.position.set(x,y,z);mote.userData={baseY:y,phase:Math.random()*Math.PI*2,speed:.25+Math.random()*.5};v2Decor.add(mote);v2Motes.push(mote);
 }
 // Four illuminated pylons give each arena a strong, readable skyline.
 for(const [x,z,col] of [[-35,-29,0x80e9bd],[35,-29,0x76d8ff],[-35,29,0xc77be8],[35,29,0xffd18a]]){
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.55,.8,5.5,8),new THREE.MeshStandardMaterial({color:0x24363a,metalness:.6,roughness:.38}));
  base.position.set(x,2.75,z);base.castShadow=true;v2Decor.add(base);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.72,.09,8,24),new THREE.MeshBasicMaterial({color:col}));
  ring.rotation.x=Math.PI/2;ring.position.set(x,4.9,z);v2Decor.add(ring);
  const lamp=new THREE.PointLight(col,1.6,13,2);lamp.position.set(x,4.8,z);v2Decor.add(lamp);v2Lights.push({lamp,ring,phase:Math.random()*6});
 }
 // Low luminous guide rails around the centre, kept non-solid so existing collision stays unchanged.
 for(const [x,z,sx,sz,col] of [[0,-31,30,.1,0x76d8ff],[0,31,30,.1,0x80e9bd],[-38,0,.1,24,0xc77be8],[38,0,.1,24,0xffd18a]]){
  const rail=new THREE.Mesh(new THREE.BoxGeometry(sx,.045,sz),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.72}));
  rail.position.set(x,.08,z);v2Decor.add(rail);
 }
}
function animateV2(dt,now){
 for(const m of v2Motes){m.position.y=m.userData.baseY+Math.sin(now*.001*m.userData.speed+m.userData.phase)*.32;m.rotation.y+=dt*.18;}
 for(const l of v2Lights){const pulse=.75+Math.sin(now*.0014+l.phase)*.25;l.lamp.intensity=1.15+pulse*.8;l.ring.rotation.z+=dt*.25;}
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
 stick.addEventListener('pointerdown',e=>{if(!touchMode())return;stickId=e.pointerId;stick.setPointerCapture(stickId);const r=stick.getBoundingClientRect();origin={x:r.left+r.width/2,y:r.top+r.height/2};moveStick(e);});
 function moveStick(e){if(e.pointerId!==stickId||!origin)return;const dx=e.clientX-origin.x,dy=e.clientY-origin.y,len=Math.hypot(dx,dy),scale=Math.min(1,len/40),x=len?dx/len*scale:0,y=len?dy/len*scale:0;nub.style.transform='translate('+x*34+'px,'+y*34+'px)';setKey('KeyA',x<-.22);setKey('KeyD',x>.22);setKey('KeyW',y<-.22);setKey('KeyS',y>.22);}
 stick.addEventListener('pointermove',moveStick);
 function releaseStick(e){if(e.pointerId!==stickId)return;stickId=null;origin=null;nub.style.transform='translate(0,0)';['KeyA','KeyD','KeyW','KeyS'].forEach(k=>setKey(k,false));}
 stick.addEventListener('pointerup',releaseStick);stick.addEventListener('pointercancel',releaseStick);
 look.addEventListener('pointerdown',e=>{if(!touchMode()||e.target.closest('button,#touch-stick'))return;lookId=e.pointerId;lastLook={x:e.clientX,y:e.clientY};look.setPointerCapture(lookId);});
 look.addEventListener('pointermove',e=>{if(e.pointerId!==lookId||!lastLook||!running)return;const dx=e.clientX-lastLook.x,dy=e.clientY-lastLook.y;lastLook={x:e.clientX,y:e.clientY};const yaw=controls.getObject();yaw.rotation.y-=dx*.0042;camera.rotation.x=THREE.MathUtils.clamp(camera.rotation.x-dy*.0042,-Math.PI/2,Math.PI/2);});
 const endLook=e=>{if(e.pointerId===lookId){lookId=null;lastLook=null;}};look.addEventListener('pointerup',endLook);look.addEventListener('pointercancel',endLook);
$('touch-sprint')?.addEventListener('pointerdown',()=>setKey('ShiftLeft',true));['pointerup','pointercancel','pointerleave'].forEach(ev=>$('touch-sprint')?.addEventListener(ev,()=>setKey('ShiftLeft',false)));
 $('audio-toggle')?.addEventListener('click',()=>{v2Audio.enabled=!v2Audio.enabled;$('audio-toggle').textContent=v2Audio.enabled?'SOUND: ON':'SOUND: OFF';if(v2Audio.enabled)v2Tone(660,.12,.035,'sine');});
}
buildV2Atmosphere();setupV2Touch();
$('reset-progress')?.addEventListener('click',()=>{if(confirm('Reset your local XP and career stats? This cannot be undone.')){career=freshCareer();saveCareer();setMessage('CAREER RESET',1400);}});updateProgressUI();

$('results-lobby')?.addEventListener('click',()=>{$('results-screen').classList.add('hidden');$('start-screen').classList.remove('hidden');$('hud').style.display='none';$('map-lobby').classList.add('hidden');});
$('results-rematch')?.addEventListener('click',()=>{$('results-screen').classList.add('hidden');$('start-screen').classList.remove('hidden');$('hud').style.display='none';$('map-lobby').classList.add('hidden');setMessage('CHOOSE QUICK PLAY OR TRAINING TO START AGAIN',2600);});
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04),now=performance.now();if(reloading&&now>=reloadUntil){const w=weapons[weaponIndex],amount=Math.min(w.mag-ammo,reserve);ammo+=amount;reserve-=amount;reloading=false;updateHud();}updateBotShotEffects(now);animateV2(dt,now);if(running){movePlayer(dt);if(!online)updateBots(dt,now);if(firing&&ammo>0&&!reloading&&controls.isLocked)shoot();}recoil=Math.max(0,recoil-dt*.42);weapon.rotation.x=-recoil;flash.visible=now-lastShot<65;muzzle.intensity=flash.visible?3.5:0;renderer.render(scene,camera);}
animate();applyWeapon();updateWeaponSelector();applyMap(0);$('gun-color').addEventListener('input',e=>bodyMat.color.set(e.target.value));$('hair-color').addEventListener('input',e=>{hairColor=e.target.value;for(const item of remotePlayers.values())if(item.hair)item.hair.material.color.set(hairColor);});addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.25:1.75));renderer.setSize(innerWidth,innerHeight);});window.addEventListener('beforeunload',()=>socket?.disconnect());
