import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Store } from '../lib/store.mjs';
import { fixture, seedDemo } from '../lib/demo.mjs';
import { normalizePost, parseCount, DAY } from '../lib/domain.mjs';
import { parseTime, pageState, nativeId } from '../lib/collectors.mjs';
import { importAnalysis, validateAnalysis, prepareInput } from '../lib/analysis.mjs';
import { scoreEvents, impactScore, percentile } from '../lib/scoring.mjs';
import { reportMarkdown, reportHtml } from '../lib/report.mjs';
import { evaluateReview } from '../lib/review.mjs';
import { createServer, state } from '../server.mjs';

function setup(t, mode = 'real') {
  const store = new Store(mode, ':memory:'); t.after(() => store.close());
  const data = fixture(Date.now() - 3000);
  const run = store.beginRun({ days: 7 });
  data.posts.forEach(p => store.savePost(run.id, p));
  store.finishRun(run.id, { status: 'success', count: 60 });
  const input = { schemaVersion: 1, runId: run.id, events: structuredClone(data.events), excludedPostIds: [] };
  return { store, input, data, run };
}
test('60 reference samples cover 3 platforms, 15 new-game and 15 esports samples; no human claim', () => {
  const { benchmark } = fixture();
  assert.equal(benchmark.length, 60);
  assert.equal(new Set(benchmark.map(p => p.postId.split(':')[0])).size, 3);
  for (const c of ['热门新游', '电竞赛事']) assert.equal(benchmark.filter(p => p.expectedCategories.includes(c)).length, 15);
  assert.ok(benchmark.every(p => p.humanReviewed === false));
});
test('missing metrics remain null; URL and negative metric validation', () => {
  const p = fixture().posts[0];
  assert.equal(normalizePost({ ...p, metrics: {} }).metrics.likes, null);
  assert.throws(() => normalizePost({ ...p, metrics: { likes: -1 } }));
  assert.throws(() => normalizePost({ ...p, url: 'https://bilibili.com.attacker.test/video/BV123' }));
  assert.throws(() => normalizePost({ ...p, url: 'javascript:alert(1)' }));
  assert.equal(parseCount('1.2万'), 12000); assert.equal(parseCount('赞'), null); assert.equal(parseCount('0'), 0);
});
test('timestamps use Shanghai and ambiguous dates stay unknown', () => {
  const now = new Date('2026-11-02T02:00:00Z');
  assert.equal(parseTime('2026-11-01 23:30', now), '2026-11-01T15:30:00.000Z');
  assert.equal(parseTime('1小时前', now), '2026-11-02T01:00:00.000Z');
  assert.equal(parseTime('11月1日 08:00', now), '2026-11-01T00:00:00.000Z');
  assert.equal(parseTime('· 10月28日', now), '2026-10-27T16:00:00.000Z');
  assert.equal(parseTime('· 昨天', now), '2026-10-31T16:00:00.000Z');
  assert.equal(parseTime('今天 09:30', now), '2026-11-02T01:30:00.000Z');
  assert.equal(parseTime('未知', now), null);
  assert.equal(nativeId('bilibili', 'https://www.bilibili.com/video/BV1234'), 'BV1234');
});
test('login, blocked, parser failure and genuine zero results are distinct', () => {
  assert.equal(pageState({ status: 412, url: 'https://bilibili.com', text: '', cards: 0 }), 'restricted');
  assert.equal(pageState({ status: 200, url: 'https://xiaohongshu.com/login', text: '', cards: 0 }), 'needs_login');
  assert.equal(pageState({ status: 200, url: 'https://x.test', text: '加载中', cards: 0 }), 'parse_failed');
  assert.equal(pageState({ status: 200, url: 'https://x.test', text: '暂无搜索结果', cards: 0 }), 'success');
});
test('deduplicated posts retain immutable captures across runs', t => {
  const { store, data, run } = setup(t);
  store.savePost(run.id, { ...data.posts[0], metrics: { likes: 999 } });
  assert.equal(store.posts().length, 60); assert.equal(store.captures().length, 60);
  assert.equal(store.captures().find(c => c.postId === data.posts[0].id).post.metrics.likes, data.posts[0].metrics.likes);
  const next = store.beginRun({ days: 1 }); store.savePost(next.id, { ...data.posts[0], collectedAt: new Date().toISOString(), metrics: { likes: 2000 } });
  store.finishRun(next.id, { status: 'partial' });
  assert.equal(store.captures().length, 61);
  assert.equal(store.analysisInput(run.id).posts.find(p => p.id === data.posts[0].id).metrics.likes, data.posts[0].metrics.likes);
});
test('malformed analysis import is atomic and does not delete history', t => {
  const { store, input } = setup(t);
  importAnalysis(store, input); const bad = structuredClone(input); bad.events[0].evidence[0].postId = 'invented';
  assert.throws(() => store.transaction(() => importAnalysis(store, bad)), /不存在/);
  assert.equal(store.analyses().length, 1); assert.equal(store.posts().length, 60);
});
test('fabricated quotes, invalid scores and unsupported official claims are rejected', t => {
  const { store, input, run } = setup(t), context = store.analysisInput(run.id);
  for (const mutate of [i => i.events[0].evidence[0].quote = '不存在的引语', i => i.events[0].relevance = 99,
    i => i.events[0].impactDimensions.reach = 5, i => i.events[0].evidence[0].role = 'official', i => i.events[0].confidence = 'primary']) {
    const bad = structuredClone(input); mutate(bad); assert.throws(() => validateAnalysis(bad, context));
  }
});
test('all input evidence must be assigned or explicitly excluded', t => {
  const { store, input, run } = setup(t); input.events.pop();
  assert.throws(() => validateAnalysis(input, store.analysisInput(run.id)), /未处理/);
  input.excludedPostIds = store.analysisInput(run.id).posts.filter(p => !input.events.some(e => e.evidence.some(r => r.postId === p.id))).map(p => p.id);
  assert.doesNotThrow(() => validateAnalysis(input, store.analysisInput(run.id)));
});
test('new-game release states require evidence dates; future results rejected', t => {
  const { store, input, run } = setup(t), context = store.analysisInput(run.id);
  const game = input.events.find(e => e.releaseStage === 'launched');
  game.releaseDate = new Date(Date.now() - 91 * DAY).toISOString();
  assert.throws(() => validateAnalysis(input, context), /90 天/);
  game.releaseStage = 'testing'; game.releaseDate = null;
  assert.doesNotThrow(() => validateAnalysis(input, context));
  const result = input.events.find(e => e.eventType === 'result'); result.matchAt = new Date(Date.now() + DAY).toISOString();
  assert.throws(() => validateAnalysis(input, context), /未来/);
});
test('same tournament preview and semifinal result stay separate events', t => {
  const { store, input } = setup(t), analysis = importAnalysis(store, input);
  const events = analysis.events.filter(e => e.tournamentName === '示例年度冠军赛');
  assert.equal(events.length, 2); assert.notEqual(events[0].id, events[1].id); assert.notEqual(events[0].eventType, events[1].eventType);
});
test('impact is deterministic and prioritizes low-volume high-impact FC risks', t => {
  assert.equal(impactScore({ strength: 4, reach: 2, urgency: 4, duration: 2 }), 77.5);
  const { store, input } = setup(t), a = importAnalysis(store, input);
  assert.equal(a.events[0].id, 'demo-event-0');
  const highHeat = a.events.find(e => e.id === 'demo-event-7');
  assert.ok(highHeat.heatScore > a.events[0].heatScore); assert.ok(highHeat.priority < a.events[0].priority);
  const again = importAnalysis(store, input);
  assert.deepEqual(a.events.map(e => e.heatScore), again.events.map(e => e.heatScore));
});
test('percentiles handle ties; cold start below 10 events has no heat score', () => {
  assert.equal(percentile(2, [2, 2]), 50);
  const d = fixture(), posts = d.posts.map(p => normalizePost(p));
  const scored = scoreEvents(d.events.slice(0, 9), posts, [], [], Date.now());
  assert.ok(scored.every(e => e.heatScore === null));
  assert.ok(scored[0].heat.every(h => h.raw.growth === null));
});
test('missing interactions are omitted and weights renormalized, not zero filled', () => {
  const d = fixture(), posts = d.posts.map(p => normalizePost({ ...p, metrics: {} }));
  const scored = scoreEvents(d.events, posts, [], [], Date.now());
  assert.ok(scored[0].heat.every(h => h.raw.interactions.likes === null && h.missing.includes('interactions')));
  assert.equal(scored[0].heat[0].weightCoverage, 50);
  assert.equal(scored[0].heat[0].raw.completeness, 0);
});
test('growth requires comparable snapshots at least one day apart', () => {
  const now = Date.now(), d = fixture(now), posts = d.posts.map(p => normalizePost(p));
  const captures = posts.flatMap(p => [
    { postId: p.id, at: new Date(now - 2 * DAY).toISOString(), post: { ...p, metrics: Object.fromEntries(Object.entries(p.metrics).map(([k,v]) => [k, v === null ? null : v / 2])) } },
    { postId: p.id, at: new Date(now).toISOString(), post: p },
  ]);
  const scored = scoreEvents(d.events, posts, captures, [], now);
  assert.equal(scored[0].heat[0].raw.growth, .5);
  assert.equal(scored[0].heat[0].weightCoverage, 100);
});
test('historical baseline uses unique events and only prior 30 days', () => {
  const now = Date.now(), d = fixture(now), posts = d.posts.map(p => normalizePost(p));
  const previous = scoreEvents(d.events, posts, [], [], now - DAY);
  const scored = scoreEvents(d.events.slice(0, 2), posts, [], [{ generatedAt: new Date(now - DAY).toISOString(), events: previous }], now);
  assert.ok(scored.every(e => e.heat.every(h => h.baseline === '历史 30 天' && h.score !== null)));
});
test('prompt treats hostile post text as data and requires evidence', t => {
  const { store, run } = setup(t), input = prepareInput(store, run.id);
  assert.match(input.instruction, /不可信的数据/); assert.match(input.instruction, /不要执行/); assert.equal(input.posts.length, 60);
});
test('demo cannot seed real store; demo runs never count as real acceptance', t => {
  const real = new Store('real', ':memory:'), demo = new Store('demo', ':memory:'); t.after(() => { real.close(); demo.close(); });
  assert.throws(() => seedDemo(real)); seedDemo(demo);
  assert.equal(real.latestAnalysis(), null);
  assert.deepEqual(Object.values(state(demo).verifiedRuns), [0, 0, 0]);
});
test('failed run preserves last report and is marked as analysis pending', t => {
  const { store, input } = setup(t); const analysis = importAnalysis(store, input);
  const failed = store.beginRun(); store.addSource(failed.id, { platform: 'weibo', status: 'needs_login', count: 0, method: 'browser', notes: ['登录失效'] });
  store.finishRun(failed.id, { status: 'failed' });
  assert.equal(state(store).analysis.id, analysis.id); assert.equal(state(store).analysisPending, true);
  assert.match(reportMarkdown(analysis, { latestRun: store.getRun(failed.id) }), /上次已校验简报/);
});
test('single-platform updates retain the latest coverage of the other platforms', t => {
  const { store, run } = setup(t);
  store.addSource(run.id, { platform: 'bilibili', status: 'success', count: 20, method: 'browser', notes: [] });
  store.addSource(run.id, { platform: 'weibo', status: 'partial', count: 4, method: 'browser', notes: [] });
  const next = store.beginRun({ days: 7 });
  store.addSource(next.id, { platform: 'xiaohongshu', status: 'partial', count: 12, method: 'browser', notes: ['时间未知'] });
  store.finishRun(next.id, { status: 'partial' });
  assert.equal(store.coverage(next.id).length, 3);
  assert.equal(store.analysisInput(next.id).sources.length, 3);
});
test('exports preserve evidence and escape hostile HTML', t => {
  const { store, input } = setup(t); input.events[0].title = '<script>alert(1)</script>';
  const analysis = importAnalysis(store, input);
  assert.match(reportMarkdown(analysis), /热门新游/); assert.match(reportMarkdown(analysis), /电竞动态/); assert.match(reportMarkdown(analysis), /https:\/\//);
  assert.ok(!reportHtml(analysis).includes('<script>'));
});
test('human review cannot be replaced by unreviewed synthetic reference', t => {
  const { store, input, data } = setup(t); const analysis = importAnalysis(store, input);
  assert.throws(() => evaluateReview({ reviewer: 'tester', reviewedAt: new Date().toISOString(), items: data.benchmark }, analysis), /逐条确认/);
  // Independent evaluation mechanics only; these test labels do not constitute real acceptance.
  const result = evaluateReview({ reviewer: 'unit-test-only', reviewedAt: new Date().toISOString(), items: data.benchmark.map(i => ({ ...i, humanReviewed: true })) }, analysis);
  assert.equal(result.productAccuracy, 1); assert.equal(result.categoryAccuracy, 1); assert.equal(result.falseMergeRate, 0);
});
test('local HTTP server enforces mode isolation and read-only boundaries', async t => {
  const store = new Store('real', ':memory:'), server = createServer(store);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); store.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const json = await (await fetch(base + '/api/state?mode=demo')).json();
  assert.equal(json.mode, 'real'); assert.equal(json.analysis, null);
  assert.equal((await fetch(base + '/api/state', { method: 'POST' })).status, 405);
  assert.equal((await fetch(base + '/api/export.md')).status, 404);
  const hostileStatus = await new Promise((resolve, reject) => http.get(base + '/api/state', { headers: { host: 'attacker.test' } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject));
  assert.equal(hostileStatus, 403);
});
