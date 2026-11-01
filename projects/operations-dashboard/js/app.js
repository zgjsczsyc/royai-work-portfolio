const D = window.__DEMO_DATA__;
const $ = id => document.getElementById(id);
const fmt = n => n==null?'--':(n>=10000?(n/10000).toFixed(1)+'万':Math.round(n).toLocaleString('zh-CN'));
const fmtInt = n => n==null?'--':Math.round(n).toLocaleString('zh-CN');
const md = s => String(s).slice(5);
const pctDelta = (cur, prev) => (prev==null||prev===0) ? null : (cur/prev-1)*100;
const deltaHtml = d => d==null ? '' : `<span class="delta ${d>=0?'up':'down'}">${d>=0?'↑':'↓'}${Math.abs(d).toFixed(1)}%</span>`;

// 预处理：每用户渠道首用日
D.users.forEach(u=>{
  u.fw = u.w.length ? u.w[0][0] : Infinity;
  u.fe = u.e.length ? u.e[0][0] : Infinity;
  u.f  = Math.min(u.fw, u.fe);
});
const N = D.dates.length;
const state = { range: 30, ch: 'all' };

function pairsOf(u, ch){ return ch==='web' ? u.w : ch==='de' ? u.e : null; }

// 核心聚合：给定窗口与渠道
function aggregate(start, end, ch){
  const len = end - start + 1;
  const A = {
    len, pv:0, webPv:0, dePv:0,
    pvDay:Array(len).fill(0), webDay:Array(len).fill(0), deDay:Array(len).fill(0),
    usersDay:Array(len).fill(0), newDay:Array(len).fill(0), retDay:Array(len).fill(0),
    users:0, newUserIds:new Set(), activeIds:new Set(),
    dept:new Map(), userRows:[],
    workPv:0, wePv:0, workDays:0, weDays:0,
    daySum:0,
  };
  for (const u of D.users){
    const firstCh = ch==='web' ? u.fw : ch==='de' ? u.fe : u.f;
    let pv=0, webPv=0, dePv=0;
    const daySet = new Set();
    const push = (arr, di, v) => { arr[di-start] += v; };
    if (ch !== 'de'){
      for (const [di, v] of u.w){
        if (di<start || di>end) continue;
        pv+=v; webPv+=v; daySet.add(di); push(A.webDay, di, v); push(A.pvDay, di, v);
      }
    }
    if (ch !== 'web'){
      for (const [di, v] of u.e){
        if (di<start || di>end) continue;
        pv+=v; dePv+=v; daySet.add(di); push(A.deDay, di, v); push(A.pvDay, di, v);
      }
    }
    if (pv === 0) continue;
    A.pv += pv; A.webPv += webPv; A.dePv += dePv;
    A.activeIds.add(u.i);
    if (firstCh >= start && firstCh <= end) A.newUserIds.add(u.i);
    // 日活跃/新增/回访
    for (const di of daySet){
      A.usersDay[di-start] += 1;
      if (di === firstCh) A.newDay[di-start] += 1; else A.retDay[di-start] += 1;
    }
    A.daySum += daySet.size;
    // 工作日/周末 PV（覆盖所选渠道的全部数组）
    const srcs = ch==='de' ? [u.e] : ch==='web' ? [u.w] : [u.w, u.e];
    for (const arr of srcs) for (const [di, v] of arr){
      if (di<start || di>end) continue;
      const dow = new Date(D.dates[di]).getDay();
      if (dow===0||dow===6) A.wePv += v; else A.workPv += v;
    }
    // 部门
    let dRow = A.dept.get(u.d);
    if (!dRow){ dRow = {name:u.d, pv:0, dePv:0, users:new Set(), news:new Set()}; A.dept.set(u.d, dRow); }
    dRow.pv += pv; dRow.dePv += dePv; dRow.users.add(u.i);
    if (firstCh >= start && firstCh <= end) dRow.news.add(u.i);
    A.userRows.push({id:u.i, name:u.n, dept:u.d, days:daySet.size, pv, dePv});
  }
  // 工作日天数
  for (let di=start; di<=end; di++){
    const dow = new Date(D.dates[di]).getDay();
    if (dow===0||dow===6) A.weDays++; else A.workDays++;
  }
  A.users = A.activeIds.size;
  A.newUsers = A.newUserIds.size;
  A.ppu = A.users ? A.pv/A.users : 0;
  A.avgDays = A.users ? A.daySum/A.users : 0;
  A.workAvg = A.workDays ? A.workPv/A.workDays : 0;
  A.weAvg = A.weDays ? A.wePv/A.weDays : 0;
  return A;
}

// 分层阈值（随范围自适应）
function layerBounds(len){
  return { heavy: Math.max(4, Math.round(len*0.25)), mid: Math.max(3, Math.round(len*0.12)) };
}

const charts = {};
function C(id){ if(!charts[id]) charts[id] = echarts.init($(id)); return charts[id]; }
const baseGrid = {left:50, right:30, top:40, bottom:40, containLabel:true};
const axisStyle = {
  axisLine:{lineStyle:{color:'#E6E9F0'}}, axisTick:{show:false},
  axisLabel:{color:'#8A94A6', fontSize:11}, splitLine:{lineStyle:{color:'#F0F2F6', type:'dashed'}}
};
const tooltipStyle = {
  backgroundColor:'rgba(255,255,255,.96)', borderColor:'#E6E9F0', borderWidth:1,
  textStyle:{color:'#1F2733', fontSize:12},
  extraCssText:'box-shadow:0 4px 12px rgba(31,39,51,.08); border-radius:8px;'
};

function render(){
  const end = N-1;
  const start = state.range==='all' ? 0 : Math.max(0, end-state.range+1);
  const len = end-start+1;
  const A = aggregate(start, end, state.ch);
  // 环比窗口
  const pEnd = start-1, pStart = pEnd-len+1;
  const P = pStart >= 0 ? aggregate(pStart, pEnd, state.ch) : null;

  $('rangeLbl').textContent = `${md(D.dates[start])} ~ ${md(D.dates[end])} · ${len} 天`;

  // ===== KPI =====
  $('kPv').textContent = fmt(A.pv);
  $('kPvAvg').textContent = fmtInt(A.pv/len);
  $('kPvDelta').innerHTML = deltaHtml(pctDelta(A.pv, P?P.pv:null));
  $('kUsers').textContent = fmtInt(A.users);
  $('kNew').textContent = fmtInt(A.newUsers);
  $('kUsersDelta').innerHTML = deltaHtml(pctDelta(A.users, P?P.users:null));
  $('kPpu').textContent = A.ppu.toFixed(1);
  $('kDays').textContent = A.avgDays.toFixed(2);
  $('kDepts').textContent = A.dept.size;
  $('kDeptsAll').textContent = new Set(D.users.map(u=>u.d)).size;
  $('kDePct').textContent = state.ch==='web' ? '--' : (A.pv ? (A.dePv/A.pv*100).toFixed(1)+'%' : '--');
  $('kDePv').textContent = fmtInt(A.dePv);
  $('kWk').textContent = fmtInt(A.workAvg);
  $('kWe').textContent = fmtInt(A.weAvg);
  $('kWeRatio').textContent = A.workAvg ? (A.weAvg/A.workAvg*100).toFixed(1)+'%' : '--';

  // ===== 趋势 =====
  const dLabels = D.dates.slice(start, end+1).map(md);
  $('trendSub').textContent = `范围 ${md(D.dates[start])} ~ ${md(D.dates[end])} · 渠道=${state.ch==='all'?'全部':state.ch==='web'?'真人Web':'数字员工'}`;
  $('trendTag').textContent = state.ch==='all' ? '堆叠=Web+数字员工 / 线=活跃人数' : '柱=PV / 线=活跃人数';
  const trendSeries = [];
  if (state.ch !== 'de') trendSeries.push({
    name:'真人Web PV', type:'bar', stack:'pv', data:A.webDay, barMaxWidth:14,
    itemStyle:{color:'#3370FF', borderRadius:[0,0,0,0]}});
  if (state.ch !== 'web') trendSeries.push({
    name:'数字员工 PV', type:'bar', stack:'pv', data:A.deDay, barMaxWidth:14,
    itemStyle:{color:'#7C6FE8', borderRadius:[3,3,0,0]}});
  trendSeries.push({
    name:'活跃人数', type:'line', yAxisIndex:1, data:A.usersDay, smooth:true,
    symbol:'none', lineStyle:{color:'#F5A623', width:2}});
  C('chartTrend').setOption({
    tooltip:{trigger:'axis', ...tooltipStyle, axisPointer:{type:'shadow'}},
    legend:{right:10, top:6, textStyle:{color:'#5A6472', fontSize:11}, itemWidth:12, itemHeight:8},
    grid:baseGrid,
    xAxis:{type:'category', data:dLabels, ...axisStyle, axisLabel:{...axisStyle.axisLabel, interval:Math.ceil(len/15)}},
    yAxis:[{type:'value', name:'PV', ...axisStyle, nameTextStyle:{color:'#8A94A6', fontSize:11}},
           {type:'value', name:'人数', ...axisStyle, nameTextStyle:{color:'#8A94A6', fontSize:11}, splitLine:{show:false}}],
    series:trendSeries
  }, true);

  C('chartNewRet').setOption({
    tooltip:{trigger:'axis', ...tooltipStyle, axisPointer:{type:'shadow'}},
    legend:{right:10, top:6, textStyle:{color:'#5A6472', fontSize:11}, itemWidth:12, itemHeight:8},
    grid:baseGrid,
    xAxis:{type:'category', data:dLabels, ...axisStyle, axisLabel:{...axisStyle.axisLabel, interval:Math.ceil(len/8)}},
    yAxis:{type:'value', ...axisStyle},
    series:[
      {name:'新增用户', type:'bar', stack:'u', data:A.newDay, itemStyle:{color:'#27AE60'}, barMaxWidth:14},
      {name:'回访用户', type:'bar', stack:'u', data:A.retDay, itemStyle:{color:'#8FB0FF', borderRadius:[3,3,0,0]}, barMaxWidth:14}
    ]
  }, true);
  const newShare = A.users ? (A.newUsers/A.users*100) : 0;
  $('insNew').innerHTML = `范围内活跃 <b>${fmtInt(A.users)}</b> 人，其中新增 <b>${fmtInt(A.newUsers)}</b> 人（<b>${newShare.toFixed(1)}%</b>）、回访 <b>${fmtInt(A.users-A.newUsers)}</b> 人。`+
    (newShare>50 ? '新增占比过半，处于<b>拉新驱动期</b>，重点看承接与留存。' : '回访占主导，进入<b>存量运营期</b>，重点看活跃深度与频次。');

  // ===== 渠道结构 =====
  $('chTag').textContent = D.meta.has_de ? `数字员工 ${D.meta.de_first_idx!=null?md(D.dates[D.meta.de_first_idx]):''} 起埋点` : '无数字员工数据';
  C('chartChannel').setOption({
    tooltip:{trigger:'axis', ...tooltipStyle, axisPointer:{type:'cross'}},
    legend:{right:10, top:6, textStyle:{color:'#5A6472', fontSize:11}, itemWidth:12, itemHeight:8},
    grid:baseGrid,
    xAxis:{type:'category', data:dLabels, boundaryGap:false, ...axisStyle, axisLabel:{...axisStyle.axisLabel, interval:Math.ceil(len/15)}},
    yAxis:{type:'value', ...axisStyle},
    series:[
      {name:'真人Web PV', type:'line', stack:'c', smooth:true, symbol:'none',
       areaStyle:{color:'rgba(51,112,255,.25)'}, lineStyle:{color:'#3370FF', width:1.5}, data:A.webDay},
      {name:'数字员工 PV', type:'line', stack:'c', smooth:true, symbol:'none',
       areaStyle:{color:'rgba(124,111,232,.45)'}, lineStyle:{color:'#7C6FE8', width:1.5}, data:A.deDay}
    ]
  }, true);
  const half = Math.floor(len/2);
  const de1 = A.deDay.slice(0, half).reduce((s,v)=>s+v,0);
  const de2 = A.deDay.slice(half).reduce((s,v)=>s+v,0);
  $('insChannel').innerHTML = `范围内数字员工 PV <b>${fmtInt(A.dePv)}</b>（占 <b>${A.pv?(A.dePv/A.pv*100).toFixed(1):0}%</b>）、真人Web <b>${fmtInt(A.webPv)}</b>。`+
    (de1>0 ? `范围后半程数字员工 ${fmtInt(de2)} PV vs 前半程 ${fmtInt(de1)} PV（<b>${((de2/de1-1)*100).toFixed(1)}%</b>）。` : '')+
    `渠道结构建议进周度北极星：真人渗透看 Web，业务嵌入看数字员工。`;

  // ===== 部门 =====
  const deptRows = [...A.dept.values()].sort((a,b)=>b.pv-a.pv);
  const dTop = deptRows.slice(0,12).reverse();
  C('chartDept').setOption({
    tooltip:{trigger:'axis', ...tooltipStyle, axisPointer:{type:'shadow'},
      formatter:p=>{const r=dTop[p[0].dataIndex]; return `<b>${r.name}</b><br>PV: ${fmtInt(r.pv)}<br>活跃: ${r.users.size} 人<br>新增: ${r.news.size} 人<br>数字员工PV: ${fmtInt(r.dePv)}`;}},
    grid:{...baseGrid, left:140, right:60},
    xAxis:{type:'value', ...axisStyle},
    yAxis:{type:'category', data:dTop.map(r=>r.name), ...axisStyle, axisLabel:{...axisStyle.axisLabel, fontSize:11.5}},
    series:[{type:'bar', data:dTop.map(r=>r.pv), barMaxWidth:16,
      itemStyle:{color:p=>(dTop.length-1-p.dataIndex)<3?'#3370FF':'#8FB0FF', borderRadius:[0,4,4,0]},
      label:{show:true, position:'right', formatter:p=>fmt(p.value), color:'#5A6472', fontSize:10.5}}]
  }, true);
  const tb = document.querySelector('#tblDept tbody');
  tb.innerHTML = deptRows.map(r=>`<tr>
    <td><b>${r.name}</b></td>
    <td class="num">${fmtInt(r.pv)}</td>
    <td class="num">${r.users.size}</td>
    <td class="num">${r.news.size}</td>
    <td class="num">${(r.pv/r.users.size).toFixed(1)}</td>
    <td class="num" style="color:#7C6FE8">${r.dePv?fmtInt(r.dePv):'-'}</td>
    <td class="num">${(r.pv/A.pv*100).toFixed(1)}%</td>
  </tr>`).join('');
  const d0 = deptRows[0], d1r = deptRows[1];
  const deepDept = deptRows.filter(r=>r.pv>0).map(r=>({n:r.name, s:r.dePv/r.pv*100, pv:r.dePv}))
                           .filter(x=>x.pv>=100).sort((a,b)=>b.s-a.s)[0];
  $('insDept').innerHTML = `<b>${d0.name}</b> 以 ${fmtInt(d0.pv)} PV 居首（占 ${(d0.pv/A.pv*100).toFixed(1)}%），其次 ${d1r?d1r.name:'--'}；`+
    (deepDept ? `数字员工渗透最深的是 <b>${deepDept.n}</b>（数字员工 PV 占该部门 ${deepDept.s.toFixed(1)}%）。` : '')+
    `人均 PV 最高部门：${deptRows.filter(r=>r.users.size>=5).sort((a,b)=>(b.pv/b.users.size)-(a.pv/a.users.size))[0]?.name ?? '--'}，可作为深度使用案例来源。`;

  // ===== 分层 =====
  const {heavy, mid} = layerBounds(len);
  const buckets = [
    {label:`高频(≥${heavy}天)`, test:d=>d>=heavy, color:'#7C6FE8'},
    {label:`中频(${mid}-${heavy-1}天)`, test:d=>d>=mid&&d<heavy, color:'#3370FF'},
    {label:`低频(2-${mid-1}天)`, test:d=>d===2||(d>2&&d<mid), color:'#8FB0FF'},
    {label:'试用(1天)', test:d=>d===1, color:'#F5A623'},
  ];
  buckets.forEach(b=>{b.users=0; b.pv=0;});
  A.userRows.forEach(r=>{ const b = buckets.find(b=>b.test(r.days)); if(b){b.users++; b.pv+=r.pv;} });
  $('layerTag').textContent = `高频≥${heavy}天 / 中频≥${mid}天 / 低频2天 / 试用1天`;
  $('layerSub').textContent = `按范围内活跃天数划分（${len} 天窗口）`;
  C('chartLayer').setOption({
    tooltip:{trigger:'axis', ...tooltipStyle, axisPointer:{type:'shadow'}},
    legend:{right:10, top:6, textStyle:{color:'#5A6472', fontSize:11}, itemWidth:12, itemHeight:8},
    grid:{...baseGrid, left:60, right:60},
    xAxis:{type:'category', data:buckets.map(b=>b.label), ...axisStyle, axisLabel:{...axisStyle.axisLabel, fontSize:11, interval:0}},
    yAxis:[{type:'value', name:'人数', ...axisStyle, nameTextStyle:{color:'#8A94A6', fontSize:11}},
           {type:'value', name:'PV', ...axisStyle, nameTextStyle:{color:'#8A94A6', fontSize:11}, splitLine:{show:false}}],
    series:[
      {name:'人数', type:'bar', data:buckets.map(b=>b.users), barMaxWidth:30,
       itemStyle:{color:'#3370FF', borderRadius:[4,4,0,0]},
       label:{show:true, position:'top', formatter:p=>fmtInt(p.value), color:'#1F2733', fontSize:11, fontWeight:600}},
      {name:'PV', type:'bar', yAxisIndex:1, data:buckets.map(b=>b.pv), barMaxWidth:30,
       itemStyle:{color:'#7C6FE8', borderRadius:[4,4,0,0]},
       label:{show:true, position:'top', formatter:p=>fmt(p.value), color:'#7C6FE8', fontSize:11, fontWeight:600}}
    ]
  }, true);
  const b0 = buckets[0], b3 = buckets[3];
  $('insLayer').innerHTML = `<b>${(b0.users/A.users*100).toFixed(1)}% 高频用户（${b0.users} 人）贡献 ${(b0.pv/A.pv*100).toFixed(1)}% PV；`+
    `${(b3.users/A.users*100).toFixed(1)}% 试用用户（${fmtInt(b3.users)} 人）贡献 ${(b3.pv/A.pv*100).toFixed(1)}% PV。</b>`+
    `试用→低频转化是常态化运营的主杠杆：关注试用层 7 日内二次触达与场景引导。`;

  const topRows = A.userRows.sort((a,b)=>b.pv-a.pv).slice(0,20);
  document.querySelector('#tblTop tbody').innerHTML = topRows.map((r,i)=>`<tr>
    <td style="color:#8A94A6">${i+1}</td>
    <td style="font-family:monospace; font-size:11.5px">${r.id}</td>
    <td><b>${r.name}</b></td>
    <td style="color:#5A6472">${r.dept}</td>
    <td class="num">${r.days}</td>
    <td class="num"><b>${fmtInt(r.pv)}</b></td>
    <td class="num" style="color:#7C6FE8">${r.dePv?fmtInt(r.dePv):'-'}</td>
  </tr>`).join('');

  // ===== 数字员工（独立于渠道筛选，跟随时间范围） =====
  const DE = aggregate(start, end, 'de');
  const WEB = aggregate(start, end, 'web');
  $('deSub').textContent = `范围 ${md(D.dates[start])} ~ ${md(D.dates[end])} · 来源=合成数字员工`;
  $('dPv').textContent = fmtInt(DE.pv);
  $('dPct').textContent = A.pv ? (DE.pv/aggregate(start,end,'all').pv*100).toFixed(1)+'%' : '--';
  $('dUsers').textContent = fmtInt(DE.users);
  const deIds = new Set(DE.activeIds), webIds = new Set(WEB.activeIds);
  const deOnly = [...deIds].filter(id=>!webIds.has(id)).length;
  $('dOnly').textContent = fmtInt(deOnly);
  $('dPpu').textContent = DE.users ? (DE.pv/DE.users).toFixed(1) : '--';
  $('dWebPpu').textContent = WEB.users ? (WEB.pv/WEB.users).toFixed(1) : '--';
  $('dWow').textContent = de1>0 ? ((de2/de1-1)*100>=0?'+':'')+((de2/de1-1)*100).toFixed(1)+'%' : '--';
  $('dHalf1').textContent = fmtInt(de1);
  $('dHalf2').textContent = fmtInt(de2);
  C('chartDeDaily').setOption({
    tooltip:{trigger:'axis', ...tooltipStyle, axisPointer:{type:'shadow'}},
    legend:{right:10, top:6, textStyle:{color:'#5A6472', fontSize:11}, itemWidth:12, itemHeight:8},
    grid:baseGrid,
    xAxis:{type:'category', data:dLabels, ...axisStyle, axisLabel:{...axisStyle.axisLabel, interval:Math.ceil(len/12)}},
    yAxis:[{type:'value', name:'PV', ...axisStyle, nameTextStyle:{color:'#8A94A6', fontSize:11}},
           {type:'value', name:'人数', ...axisStyle, nameTextStyle:{color:'#8A94A6', fontSize:11}, splitLine:{show:false}}],
    series:[
      {name:'数字员工PV', type:'bar', data:DE.pvDay, barMaxWidth:14, itemStyle:{color:'#7C6FE8', borderRadius:[3,3,0,0]}},
      {name:'调用人数', type:'line', yAxisIndex:1, data:DE.usersDay, smooth:true, symbol:'none',
       lineStyle:{color:'#F5A623', width:2}}
    ]
  }, true);
  const deDeptRows = [...DE.dept.values()].sort((a,b)=>b.pv-a.pv);
  const deDeptTop = deDeptRows.slice(0,10).reverse();
  const allDeptPv = new Map(deptRows.map(r=>[r.name, r.pv]));
  C('chartDeDept').setOption({
    tooltip:{trigger:'axis', ...tooltipStyle, axisPointer:{type:'shadow'},
      formatter:p=>{const r=deDeptTop[p[0].dataIndex]; const tot=allDeptPv.get(r.name)||r.pv;
        return `<b>${r.name}</b><br>数字员工PV: ${fmtInt(r.pv)}<br>调用人数: ${r.users.size}<br>占该部门PV: ${(r.pv/tot*100).toFixed(1)}%`;}},
    grid:{...baseGrid, left:130, right:80},
    xAxis:{type:'value', ...axisStyle},
    yAxis:{type:'category', data:deDeptTop.map(r=>r.name), ...axisStyle, axisLabel:{...axisStyle.axisLabel, fontSize:11.5}},
    series:[{type:'bar', data:deDeptTop.map(r=>r.pv), barMaxWidth:14,
      itemStyle:{color:p=>{const tot=allDeptPv.get(deDeptTop[p.dataIndex].name)||1; return deDeptTop[p.dataIndex].pv/tot>=0.2?'#7C6FE8':'#B7AFF0';}, borderRadius:[0,4,4,0]},
      label:{show:true, position:'right',
        formatter:p=>{const tot=allDeptPv.get(deDeptTop[p.dataIndex].name)||1; return `${fmtInt(p.value)} · ${(deDeptTop[p.dataIndex].pv/tot*100).toFixed(0)}%`;},
        color:'#5A6472', fontSize:10.5}}]
  }, true);
  const dd0 = deDeptRows[0];
  $('insDe').innerHTML = dd0
    ? `数字员工调用集中在 <b>${dd0.name}</b>（${fmtInt(dd0.pv)} PV、${dd0.users.size} 人）；仅通过数字员工使用AI 平台的有 <b>${fmtInt(deOnly)}</b> 人——数字员工是触达 Web 推广覆盖不到人群的增量入口。建议对高渗透部门沉淀场景模板，对仅数字员工用户补 Web 自主使用引导。`
    : '当前范围内无数字员工调用。';
}

// ===== 筛选器 =====
document.querySelectorAll('#segRange button').forEach(b=>b.addEventListener('click', ()=>{
  document.querySelectorAll('#segRange button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  state.range = b.dataset.r==='all' ? 'all' : parseInt(b.dataset.r,10);
  render();
}));
document.querySelectorAll('#segCh button').forEach(b=>b.addEventListener('click', ()=>{
  document.querySelectorAll('#segCh button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  state.ch = b.dataset.c;
  render();
}));
window.addEventListener('resize', ()=>Object.values(charts).forEach(c=>c.resize()));
render();
