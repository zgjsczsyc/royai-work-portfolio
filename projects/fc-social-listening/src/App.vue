<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue';
const RadarChart = defineAsyncComponent(() => import('./RadarChart.vue'));
import type { State, RadarEvent, Source } from './types';
const state = ref<State | null>(null), loading = ref(false), error = ref('');
const page = ref('overview'), selectedId = ref(''), help = ref(false);
const view = ref('fc'), search = ref(''), platform = ref('all'), category = ref('all'), sentiment = ref('all'), product = ref('all'), days = ref(7), minRelevance = ref(0), minImpact = ref(0);
const names: Record<string, string> = { bilibili: 'B站', weibo: '微博', xiaohongshu: '小红书' };
const directions: Record<string, string> = { risk: '风险', opportunity: '机会', mixed: '双向影响', uncertain: '待判断' };
const sentiments: Record<string, string> = { positive: '正面', negative: '负面', neutral: '中性', mixed: '混合' };
const statuses: Record<string, string> = { success: '已采集', partial: '覆盖不完整', needs_login: '需要登录', restricted: '访问受限', parse_failed: '未解析到内容', failed: '采集失败', running: '采集中' };
const confidence: Record<string, string> = { primary: '官方／一手材料', corroborated: '多个独立来源', unverified: '尚待独立核实' };
const stages: Record<string, string> = { announced: '已公布', preregister: '预约中', testing: '测试中', launched: '已上线', unknown: '阶段待确认' };
const eventTypes: Record<string, string> = { preview: '赛前预告', result: '已发生赛果', controversy: '赛事争议', marketing: '赛事活动', partnership: '商业合作' };
const isDemo = computed(() => state.value?.mode === 'demo');
const snapshotMode = import.meta.env.VITE_RADAR_SNAPSHOT === '1';
const excludedCount = computed(() => state.value?.snapshot?.excludedPosts ?? state.value?.analysis?.excludedPostIds.length ?? 0);
const exportUrl = (extension: string) => snapshotMode ? `./report.${extension}` : `/api/export.${extension}`;
const events = computed(() => state.value?.analysis?.events ?? []);
const posts = computed(() => new Map((state.value?.analysis?.posts ?? []).map(p => [p.id, p])));
const focus = computed(() => events.value.filter(e => e.relevance >= 50).slice(0, 3));
const active = computed(() => events.value.find(e => e.id === selectedId.value));
const products = computed(() => [...new Set(events.value.map(e => e.product))]);
const filtered = computed(() => {
  // Fixed captures stay browsable after their original collection window.
  const end = isDemo.value || snapshotMode ? Date.parse(state.value?.analysis?.sourceCutoff ?? new Date().toISOString()) : Date.now();
  return events.value.filter(e => {
    const times = e.evidence.map(ref => posts.value.get(ref.postId)?.publishedAt).filter(Boolean) as string[];
    return (view.value !== 'fc' || e.relevance >= 50) && (view.value !== 'new' || e.categories.includes('热门新游')) && (view.value !== 'esports' || e.categories.includes('电竞赛事')) &&
      (platform.value === 'all' || e.platforms.includes(platform.value)) && (category.value === 'all' || e.categories.includes(category.value)) &&
      (product.value === 'all' || e.product === product.value) && (sentiment.value === 'all' || e.sentiment === sentiment.value) &&
      e.relevance >= minRelevance.value && e.impact >= minImpact.value &&
      (!times.length || times.some(t => Date.parse(t) >= end - days.value * 86400000)) &&
      `${e.title} ${e.summary} ${e.product} ${e.tournamentName ?? ''}`.toLowerCase().includes(search.value.toLowerCase());
  }).sort((a, b) => view.value === 'fc' ? b.priority - a.priority || (b.heatScore ?? -1) - (a.heatScore ?? -1) : (b.heatScore ?? -1) - (a.heatScore ?? -1));
});
const platformCards = computed(() => Object.entries(names).map(([key, name]) => {
  const sources = state.value?.sources.filter(s => s.platform === key) ?? [];
  const worst = ['restricted', 'needs_login', 'failed', 'parse_failed', 'partial', 'success'].find(status => sources.some(s => s.status === status));
  return { key, name, sources, status: worst ?? 'uncollected', count: sources.reduce((n, s) => n + s.count, 0), note: [...new Set(sources.flatMap(s => s.notes))].join('；') };
}));
const pageTitle = computed(() => page.value === 'overview' ? '今日观察' : page.value === 'events' ? '事件中心' : page.value === 'report' ? '本次简报' : '事件详情');
const date = (value?: string | null) => value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)) : '未知';
const number = (n: number | null | undefined) => n == null ? '—' : new Intl.NumberFormat('zh-CN', { notation: n > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n);
const sourceLabel = (s: Source) => s.method === 'synthetic' ? '合成样本' : s.method === 'manual' ? '人工导入' : statuses[s.status] ?? s.status;
async function refresh() {
  loading.value = true; error.value = '';
  try { const res = await fetch(snapshotMode ? './state.json' : '/api/state'); if (!res.ok) throw new Error(snapshotMode ? '无法读取分享快照' : '无法读取本地数据'); state.value = await res.json(); }
  catch (e) { error.value = e instanceof Error ? e.message : '加载失败'; }
  finally { loading.value = false; }
}
function navigate(next: string, id = '') { page.value = next; selectedId.value = id; location.hash = next === 'detail' ? `event/${id}` : next; window.scrollTo(0, 0); }
function readHash() { const [route, id] = location.hash.slice(1).split('/'); page.value = route === 'event' ? 'detail' : ['overview', 'events', 'report'].includes(route) ? route : 'overview'; selectedId.value = id ?? ''; }
function showView(next: string) { view.value = next; navigate('events'); }
onMounted(() => { readHash(); void refresh(); window.addEventListener('hashchange', readHash); });
onBeforeUnmount(() => window.removeEventListener('hashchange', readHash));
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <a href="#overview" class="brand" @click.prevent="navigate('overview')"><span class="brand-mark"><i></i></span><span>FC<span class="brand-light"> SOCIAL RADAR</span><small>游戏舆情与行业观察</small></span></a>
      <div class="workspace"><span class="workspace-icon">FC</span><div><strong>足球世界</strong><small>中国市场 · 社区与内容运营</small></div><span class="workspace-dot"></span></div>
      <span class="nav-heading">工作台</span>
      <nav aria-label="主要导航">
        <button :class="{ active: page === 'overview' }" @click="navigate('overview')"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>今日概览</button>
        <button :class="{ active: page === 'events' || page === 'detail' }" @click="navigate('events')"><svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6M10 7v6"/></svg>事件中心<span class="nav-count">{{ events.length }}</span></button>
        <button :class="{ active: page === 'report' }" @click="navigate('report')"><svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5zM9 11h6M9 15h6M14 3v5h5"/></svg>本次简报</button>
      </nav>
      <span class="nav-heading topic-heading">持续关注</span>
      <div class="topic-links"><button @click="showView('fc')"><i class="dot green"></i>FC 玩家与社区</button><button @click="showView('new')"><i class="dot blue"></i>热门新游戏</button><button @click="showView('esports')"><i class="dot amber"></i>电竞赛事</button><button @click="showView('all')"><i class="dot gray"></i>游戏行业动态</button></div>
      <div class="sidebar-bottom"><div class="local-label"><i class="dot green"></i>{{ snapshotMode ? '只读分享快照' : '本地工作空间' }}</div><p>关注发生了什么，<br>更关注它对 FC 意味着什么。</p><button v-if="!snapshotMode" class="help-button" @click="help = !help">{{ help ? '收起使用说明' : '如何更新观察结果 ↗' }}</button></div>
    </aside>

    <div class="main-shell">
      <header class="topbar"><div class="breadcrumb">工作台 <span>/</span> <strong>{{ pageTitle }}</strong></div><div class="topbar-right"><span class="mode-badge" :class="isDemo ? 'demo' : 'live'">{{ isDemo ? '合成演示' : snapshotMode ? '真实采集快照 · 只读' : '真实数据' }}</span><span class="local-time">北京时间</span><span class="avatar">R</span></div></header>
      <main>
        <div v-if="error" class="banner danger" role="alert">{{ error }}。已有结果仍保留。<button @click="refresh">重试</button></div>
        <div v-if="help" class="help-panel panel"><h3>让 Codex 发起一次监测</h3><p>首次使用先在专用浏览器登录三个平台。之后让 Codex 采集、读取证据并导入分析，再点击“刷新结果”。看板本身不会向模型发送数据。</p><code>npm run radar -- collect</code><code>npm run radar -- prepare-analysis</code><code>npm run radar -- import-analysis --file /分析文件的绝对路径/analysis.json</code></div>
        <div class="page-heading"><div><div class="eyebrow">FC MOBILE / CHINA INTELLIGENCE</div><h1>{{ pageTitle }}<span v-if="page === 'overview'" class="heading-dot">.</span></h1><p>{{ page === 'overview' ? '从玩家声音到行业信号，找到值得行动的下一件事。' : page === 'events' ? '把讨论放回事件中，让热度、关联与影响各有依据。' : page === 'report' ? '保留证据，明确判断，把观察转化为下一步行动。' : '回到原始讨论，理解评分背后的依据与不确定性。' }}</p></div><button class="refresh-button" :disabled="loading" @click="refresh"><span :class="{ spinning: loading }">↻</span>{{ loading ? '读取中' : snapshotMode ? '重新加载快照' : '刷新结果' }}</button></div>
        <div class="context-line"><span v-if="state?.analysis">数据截至 {{ date(state.analysis.sourceCutoff) }} · {{ state.snapshot?.inputPosts ?? state.analysis.posts.length }} 条分析输入样本</span><span v-else>等待第一份已校验分析</span><span v-if="isDemo" class="context-note">全部内容与指标为虚构，不代表真实游戏动态</span><span v-else class="context-note">平台可见检索样本 · 非全网声量</span></div>
        <div v-if="state?.snapshot" class="banner warning">真实采集结果的只读快照，发布于 {{ date(state.snapshot.createdAt) }}。保留 {{ state.analysis?.posts.length }} 条引用证据；待核实结论及覆盖缺口见简报。本页不会发起采集，非 EA 官方产品。</div>
        <div v-if="state?.analysisPending" class="banner warning">{{ state.latestRun?.status === 'running' ? '采集正在进行。' : '最新采集尚未完成分析。' }}{{ state.analysis ? '下方保留上次已校验结果，不代表最新情况。' : '采集状态不等于舆情结论。' }}</div>

        <template v-if="page === 'overview'">
          <section class="platform-grid" aria-label="平台采集状态"><article v-for="p in platformCards" :key="p.key" class="platform-card"><div class="platform-icon" :class="p.key">{{ p.key === 'bilibili' ? 'bili' : p.key === 'weibo' ? '微' : '红' }}</div><div><strong>{{ p.name }}</strong><span>{{ isDemo ? '合成样本' : statuses[p.status] ?? '尚未采集' }}</span></div><span class="platform-result" :class="{ 'status-error': !isDemo && !['success', 'partial'].includes(p.status) }">{{ isDemo ? 'DEMO' : p.status === 'success' ? '已读取' : p.status === 'partial' ? '部分读取' : '待处理' }}</span><div class="platform-hover">{{ p.note || '暂无采集记录' }}<br>真实有效采集 {{ state?.verifiedRuns[p.key] ?? 0 }}/2 次</div></article></section>
          <section class="kpi-grid"><article class="kpi"><span>观察事件 <small>OBSERVED</small></span><strong>{{ events.length }}<em>个</em></strong><p>按事件聚合，跨平台保留证据</p></article><article class="kpi"><span>FC 重点 <small>RELEVANT</small></span><strong>{{ events.filter(e => e.relevance >= 50).length }}<em>个</em></strong><p>有明确的 FC 关联路径</p></article><article class="kpi"><span>优先关注 <small>WATCH</small></span><strong class="orange">{{ events.filter(e => e.relevance >= 50 && e.direction === 'risk').length }}<em>个</em></strong><p>潜在风险，仍需核实实际范围</p></article><article class="kpi"><span>内容机会 <small>OPPORTUNITY</small></span><strong class="green-text">{{ events.filter(e => e.relevance >= 50 && e.direction === 'opportunity').length }}<em>个</em></strong><p>可进一步评估的运营选题</p></article></section>
          <div v-if="!events.length" class="empty panel"><div class="empty-orbit">◎</div><h2>先建立一份有证据的观察</h2><p>目前还没有已校验的事件分析。平台未读取到内容，不代表没有讨论。</p><button class="primary-button" @click="help = true">查看监测步骤</button></div>
          <template v-else>
            <section class="overview-grid"><article class="panel chart-panel"><div class="panel-heading"><div><h2>热度 × 潜在影响</h2><p>热度不等于重要程度 · 圆点大小表示 FC 关联度</p></div><span class="mini-label">样本观察</span></div><div class="chart-caption"><span>高影响，低热度也值得关注</span><span>高热度，高影响</span></div><RadarChart :events="events" @select="navigate('detail', $event)"/><div class="chart-legend"><span><i class="dot amber"></i>风险</span><span><i class="dot green"></i>机会</span><span><i class="dot gray"></i>混合／待判断</span><span class="legend-note">{{ events.filter(e => e.heatScore === null).length }} 个事件因样本不足未绘点</span></div></article>
            <article class="panel focus-panel"><div class="panel-heading"><div><h2>先看这几件事</h2><p>按 FC 关联度 × 潜在影响排序</p></div><span class="mini-label">TOP {{ focus.length }}</span></div><button v-for="(e, i) in focus" :key="e.id" class="focus-item" @click="navigate('detail', e.id)"><span class="focus-number">0{{ i + 1 }}</span><div><span class="badge" :class="e.direction">{{ directions[e.direction] }}</span><h3>{{ e.title }}</h3><p>{{ e.action }}</p><small>FC 关联 {{ e.relevance }} <b>·</b> 潜在影响 {{ e.impact }}</small></div><span class="item-arrow">↗</span></button><button class="text-button full" @click="showView('fc')">查看全部 FC 重点 <span>→</span></button></article></section>
            <section class="panel industry-panel"><div class="panel-heading"><div><h2>行业也值得看一眼</h2><p>不止足球游戏，也关注新的玩法、内容和注意力流向。</p></div><button class="text-button" @click="showView('all')">全部行业 →</button></div><div class="industry-grid"><button v-for="e in [...events].filter(e => e.categories.some(c => ['热门新游', '电竞赛事'].includes(c))).sort((a,b) => (b.heatScore ?? -1) - (a.heatScore ?? -1)).slice(0,3)" :key="e.id" class="industry-card" @click="navigate('detail', e.id)"><span class="category-label">{{ e.categories[0] }} <span>↗</span></span><h3>{{ e.title }}</h3><p>{{ e.relevanceReason }}</p><div><span>样本热度 <strong>{{ number(e.heatScore) }}</strong></span><span>FC 关联 <strong>{{ e.relevance }}</strong></span></div></button></div></section>
          </template>
        </template>

        <template v-if="page === 'events'">
          <div class="event-tabs" role="tablist" aria-label="事件视角"><button v-for="t in [{id:'fc',name:'FC 重点'},{id:'new',name:'热门新游'},{id:'esports',name:'电竞赛事'},{id:'all',name:'全部行业'}]" :key="t.id" role="tab" :aria-selected="view === t.id" :class="{active:view === t.id}" @click="view = t.id">{{ t.name }}</button></div>
          <section class="panel event-panel"><div class="filters"><label class="search"><span>⌕</span><input v-model="search" aria-label="搜索事件" placeholder="搜索事件、游戏、赛事…"></label><select v-model="platform" aria-label="平台筛选"><option value="all">全部平台</option><option v-for="(name,key) in names" :key="key" :value="key">{{ name }}</option></select><select v-model="category" aria-label="分类筛选"><option value="all">全部分类</option><option v-for="c in state?.categories" :key="c">{{ c }}</option></select><select v-model.number="days" aria-label="时间范围"><option :value="1">近 24 小时</option><option :value="7">近 7 天</option><option :value="30">近 30 天</option></select></div>
          <div class="secondary-filters"><select v-model="product" aria-label="产品筛选"><option value="all">全部产品</option><option v-for="p in products" :key="p">{{ p }}</option></select><select v-model="sentiment" aria-label="情绪筛选"><option value="all">全部情绪</option><option v-for="(label,key) in sentiments" :key="key" :value="key">{{ label }}</option></select><select v-model.number="minRelevance" aria-label="关联度筛选"><option :value="0">全部关联度</option><option :value="50">FC 关联 ≥ 50</option><option :value="75">FC 关联 ≥ 75</option><option :value="100">FC 关联 100</option></select><select v-model.number="minImpact" aria-label="影响度筛选"><option :value="0">全部潜在影响</option><option :value="50">潜在影响 ≥ 50</option><option :value="75">潜在影响 ≥ 75</option></select><span>{{ filtered.length }} 个事件 · {{ view === 'fc' ? '按关注优先级' : '按样本热度' }}排序</span></div>
          <div class="event-table"><div class="table-head"><span>事件 / 观察与判断</span><span>样本热度</span><span>FC 关联</span><span>潜在影响</span><span>方向</span></div><button v-for="e in filtered" :key="e.id" class="event-row" @click="navigate('detail',e.id)"><div class="event-cell"><div class="event-tags"><span>{{ e.categories.join(' · ') }}</span><small>{{ e.platforms.map(p => names[p]).join(' / ') }}</small></div><h3>{{ e.title }}</h3><p>{{ e.relevanceReason }}</p><small>{{ e.evidence.length }} 条证据 · {{ confidence[e.confidence] }}<template v-if="!e.evidence.some(ref => posts.get(ref.postId)?.publishedAt)"> · 发布时间未知</template></small></div><div class="score-cell"><strong>{{ number(e.heatScore) }}</strong><small>{{ e.heatScore === null ? '样本不足' : '样本内比较' }}</small></div><div class="score-cell"><strong>{{ e.relevance }}</strong><div class="score-bar"><i :style="{width:e.relevance+'%'}"></i></div></div><div class="score-cell"><strong>{{ e.impact }}</strong><small>潜在 · 待验证</small></div><div><span class="badge" :class="e.direction">{{ directions[e.direction] }}</span></div></button></div><div v-if="!filtered.length" class="empty"><h3>没有匹配的事件</h3><p>试试其他筛选条件；空结果不代表该平台没有讨论。</p></div></section>
        </template>

        <template v-if="page === 'detail' && active">
          <button class="back-link" @click="navigate('events')">← 返回事件中心</button>
          <article class="panel detail-header"><div class="event-tags"><span>{{ active.categories.join(' / ') }}</span><span class="badge" :class="active.direction">{{ directions[active.direction] }}</span></div><h2>{{ active.title }}</h2><p>{{ active.summary }}</p><div class="detail-metrics"><div><small>样本热度</small><strong>{{ number(active.heatScore) }}</strong></div><div><small>FC 关联度</small><strong>{{ active.relevance }}</strong></div><div><small>潜在影响</small><strong>{{ active.impact }}</strong></div><div><small>情绪 · {{ active.sentimentTarget }}</small><strong class="word-value">{{ sentiments[active.sentiment] }}</strong></div></div><div class="entity-meta" v-if="active.gameName"><span>游戏 <b>{{ active.gameName }}</b></span><span v-if="active.releaseStage">发行阶段 <b>{{ stages[active.releaseStage] }}</b></span><span v-if="active.releaseDate">上线时间 <b>{{ date(active.releaseDate) }}</b></span><span v-if="active.tournamentName">赛事 <b>{{ active.tournamentName }} / {{ active.stage }}</b></span><span v-if="active.eventType">类型 <b>{{ eventTypes[active.eventType] }}</b></span><span v-if="active.matchAt">{{ active.matchTimePrecision === 'day' ? '比赛日期（时间未知）' : '比赛时间' }} <b>{{ active.matchTimePrecision === 'day' ? new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(active.matchAt)) : date(active.matchAt) }}</b></span></div></article>
          <div class="detail-grid"><section class="panel detail-body"><h2>为什么值得关注</h2><div class="reason-block"><span class="section-kicker">FC 关联</span><p>{{ active.relevanceReason }}</p><p v-if="active.relationshipBasis" class="muted">{{ active.relationshipBasis }}</p></div><div class="reason-block"><span class="section-kicker">潜在影响</span><p>{{ active.impactReason }}</p><div class="dimension-grid"><div v-for="(label,key) in {strength:'影响强度',reach:'涉及范围',urgency:'紧迫性',duration:'持续性'}" :key="key"><span>{{ label }}</span><strong>{{ active.impactDimensions[key] }}<small>/4</small></strong></div></div></div><div class="action-box"><h3>建议的下一步</h3><p>{{ active.action }}</p></div><div class="reason-block"><span class="section-kicker">还需要验证</span><p>{{ active.verify }}</p><span class="badge uncertain">{{ confidence[active.confidence] }}</span></div><h2 class="subsection-title">事件时间线</h2><div v-for="(point,i) in active.timeline" :key="i" class="timeline-point"><span>{{ date(point.at) }}</span><p>{{ point.label }}<small>{{ point.evidenceIds.length }} 条证据</small></p></div></section>
          <aside class="panel heat-details"><h2>热度如何得来</h2><p>平台分别计算，再对可评分平台等权取均值。不同平台的原始互动量不直接相加。</p><article v-for="h in active.heat" :key="h.platform"><div class="heat-heading"><strong>{{ names[h.platform] }}</strong><b>{{ number(h.score) }}</b></div><small>{{ h.baseline }} · {{ h.sampleSize }} 个事件</small><dl><div><dt>独立帖子</dt><dd>{{ h.raw.posts }}</dd></div><div><dt>可识别作者</dt><dd>{{ number(h.raw.authors) }}</dd></div><div v-for="(label,key) in {likes:'点赞',comments:'评论',shares:'转发',views:'播放／浏览',favorites:'收藏'}" :key="key"><dt>{{ label }}</dt><dd>{{ number(h.raw.interactions[key]) }}</dd></div><div><dt>历史增长</dt><dd>{{ h.raw.growth === null ? '暂无可比快照' : number(h.raw.growth * 100) + '% / 日' }}</dd></div></dl><div class="completeness">指标可见率 {{ h.raw.completeness }}% · 有效权重 {{ h.weightCoverage }}%</div></article><p class="fine-print">公式：互动 40% + 帖子 30% + 作者 20% + 增长 10%。缺失项不补零；不足 10 个基准事件不评分。</p></aside></div>
          <section class="panel evidence-panel"><div class="panel-heading"><div><h2>原始证据 <span class="muted">{{ active.evidence.length }}</span></h2><p>摘录来自原文；转发不等于新的独立事实证明。</p></div></div><article v-for="ref in active.evidence" :key="ref.postId" class="evidence-card"><div class="evidence-top"><span class="platform-small" :class="posts.get(ref.postId)?.platform">{{ names[posts.get(ref.postId)?.platform ?? ''] }}</span><strong>{{ posts.get(ref.postId)?.authorName ?? (snapshotMode ? '作者信息未展示' : '作者未知') }}</strong><span>{{ date(posts.get(ref.postId)?.publishedAt) }}</span><a v-if="!isDemo" :href="posts.get(ref.postId)?.url" target="_blank" rel="noopener noreferrer">查看原文 ↗</a><span v-else class="synthetic-label">合成证据 · 无真实原文链接</span></div><blockquote>{{ ref.quote }}</blockquote><div class="evidence-bottom"><span>{{ ref.postId }}</span><span>采集于 {{ date(posts.get(ref.postId)?.collectedAt) }}</span><span>{{ posts.get(ref.postId)?.method === 'manual' ? '人工导入' : isDemo ? '合成样本' : '浏览器采集' }}</span></div></article></section>
        </template>
        <div v-if="page === 'detail' && !active" class="empty panel"><h2>事件不存在或尚未分析</h2><button class="text-button" @click="navigate('events')">返回事件中心 →</button></div>

        <template v-if="page === 'report'">
          <div class="report-toolbar"><p>生成于 {{ date(state?.analysis?.generatedAt) }} · {{ state?.analysis?.scoreVersion ?? '尚无评分版本' }}</p><div v-if="state?.analysis"><a class="secondary-button" :href="exportUrl('md')" download>下载 Markdown ↓</a><a class="primary-button" :href="exportUrl('html')" download>下载 HTML ↓</a></div></div>
          <article v-if="state?.analysis" class="panel report-paper"><div class="report-cover"><span class="eyebrow">FIELD NOTES / FC SOCIAL RADAR</span><h2>本次值得关注的事</h2><p>{{ isDemo ? '合成演示简报 · 所有案例均为虚构' : '基于本次可见样本的观察，结论仍需结合业务验证' }}</p></div><section v-for="(section,i) in state.sections" :key="section.title" class="report-section"><h3><span>0{{ i+1 }}</span>{{ section.title }}</h3><p v-if="!section.events.length" class="muted">当前没有足够材料，不补造内容。</p><article v-for="e in section.events" :key="e.id" class="report-event"><button @click="navigate('detail',e.id)">{{ e.title }} ↗</button><p>{{ e.summary }}</p><div class="report-scores">关联 {{ e.relevance }} · 潜在影响 {{ e.impact }} · 样本热度 {{ number(e.heatScore) }} · {{ confidence[e.confidence] }}</div><p><b>FC 关联</b> {{ e.relevanceReason }}</p><p><b>建议</b> {{ e.action }}</p><p class="muted"><b>待验证</b> {{ e.verify }}</p><div class="report-evidence"><template v-for="ref in e.evidence.slice(0,3)" :key="ref.postId"><a v-if="!isDemo" :href="posts.get(ref.postId)?.url" target="_blank" rel="noopener noreferrer">{{ names[posts.get(ref.postId)?.platform ?? ''] }}证据 ↗</a><span v-else>合成证据 {{ ref.postId }}</span></template></div></article></section><section class="report-section"><h3><span>06</span>数据缺口</h3><p v-if="excludedCount">{{ excludedCount }} 条检索样本未纳入重点事件，保留在本地分析输入中供复核。</p><p v-for="note in state.analysis.limitations" :key="note">{{ note }}</p><p v-for="(s,i) in state.analysis.sources" :key="i">{{ names[s.platform] }} · {{ sourceLabel(s) }} · {{ s.count }} 条检索结果：{{ s.notes.join('；') || '仅覆盖可见检索结果，不代表全量讨论' }}</p></section></article><div v-else class="panel empty"><h2>尚无可导出的简报</h2><p>完成采集并导入已校验分析后，简报会出现在这里。</p></div>
        </template>
        <footer class="page-footer"><span>FC SOCIAL RADAR <b>·</b> 观察有据，判断有度</span><span>{{ isDemo ? '独立作品集演示，非 EA 官方产品' : snapshotMode ? '真实采集快照 · 手动发布 · 非 EA 官方产品' : '本地运行 · 手动更新 · 不自动发布' }}</span></footer>
      </main>
    </div>
  </div>
</template>
