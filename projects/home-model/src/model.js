import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {rooms,walls,openings,extraFloors,furniture,tvStops} from './layout.js';
import {materials} from './materials.js';
export function makeHome(scene){
 const M=materials(),root=new THREE.Group();scene.add(root);
 const groups={},walls3d=[],screens=[],lights=[],pickables=[],doors=[],bedLegs=[];let current;
 for(const r of rooms){const g=new THREE.Group();g.userData.room=r.id;root.add(g);groups[r.id]=g;}
 const boxes=new Map();
 function box(x,y,z,w,h,d,mat='wood',round=0,parent=current){
  const key=[w,h,d,round].join(',');let geo=boxes.get(key);if(!geo){geo=round?new RoundedBoxGeometry(w,h,d,2,Math.min(round,w/3,h/3,d/3)):new THREE.BoxGeometry(w,h,d);boxes.set(key,geo);}
  const m=new THREE.Mesh(geo,typeof mat==='string'?M[mat]:mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
 }
 function cylinder(x,y,z,r,h,mat='wood',r2=r,parent=current){const m=new THREE.Mesh(new THREE.CylinderGeometry(r2,r,h,24),M[mat]);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
 function ball(x,y,z,r,mat,parent=current){const m=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),M[mat]);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
 function item(id,name,x,z,w,d,build){const g=new THREE.Group();g.position.set(x,0,z);g.userData={item:id,room:current.userData.room};current.add(g);furniture.push({id,name,room:current.userData.room,x,z,w,d});build(g);return g;}
 function plant(x,z,size=1,parent=current){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(size);parent.add(g);cylinder(0,.22,0,.22,.44,'pot',.28,g);cylinder(0,.446,0,.25,.014,'soil',.25,g);for(let i=0;i<9;i++){let a=i*2.4,h=.65+(i%4)*.2;let stem=cylinder(Math.cos(a)*.12,h/2+.3,Math.sin(a)*.12,.016,h-.3,'woodDark',.01,g);stem.rotation.z=Math.cos(a)*.2;let leaf=ball(Math.cos(a)*.25,h,Math.sin(a)*.25,.22,'leaf',g);leaf.scale.set(.65,1.5,.38);leaf.rotation.set(.4,a,.6);}return g;}
 function stool(x,z,mat='sage',parent=current){cylinder(x,.43,z,.23,.12,mat,.23,parent);for(let a=0;a<4;a++){let t=a*Math.PI/2+.7;box(x+Math.cos(t)*.15,.2,z+Math.sin(t)*.15,.035,.4,.035,'wood',0,parent);}}
 function chair(x,z,rot=0,parent=current){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;parent.add(g);box(0,.46,0,.45,.11,.45,'fabric',.05,g);box(0,.73,.2,.45,.55,.08,'wood',.04,g);for(const a of [-1,1])for(const b of [-1,1])box(a*.17,.22,b*.17,.035,.44,.035,'woodDark',0,g);return g;}
 function frame(x,y,z,w,h,rot=0,parent=current){const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rot;parent.add(g);box(0,0,0,w,h,.045,'woodDark',.005,g);box(0,0,.025,w-.05,h-.05,.01,'fabric',0,g);const art=ball(-w*.08,0,.037,Math.min(w,h)*.25,'sage',g);art.scale.z=.01;const art2=ball(w*.1,-h*.15,.038,Math.min(w,h)*.17,'clay',g);art2.scale.z=.01;}
 function book(x,y,z,c,parent=current){box(x,y,z,.045,.2,.15,c,0,parent);}
 function lamp(x,z,parent=current){cylinder(x,.78,z,.09,.025,'metal',.09,parent);cylinder(x,.98,z,.014,.4,'metal',.014,parent);cylinder(x,1.16,z,.14,.14,'light',.08,parent);const l=new THREE.PointLight('#ffd79c',4,2.7,2);l.position.set(x,1.08,z);parent.add(l);lights.push(l);}
 // One floor and thin base per room; semantic open boundaries do not create walls.
 for(const r of rooms){current=groups[r.id];for(const floor of r.floorRects||[r.box]){const [x,z,X,Z]=floor,mat=r.material==='wood'?'woodFloor':r.material;box((x+X)/2,-.13,(z+Z)/2,X-x,.24,Z-z,'base',.03);let floorMat=M[mat].clone();if(floorMat.map){floorMat.map=floorMat.map.clone();floorMat.map.repeat.set((X-x)/(mat==='woodFloor'?1.7:1.2),(Z-z)/(mat==='woodFloor'?1.7:1.2));}const f=box((x+X)/2,.005,(z+Z)/2,X-x,.035,Z-z,floorMat);f.userData.floor=r.id;pickables.push(f);}}

 for(const f of extraFloors){current=groups[f.id];const [x,z,X,Z]=f.box;box((x+X)/2,-.01,(z+Z)/2,X-x,.07,Z-z,f.id==='master'?'woodFloor':'stone');}
 // Shared wall segments and glazing, kept in the same coordinate frame as the plan.
 for(const data of walls){const g=new THREE.Group();root.add(g);g.position.set((data.a[0]+data.b[0])/2,0,(data.a[1]+data.b[1])/2);const len=Math.hypot(data.b[0]-data.a[0],data.b[1]-data.a[1]);g.rotation.y=-Math.atan2(data.b[1]-data.a[1],data.b[0]-data.a[0]);let wallMat='wall';
  if(data.feature==='marble'){box(0,1.35,0,len,2.7,.17,'wall',0,g);box(0,.2,.11,len-.06,.4,.055,'woodDark',0,g);for(let x=-len/2+.04;x<len/2;x+=.035)box(x,.2,.143,.011,.38,.013,'woodDark',0,g);box(0,1.49,.126,len-.12,2.14,.04,[M.trim,M.trim,M.trim,M.trim,M.marble,M.wall],.004,g);box(0,2.59,.14,len-.08,.018,.02,'light',0,g);box(0,2.66,.035,len,.08,.2,'wall',0,g);}
  else if(data.railing){box(0,.07,0,len,.14,.14,'trim',0,g);box(0,.61,0,len,1,.018,'glass',0,g);box(0,1.13,0,len,.045,.06,'metal',.01,g);for(let x=-len/2;x<=len/2+.01;x+=len/Math.ceil(len/1.2))box(x,.62,0,.045,1.08,.06,'metal',0,g);}
  else if(data.glass){box(0,.2,0,len,.4,.12,'trim',0,g);box(0,1.4,0,len,2,.025,'glass',0,g);box(0,2.45,0,len,.045,.07,'black',0,g);for(let x=-len/2;x<=len/2+.01;x+=len/Math.ceil(len/1.1))box(x,1.45,0,.04,2,.055,'black',0,g);}
  else if(data.window){const sill=data.bay?.6:.9;box(0,sill/2,0,len,sill,.18,wallMat,0,g);box(0,(sill+2.5)/2,0,len,2.5-sill,.025,'glass',0,g);box(0,2.6,0,len,.2,.18,'wall',0,g);for(let x=-len/2;x<=len/2+.01;x+=len/Math.ceil(len/1.3))box(x,(sill+2.5)/2,0,.045,2.5-sill,.065,'black',0,g);box(0,sill+.02,0,len,.045,.07,'black',0,g);}

  else{box(0,1.35,0,len,2.7,.17,wallMat==='marble'?[M.wall,M.wall,M.wall,M.wall,M.marble,M.wall]:wallMat,0,g);box(0,.07,-.09,len,.14,.028,'woodDark',0,g);}
  walls3d.push({g,data});
 }
 function glazedPanel(w,h,parent){box(0,h/2,0,w,h,.016,'glass',0,parent);for(const a of [-1,1])box(a*w/2,h/2,0,.024,h,.045,'metal',0,parent);for(const y of [0,h])box(0,y,0,w,.028,.045,'metal',0,parent);}

 for(const o of openings){const threshold=new THREE.Group();root.add(threshold);box((o.a[0]+o.b[0])/2,.005,(o.a[1]+o.b[1])/2,Math.max(.2,Math.abs(o.b[0]-o.a[0])),.035,Math.max(.2,Math.abs(o.b[1]-o.a[1])),'stone',0,threshold);doors.push({g:threshold,owners:o.owners});if(o.type==='door'||o.type==='open'||o.type==='lift')continue;const g=new THREE.Group();root.add(g);const len=Math.hypot(o.b[0]-o.a[0],o.b[1]-o.a[1]);g.position.set(o.a[0],0,o.a[1]);g.rotation.y=-Math.atan2(o.b[1]-o.a[1],o.b[0]-o.a[0]);box(len/2,2.53,0,len,.055,.14,'metal',0,g);let n=2;for(let i=0;i<n;i++){const p=new THREE.Group();g.add(p);p.position.set((i+.5)*len/n,0,i*.035);glazedPanel(len/n+.01,2.5,p);}doors.push({g,owners:o.owners});}
 // Open horizontal living room. Sofa and desk both face +x, towards the stone feature wall.
 current=groups.living;
 const sofa=item('sofa','背靠书房的沙发',6.62,7.02,.98,2.4,g=>{box(0,.24,0,2.4,.28,.94,'linen',.1,g);for(let i=0;i<3;i++)box((i-1)*.74,.48,-.06,.73,.25,.78,'fabric',.09,g);box(0,.77,.34,2.32,.69,.21,'fabric',.08,g);for(const side of[-1,1]){box(side*1.12,.6,-.015,.2,.45,.93,'fabric',.08,g);box(side*.7,.79,.17,.47,.44,.15,side<0?'clay':'linen',.06,g).rotation.z=side*.14;}box(.1,.74,.16,.43,.4,.13,'sage',.06,g).rotation.z=-.18;box(-.72,.64,-.1,.42,.04,.72,'linen',.025,g);});sofa.rotation.y=-Math.PI/2;
 item('livingRug','羊毛感地毯',8.08,7.03,2.8,2.35,g=>box(0,.038,0,2.8,.023,2.35,'rug',.08,g));
 item('coffee','圆润茶几',8.03,7.05,.66,1.05,g=>{box(0,.37,0,.66,.075,1.05,'woodDark',.15,g);box(0,.2,0,.39,.33,.7,'wood',.08,g);box(.07,.416,-.13,.31,.025,.23,'linen',.006,g);cylinder(-.13,.46,.22,.055,.09,'white',.055,g);});
 item('dining','圆角餐桌',7.73,4.08,1.48,.82,g=>{box(0,.755,0,1.48,.065,.82,'wood',.11,g);for(const x of[-.51,.51])box(x,.38,0,.14,.75,.54,'woodDark',.05,g);cylinder(.25,.89,0,.08,.2,'pot',.055,g);for(let i=0;i<3;i++)ball(.25+(i-1)*.04,1.05+i*.04,0,.06,'leaf',g);});
 for(const x of[7.32,8.14]){chair(x,3.42,Math.PI);chair(x,4.74,0);}
 item('sideboard','暖灰餐边柜',6.38,3.92,.5,1.55,g=>{box(0,.45,0,.5,.85,1.55,'lacquer',.018,g);box(0,.895,0,.52,.04,1.58,'island',.012,g);for(const z of[-.5,0,.5])box(.254,.47,z,.01,.76,.48,'lacquer',.004,g);});
 const tv=item('tv','移动电视',tvStops.living[0],tvStops.living[1],.48,.98,g=>{box(0,.13,0,.73,.065,.43,'white',.07,g);for(const x of[-.28,.28])for(const z of[-.16,.16]){const wheel=cylinder(x,.075,z,.052,.035,'black',.052,g);wheel.rotation.z=Math.PI/2;}cylinder(0,.72,0,.028,1.12,'metal',.028,g);box(0,1.32,0,.98,.59,.055,'black',.025,g);const screen=box(0,1.32,.031,.93,.535,.009,'screen',.013,g);screens.push({mesh:screen,type:'tv'});});tv.rotation.y=tvStops.living[2];tv.userData.action='tv';pickables.push(tv);
 // A continuous desk sits behind the sofa. Chairs look east, towards the living room.
 current=groups.study;
 const desk=item('desk','朝向客厅的双人桌',5.55,7.1,.65,2.2,g=>{box(0,.755,0,2.2,.055,.65,'wood',.035,g);for(const x of[-1.015,1.015])box(x,.37,.08,.065,.74,.52,'woodDark',.015,g);for(const x of[-.55,.55]){box(x,.81,.11,.26,.028,.16,'metal',.012,g);box(x,.98,.11,.026,.29,.026,'metal',0,g);box(x,1.17,.11,.5,.32,.032,'black',.012,g);const screen=box(x,1.17,.087,.465,.285,.009,'screen',.004,g);screens.push({mesh:screen,type:'computer'});box(x,.795,-.16,.34,.012,.13,'white',.007,g);}});desk.rotation.y=Math.PI/2;
 const deskChairs=[];for(const z of[6.55,7.65]){const chairGroup=chair(4.66,z,-Math.PI/2);chairGroup.children[1].material=M.linen;deskChairs.push(chairGroup);furniture.push({id:'deskChair'+z,name:'工作椅',room:'study',x:4.66,z,w:.55,d:.5});}
 lamp(5.55,7.12);
 // Integrated shelf and guest bed run along the inner wall; the desk stays usable when the bed is down.
 item('bookCabinet','暖灰柜与开放书架',3.49,7.02,.5,1.88,g=>{box(-.22,1.25,0,.055,2.5,1.88,'wood',.01,g);for(const z of[-.915,.915])box(0,1.25,z,.5,2.5,.05,'lacquer',.01,g);for(const y of[.1,.7,1.42,2.08,2.48])box(0,y,0,.5,.04,1.88,'wood',.008,g);for(const z of[-.46,.46])box(.258,.39,z,.03,.56,.895,'lacquer',.01,g);box(.258,2.29,0,.03,.38,1.83,'lacquer',.01,g);for(const y of[1.39,2.05])box(.19,y,0,.02,.013,1.7,'light',0,g);for(let i=0;i<13;i++){const bk=box(.05,.92,-.72+i*.09,.3,.37,.055,i%3===0?'linen':i%3===1?'woodDark':'sage',.004,g);bk.rotation.x=(i%4-1)*.05;}cylinder(.04,1.61,.35,.095,.33,'pot',.06,g);ball(.06,1.76,-.35,.13,'clay',g);});
 current=groups.studioBalcony;
 item('murphyCase','一体式隐藏床柜',3.48,8.9,.52,1.48,g=>{box(-.225,1.25,0,.055,2.5,1.48,'wood',.01,g);for(const z of[-.71,.71])box(0,1.25,z,.52,2.5,.055,'lacquer',.012,g);box(0,2.48,0,.52,.05,1.48,'lacquer',.012,g);box(.23,2.38,0,.028,.12,1.35,'wood',.005,g);box(.26,2.29,0,.016,.012,1.33,'light',0,g);});
 const bedPivot=new THREE.Group();bedPivot.position.set(3.73,.33,8.9);current.add(bedPivot);box(1.01,0,0,2.02,.13,1.27,'lacquer',.025,bedPivot);for(const z of[-.316,.316])box(1.01,-.077,z,1.98,.025,.615,'lacquer',.007,bedPivot);box(1.01,.13,0,1.98,.2,1.2,'fabric',.07,bedPivot);box(1.22,.255,0,1.44,.055,1.21,'linen',.04,bedPivot);box(.25,.265,0,.38,.11,.95,'white',.08,bedPivot);box(1.55,.289,0,.32,.018,1.23,'clay',.01,bedPivot);for(const z of[-.5,.5])bedLegs.push(box(1.84,-.15,z,.055,.3,.055,'woodDark',.008,bedPivot));bedPivot.rotation.z=Math.PI/2;bedPivot.userData.action='bed';pickables.push(bedPivot);
 furniture.push({id:'guestBed',name:'展开客床',room:'studioBalcony',allowedRooms:['study','studioBalcony'],x:4.74,z:8.9,w:2.02,d:1.27,dynamic:true});
 const play=new THREE.Group();current.add(play);box(4.91,.04,8.92,1.45,.035,1.25,'rug',.08,play);for(let i=0;i<4;i++)box(4.65+i*.17,.13,8.95+(i%2)*.17,.145,.145,.145,i%2?'wood':'sage',.025,play);ball(5.24,.19,9.13,.16,'pink',play);
 // Master suite: L-shaped joinery separates the bathroom vestibule from the bed.
 current=groups.master;
 item('masterWardrobeReturn','L 型柜转角',.365,5.355,.58,.91,g=>{box(0,1.26,0,.58,2.5,.91,'lacquer',.013,g);box(.296,1.29,0,.025,2.35,.86,'wood',.008,g);box(.315,1.22,.26,.022,.52,.018,'metal',.005,g);});
 const masterWardrobe=item('masterWardrobe','L 型更衣柜',1.05,6.1,1.95,.58,g=>{box(0,1.25,.265,1.95,2.5,.05,'lacquer',.01,g);for(const x of[-.951,.951])box(x,1.25,0,.048,2.5,.58,'lacquer',.01,g);for(const y of[.09,.65,2.45])box(0,y,0,1.95,.04,.56,'wood',.008,g);box(0,1.25,0,.035,2.42,.56,'wood',0,g);for(let i=0;i<8;i++)box(-.82+i*.23,1.6,0,.14,.8,.3,i%2?'linen':'fabric',.045,g);for(const x of[-.475,.475])box(x,.35,-.03,.86,.4,.43,'linen',.02,g);const panel=box(-.005,1.26,-.315,.63,2.42,.035,'lacquer',.007,g);box(.6375,1.26,-.36,.63,2.42,.035,'lacquer',.007,g);doors.push({wardrobe:true,p:panel,closed:-.005,open:.6375});frame(.05,1.73,.31,.68,.5,0,g);box(.05,1.94,.3,1.78,.035,.04,'woodDark',.006,g);box(.05,2,.302,1.75,.012,.023,'light',0,g);});masterWardrobe.userData.action='wardrobe';pickables.push(masterWardrobe);
 const masterBed=item('masterBed','床头靠内侧外墙',1.12,7.86,2.06,1.85,g=>{box(0,.22,0,1.8,.29,2.02,'linen',.055,g);box(0,.43,0,1.78,.22,1.98,'fabric',.07,g);box(0,.57,.28,1.82,.095,1.38,'fabric',.055,g);box(0,.79,-.98,1.85,.97,.13,'linen',.045,g);for(const x of[-.43,.43]){box(x,.59,-.66,.71,.13,.41,'white',.07,g);box(x,.66,-.47,.58,.11,.28,'linen',.07,g);}box(.18,.635,.54,1.45,.025,.47,'clay',.018,g);});
 masterBed.rotation.y=Math.PI/2;
 for(const z of[6.66,9.04]){cylinder(.3,.28,z,.19,.56,'wood',.19);cylinder(.3,.59,z,.065,.06,'pot',.06);}frame(.015,1.78,7.86,.9,.58,Math.PI/2);
 item('baySeat','飘窗坐榻',1.5,9.72,2.5,.72,g=>{box(0,.275,0,2.5,.55,.72,'wall',.014,g);box(0,.565,0,2.53,.035,.75,'island',.015,g);box(0,.62,0,2.25,.08,.6,'fabric',.05,g);for(const side of[-1,1]){const cushion=box(side*.84,.86,.11,.42,.44,.16,side<0?'clay':'linen',.07,g);cushion.rotation.z=side*.18;}box(.2,.685,-.08,.4,.022,.28,'wood',.009,g);});
 // Secondary bedroom retains its laundry separation and existing furniture arrangement.
 current=groups.secondary;
 const secondaryBed=item('secondaryBed','次卧床',11.14,6.81,2.08,1.35,g=>{box(0,.22,0,1.39,.27,2.08,'wood',.04,g);box(0,.43,0,1.35,.23,2.02,'fabric',.07,g);box(0,.59,.27,1.38,.1,1.5,'pink',.06,g);box(0,.75,-1,1.53,1.18,.14,'fabric',.07,g);for(const x of[-.33,.33])box(x,.61,-.68,.54,.13,.4,'white',.07,g);box(.03,.66,.66,1.39,.018,.5,'rug',.01,g);});secondaryBed.rotation.y=Math.PI/2;
 item('secondaryWardrobe','次卧衣柜',11.85,5.27,1.5,.6,g=>{box(0,1.2,0,1.5,2.4,.6,'wood',.015,g);for(const x of[-.375,.375])box(x,1.2,.31,.73,2.3,.025,'lacquer',.008,g);});plant(12.5,8,.6);
 // Open kitchen, low stone island and perimeter L-shaped worktop.
 current=groups.kitchen;
 item('kitchenBack','厨房后操作台',6.73,.39,1.95,.62,g=>{box(0,.43,0,1.95,.84,.62,'lacquer',.015,g);box(0,.88,0,1.98,.055,.65,'island',.012,g);for(let i=0;i<3;i++)box((i-1)*.64,.45,.32,.62,.75,.02,'white',.006,g);box(0,2.03,-.06,1.95,.74,.42,'white',.01,g);box(0,1.65,.1,1.83,.018,.025,'light',0,g);});
 item('kitchenSide','厨房水槽台',6.05,1.51,.6,1.47,g=>{box(0,.43,0,.6,.84,1.47,'lacquer',.012,g);box(0,.88,0,.63,.055,1.49,'island',.012,g);box(0,.916,0,.43,.015,.51,'metal',.045,g);box(0,.927,0,.34,.01,.39,'black',.045,g);cylinder(-.22,1.08,0,.015,.34,'metal',.015,g);box(-.11,1.24,0,.22,.025,.025,'metal',.008,g);});
 item('island','约 900 mm 低岛台',7.65,2.17,1.2,.78,g=>{box(0,.43,0,1.16,.84,.73,'lacquer',.012,g);box(0,.878,0,1.2,.045,.78,'island',.01,g);box(0,.454,.371,1.2,.85,.035,'island',.008,g);for(const x of[-.585,.585])box(x,.454,0,.03,.85,.76,'island',.008,g);cylinder(-.42,.904,-.21,.04,.005,'metal',.04,g);});
 box(6.66,.923,.39,.7,.018,.44,'black',.012);for(const x of[6.47,6.85]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.1,.006,8,32),M.metal);ring.rotation.x=Math.PI/2;ring.position.set(x,.937,.39);current.add(ring);}
 item('fridge','靠侧边的高柜',8.055,.4,.67,.7,g=>{box(0,1.26,0,.67,2.5,.7,'wood',.015,g);box(0,1.32,.357,.63,.54,.024,'black',.012,g);box(0,1.53,.38,.45,.02,.025,'metal',.005,g);});
 // Entry and storage.
 current=groups.entry;
 // True recessed niche: shelves and side panels, with open air above the stone counter.
 item('entryCloset','浅橡木玄关柜与石材凹台',10.35,1.7,.6,2.8,g=>{
  box(.265,1.3,0,.045,2.6,2.8,'wood',.005,g);
  for(const z of[-1.38,-.34,.8,1.38])box(0,1.3,z,.59,2.6,.035,'wood',.004,g);
  for(const y of[.08,2.58])box(0,y,0,.6,.04,2.8,'wood',.004,g);
  for(const z of[-1.115,-.615,1.09]){const d=z===1.09?.53:.475;box(-.301,1.33,z,.026,2.47,d,'wood',.003,g);box(-.32,1.25,z+d/2-.04,.01,.48,.008,'metal',.002,g);}
  for(const z of[-.055,.515]){
   box(-.301,2.135,z,.028,.87,.543,'wood',.003,g);
   for(const [y,h] of[[.27,.34],[.66,.36]]){box(-.3,y,z,.03,h,.54,'wood',.004,g);box(-.32,y+h/2-.028,z,.013,.014,.45,'metal',.002,g);}
  }
  box(0,.896,.23,.615,.045,1.105,'entryStone',.008,g);
  box(.215,1.02,.23,.03,.21,1.105,'entryStone',.002,g);
  for(const z of[-.314,.775])box(-.035,1.02,z,.52,.21,.018,'entryStone',.002,g);
  box(-.025,1.672,.23,.53,.035,1.1,'wood',.003,g);
  box(-.24,1.647,.23,.018,.012,1.035,'light',0,g);
  const light=new THREE.PointLight('#ffe1b2',1.5,1.3,2);light.position.set(-.2,1.45,.23);g.add(light);lights.push(light);
 });
 item('entryBench','换鞋凳',9.05,2.63,.52,.8,g=>{box(0,.38,0,.52,.12,.8,'fabric',.04,g);for(const a of [-.19,.19])for(const b of [-.31,.31])box(a,.17,b,.05,.34,.05,'wood',.01,g);});
 // Pale entrance leaf, bronze hardware and two panels from the new entrance reference.
 item('entranceLeaf','浅木入户门',9.4,-.055,1.04,.085,g=>{box(0,1.23,0,1.04,2.46,.085,'wood',.006,g);for(const x of[-.54,.54])box(x,1.25,.015,.035,2.5,.095,'metal',0,g);box(.38,.98,.062,.045,.2,.025,'metal',.009,g);box(.3,1.02,.09,.18,.024,.025,'metal',.008,g);});
 item('entryControls','入户中控与小面板',10.31,.012,.55,.07,g=>{
  box(.03,1.46,0,.35,.37,.045,'woodDark',.005,g);box(.03,1.505,.027,.303,.245,.009,'black',.004,g);
  const c=document.createElement('canvas');c.width=512;c.height=384;const ctx=c.getContext('2d');ctx.fillStyle='#28343b';ctx.fillRect(0,0,512,384);ctx.fillStyle='#e8ede8';ctx.font='36px sans-serif';ctx.fillText('09:00',22,75);ctx.font='18px sans-serif';ctx.fillText('HOME',24,109);
  const colors=['#cfae74','#85a799','#c29585','#94aac5','#a9a0c6','#a9b98e'];for(let i=0;i<6;i++){const x=190+(i%3)*99,y=36+Math.floor(i/3)*132;ctx.fillStyle=colors[i];ctx.fillRect(x,y,75,81);ctx.fillStyle='#f5f0e3';ctx.font='24px sans-serif';ctx.fillText(['☀','⌂','♫','◉','▤','◌'][i],x+24,y+50);}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;box(.03,1.51,.035,.283,.21,.005,new THREE.MeshBasicMaterial({map:tex}),0,g);
  for(const x of[-.07,.03,.13])for(const y of[1.315,1.355])box(x,y,.027,.038,.008,.003,'white',0,g);
  box(-.222,1.18,0,.115,.13,.045,'black',.004,g);box(-.222,1.18,.026,.095,.087,.006,'screenOff',.002,g);
 });
 current=groups.storage;
 function storageRack(id,x,z,w,d,rotation=0){const rack=item(id,'模块化层板与抽屉',x,z,rotation?d:w,rotation?w:d,g=>{
  for(const X of[-w/2+.018,w/2-.018])for(const Z of[-d/2+.02,d/2-.02]){box(X,1.18,Z,.025,2.32,.025,'metal',.003,g);for(let y=.2;y<2.3;y+=.12)box(X,y,Z+.014,.008,.018,.003,'black',0,g);}
  for(const y of[.18,.69,1.22,1.77,2.31])box(0,y,0,w,.028,d,'wood',.005,g);
  for(const X of[-w*.25,w*.25]){box(X,.42,0,w*.44,.4,d-.04,'white',.01,g);box(X,.45,d/2-.012,.16,.028,.018,'metal',.004,g);}
  for(const [y,n] of[[.94,2],[1.46,2],[2.04,1]])for(let i=0;i<n;i++){const X=(i-(n-1)/2)*w*.48;box(X,y,0,w*.39,.35,d-.07,y>2?'linen':'white',.018,g);box(X,y+.01,d/2-.028,.16,.07,.008,'pot',.005,g);box(X,y+.01,d/2-.023,.075,.008,.005,'metal',0,g);}
 });rack.rotation.y=rotation;return rack;}
 storageRack('storageNorth',11.64,3.18,1.4,.42);
 storageRack('storageEast',12.41,4.045,1.18,.42,-Math.PI/2);
 // Elevator doors face the public lobby, outside the entrance and square storage room.
 current=groups.exterior;
 item('elevator','电梯门与门套',11.79,-.11,1.19,.09,g=>{box(0,1.17,0,1.19,2.34,.085,'trim',.006,g);for(const x of[-.25,.25])box(x,1.12,-.052,.493,2.24,.02,'metal',.003,g);box(0,2.43,-.05,.2,.08,.018,'black',.002,g);box(0,2.43,-.062,.065,.011,.005,'light',0,g);box(-.7,1.15,-.016,.065,.18,.035,'metal',.003,g);});
 // Wet rooms; dimensions from image are approximate, no new drains assumed.
 for(const id of ['ensuite','bath']){current=groups[id];const r=rooms.find(r=>r.id===id),[x,z]=r.box;
 item(id+'Vanity','浴室柜',x+.76,z+.35,1.3,.54,g=>{box(0,.48,0,1.3,.6,.54,'wood',.02,g);box(0,.81,0,1.34,.055,.58,'stone',.015,g);box(0,.88,0,.55,.12,.38,'white',.055,g);box(0,.951,0,.41,.015,.26,'stone',.055,g);cylinder(.3,.98,-.12,.015,.25,'metal',.015,g);box(0,1.55,-.29,1.27,.87,.025,'metal',.02,g).userData.mounted=true;box(0,1.55,-.271,1.21,.81,.012,new THREE.MeshStandardMaterial({color:'#b1beb9',metalness:.95,roughness:.09}),.01,g).userData.mounted=true;});
 item(id+'Toilet','马桶',x+1.73,z+.54,.4,.62,g=>{box(0,.33,0,.37,.53,.6,'white',.15,g);box(0,.68,-.2,.38,.55,.16,'white',.04,g);box(0,.59,.07,.39,.055,.49,'stone',.14,g);});
 box(x+2.1,1.2,z+.85,.018,2.4,1.5,'glass');cylinder(x+2.49,1.6,z+.08,.013,1.4,'metal',.013).userData.mounted=true;box(x+2.44,2.23,z+.18,.25,.027,.25,'metal',.03).userData.mounted=true;
 }
 // Laundry stays on the secondary bedroom balcony.
 current=groups.laundry;
 item('laundryStack','洗衣机＋烘干机',12.36,9.31,.65,.68,g=>{for(let n=0;n<2;n++){box(0,.45+n*.86,0,.65,.83,.66,'white',.035,g);const drum=cylinder(0,.42+n*.86,-.34,.22,.045,'metal',.22,g);drum.rotation.x=Math.PI/2;const glass=cylinder(0,.42+n*.86,-.368,.17,.02,'black',.17,g);glass.rotation.x=Math.PI/2;box(.13,.75+n*.86,-.345,.15,.045,.012,'screen',.005,g);}});
 item('laundrySink','洗衣台盆',11.46,9.4,.93,.64,g=>{box(0,.45,0,.93,.86,.64,'wood',.02,g);box(0,.9,0,.98,.055,.68,'stone',.015,g);box(0,.935,0,.49,.025,.42,'white',.07,g);cylinder(.28,1.04,.13,.016,.26,'metal',.016,g);});
 current=groups.loungeBalcony;
 item('loungeChair','窗边软包休闲椅',8.7,9.19,.86,.82,g=>{box(0,.28,0,.74,.29,.72,'woodDark',.05,g);box(0,.46,-.035,.82,.23,.76,'fabric',.11,g);box(0,.78,.29,.83,.65,.2,'fabric',.09,g);for(const x of[-.35,.35])box(x,.62,0,.14,.35,.75,'fabric',.06,g);box(0,.75,.12,.4,.38,.14,'clay',.06,g);});
 cylinder(7.82,.43,9.1,.29,.055,'woodDark',.29);cylinder(7.82,.225,9.1,.085,.43,'wood',.085);box(7.83,.476,9.1,.22,.022,.29,'linen',.008);plant(9.4,9.35,.7);
 cylinder(7.18,.035,9.42,.21,.05,'metal',.21);cylinder(7.18,.77,9.42,.014,1.5,'metal',.014);cylinder(7.18,1.58,9.42,.23,.32,'fabric',.16);const floorLight=new THREE.PointLight('#ffdfa8',5,3,2);floorLight.position.set(7.18,1.4,9.42);current.add(floorLight);lights.push(floorLight);
 function curtain(x,z,w,parent=current){const geometry=new THREE.PlaneGeometry(w,2.42,30,1),pos=geometry.attributes.position;for(let i=0;i<pos.count;i++)pos.setZ(i,Math.sin(pos.getX(i)/w*Math.PI*14)*.04);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,M.curtain);mesh.position.set(x,1.38,z);parent.add(mesh);box(x,2.61,z,w+.08,.025,.025,'metal',0,parent);}
 curtain(6.3,9.77,.3);curtain(9.52,9.77,.32);curtain(3.39,9.77,.22,groups.studioBalcony);curtain(.33,9.52,.2,groups.master);curtain(2.67,9.52,.2,groups.master);
 // Local task and ambient lights, without changing room geometry.
 for(const id of ['living','master','secondary','kitchen','entry','study']){current=groups[id];const [x,z,X,Z]=rooms.find(r=>r.id===id).box;const l=new THREE.PointLight('#ffe0b0',id==='living'?7:4.5,6,2);l.position.set((x+X)/2,2.4,(z+Z)/2);current.add(l);lights.push(l);}
 current=groups.platform;box(4.45,.36,-4.13,1.08,.72,.46,'white',.025);for(let i=0;i<10;i++)box(4.45,.15+i*.045,-3.89,.88,.012,.02,'metal');
 for(const f of furniture)if(f.id==='murphyCase')f.allowedRooms=['study','studioBalcony'];
 return {root,groups,M,walls3d,screens,lights,pickables,doors,bedPivot,bedLegs,deskChairs,play,tv};
}
