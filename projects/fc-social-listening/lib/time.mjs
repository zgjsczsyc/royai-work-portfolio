import { DAY } from './domain.mjs';
export function parseTime(value, now = new Date()) {
  if (!value) return null;
  const s = value.trim().replace(/^[·•\s]+/, '').replace(/^(?:编辑于|发布于)\s*/, '');
  const relative = s.match(/(\d+)\s*(分钟|小时|天)前/);
  if (relative) return new Date(now.getTime() - Number(relative[1]) * ({ 分钟: 60000, 小时: 3600000, 天: DAY }[relative[2]])).toISOString();
  if (/刚刚/.test(s)) return now.toISOString();
  const today = s.match(/^(今天|昨天|前天)(?:\s*(\d{1,2}):(\d{2}))?/);
  if (today) {
    const offset = { 今天: 0, 昨天: 1, 前天: 2 }[today[1]];
    const date = new Date(now.getTime() + 8 * 3600000 - offset * DAY).toISOString().slice(0, 10);
    return new Date(`${date}T${(today[2] ?? '00').padStart(2, '0')}:${today[3] ?? '00'}:00+08:00`).toISOString();
  }
  const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Shanghai' }).format(now));
  const full = s.match(/(20\d{2})[-年/](\d{1,2})[-月/](\d{1,2})(?:日)?(?:\s+(\d{1,2}):(\d{2}))?/);
  let parts = full && full.slice(1);
  if (!parts) {
    const short = s.match(/^(\d{1,2})[-月/](\d{1,2})(?:日)?(?:\s+(\d{1,2}):(\d{2}))?/);
    if (short) parts = [String(year), ...short.slice(1)];
  }
  if (!parts) return null;
  const [y, m, d, h, min] = parts;
  if (+m < 1 || +m > 12 || +d < 1 || +d > 31 || +(h ?? 0) > 23 || +(min ?? 0) > 59) return null;
  let t = Date.parse(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${(h || '00').padStart(2, '0')}:${min || '00'}:00+08:00`);
  if (!full && t > now.getTime() + DAY) t = Date.parse(`${year - 1}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00+08:00`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
