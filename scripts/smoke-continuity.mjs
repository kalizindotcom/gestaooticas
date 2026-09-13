import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const dataDirectory = await mkdtemp(path.join(tmpdir(), 'otica-ci-continuity-'));
let child;
let baseUrl;
let token;
let output = '';

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function startServer(port) {
  child = spawn(process.execPath, ['dist-server/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      OTICA_DATA_DIR: dataDirectory,
      OTICA_DISABLE_SCHEDULER: 'true',
      LOCAL_SEED_ADMIN: 'true',
      LOCAL_ADMIN_EMAIL: 'ci-continuity@example.test',
      LOCAL_ADMIN_PASSWORD: 'CI-Continuity-Admin-2026!',
      LOCAL_AUTH_SECRET: 'ci-continuity-secret-that-is-long-enough-2026',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr?.on('data', (chunk) => { output += chunk.toString(); });
}

async function request(pathname, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (options.body !== undefined && !(options.body instanceof FormData)) headers.set('content-type', 'application/json');
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body: options.body instanceof FormData ? options.body : options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.arrayBuffer();
  return { response, body };
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) throw new Error(`API encerrou durante o boot com código ${child.exitCode}.`);
    try {
      const { response } = await request('/api/health');
      if (response.ok) return;
    } catch {
      // O banco pode ainda estar inicializando.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('API não respondeu ao smoke de continuidade dentro do prazo.');
}

async function stopServer() {
  if (!child) return;
  if (child.exitCode === null) child.kill('SIGTERM');
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(resolve, 2_000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  child = undefined;
}

try {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  startServer(port);
  await waitForHealth();
  const publicHealth = await request('/api/health');
  assert.deepEqual(publicHealth.body, { ok: true, database: 'sqlite', service: 'gestao-oticas-api' });

  const login = await request('/api/auth/login', { method: 'POST', body: { email: 'ci-continuity@example.test', password: 'CI-Continuity-Admin-2026!' } });
  assert.equal(login.response.status, 200);
  token = login.body?.data?.access_token;
  assert.ok(token);

  const backup = await request('/api/admin/backups/run', { method: 'POST', body: { label: 'ci-continuity', send_to_drive: false } });
  assert.equal(backup.response.status, 201);
  const jobId = String(backup.body?.data?.id || '');
  assert.ok(jobId);

  const history = await request('/api/admin/backups/history?limit=20');
  assert.equal(history.response.status, 200);
  assert.ok(history.body.data.some((job) => String(job.id) === jobId && job.status === 'completed'));

  const metrics = await request('/api/admin/metrics');
  assert.equal(metrics.response.status, 200);
  assert.equal(metrics.body.data.backups.latest_job.id, jobId);
  assert.ok(metrics.body.data.requests.total >= 5);

  const download = await request(`/api/admin/backups/${encodeURIComponent(jobId)}/download`);
  assert.equal(download.response.status, 200);
  assert.ok(download.body.byteLength > 100);

  const archive = new Blob([download.body], { type: 'application/gzip' });
  const inspectForm = new FormData();
  inspectForm.set('file', archive, 'ci-continuity.tar.gz');
  const inspected = await request('/api/admin/backups/inspect', { method: 'POST', body: inspectForm });
  assert.equal(inspected.response.status, 200);
  assert.equal(inspected.body.data.manifest.label, 'ci-continuity');

  const importForm = new FormData();
  importForm.set('file', new Blob([download.body], { type: 'application/gzip' }), 'ci-continuity-import.tar.gz');
  const imported = await request('/api/admin/backups/import', { method: 'POST', body: importForm });
  assert.equal(imported.response.status, 201);
  assert.equal(imported.body.data.status, 'imported');

  const restore = await request(`/api/admin/backups/${encodeURIComponent(jobId)}/restore`, { method: 'POST', body: { confirmation: 'RESTAURAR' } });
  if (restore.response.status !== 200) console.error('Restore response:', restore.response.status, restore.body);
  assert.equal(restore.response.status, 200);
  await stopServer();
  await access(path.join(dataDirectory, 'backups', 'restore-pending.json'));

  startServer(port);
  await waitForHealth();
  const afterRestart = await request('/api/admin/backups/history?limit=20');
  assert.equal(afterRestart.response.status, 200);
  assert.ok(afterRestart.body.data.some((job) => String(job.id) === jobId && job.status === 'restored'));
  const restoredMetrics = await request('/api/admin/metrics');
  assert.equal(restoredMetrics.response.status, 200);
  assert.equal(restoredMetrics.body.data.last_restore_completed.job_id, jobId);
  const migrations = await request('/api/admin/database/migrations');
  assert.equal(migrations.response.status, 200);
  assert.equal(migrations.body.data.currentVersion, migrations.body.data.targetVersion);
  assert.ok(Array.isArray(migrations.body.data.applied));
  console.log('Smoke continuidade OK: backup, inspeção, importação, restore pendente e retomada idempotente.');
} catch (error) {
  console.error('Smoke continuidade FAILED.');
  console.error(error);
  if (output) console.error(output);
  process.exitCode = 1;
} finally {
  await stopServer();
  await rm(dataDirectory, { recursive: true, force: true });
}
