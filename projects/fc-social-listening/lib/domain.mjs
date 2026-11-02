import { createHash } from 'node:crypto';
export const PLATFORMS = ['bilibili', 'weibo', 'xiaohongshu'];
export const PLATFORM_NAMES = { bilibili: 'B站', weibo: '微博', xiaohongshu: '小红书' };
export const CATEGORIES = ['版本活动', '玩法体验', '商业化', '服务故障', '社区口碑', '竞品动态', '足球热点', '热门新游', '电竞赛事', '行业政策'];
export const STATUSES = ['success', 'partial', 'needs_login', 'restricted', 'parse_failed', 'failed'];
export const SCORE_VERSION = 'sample-v1';
export const SCHEMA_VERSION = 1;
export const DAY = 86400000;
export const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 20);
export const postId = (platform, nativeId) => `${platform}:${nativeId}`;
export function assert(condition, message) { if (!condition) throw new Error(message); }
export function validDate(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)); }
export function safeUrl(value, platform) {
  try {
    const u = new URL(value);
    const domain = { bilibili: 'bilibili.com', weibo: 'weibo.com', xiaohongshu: 'xiaohongshu.com' }[platform];
    const allowed = domain && (u.hostname === domain || u.hostname.endsWith(`.${domain}`) || (platform === 'weibo' && u.hostname === 'm.weibo.cn'));
    return u.protocol === 'https:' && !u.username && !u.password && allowed;
  } catch { return false; }
}
export function normalizePost(input, { mode = 'real', method = 'browser', now = new Date().toISOString() } = {}) {
  assert(PLATFORMS.includes(input.platform), '未知平台');
  assert(typeof input.nativeId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(input.nativeId), '缺少合法平台 ID');
  assert(safeUrl(input.url, input.platform), '原文 URL 必须属于对应平台且使用 HTTPS');
  assert(typeof input.text === 'string' && input.text.trim(), '帖子正文不能为空');
  assert(input.publishedAt == null || validDate(input.publishedAt), '发布时间无效');
  assert(validDate(input.collectedAt ?? now), '采集时间无效');
  const metrics = {};
  for (const key of ['likes', 'comments', 'shares', 'views', 'favorites']) {
    const n = input.metrics?.[key] ?? null;
    assert(n === null || (Number.isFinite(n) && n >= 0), `无效指标 ${key}`);
    metrics[key] = n;
  }
  return { ...input, id: postId(input.platform, input.nativeId), title: String(input.title ?? '').slice(0, 500),
    text: input.text.slice(0, 30000), authorId: input.authorId || null, authorName: input.authorName || null,
    publishedAt: input.publishedAt ?? null, collectedAt: input.collectedAt ?? now, metrics,
    comments: (input.comments ?? []).slice(0, 20), method, mode, topics: input.topics ?? [],
    sourceType: ['official', 'firsthand', 'repost', 'unknown'].includes(input.sourceType) ? input.sourceType : 'unknown' };
}
export function parseCount(text) {
  if (text == null) return null;
  const s = String(text).replace(/,/g, '').trim();
  if (!/^\d/.test(s)) return null;
  const match = s.match(/^(\d+(?:\.\d+)?)\s*(亿|万|[kKmM])?/);
  return match ? Math.round(Number(match[1]) * ({ 亿: 1e8, 万: 1e4, k: 1e3, K: 1e3, m: 1e6, M: 1e6 }[match[2]] ?? 1)) : null;
}
