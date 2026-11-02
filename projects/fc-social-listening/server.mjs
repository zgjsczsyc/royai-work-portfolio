import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Store } from './lib/store.mjs';
import { PLATFORMS, CATEGORIES } from './lib/domain.mjs';
import { reportMarkdown, reportHtml, reportSections } from './lib/report.mjs';

export function state(store) {
  const runs = store.runs();
  const latestRun = runs[0] ?? null, analysis = store.latestAnalysis();
  const sources = latestRun ? store.coverage(latestRun.id) : [];
  const verifiedRuns = Object.fromEntries(PLATFORMS.map(platform => [platform, runs.filter(run => run.mode === 'real' && run.method === 'browser' && store.sources(run.id).some(s => s.platform === platform && s.count > 0 && ['success', 'partial'].includes(s.status))).length]));
  const visibleAnalysis = analysis ? { ...analysis } : null;
  if (visibleAnalysis) delete visibleAnalysis.rawInput;
  return { mode: store.mode, latestRun, sources, analysis: visibleAnalysis, categories: CATEGORIES,
    analysisPending: Boolean(latestRun && latestRun.id !== analysis?.runId),
    sections: reportSections(analysis), verifiedRuns,
    runs: runs.slice(0, 20).map(r => ({ ...r, sources: store.sources(r.id) })),
    notes: ['热度仅代表检索样本，不能解释为全网声量。', '人工导入与合成演示不计入真实平台验收。'] };
}
export function createServer(store) {
  const dist = fileURLToPath(new URL('./dist/', import.meta.url));
  return http.createServer((req, res) => {
    const send = (status, type, content) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" }); res.end(content); };
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const host = (req.headers.host ?? '').split(':')[0];
      if (!['127.0.0.1', 'localhost'].includes(host)) return send(403, 'text/plain', '仅允许本机访问');
      if (req.method !== 'GET') return send(405, 'text/plain', '只读看板；通过本地命令更新数据');
      if (url.pathname === '/api/state') return send(200, 'application/json; charset=utf-8', JSON.stringify(state(store)));
      if (['/api/export.md', '/api/export.html'].includes(url.pathname)) {
        const analysis = store.latestAnalysis();
        if (!analysis) return send(404, 'application/json; charset=utf-8', JSON.stringify({ error: '暂无已校验简报' }));
        const html = url.pathname.endsWith('.html');
        res.setHeader('Content-Disposition', `attachment; filename="fc-radar-${store.mode}.${html ? 'html' : 'md'}"`);
        return send(200, html ? 'text/html; charset=utf-8' : 'text/markdown; charset=utf-8', (html ? reportHtml : reportMarkdown)(analysis, { latestRun: store.runs()[0] }));
      }
      if (url.pathname.startsWith('/api/')) return send(404, 'application/json', '{"error":"not_found"}');
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.resolve(dist, relative);
      if (!file.startsWith(path.resolve(dist) + path.sep)) return send(403, 'text/plain', 'Forbidden');
      if (!existsSync(file)) return send(404, 'text/plain; charset=utf-8', '资源不存在；首次启动前请执行 npm run build');
      const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }[path.extname(file)] ?? 'application/octet-stream';
      return send(200, type, readFileSync(file));
    } catch { send(500, 'application/json; charset=utf-8', JSON.stringify({ error: '读取失败，请查看本地数据与构建状态' })); }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), i = args.indexOf('--mode'), mode = i < 0 ? 'real' : args[i + 1];
  const p = args.indexOf('--port'), port = p < 0 ? (mode === 'demo' ? 8771 : 8770) : Number(args[p + 1]);
  const store = new Store(mode), server = createServer(store);
  server.listen(port, '127.0.0.1', () => console.log(`FC Social Radar · ${mode} · http://127.0.0.1:${port}`));
  server.on('error', error => { console.error(error.message); store.close(); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
}
