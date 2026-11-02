import test from 'node:test';
import assert from 'node:assert/strict';
import { shareState } from '../lib/share.mjs';
import { reportMarkdown, reportHtml } from '../lib/report.mjs';

function fixture() {
  const post = { id: 'bilibili:BV1', platform: 'bilibili', url: 'https://www.bilibili.com/video/BV1?session=PRIVATE', text: 'UNPUBLISHED_RAW_TEXT', authorId: 'PRIVATE_AUTHOR', comments: ['PRIVATE_COMMENT'], collectedAt: '2026-11-02T03:00:00Z', publishedAt: null, method: 'browser' };
  const event = { id: 'event1', title: '待核实的活动讨论', summary: '仅代表可见样本', categories: ['版本活动'], relevance: 100, direction: 'risk', confidence: 'unverified', evidence: [{ postId: post.id, role: 'claim', quote: '公开引用片段', extra: 'PRIVATE_EXTRA' }], timeline: [], impactDimensions: { strength: 1, reach: 1, urgency: 1, duration: 1 }, heat: [], internal: 'PRIVATE_EVENT' };
  const source = { platform: 'weibo', status: 'failed', count: 0, method: 'browser', notes: ['部分发布时间不可读', 'page.goto: Timeout /var/mock-session'], debug: 'PRIVATE_DEBUG' };
  return { mode: 'real', latestRun: { id: 'run1', status: 'partial', diagnostics: 'PRIVATE_RUN' }, sources: [source], analysisPending: false, verifiedRuns: { bilibili: 2 }, categories: ['版本活动'], analysis: { id: 'analysis1', runId: 'run1', mode: 'real', sourceCutoff: '2026-11-02T03:00:00Z', generatedAt: '2026-11-02T04:00:00Z', events: [event], posts: [post, { ...post, id: 'excluded', text: 'PRIVATE_EXCLUDED' }], excludedPostIds: ['excluded'], sources: [source], limitations: ['尚未完成独立人工质量验收'], rawInput: 'PRIVATE_INPUT' } };
}

test('share exports only cited evidence and public fields while retaining uncertainty', () => {
  const local = fixture(), snapshot = shareState(local, '2026-11-02T05:00:00Z');
  const serialized = JSON.stringify(snapshot);
  assert.equal(snapshot.analysis.posts.length, 1);
  assert.equal(snapshot.snapshot.inputPosts, 2);
  assert.equal(snapshot.snapshot.excludedPosts, 1);
  assert.equal(snapshot.analysis.posts[0].url, 'https://www.bilibili.com/video/BV1');
  assert.equal(snapshot.analysis.events[0].confidence, 'unverified');
  assert.equal(snapshot.sources[0].status, 'failed');
  assert.equal(snapshot.sources[0].notes[0], '部分发布时间不可读');
  assert.ok(!/PRIVATE|UNPUBLISHED|\/home\/|session/.test(serialized));
  assert.equal(local.analysis.posts.length, 2);
  const options = { snapshot: snapshot.snapshot };
  for (const report of [reportMarkdown(snapshot.analysis, options), reportHtml(snapshot.analysis, options)]) {
    assert.ok(report.includes('只读分享快照'));
    assert.ok(report.includes('1 条检索样本未纳入重点事件'));
    assert.ok(report.includes('尚未完成独立人工质量验收'));
    assert.ok(!report.includes('PRIVATE'));
  }
});

test('share refuses demo, missing evidence and off-platform links', () => {
  assert.throws(() => shareState({ ...fixture(), mode: 'demo' }), /真实/);
  const missing = fixture(); missing.analysis.posts = [];
  assert.throws(() => shareState(missing), /证据缺失/);
  for (const url of ['javascript:alert(1)', 'https://evil.example/x', 'https://name:secret@www.bilibili.com/x']) {
    const local = fixture(); local.analysis.posts[0].url = url;
    assert.throws(() => shareState(local), /证据链接/);
  }
});
