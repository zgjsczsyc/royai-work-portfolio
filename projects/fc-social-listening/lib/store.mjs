import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { assert, normalizePost, DAY } from './domain.mjs';
import { parseTime } from './time.mjs';
const repository = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)));
export function dataRoot(mode = 'real') {
  assert(['real', 'demo'].includes(mode), 'mode 必须为 real 或 demo');
  const root = path.resolve(process.env.FC_RADAR_DATA_DIR || path.join(homedir(), '.local', 'share', 'fc-social-radar'));
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const resolved = realpathSync(root);
  assert(resolved !== repository && !resolved.startsWith(repository + path.sep), '运行数据目录必须位于作品集仓库之外');
  const dir = path.join(resolved, mode);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}
export class Store {
  constructor(mode = 'real', filename) {
    this.mode = mode;
    this.db = new DatabaseSync(filename ?? path.join(dataRoot(mode), 'radar.sqlite'));
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sources(id INTEGER PRIMARY KEY, run_id TEXT REFERENCES runs(id), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS captures(id INTEGER PRIMARY KEY, run_id TEXT REFERENCES runs(id), post_id TEXT REFERENCES posts(id), at TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(run_id,post_id));
      CREATE TABLE IF NOT EXISTS analyses(id TEXT PRIMARY KEY, run_id TEXT REFERENCES runs(id), generated_at TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS captures_post ON captures(post_id, at);
    `);
  }
  close() { this.db.close(); }
  transaction(fn) {
    this.db.exec('BEGIN');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  beginRun(extra = {}) {
    const run = { id: randomUUID(), startedAt: new Date().toISOString(), status: 'running', mode: this.mode, method: 'browser', ...extra };
    this.db.prepare('INSERT INTO runs VALUES(?,?,NULL,?)').run(run.id, run.startedAt, JSON.stringify(run));
    return run;
  }
  finishRun(id, extra = {}) {
    const current = this.getRun(id);
    assert(current, '采集记录不存在');
    const run = { ...current, finishedAt: new Date().toISOString(), ...extra };
    this.db.prepare('UPDATE runs SET finished_at=?,data=? WHERE id=?').run(run.finishedAt, JSON.stringify(run), id);
    return run;
  }
  getRun(id) { const row = this.db.prepare('SELECT data FROM runs WHERE id=?').get(id); return row ? JSON.parse(row.data) : null; }
  runs() { return this.db.prepare('SELECT data FROM runs ORDER BY started_at DESC, rowid DESC').all().map(r => JSON.parse(r.data)); }
  addSource(runId, result) { this.db.prepare('INSERT INTO sources(run_id,data) VALUES(?,?)').run(runId, JSON.stringify(result)); }
  sources(runId) { return this.db.prepare('SELECT data FROM sources WHERE run_id=? ORDER BY id').all(runId).map(r => JSON.parse(r.data)); }
  coverage(runId) {
    const target = this.getRun(runId);
    if (!target) return [];
    const runs = this.db.prepare('SELECT data FROM runs WHERE rowid <= (SELECT rowid FROM runs WHERE id=?) ORDER BY rowid DESC').all(runId).map(r => JSON.parse(r.data));
    const seen = new Set(), sources = [];
    for (const run of runs) {
      if (run.status === 'running' && run.id !== runId) continue;
      if (Date.parse(run.finishedAt ?? run.startedAt) < Date.parse(target.finishedAt ?? target.startedAt) - (target.days ?? 7) * DAY) continue;
      const candidates = this.sources(run.id).filter(s => !seen.has(s.platform));
      for (const source of candidates) sources.push({ ...source, runId: run.id, collectedAt: run.finishedAt ?? run.startedAt });
      for (const source of candidates) seen.add(source.platform);
    }
    return sources;
  }
  savePost(runId, input, method = 'browser') {
    assert(this.getRun(runId), '采集记录不存在');
    const post = normalizePost(input, { mode: this.mode, method });
    const prior = this.db.prepare('SELECT data FROM posts WHERE id=?').get(post.id);
    if (prior) post.topics = [...new Set([...JSON.parse(prior.data).topics, ...post.topics])];
    this.db.prepare('INSERT INTO posts VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(post.id, JSON.stringify(post));
    // Captures are immutable: repeated queries in the same run do not overwrite the first observation.
    this.db.prepare('INSERT OR IGNORE INTO captures(run_id,post_id,at,data) VALUES(?,?,?,?)').run(runId, post.id, post.collectedAt, JSON.stringify(post));
    return post;
  }
  posts() { return this.db.prepare('SELECT data FROM posts ORDER BY id').all().map(r => JSON.parse(r.data)); }
  captures(throughRunId) {
    const rows = throughRunId
      ? this.db.prepare('SELECT c.run_id,c.post_id,c.at,c.data FROM captures c JOIN runs r ON r.id=c.run_id WHERE r.rowid <= (SELECT rowid FROM runs WHERE id=?) ORDER BY c.at,c.id').all(throughRunId)
      : this.db.prepare('SELECT run_id,post_id,at,data FROM captures ORDER BY at,id').all();
    return rows.map(r => ({ runId: r.run_id, postId: r.post_id, at: r.at, post: JSON.parse(r.data) }));
  }
  analysisInput(runId) {
    const run = this.getRun(runId);
    assert(run && run.status !== 'running', '请先完成采集');
    const until = Date.parse(run.finishedAt);
    const since = until - (run.days ?? 1) * DAY;
    // Use captured versions, not later edits, so importing an older analysis remains reproducible.
    const byId = new Map();
    for (const cap of this.captures(runId)) {
      const post = { ...cap.post, publishedAt: cap.post.publishedAt ?? parseTime(cap.post.timeText, new Date(cap.post.collectedAt)) };
      if (Date.parse(cap.at) <= until && Date.parse(cap.at) >= since &&
          (post.publishedAt === null || Date.parse(post.publishedAt) >= since)) byId.set(cap.postId, post);
    }
    return { run, sources: this.coverage(runId), posts: [...byId.values()] };
  }
  saveAnalysis(analysis) {
    this.db.prepare('INSERT INTO analyses VALUES(?,?,?,?)').run(analysis.id, analysis.runId, analysis.generatedAt, JSON.stringify(analysis));
    return analysis;
  }
  analyses() { return this.db.prepare('SELECT data FROM analyses ORDER BY generated_at DESC,rowid DESC').all().map(r => JSON.parse(r.data)); }
  latestAnalysis() { return this.analyses()[0] ?? null; }
}
