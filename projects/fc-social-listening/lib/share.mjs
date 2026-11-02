import { reportSections } from './report.mjs';

const pick = (value, keys) => Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
const fields = 'id title summary product categories platforms sentiment sentimentTarget direction relevance impact priority heatScore confidence relevanceReason impactReason action verify gameName releaseStage releaseDate tournamentName stage matchAt matchTimePrecision eventType relationshipBasis'.split(' ');
const publicNote = note => /\/(?:home|Users|work|var)\/|https?:|(?:page|browser|locator|chromium)\.|Timeout|Error|token|cookie|session|Target closed|Protocol/i.test(note)
  ? '部分页面读取失败；本次覆盖不完整，技术诊断仅保存在本机。' : note;
const source = value => ({ ...pick(value, ['platform', 'status', 'count', 'method', 'query', 'collectedAt']), notes: (value.notes ?? []).map(publicNote) });

export function shareState(local, createdAt = new Date().toISOString()) {
  if (local.mode !== 'real' || !local.analysis) throw new Error('分享需要真实、已导入的分析');
  const original = local.analysis;
  const events = original.events.map(event => ({
    ...pick(event, fields),
    impactDimensions: pick(event.impactDimensions, ['strength', 'reach', 'urgency', 'duration']),
    evidence: event.evidence.map(ref => pick(ref, ['postId', 'role', 'quote'])),
    timeline: event.timeline.map(point => pick(point, ['at', 'label', 'evidenceIds'])),
    heat: event.heat.map(heat => ({
      ...pick(heat, ['platform', 'score', 'baseline', 'sampleSize', 'weightCoverage', 'missing']),
      raw: { ...pick(heat.raw, ['posts', 'authors', 'growth', 'completeness']), interactions: pick(heat.raw.interactions, ['likes', 'comments', 'shares', 'views', 'favorites']) }
    }))
  }));
  const cited = new Set(events.flatMap(event => event.evidence.map(ref => ref.postId)));
  const posts = original.posts.filter(post => cited.has(post.id)).map(post => {
    const url = new URL(post.url);
    const domains = { bilibili: ['www.bilibili.com', 'bilibili.com'], weibo: ['weibo.com', 'www.weibo.com'], xiaohongshu: ['www.xiaohongshu.com', 'xiaohongshu.com'] };
    if (url.protocol !== 'https:' || !domains[post.platform]?.includes(url.hostname) || url.username || url.password) throw new Error('证据链接不属于支持的平台');
    url.search = ''; url.hash = '';
    return { ...pick(post, ['id', 'platform', 'publishedAt', 'collectedAt', 'method']), url: url.href, title: '', text: '', authorName: null, metrics: {} };
  });
  if (posts.length !== cited.size) throw new Error('引用证据缺失，不能生成快照');
  const analysis = {
    ...pick(original, ['id', 'runId', 'mode', 'generatedAt', 'sourceCutoff', 'scoreVersion']),
    events, posts, excludedPostIds: [], limitations: original.limitations ?? [], sources: original.sources.map(source)
  };
  const snapshot = { createdAt, inputPosts: original.posts.length, excludedPosts: original.excludedPostIds.length };
  return {
    mode: 'real', snapshot, analysis,
    latestRun: local.latestRun ? pick(local.latestRun, ['id', 'status', 'startedAt', 'finishedAt', 'count', 'method']) : null,
    sources: local.sources.map(source), categories: local.categories,
    analysisPending: local.analysisPending, verifiedRuns: local.verifiedRuns,
    sections: reportSections(analysis), runs: []
  };
}
