import { importAnalysis } from './analysis.mjs';
import { PLATFORMS, DAY } from './domain.mjs';
export const scenarios = [
  { title: '登录失败的零散反馈，值得先核查', category: '服务故障', product: 'FC Mobile／足球世界', direction: 'risk', relevance: 100, dims: [4, 2, 4, 2], volume: 6, sentiment: 'negative', quote: '更新后连续两次无法登录，重新连接网络后还是失败。', action: '先核对故障时间、设备与网络条件，再判断是否需要社区说明。', basis: '直接涉及 FC 移动端登录体验。' },
  { title: '球星主题活动，社区期待更清晰的参与说明', category: '版本活动', product: 'FC Mobile／足球世界', direction: 'opportunity', relevance: 100, dims: [2, 3, 3, 2], volume: 80, sentiment: 'mixed', quote: '球星活动很有意思，但希望有一张图说清楚任务和奖励。', action: '制作一图读懂活动，收集玩家对规则的常见问题。', basis: 'FC 活动信息直接影响玩家参与和社区问答。' },
  { title: '操作手感讨论升温，需要区分设备与玩法', category: '玩法体验', product: 'FC Mobile／足球世界', direction: 'risk', relevance: 100, dims: [3, 2, 2, 3], volume: 160, sentiment: 'mixed', quote: '同样的传球操作在不同模式下感觉不一样，想知道是不是设置问题。', action: '整理可复现条件，向产品团队提交结构化问题清单。', basis: 'FC 移动端玩家对核心玩法的直接评价。' },
  { title: '足球竞品以回流礼包拉动老玩家讨论', category: '竞品动态', product: '示例足球竞品', direction: 'mixed', relevance: 75, dims: [2, 2, 2, 2], volume: 250, sentiment: 'positive', quote: '这次回流任务不复杂，老玩家回来能很快凑齐一套阵容。', action: '比较回流活动的任务成本与内容表达，不推断实际用户流失。', basis: '同为移动端足球游戏，可能争夺相似玩家的时间。' },
  { title: '球星转会话题走热，适合做互动选题', category: '足球热点', product: '足球内容', direction: 'opportunity', relevance: 50, dims: [2, 3, 3, 1], volume: 900, sentiment: 'positive', quote: '如果这名球星换队，你最想看到哪种阵容组合？', action: '在确认公开消息后设计阵容话题，不使用未确认转会作为事实。', basis: '足球内容与 FC 玩家兴趣相交，可用于社区互动。' },
  { title: '手游内容标识规范讨论，先确认适用范围', category: '行业政策', product: '游戏行业', direction: 'uncertain', relevance: 25, dims: [1, 1, 1, 2], volume: 45, sentiment: 'neutral', quote: '最近看到内容标识规则的讨论，但还不知道适用哪些平台。', action: '寻找平台正式规则，再核对 FC 社区内容是否涉及。', basis: '目前只有宽泛行业关联，尚未确认适用 FC。' },
  { title: '《星港旅人》公测：创作者教程形成内容入口', category: '热门新游', product: '星港旅人（虚构）', game: '星港旅人（虚构）', release: 'testing', direction: 'opportunity', relevance: 50, dims: [2, 2, 2, 2], volume: 650, sentiment: 'positive', quote: '公测第一天最有用的不是宣传片，而是创作者做的新手三分钟教程。', action: '研究短教程的内容结构，尝试转化为 FC 新手内容选题。', basis: '可借鉴移动端新手内容的表达方式；未发现足球玩家直接迁移证据。' },
  { title: '《深海回声》上线引发讨论，与 FC 关联有限', category: '热门新游', product: '深海回声（虚构）', game: '深海回声（虚构）', release: 'launched', direction: 'uncertain', relevance: 25, dims: [1, 1, 1, 1], volume: 2300, sentiment: 'positive', quote: '今天正式上线，很多人在分享单机剧情和画面截图。', action: '保留在行业观察，不将高热度解释为 FC 玩家流失。', basis: '单机叙事品类与 FC 的玩家需求差异较大。' },
  { title: '《绿茵计划》预约：足球手游的新竞争信号', category: '热门新游', product: '绿茵计划（虚构）', game: '绿茵计划（虚构）', release: 'preregister', direction: 'risk', relevance: 75, dims: [3, 2, 2, 3], volume: 360, sentiment: 'mixed', quote: '预约页强调轻量养成和球员收集，还没有公布正式上线日期。', action: '跟踪正式公告和测试反馈，比较目标玩家与养成门槛。', basis: '足球题材、移动端和球员收集与 FC 存在具体重合。' },
  { title: 'FC 社区邀请赛预告，可安排赛前内容', category: '电竞赛事', product: 'FC Mobile／足球世界', game: 'FC Mobile／足球世界', tournament: '示例社区邀请赛', type: 'preview', direction: 'opportunity', relevance: 100, dims: [2, 2, 3, 1], volume: 120, sentiment: 'positive', quote: '社区邀请赛将在后天开打，想看参赛阵容介绍和对阵预测。', action: '准备参赛阵容介绍、对阵讨论与赛后复盘模板。', basis: '直接服务 FC 电竞社区和赛事内容。' },
  { title: '跨品类电竞决赛将至，注意内容档期竞争', category: '电竞赛事', product: '极光竞技（虚构）', game: '极光竞技（虚构）', tournament: '示例年度冠军赛', type: 'preview', direction: 'mixed', relevance: 50, dims: [2, 3, 3, 1], volume: 1800, sentiment: 'positive', quote: '周末决赛大家准备一起看，相关直播和短视频已经开始预热。', action: '检查 FC 重要内容是否与决赛时段重叠，避免直接推断转化损失。', basis: '可能竞争泛游戏内容注意力，实际 FC 玩家重合尚待验证。' },
  { title: '同一电竞赛事的半决赛赛果，单独记录', category: '电竞赛事', product: '极光竞技（虚构）', game: '极光竞技（虚构）', tournament: '示例年度冠军赛', type: 'result', direction: 'opportunity', relevance: 25, dims: [1, 2, 1, 1], volume: 1100, sentiment: 'positive', quote: '半决赛已经结束，大家在转发选手赛后的复盘片段。', action: '观察选手复盘内容如何带动讨论，作为行业案例保留。', basis: '不同品类的电竞内容案例，没有直接影响 FC 的证据。' },
];
export function fixture(now = Date.now()) {
  const posts = [], events = [], benchmark = [];
  scenarios.forEach((s, i) => {
    const evidence = [];
    for (let j = 0; j < 5; j++) {
      const platform = PLATFORMS[j % 3], nativeId = `demo_${i}_${j}`, id = `${platform}:${nativeId}`;
      const quote = `【合成示例】${s.quote}`;
      posts.push({ id, platform, nativeId, url: `https://${platform === 'bilibili' ? 'www.bilibili.com' : platform === 'weibo' ? 'weibo.com' : 'www.xiaohongshu.com'}/demo/${nativeId}`,
        title: `【演示】${s.title}`, text: `${quote}\n虚构玩家 ${i}-${j} 的补充观察，仅用于演示与测试。`,
        authorId: `fictional-${i}-${j}`, authorName: `示例玩家 ${i * 5 + j + 1}`, publishedAt: new Date(now - (j + 1) * 3600000).toISOString(),
        collectedAt: new Date(now).toISOString(), topics: [s.category], sourceType: 'unknown',
        metrics: { likes: s.volume * (j + 1), comments: Math.round(s.volume / 4) * (j + 1), shares: platform === 'weibo' ? s.volume : null, views: platform === 'bilibili' ? s.volume * 50 : null, favorites: null },
        comments: ['【合成评论】希望看到更多细节与后续说明。'] });
      evidence.push({ postId: id, role: 'independent', quote });
      benchmark.push({ postId: id, source: 'synthetic', expectedProduct: s.product, expectedCategories: [s.category], expectedEvent: `demo-event-${i}`, humanReviewed: false });
    }
    const at = new Date(now - 3600000).toISOString();
    events.push({ id: `demo-event-${i}`, title: s.title, summary: `合成场景：${s.quote} 这些文字和指标均为虚构，不能用来判断真实游戏或赛事。`,
      categories: [s.category], product: s.product, sentiment: s.sentiment, sentimentTarget: s.product, direction: s.direction,
      relevance: s.relevance, relevanceReason: s.basis, relevanceEvidenceIds: [evidence[0].postId],
      impactDimensions: Object.fromEntries(['strength', 'reach', 'urgency', 'duration'].map((k, j) => [k, s.dims[j]])),
      impactReason: `演示评分：强度 ${s.dims[0]}/4，范围 ${s.dims[1]}/4，紧迫性 ${s.dims[2]}/4，持续性 ${s.dims[3]}/4；${s.basis} 不代表实际业务影响。`,
      impactEvidenceIds: [evidence[0].postId], confidence: 'unverified', evidence, action: s.action, verify: '在真实使用时核对官方材料、独立来源和 FC 玩家覆盖；当前仅为合成案例。',
      timeline: [{ at, label: s.type === 'result' ? '示例半决赛赛果讨论' : '检索到相关讨论（合成）', evidenceIds: [evidence[0].postId] }],
      gameName: s.game ?? null, releaseStage: s.release ?? null, releaseDate: s.release === 'launched' ? new Date(now - DAY).toISOString() : null,
      tournamentName: s.tournament ?? null, stage: s.type === 'result' ? '半决赛' : s.tournament ? '决赛预告' : null,
      matchAt: s.tournament ? new Date(now + (s.type === 'result' ? -1 : 2) * DAY).toISOString() : null, eventType: s.type ?? null, relationshipBasis: s.basis });
  });
  return { posts, events, benchmark };
}
export function seedDemo(store) {
  if (store.mode !== 'demo') throw new Error('合成样本只能写入 demo');
  if (store.latestAnalysis()) return { existing: true, analysis: store.latestAnalysis() };
  const now = Date.now() - 1000, data = fixture(now);
  const run = store.beginRun({ method: 'synthetic', days: 7, startedAt: new Date(now - 60000).toISOString() });
  store.transaction(() => {
    for (const p of data.posts) store.savePost(run.id, p, 'synthetic');
    for (const platform of PLATFORMS) store.addSource(run.id, { platform, query: '合成演示样本', status: 'success', method: 'synthetic', count: data.posts.filter(p => p.platform === platform).length, notes: ['这不是一次真实平台采集'] });
    store.finishRun(run.id, { status: 'success', count: data.posts.length });
  });
  return { analysis: importAnalysis(store, { schemaVersion: 1, runId: run.id, events: data.events, excludedPostIds: [] }), benchmark: data.benchmark };
}
