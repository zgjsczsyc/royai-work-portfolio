import { DAY, SCORE_VERSION } from './domain.mjs';
const round = n => Math.round(n * 10) / 10;
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
export function percentile(value, sample) {
  if (value === null || !sample.length) return null;
  return 100 * (sample.filter(x => x < value).length + sample.filter(x => x === value).length / 2) / sample.length;
}
export function impactScore(dimensions) {
  return round(25 * (dimensions.strength * .35 + dimensions.reach * .30 + dimensions.urgency * .20 + dimensions.duration * .15));
}
function rawFor(event, platform, postMap, captures, cutoff) {
  const posts = event.evidence.map(e => postMap.get(e.postId)).filter(p => p.platform === platform);
  const interactions = {};
  for (const key of ['likes', 'comments', 'shares', 'views', 'favorites']) {
    const observed = posts.map(p => p.metrics[key]).filter(n => n !== null);
    interactions[key] = observed.length ? observed.reduce((a, b) => a + b, 0) : null;
  }
  const growths = [];
  for (const p of posts) {
    const snapshots = captures.filter(c => c.postId === p.id && Date.parse(c.at) <= cutoff).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const latest = snapshots.at(-1);
    if (!latest) continue;
    const previous = snapshots.filter(c => Date.parse(c.at) <= Date.parse(latest.at) - DAY).at(-1);
    if (!previous || Date.parse(latest.at) - Date.parse(previous.at) > 7 * DAY) continue;
    const deltas = [];
    for (const key of ['likes', 'comments', 'shares', 'views', 'favorites']) {
      const before = previous.post.metrics[key], after = latest.post.metrics[key];
      if (before !== null && after !== null && after >= before) deltas.push((after - before) / Math.max(before, 1) / ((Date.parse(latest.at) - Date.parse(previous.at)) / DAY));
    }
    if (deltas.length) growths.push(mean(deltas));
  }
  const authors = posts.map(p => p.authorId).filter(Boolean);
  const completeness = round(100 * posts.reduce((n, p) => n + ['likes', 'comments', 'shares', 'views', 'favorites'].filter(k => p.metrics[k] !== null).length, 0) / Math.max(posts.length * 5, 1));
  return { interactions, posts: posts.length, authors: authors.length ? new Set(authors).size : null, growth: mean(growths), completeness,
    missingDates: posts.filter(p => !p.publishedAt).length, growthPosts: growths.length };
}
export function scoreEvents(events, posts, captures, previousAnalyses, cutoff) {
  const postMap = new Map(posts.map(p => [p.id, p]));
  const items = events.map(event => {
    const platforms = [...new Set(event.evidence.map(e => postMap.get(e.postId).platform))];
    return { ...event, platforms, impact: impactScore(event.impactDimensions), priority: round(event.relevance * impactScore(event.impactDimensions) / 100),
      heat: platforms.map(platform => ({ platform, raw: rawFor(event, platform, postMap, captures, cutoff) })) };
  });
  for (const item of items) {
    for (const h of item.heat) {
      const history = new Map();
      for (const a of [...previousAnalyses].sort((a, b) => Date.parse(a.generatedAt) - Date.parse(b.generatedAt))) {
        if (Date.parse(a.generatedAt) < cutoff - 30 * DAY || Date.parse(a.generatedAt) >= cutoff) continue;
        for (const e of a.events) {
          const heat = e.heat.find(x => x.platform === h.platform);
          if (heat) history.set(e.id, heat.raw);
        }
      }
      const initial = items.flatMap(e => e.heat.filter(x => x.platform === h.platform).map(x => x.raw));
      const baseline = history.size >= 10 ? [...history.values()] : initial;
      h.baseline = history.size >= 10 ? '历史 30 天' : '初始基准';
      h.sampleSize = baseline.length;
      const metrics = ['likes', 'comments', 'shares', 'views', 'favorites'].map(key => percentile(h.raw.interactions[key], baseline.map(x => x.interactions[key]).filter(n => n !== null))).filter(n => n !== null);
      const values = { interactions: mean(metrics), posts: percentile(h.raw.posts, baseline.map(x => x.posts)),
        authors: percentile(h.raw.authors, baseline.map(x => x.authors).filter(n => n !== null)),
        growth: percentile(h.raw.growth, baseline.map(x => x.growth).filter(n => n !== null)) };
      const weights = { interactions: .4, posts: .3, authors: .2, growth: .1 };
      const available = Object.entries(weights).filter(([key]) => values[key] !== null);
      h.score = baseline.length < 10 ? null : round(available.reduce((sum, [key, weight]) => sum + values[key] * weight, 0) / available.reduce((sum, [, w]) => sum + w, 0));
      h.components = values;
      h.weightCoverage = round(available.reduce((sum, [, w]) => sum + w, 0) * 100);
      h.missing = Object.keys(values).filter(k => values[k] === null);
    }
    item.heatScore = mean(item.heat.map(h => h.score).filter(n => n !== null));
    if (item.heatScore !== null) item.heatScore = round(item.heatScore);
    item.heatNote = '可评分平台的等权均值；非全网声量。平台覆盖不同，比较需谨慎。';
    item.scoreVersion = SCORE_VERSION;
  }
  return items.sort((a, b) => b.priority - a.priority || (b.heatScore ?? -1) - (a.heatScore ?? -1) || a.id.localeCompare(b.id));
}
