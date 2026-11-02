import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { dataRoot } from './store.mjs';
import { PLATFORMS, assert, parseCount, DAY } from './domain.mjs';
import { parseTime } from './time.mjs';
export { parseTime } from './time.mjs';

export const adapters = {
  bilibili: {
    home: 'https://www.bilibili.com',
    search: q => `https://search.bilibili.com/all?keyword=${encodeURIComponent(q)}&order=pubdate`,
    card: '.bili-video-card', link: 'a[href*="/video/"]', title: 'h3',
    author: '.bili-video-card__info--author', time: '.bili-video-card__info--date',
    metrics: { views: '.bili-video-card__stats--item:first-child' },
    detailText: '.basic-desc-info', comment: '.reply-content',
  },
  weibo: {
    home: 'https://weibo.com',
    search: q => `https://s.weibo.com/weibo?q=${encodeURIComponent(q)}&timescope=custom:&Refer=g`,
    card: '.card-wrap[action-type="feed_list_item"]', link: '.from a[href*="weibo.com"]',
    title: '[node-type="feed_list_content_full"], [node-type="feed_list_content"]', author: '.name', time: '.from a:first-child',
    metrics: { shares: '.card-act li:nth-child(2)', comments: '.card-act li:nth-child(3)', likes: '.card-act li:nth-child(4)' },
    detailText: '[class*="detail_wbtext"]', comment: '[class*="text"] [class*="comment"]',
  },
  xiaohongshu: {
    home: 'https://www.xiaohongshu.com/explore',
    // Current desktop search opens this route with a twice-encoded keyword.
    // Only the note cards are collected; the separate AI answer panel is ignored.
    search: q => `https://www.xiaohongshu.com/search_result_ai?keyword=${encodeURIComponent(encodeURIComponent(q))}&source=unknown`,
    card: 'section.note-item', link: 'a.cover', title: '.title', author: '.author .name', time: '.date',
    metrics: { likes: '.like-wrapper .count' }, detailText: '#detail-desc', comment: '.comment-item .content',
  },
};
export function nativeId(platform, href) {
  const pathname = new URL(href).pathname;
  if (platform === 'bilibili') return pathname.match(/\/video\/(BV[A-Za-z0-9]+|av\d+)/)?.[1] ?? null;
  if (platform === 'weibo') return pathname.split('/').filter(Boolean).at(-1) ?? null;
  return pathname.match(/\/(?:explore|search_result)\/([a-f0-9]{24})/)?.[1] ?? null;
}
export function pageState({ status, url, text, cards, loginVisible = false }) {
  if ([403, 412, 429, 432].includes(status) || (cards === 0 && /安全验证|访问异常|访问频繁|验证码|访问受限|Access Denied|captcha/i.test(text))) return 'restricted';
  if (/\/login(?:[/?]|$)|passport\./.test(url) || (cards === 0 && (loginVisible || /登录后.{0,12}(查看|搜索)|扫码登录|请先登录/.test(text)))) return 'needs_login';
  if (status >= 400) return 'failed';
  if (cards > 0) return 'success';
  if (/暂无搜索结果|没有找到相关|未找到相关|没有搜到/.test(text)) return 'success';
  return 'parse_failed';
}
export async function openContext(platform, { headless = false } = {}) {
  assert(PLATFORMS.includes(platform), '未知平台');
  const profile = path.join(dataRoot('real'), 'browser-profiles', platform);
  mkdirSync(profile, { recursive: true, mode: 0o700 });
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome', headless, viewport: { width: 1360, height: 900 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai',
  });
  context.setDefaultTimeout(10000);
  return context;
}
export async function login(platform) {
  const context = await openContext(platform);
  const page = context.pages()[0] || await context.newPage();
  await page.goto(adapters[platform].home, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  console.log(`已打开 ${platform} 专用浏览器。请手动登录，完成后关闭这个浏览器窗口以保存会话。`);
  await new Promise(resolve => context.once('close', resolve));
}
async function extractCards(page, spec) {
  const selectors = { link: spec.link, title: spec.title, author: spec.author, time: spec.time, metrics: spec.metrics };
  return page.locator(spec.card).evaluateAll((cards, adapter) => cards.slice(0, 20).map(card => {
    const text = selector => card.querySelector(selector)?.textContent?.trim() || null;
    const href = card.querySelector(adapter.link)?.href;
    const authorHref = card.querySelector(adapter.author)?.closest('a')?.href;
    const author = authorHref ? new URL(authorHref).origin + new URL(authorHref).pathname : null;
    return { href, title: text(adapter.title), authorName: text(adapter.author), authorId: author,
      timeText: text(adapter.time), rawMetrics: Object.fromEntries(Object.entries(adapter.metrics).map(([key, selector]) => [key, text(selector)])) };
  }), selectors);
}
export async function collectQuery(page, platform, query, { days, group, detail = true }) {
  const spec = adapters[platform], started = new Date();
  const result = { platform, query, group, status: 'failed', count: 0, startedAt: started.toISOString(), method: 'browser', notes: [], posts: [] };
  try {
    const response = await page.goto(spec.search(query), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    if (platform === 'xiaohongshu') await page.locator(spec.card).first().waitFor({ state: 'attached', timeout: 12000 }).catch(() => {});
    const text = (await page.locator('body').innerText()).slice(0, 30000);
    const cards = await page.locator(spec.card).count();
    result.status = pageState({ status: response?.status() ?? 0, url: page.url(), text, cards });
    if (platform === 'xiaohongshu' && result.status === 'success' && !new URL(page.url()).pathname.startsWith('/search_result')) result.status = 'parse_failed';
    if (result.status !== 'success') {
      result.notes.push(`页面状态 ${response?.status() ?? '无响应'}，${result.status === 'needs_login' ? '请在专用会话登录' : '未获得可用搜索结果；未绕过限制'}`);
      return result;
    }
    const raw = await extractCards(page, spec);
    let invalid = 0, detailsFailed = 0;
    for (const card of raw) {
      if (!card.href || !card.title) { invalid++; continue; }
      const id = nativeId(platform, card.href);
      if (!id) { invalid++; continue; }
      const publishedAt = parseTime(card.timeText, started);
      if (publishedAt && Date.parse(publishedAt) < started.getTime() - days * DAY) continue;
      const clean = new URL(card.href);
      // XHS security tokens are needed only for this navigation; never persist them in evidence URLs.
      const canonicalUrl = platform === 'xiaohongshu' ? `https://www.xiaohongshu.com/explore/${id}` : `${clean.origin}${clean.pathname}`;
      const metrics = Object.fromEntries(Object.entries(card.rawMetrics).map(([key, value]) => [key, parseCount(value?.replace(/^(转发|评论|赞)\s*/, ''))]));
      const post = { platform, nativeId: id, url: canonicalUrl, title: card.title, text: card.title,
        authorName: card.authorName, authorId: card.authorId, publishedAt, collectedAt: new Date().toISOString(),
        metrics, topics: [group], comments: [], sourceType: 'unknown', coverage: 'search', timeText: card.timeText };
      // Inspect at most three priority posts per query, keeping both navigation and comment volume bounded.
      if (detail && result.posts.length < 3) {
        const tab = await page.context().newPage();
        try {
          const detailResponse = await tab.goto(card.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
          await tab.waitForTimeout(1200);
          const detailBody = (await tab.locator('body').innerText()).slice(0, 30000);
          const content = await tab.locator(spec.detailText).first().textContent({ timeout: 3000 }).catch(() => null);
          const detailState = pageState({ status: detailResponse?.status() ?? 0, url: tab.url(), text: detailBody, cards: content ? 1 : 0 });
          if (detailState === 'success' && content?.trim()) {
            post.text = `${card.title}\n${content.trim()}`;
            post.coverage = 'detail';
            if (platform === 'xiaohongshu' && post.publishedAt === null) {
              const detailTime = await tab.locator('.note-content .date, .bottom-container .date, .date').first().textContent({ timeout: 1500 }).catch(() => null);
              if (detailTime) { post.timeText = detailTime.trim(); post.publishedAt = parseTime(post.timeText, started); }
            }
            post.comments = await tab.locator(spec.comment).evaluateAll(nodes => nodes.slice(0, 20).map(n => n.textContent?.trim()).filter(Boolean));
          } else detailsFailed++;
        } catch { detailsFailed++; }
        finally { await tab.close(); }
      }
      if (post.publishedAt && Date.parse(post.publishedAt) < started.getTime() - days * DAY) continue;
      result.posts.push(post);
    }
    result.count = result.posts.length;
    if (invalid || detailsFailed || result.posts.some(p => p.publishedAt === null)) result.status = result.count ? 'partial' : 'parse_failed';
    if (invalid) result.notes.push(`${invalid} 条结果缺少 ID 或正文`);
    if (detailsFailed) result.notes.push(`${detailsFailed} 条详情不可读，保留搜索摘要`);
    if (result.posts.some(p => p.publishedAt === null)) result.notes.push('部分发布时间不可读，时间窗口覆盖不完整');
    if (cards >= 20) result.notes.push('每次检索最多前 20 条，不代表全平台声量');
    return result;
  } catch (e) { result.status = result.posts.length ? 'partial' : 'failed'; result.count = result.posts.length; result.notes.push(String(e.message).split('\n')[0]); return result; }
}
export async function collect(store, { platforms = PLATFORMS, days, probe = false, headless = false, discoveryFile } = {}) {
  assert(store.mode === 'real', '真实采集禁止写入演示数据库');
  const prior = store.runs().some(r => r.method === 'browser' && !r.probe && ['success', 'partial'].includes(r.status));
  const windowDays = days ?? (prior ? 1 : 7);
  assert(Number.isFinite(windowDays) && windowDays >= 1 && windowDays <= 30, 'days 需在 1—30 内');
  const config = JSON.parse(readFileSync(new URL('../config/queries.json', import.meta.url), 'utf8'));
  let queries = config.flatMap(g => g.keywords.map(q => ({ group: g.group, query: q })));
  if (probe) queries = queries.slice(0, 1);
  let discoveries = [];
  if (discoveryFile) {
    const input = JSON.parse(readFileSync(discoveryFile, 'utf8'));
    assert(Array.isArray(input.candidates), 'discovery 文件需要 candidates 数组');
    const posts = new Map(store.posts().map(p => [p.id, p]));
    discoveries = input.candidates.map(c => {
      assert(['game', 'tournament'].includes(c.kind) && typeof c.name === 'string' && c.name.length <= 80 && c.name.trim(), '发现实体无效');
      assert(Array.isArray(c.evidenceIds) && c.evidenceIds.length && c.evidenceIds.every(id => posts.has(id)), '发现实体需要本地证据');
      // Rank by within-platform percentiles, never by raw sums across platforms.
      const strengths = c.evidenceIds.map(id => {
        const p = posts.get(id), key = ['likes', 'comments', 'views', 'shares'].find(k => p.metrics[k] !== null);
        const value = key ? p.metrics[key] : null;
        const peers = key ? [...posts.values()].filter(x => x.platform === p.platform && x.metrics[key] !== null).map(x => x.metrics[key]) : [];
        return value === null || !peers.length ? 0 : peers.filter(x => x <= value).length / peers.length;
      });
      return { ...c, strength: Math.max(...strengths), group: c.kind === 'game' ? '热门新游' : '电竞赛事' };
    }).sort((a, b) => b.strength - a.strength || a.name.localeCompare(b.name)).slice(0, 5);
    queries = discoveries.map(c => ({ query: `${c.name} 官方`, group: c.group }));
  }
  const run = store.beginRun({ days: windowDays, probe, discoveries, queries });
  const outcomes = [];
  try {
    for (const platform of platforms) {
      assert(PLATFORMS.includes(platform), '未知平台');
      let context;
      try {
        context = await openContext(platform, { headless });
        const page = context.pages()[0] || await context.newPage();
        let consecutiveFailures = 0;
        for (const { query, group } of queries) {
          console.log(`[${platform}] ${query}`);
          const result = await collectQuery(page, platform, query, { days: windowDays, group, detail: !probe });
          const { posts, ...source } = result;
          store.transaction(() => { for (const post of posts) store.savePost(run.id, post); store.addSource(run.id, source); });
          outcomes.push(source);
          console.log(`  ${source.status}: ${source.count} 条`);
          if (['restricted', 'needs_login'].includes(source.status)) break;
          consecutiveFailures = ['failed', 'parse_failed'].includes(source.status) ? consecutiveFailures + 1 : 0;
          if (consecutiveFailures >= 2) { console.log('  连续两次访问或解析失败，停止本平台后续检索。'); break; }
          await page.waitForTimeout(1500);
        }
      } catch (e) {
        const failed = { platform, status: 'failed', count: 0, query: null, notes: [String(e.message).split('\n')[0]], method: 'browser' };
        store.addSource(run.id, failed); outcomes.push(failed);
      } finally { await context?.close(); }
    }
    const count = store.captures().filter(c => c.runId === run.id).length;
    return store.finishRun(run.id, { status: outcomes.length && outcomes.every(s => s.status === 'success') ? 'success' : count ? 'partial' : 'failed', count });
  } catch (e) { store.finishRun(run.id, { status: 'failed', error: e.message }); throw e; }
}
