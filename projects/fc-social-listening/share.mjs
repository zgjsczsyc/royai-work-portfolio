import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Store, dataRoot } from './lib/store.mjs';
import { state } from './server.mjs';
import { shareState } from './lib/share.mjs';
import { reportMarkdown, reportHtml } from './lib/report.mjs';

const project = fileURLToPath(new URL('./', import.meta.url));
const store = new Store('real');
try {
  const snapshot = shareState(state(store));
  const output = path.join(dataRoot('real'), 'share', snapshot.snapshot.createdAt.replace(/[:.]/g, '-'));
  mkdirSync(output, { recursive: true, mode: 0o700 });
  // Build into a dedicated directory so the local dashboard keeps its normal API mode.
  const build = spawnSync('npm', ['run', 'build', '--', '--outDir', output], { cwd: project, env: { ...process.env, VITE_RADAR_SNAPSHOT: '1' }, stdio: 'inherit' });
  if (build.status !== 0) throw new Error('分享版构建失败');
  writeFileSync(path.join(output, 'state.json'), JSON.stringify(snapshot));
  for (const [extension, render] of [['md', reportMarkdown], ['html', reportHtml]]) {
    writeFileSync(path.join(output, `report.${extension}`), render(snapshot.analysis, { latestRun: snapshot.latestRun, snapshot: snapshot.snapshot }));
  }
  writeFileSync(path.join(output, '.nojekyll'), '');
  writeFileSync(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  const index = path.join(output, 'index.html');
  writeFileSync(index, readFileSync(index, 'utf8').replace('<head>', '<head><meta name="robots" content="noindex,nofollow">'));
  // A stable pointer contains only a local path, never copied into the site.
  writeFileSync(path.join(dataRoot('real'), 'share', 'latest.txt'), realpathSync(output));
  console.log(JSON.stringify({ output, events: snapshot.analysis.events.length, evidence: snapshot.analysis.posts.length, snapshot: snapshot.snapshot }, null, 2));
} finally { store.close(); }
