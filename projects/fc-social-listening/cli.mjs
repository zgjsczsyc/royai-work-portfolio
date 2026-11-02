import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { Store, dataRoot } from './lib/store.mjs';
import { collect, login } from './lib/collectors.mjs';
import { prepareInput, importAnalysis } from './lib/analysis.mjs';
import { seedDemo, fixture } from './lib/demo.mjs';
import { assert, PLATFORMS } from './lib/domain.mjs';
import { evaluateReview } from './lib/review.mjs';

const args = process.argv.slice(2), command = args[0];
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const jsonFile = name => JSON.parse(readFileSync(option(name), 'utf8'));
async function main() {
  if (!command || command === 'help') {
    console.log(`FC Social Radar · 本地手动工作流
  login --platform bilibili|weibo|xiaohongshu
  collect [--platform bilibili] [--days 7] [--probe] [--headless]
  collect --discovery /绝对路径/discovery.json
  import-posts --file /绝对路径/posts.json
  prepare-analysis [--run RUN_ID]
  import-analysis --file /绝对路径/analysis.json
  status
  review-template
  evaluate-review --file /绝对路径/human-review.json
  seed-demo
默认真实数据模式；可选 --mode demo（仅演示相关命令）。数据保存在仓库外。`);
    return;
  }
  if (command === 'login') { await login(option('platform')); return; }
  const mode = command === 'seed-demo' ? 'demo' : option('mode', 'real');
  const store = new Store(mode);
  try {
    if (command === 'collect') {
      const result = await collect(store, { platforms: option('platform') ? [option('platform')] : PLATFORMS,
        days: option('days') ? Number(option('days')) : undefined, probe: args.includes('--probe'), headless: args.includes('--headless'), discoveryFile: option('discovery') });
      console.log(JSON.stringify(result, null, 2));
    } else if (command === 'prepare-analysis') {
      const runId = option('run', store.runs().find(r => r.status !== 'running')?.id);
      assert(runId, '还没有采集记录，请先 collect 或 import-posts');
      const input = prepareInput(store, runId);
      const dir = path.join(dataRoot(mode), 'analysis-input', runId);
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      const file = path.join(dir, 'input.json');
      writeFileSync(file, JSON.stringify(input, null, 2), { mode: 0o600 });
      console.log(JSON.stringify({ file, posts: input.posts.length, runId, next: '让 Codex 读取 input.json，按 outputShape 生成 analysis.json；再执行 import-analysis。' }, null, 2));
    } else if (command === 'import-analysis') {
      const analysis = store.transaction(() => importAnalysis(store, jsonFile('file')));
      console.log(JSON.stringify({ id: analysis.id, events: analysis.events.length, mode, generatedAt: analysis.generatedAt }, null, 2));
    } else if (command === 'import-posts') {
      const input = jsonFile('file');
      assert(Array.isArray(input.posts) && input.posts.length > 0 && input.posts.length <= 5000, 'posts 必须为非空数组，最多 5000 条');
      const run = store.transaction(() => {
        const r = store.beginRun({ method: 'manual', days: 30 });
        const normalized = input.posts.map(p => store.savePost(r.id, p, 'manual'));
        for (const platform of PLATFORMS) {
          const count = normalized.filter(p => p.platform === platform).length;
          if (count) store.addSource(r.id, { platform, query: '人工导入', status: 'partial', method: 'manual', count, notes: ['人工补充材料，不计为自动采集成功'] });
        }
        return store.finishRun(r.id, { status: 'partial', count: normalized.length });
      });
      console.log(JSON.stringify(run, null, 2));
    } else if (command === 'seed-demo') {
      const result = seedDemo(store);
      const benchmarkPath = path.join(dataRoot('demo'), 'synthetic-reference.json');
      writeFileSync(benchmarkPath, JSON.stringify(result.benchmark ?? fixture().benchmark, null, 2));
      console.log(JSON.stringify({ mode: 'demo', events: result.analysis.events.length, posts: result.analysis.posts.length, benchmarkPath, note: '60 条合成测试参考，不等于人工复核或真实采集验收。' }, null, 2));
    } else if (command === 'status') {
      console.log(JSON.stringify({ mode, directory: dataRoot(mode), posts: store.posts().length, runs: store.runs().map(r => ({ ...r, sources: store.sources(r.id) })), latestAnalysis: store.latestAnalysis()?.id ?? null }, null, 2));
    } else if (command === 'review-template') {
      assert(mode === 'real', '人工验收模板必须来自真实数据');
      const corpus = store.latestAnalysis()?.posts ?? store.posts();
      const queues = PLATFORMS.map(platform => corpus.filter(p => p.platform === platform));
      const reviewPosts = [];
      for (let i = 0; reviewPosts.length < 300 && queues.some(q => q[i]); i++) for (const queue of queues) if (queue[i] && reviewPosts.length < 300) reviewPosts.push(queue[i]);
      const template = { reviewer: '', reviewedAt: '', note: '由人独立填写，不能复制模型预测充当标注。证据不足时补充真实样本。',
        items: reviewPosts.map(p => ({ postId: p.id, url: p.url, text: p.text, expectedProduct: '', expectedCategories: [], expectedEvent: '', humanReviewed: false })) };
      const file = path.join(dataRoot(mode), 'human-review.json');
      writeFileSync(file, JSON.stringify(template, null, 2), { flag: 'wx', mode: 0o600 });
      console.log(file);
    } else if (command === 'evaluate-review') {
      const result = evaluateReview(jsonFile('file'), store.latestAnalysis());
      console.log(JSON.stringify(result, null, 2));
      if (!result.passed) process.exitCode = 1;
    } else throw new Error(`未知命令：${command}；运行 npm run radar -- help`);
  } finally { store.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
