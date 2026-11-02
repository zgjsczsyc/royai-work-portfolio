import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { dataRoot } from '../lib/store.mjs';

const root = readFileSync(path.join(dataRoot('real'), 'share/latest.txt'), 'utf8');
const snapshot = JSON.parse(readFileSync(path.join(root, 'state.json'), 'utf8'));
const prefix = '/fc-social-radar-snapshot/';
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (!pathname.startsWith(prefix) || req.method !== 'GET') { res.writeHead(404); res.end(); return; }
  const file = path.resolve(root, pathname.slice(prefix.length) || 'index.html');
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try {
    const content = readFileSync(file);
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8' }[path.extname(file)];
    res.writeHead(200, { 'Content-Type': type ?? 'application/octet-stream' }); res.end(content);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.FC_RADAR_SHARE_URL ?? `http://127.0.0.1:${server.address().port}${prefix}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
const errors = [], requests = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => requests.push(request.url()));
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
try {
  await page.goto(base); await page.locator('.focus-item').first().waitFor();
  check('Real snapshot is clearly labeled', (await page.locator('.mode-badge').innerText()).includes('真实采集快照'));
  check('Raw and cited sample counts are distinct', (await page.locator('.context-line').innerText()).includes('453') && (await page.locator('.banner.warning').first().innerText()).includes('69'));
  check('Local collection controls are hidden', await page.locator('.help-button').count() === 0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(root, '../overview-share.png'), fullPage: true });
  await page.getByRole('button', { name: '事件中心' }).click();
  for (const label of ['热门新游', '电竞赛事', '全部行业']) {
    await page.getByRole('tab', { name: label, exact: true }).click();
    check(`${label} has real events`, await page.locator('.event-row').count() > 0);
  }
  const count = await page.locator('.event-row').count();
  await page.addInitScript(() => { Date.now = () => Date.parse('2030-12-01T00:00:00Z'); });
  await page.reload(); await page.locator('.event-row').first().waitFor();
  await page.getByRole('tab', { name: '全部行业', exact: true }).click();
  check('Snapshot remains browsable after collection dates expire', await page.locator('.event-row').count() === count);
  for (const event of snapshot.analysis.events) {
    await page.goto(`${base}#event/${event.id}`); await page.locator('.detail-header').waitFor();
    check(`Evidence renders for ${event.id}`, await page.locator('.evidence-card').count() === event.evidence.length);
    const links = await page.locator('.evidence-top a').evaluateAll(elements => elements.map(a => a.href));
    check(`Original links preserved for ${event.id}`, links.every(link => /^https:\/\/(www\.)?(bilibili\.com|weibo\.com|xiaohongshu\.com)\//.test(link)));
  }
  await page.getByRole('button', { name: '本次简报', exact: true }).click();
  check('Report retains exclusions and review limitations', (await page.locator('.report-paper').innerText()).includes('384 条') && (await page.locator('.report-paper').innerText()).includes('人工质量验收'));
  for (const extension of ['md', 'html']) {
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: extension === 'md' ? '下载 Markdown ↓' : '下载 HTML ↓' }).click();
    check(`${extension} snapshot downloads`, (await download).suggestedFilename() === `report.${extension}`);
  }
  const published = await (await page.request.get(`${base}state.json`)).json();
  check('Hosted data matches exported snapshot', published.analysis.id === snapshot.analysis.id && published.analysis.posts.length === 69);
  const report = await (await page.request.get(`${base}report.html`)).text();
  check('HTML export retains snapshot date and uncertainty', report.includes(snapshot.snapshot.createdAt) && report.includes('尚未完成 60 条'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '今日概览', exact: true }).click(); await page.waitForTimeout(300);
  check('Mobile overview has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(root, '../overview-share-mobile.png'), fullPage: true });
  check('No browser runtime errors', errors.length === 0);
  check('No local API or third-party data dependencies', requests.every(url => !url.includes('/api/') && new URL(url).origin === new URL(base).origin));
  writeFileSync(path.join(root, '../share-validation.json'), JSON.stringify({ base, checks, errors, passed: checks.length }, null, 2));
  console.log(JSON.stringify({ base, passed: checks.length, errors }, null, 2));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
