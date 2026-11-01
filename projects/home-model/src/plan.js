import {rooms,walls,openings,furniture,extraFloors,tvStops} from './layout.js';
export function planSVG(state){
 const scale=60,ox=45,oz=325,px=x=>+(ox+x*scale).toFixed(2),pz=z=>+(oz+z*scale).toFixed(2);
 const colors={wood:'#e4d4b8',stone:'#eeebe0',bath:'#d2d8d3',outdoor:'#e3e5da'};
 let a=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 855 990"><rect width="855" height="990" fill="#fbfaf5"/><style>text{font-family:'PingFang SC','Microsoft YaHei',sans-serif;fill:#56604b} .small{font-size:9px;fill:#8b9381}</style><text x="42" y="28" font-size="19">A2 · 我们的家</text><text x="42" y="49" class="small">方案平面示意 / 主卧在左 · 次卧在右 / 单位 m</text>`];
 function rect(x,z,w,d,fill,stroke='none',rx=0){a.push(`<rect x="${px(x)}" y="${pz(z)}" width="${w*scale}" height="${d*scale}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`);}

 for(const r of rooms){for(const [x,z,X,Z] of r.floorRects||[r.box])rect(x,z,X-x,Z-z,colors[r.material]);}
 for(const f of extraFloors){let[x,z,X,Z]=f.box;rect(x,z,X-x,Z-z,'#eeebe0');}
 for(const f of furniture){if(f.id==='tv'||(f.id==='guestBed'&&!state.bed))continue;let fill=f.dynamic?'#9daa88':f.id==='livingRug'?'#d4cdbb':'#d0c2a7';rect(f.x-f.w/2,f.z-f.d/2,f.w,f.d,fill,'#b6ac96',3);if(f.id==='masterBed')rect(f.x-1.045,f.z-.925,.13,1.85,'#9d917c','none',2);}
 a.push(`<text x="${px(2.5)}" y="${pz(2.05)}" text-anchor="middle" class="small">室外镂空 · 非室内地面</text><text x="${px(11.8)}" y="${pz(1.3)}" text-anchor="middle" class="small">电梯井</text>`);
 // Television's plan footprint follows the same state as the 3D object.
 const tv=tvStops[state.tv];rect(tv[0]-.22,tv[1]-.49,.44,.98,'#606c56');
 for(const w of walls)a.push(`<line x1="${px(w.a[0])}" y1="${pz(w.a[1])}" x2="${px(w.b[0])}" y2="${pz(w.b[1])}" stroke="${w.glass||w.railing?'#9bac9f':'#646a5b'}" stroke-width="${w.glass||w.railing?3:9}"/>`);
 for(const o of openings){if(o.type==='open')continue;const x1=px(o.a[0]),y1=pz(o.a[1]),x2=px(o.b[0]),y2=pz(o.b[1]);if(o.type==='door'){const dx=x2-x1,dy=y2-y1;let sign=o.id==='entrance'?-1:1;a.push(`<path d="M ${x1} ${y1} l ${-dy*sign} ${dx*sign} M ${x2} ${y2} Q ${x2-dy*sign} ${y2+dx*sign} ${x1-dy*sign} ${y1+dx*sign}" fill="none" stroke="#a5ad98" stroke-width="1"/>`);}else a.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#95aaa0" stroke-width="3"/>`);}
 for(const r of rooms){let[x,z,X,Z]=r.box;let zz=(z+Z)/2;let cx=(x+X)/2;if(r.label){[cx,zz]=r.label;}if(['master','secondary','study'].includes(r.id))zz=Z-.3;if(r.id==='living')zz=5.4;a.push(`<text x="${px(cx)}" y="${pz(zz)}" text-anchor="middle" font-size="12">${r.name}</text>`);if(r.area)a.push(`<text x="${px(cx)}" y="${pz(zz)+14}" text-anchor="middle" class="small">原标注 ${r.area} m²</text>`);}
 a.push(`<text x="${px(9.4)}" y="${pz(-.4)}" text-anchor="middle" font-size="12">↓ 入户</text><text x="44" y="955" class="small">尺寸参考上传的分析图，家具、柜体及飘窗尺寸为设计估计。非施工图，不以建面 123 m² 推算室内面积。</text><text x="44" y="974" class="small">横厅连通与阳台改造以结构、围护条件和物业要求为前提。设备平台经公共走廊独立进入。</text></svg>`);return a.join('');
}
