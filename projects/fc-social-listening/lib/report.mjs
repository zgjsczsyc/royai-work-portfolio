import { PLATFORM_NAMES } from './domain.mjs';
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = value => String(value).replace(/[\[\]<>\\`*_#]/g, '\\$&').replace(/\r?\n/g, ' ');
export function reportSections(analysis) {
  const events = analysis?.events ?? [];
  return [
    { title: '优先处理', events: events.filter(e => e.relevance >= 50 && ['risk', 'mixed'].includes(e.direction)).slice(0, 5) },
    { title: '内容机会', events: events.filter(e => e.relevance >= 50 && e.direction === 'opportunity').slice(0, 5) },
    { title: '竞品变化', events: events.filter(e => e.categories.includes('竞品动态')).slice(0, 5) },
    { title: '热门新游', events: events.filter(e => e.categories.includes('热门新游')).sort((a, b) => (b.heatScore ?? -1) - (a.heatScore ?? -1)).slice(0, 5) },
    { title: '电竞动态', events: events.filter(e => e.categories.includes('电竞赛事')).sort((a, b) => (b.heatScore ?? -1) - (a.heatScore ?? -1)).slice(0, 5) },
  ];
}
export function reportMarkdown(analysis, { latestRun = null, snapshot = null } = {}) {
  if (!analysis) return '# FC Social Radar\n\n暂无已校验分析，请先采集并导入 Codex 分析。\n';
  const stale = latestRun && latestRun.id !== analysis.runId;
  const lines = ['# FC Social Radar · 本次简报', '', `模式：${analysis.mode === 'demo' ? '合成演示，全部内容为虚构' : '真实采集样本'}`, `生成时间：${analysis.generatedAt}`, `数据截至：${analysis.sourceCutoff}`, `评分版本：${analysis.scoreVersion}`, '',
    '数据范围：平台可见检索样本，不代表全网声量。分数为工作假设，不是实际业务损失预测。', ...(stale ? ['', '> 有更新的采集记录尚未完成分析；以下为上次已校验简报。'] : [])];
  const posts = new Map(analysis.posts.map(p => [p.id, p]));
  if (snapshot) lines.push(`只读分享快照：${snapshot.createdAt}；分析输入 ${snapshot.inputPosts} 条，展示引用证据 ${analysis.posts.length} 条。非 EA 官方产品；不会自动更新。`, '');
  for (const section of reportSections(analysis)) {
    lines.push('', `## ${section.title}`, '');
    if (!section.events.length) lines.push('当前没有足够材料，不补造内容。');
    for (const e of section.events) {
      lines.push(`### ${md(e.title)}`, '', md(e.summary), '', `关联度 ${e.relevance} · 潜在影响 ${e.impact} · 样本热度 ${e.heatScore ?? '样本不足'} · 证据 ${e.confidence}`, '', `FC 关联：${md(e.relevanceReason)}`, '', `建议：${md(e.action)}`, '', `待验证：${md(e.verify)}`, '');
      const matchTime = e.matchAt && e.matchTimePrecision === 'day' ? `${new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(e.matchAt))}（仅日期，准确时间未知）` : e.matchAt ?? '未知';
      if (e.gameName) lines.push(`游戏：${md(e.gameName)}；发行阶段：${md(e.releaseStage ?? '不适用')}；赛事：${md(e.tournamentName ?? '不适用')}；比赛时间：${md(matchTime)}`, '');
      for (const ref of e.evidence.slice(0, 3)) {
        const p = posts.get(ref.postId);
        lines.push(analysis.mode === 'demo' ? `- 合成证据 ${md(ref.postId)}：${md(ref.quote)}` : `- [${PLATFORM_NAMES[p.platform]} · ${md(p.id)}](${p.url})：${md(ref.quote)}`);
      }
    }
  }
  lines.push('', '## 数据缺口', '');
  const excluded = snapshot?.excludedPosts ?? analysis.excludedPostIds.length;
  if (excluded) lines.push(`- ${excluded} 条检索样本未纳入重点事件，保留在本地分析输入中供复核。`);
  for (const limitation of analysis.limitations ?? []) lines.push(`- ${md(limitation)}`);
  for (const source of analysis.sources) lines.push(`- ${PLATFORM_NAMES[source.platform]} · ${md(source.query ?? '平台访问')}：${md(source.status)}，${source.count ?? 0} 条；${md((source.notes ?? []).join('；'))}`);
  return lines.join('\n') + '\n';
}
export function reportHtml(analysis, options) {
  const body = reportMarkdown(analysis, options).split('\n').map(line => {
    const heading = line.match(/^(#{1,3}) (.*)$/);
    if (heading) return `<h${heading[1].length}>${escapeHtml(heading[2])}</h${heading[1].length}>`;
    const evidence = line.match(/^- \[([^\]]+)\]\((https:\/\/[^\s)]+)\)：(.*)$/);
    if (evidence) return `<p><a href="${escapeHtml(evidence[2])}" rel="noopener noreferrer" target="_blank">${escapeHtml(evidence[1])}</a>：${escapeHtml(evidence[3])}</p>`;
    return line ? `<p>${escapeHtml(line)}</p>` : '';
  }).join('\n');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>FC Social Radar 简报</title><style>body{max-width:900px;margin:48px auto;padding:0 24px;font:16px/1.85 system-ui;color:#18332b}h1,h2,h3{line-height:1.5}h2{border-top:1px solid #ddd;padding-top:24px}p{overflow-wrap:anywhere}@media print{body{margin:0}h2,h3{break-after:avoid}}</style><body>${body}</body></html>`;
}
