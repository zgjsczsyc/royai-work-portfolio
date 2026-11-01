// Metres. x = drawing right, z = drawing down; no geographic north is inferred.
// The dimensioned image is the coordinate source; mirror is a display transform.
export const rooms = [
 {id:'living',name:'横厅',tag:'一起工作，也一起生活',box:[6.1,2.8,9.75,8.25],area:'19.46',material:'stone',floorRects:[[6.1,2.8,8.6,3.35],[6.1,3.35,9.75,8.25]],photos:['客厅1','客厅2'],note:'客厅、书房及客厅阳台连通。沙发背靠书房，双人桌在沙发后朝向客厅；保留完整岩板与下方深木饰面，电视仍用移动支架。'},
 {id:'study',name:'共享书房',tag:'沙发后的双人办公区',box:[3.2,6,5.9,8.25],area:'5.67',material:'stone',photos:['书房'],note:'移除与客厅之间的墙及移门，约 2.2 米双人桌面向客厅、背靠内侧收纳。原书房阳台侧布置整合书架的隐藏床柜，展开客床时不占双人桌。'},
 {id:'master',name:'主卧',tag:'安静的休息角落',box:[0,4.9,3,9.4],area:'13.50',material:'wood',photos:['主卧1','主卧2','主卧3'],note:'L 型柜在主卫和睡眠区之间形成更衣缓冲区，1.8 米床头靠图面左侧最里面的外墙，床尾朝向房内通道，窗台补成带侧壁与外凸空间的休闲坐榻。'},
 {id:'secondary',name:'次卧',tag:'留给成长的空间',box:[9.95,4.9,12.75,8.25],area:'9.38',material:'wood',photos:['次卧'],note:'采用 1.35 米床与整墙收纳。保留通往生活阳台的玻璃门，减少洗烘噪声进入卧室。'},
 {id:'kitchen',name:'厨房',tag:'开放厨房与低矮岛台',box:[5.7,0,8.4,2.6],area:'7.02',material:'stone',photos:['玄关及厨房'],note:'按实景改为开放式厨房，前方设置约 0.9 米高石材岛台。高柜退到侧边，保留宽敞的厨房入口与操作通道。'},
 {id:'entry',name:'玄关',tag:'回家的第一步',box:[8.6,0,10.7,3.35],area:'6.13',material:'stone',photos:['玄关柜细节','入户操作面板','玄关'],note:'按新实景图采用浅橡木柜门，补齐石材置物凹台、上下柜、抽屉、细缝与暖光；入户门旁补大屏中控和小面板。'},
 {id:'bath',name:'公卫',tag:'保持交付格局',box:[2.85,3,5.5,4.7],area:'4.43',material:'bath',photos:['次卫'],note:'保留原湿区位置及深灰石材风格，洁具尺寸与玻璃分隔为示意。'},
 {id:'ensuite',name:'主卫',tag:'主卧内的独立卫浴',box:[0,3,2.65,4.7],area:'4.50',material:'bath',photos:['主卫'],note:'仅从主卧进入。保留洗手台、马桶、淋浴和原窗位置关系。'},
 {id:'studioBalcony',name:'窗边客卧区',tag:'隐藏床与窗边的留白',box:[3.2,8.4,5.9,9.8],area:'3.78',material:'stone',photos:['书房'],note:'原双人桌移到沙发后，窗边留给孩子活动与临时留宿。整排暖灰柜门、木色开放格和隐藏床组合，客床向横厅一侧展开。'},
 {id:'loungeBalcony',name:'窗边休闲区',tag:'阳台融入客厅',box:[6.1,8.4,9.75,9.8],area:'5.11',material:'stone',photos:['客厅1'],note:'移除客厅与阳台之间的移门、保留外侧窗，地面与横厅连续；窗边搭配软包休闲椅、边几和落地灯，延展客厅的日常活动空间。'},
 {id:'laundry',name:'洗烘阳台',tag:'上下水留在原位',box:[9.95,8.4,12.75,9.8],area:'3.92',material:'stone',photos:['次卧'],note:'保留次卧外阳台洗烘功能。叠放洗衣机和烘干机，旁设台盆及操作台；具体左右点位待交付水电图确认。'},
 {id:'hall',name:'走道',tag:'串联家里的每一天',box:[3.2,4.9,6.1,6],material:'stone',photos:[],note:'连接客餐厅、书房、主卧与公卫，不增加隔断。'},
 {id:'storage',name:'储藏间',tag:'方正空间里的有序收纳',box:[10.9,2.95,12.65,4.7],material:'stone',photos:['沙盘朝向对齐'],note:'依据沙盘修正为方正空间，暂按约 1.75 × 1.75 米设计。八百库风格的金属立柱、可调层板、抽屉及收纳箱沿两侧布置，门口和中央通道留空；净尺寸待实测。'},
 {id:'exterior',name:'北侧连廊与电梯厅',tag:'从连廊走到家门口',box:[0,-2.6,12.75,2.75],floorRects:[[0,-.2,5.6,1.15],[3.5,-2.6,5.6,-.2],[5.6,-2.6,12.75,-.2],[10.9,0,12.75,2.75]],label:[8.7,-1.4],material:'outdoor',photos:['沙盘朝向对齐','售楼处沙盘'],note:'根据沙盘补出北侧空中连廊、栏杆、电梯厅及电梯井外壳。连廊与卫生间外墙之间保留镂空，设备平台从公共区进入。公共区域轮廓与尺寸为比例示意。'},
 {id:'platform',name:'户外设备平台',tag:'公共走廊内的独立空间',box:[3.6,-4.7,5.35,-2.7],material:'outdoor',photos:['沙盘朝向对齐','户型原图'],note:'位于连廊与电梯厅交接处北侧，经公共区单独进入，与室内厨房不连通。位置按沙盘关系示意，未纳入住宅室内面积或改造。'}
];
export const extraFloors=[{id:'entry',box:[9.75,3.35,10.7,4.9]},{id:'study',box:[5.9,6,6.1,9.8]},{id:'study',box:[3.2,8.25,5.9,8.4]},{id:'living',box:[6.1,8.25,9.75,8.4]},{id:'master',box:[.25,9.4,2.75,10.1]}];
export const exteriorRooms=['exterior','platform'];
export const socialRooms=['living','study','studioBalcony','loungeBalcony'];
export const tvStops={living:[9.15,7.05,-Math.PI/2],dining:[9.15,3.6,-Math.PI/2],study:[6.7,5.1,-Math.PI/2]};
// Solid segments shared by both views. Gaps below are actual openings, not overlaid doors.
export const walls=[];
function w(a,b,owners,options={}){walls.push({a,b,owners,...options});}
function h(x1,x2,z,owners,options){w([x1,z],[x2,z],owners,options);}
function v(x,z1,z2,owners,options){w([x,z1],[x,z2],owners,options);}
v(-.1,2.9,9.5,['master','ensuite']);v(12.85,4.8,9.9,['secondary','laundry']);
h(-.1,5.6,2.9,['bath','ensuite'],{window:true});v(5.6,0,.7,['kitchen']);v(5.6,.7,2.3,['kitchen'],{window:true});v(5.6,2.3,2.9,['kitchen']);
h(5.6,8.5,-.1,['kitchen']);h(8.5,8.85,-.1,['entry']);h(9.95,10.8,-.1,['entry']);v(10.8,-.1,2.85,['entry','exterior']);


v(2.75,2.9,4.8,['bath','ensuite']);v(5.6,2.9,4.8,['bath','living']);
h(-.1,1.85,4.8,['master','ensuite']);h(2.65,4.4,4.8,['bath','ensuite','hall']);h(5.2,5.6,4.8,['bath','hall']);
v(3.1,4.8,5,['master','hall']);v(3.1,5.85,9.5,['master','study','studioBalcony']);


v(9.85,4.8,8.325,['secondary','living'],{feature:'marble'});v(9.85,8.325,9.9,['laundry','loungeBalcony']);
h(9.85,10.05,4.8,['secondary']);h(10.9,12.85,4.8,['secondary','storage']);
h(10.8,12.85,2.85,['storage','exterior']);v(12.75,2.85,4.8,['storage']);v(10.8,2.85,3.85,['storage','entry']);
h(-.1,.25,9.5,['master']);h(2.75,3.1,9.5,['master']);v(.25,9.5,10.1,['master'],{bay:true});v(2.75,9.5,10.1,['master'],{bay:true});h(.25,2.75,10.1,['master'],{window:true,bay:true});


h(9.85,10.3,8.325,['secondary','laundry']);h(12.4,12.85,8.325,['secondary','laundry']);
h(3.1,12.85,9.9,['studioBalcony','loungeBalcony','laundry'],{glass:true});
v(3.5,-4.8,-2.6,['platform']);v(5.45,-4.8,-2.6,['platform']);h(3.5,5.45,-4.8,['platform'],{glass:true});h(3.5,3.85,-2.6,['platform']);h(4.75,5.45,-2.6,['platform']);
// Public skybridge wraps around an open void; elevator shaft is outside the apartment.
h(0,3.5,-.2,['exterior'],{railing:true});h(0,5.5,1.15,['exterior'],{railing:true});v(0,-.2,1.15,['exterior'],{railing:true});v(3.5,-2.6,-.2,['exterior'],{railing:true});
h(5.6,12.85,-2.7,['exterior']);v(12.85,-2.7,2.85,['exterior']);h(10.8,11.28,-.1,['exterior']);h(12.3,12.85,-.1,['exterior']);
// Split long shared segments at room limits, so a room view never shows another room's wall tail.
const unsegmented=walls.splice(0);
for(const wall of unsegmented){
 const horizontal=wall.a[1]===wall.b[1],axis=horizontal?0:1,lo=wall.a[axis],hi=wall.b[axis];
 const cuts=[lo,hi];for(const value of horizontal?[2.75,3.1,5.6,6,8.5,9.85,10.8]:[2.7,2.9,3.6,4.8,6.075,8.325])if(value>lo+.001&&value<hi-.001)cuts.push(value);
 const pieces=[];cuts.sort((a,b)=>a-b);for(let i=1;i<cuts.length;i++){if(cuts[i]-cuts[i-1]<.001)continue;const a=[...wall.a],b=[...wall.b];a[axis]=cuts[i-1];b[axis]=cuts[i];const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
 const owners=wall.owners.filter(id=>{const r=rooms.find(r=>r.id===id),[x,z,X,Z]=r.box;return mx>=x-.22&&mx<=X+.22&&mz>=z-.22&&mz<=Z+.22;});
 const owned=owners.length?owners:wall.owners;const prev=pieces.at(-1);if(prev&&prev.owners.join()===owned.join())prev.b=b;else pieces.push({...wall,a,b,owners:owned});}
 walls.push(...pieces);
}
export const openings=[
 {id:'kitchenOpen',a:[6.35,2.7],b:[8.5,2.7],owners:['kitchen','living'],type:'open'},
 {id:'kitchenEntry',a:[8.5,.8],b:[8.5,2.7],owners:['kitchen','entry'],type:'open'},
 {id:'entrance',a:[8.85,-.1],b:[9.95,-.1],owners:['entry'],type:'door'},
 {id:'masterDoor',a:[3.1,5],b:[3.1,5.85],owners:['master','hall'],type:'door'},
 {id:'secondaryDoor',a:[10.05,4.8],b:[10.9,4.8],owners:['secondary'],type:'door'},
 {id:'bathDoor',a:[4.4,4.8],b:[5.2,4.8],owners:['bath','hall'],type:'door'},
 {id:'ensuiteDoor',a:[1.85,4.8],b:[2.65,4.8],owners:['master','ensuite'],type:'door'},
 {id:'laundryGlass',a:[10.3,8.325],b:[12.4,8.325],owners:['secondary','laundry'],type:'slider'},
 {id:'storageDoor',a:[10.8,3.85],b:[10.8,4.7],owners:['storage','entry'],type:'door'},
 {id:'platformDoor',a:[3.85,-2.6],b:[4.75,-2.6],owners:['platform','exterior'],type:'door'},
 {id:'elevatorDoor',a:[11.28,-.1],b:[12.3,-.1],owners:['exterior'],type:'lift'}
];
export const furniture=[]; // Populated once by model construction, used by the plan and geometry checks.
