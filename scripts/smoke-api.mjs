import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const dataDirectory = await mkdtemp(path.join(tmpdir(), 'otica-ci-smoke-'));
let child;
let baseUrl;
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

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers: options.body === undefined ? {} : { 'content-type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = await response.json();
  return { response, body };
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`API encerrou durante o boot com código ${child.exitCode}.`);
    }
    try {
      const { response } = await request('/api/health');
      if (response.ok) return;
    } catch {
      // O banco sql.js pode ainda estar inicializando.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('API não respondeu ao smoke test dentro do prazo.');
}

async function stopServer() {
  if (!child) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 2_000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  child = undefined;
}

try {
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  const adminEmail = 'ci-smoke@example.test';
  const adminPassword = 'CI-Smoke-Admin-2026!';
  child = spawn(process.execPath, ['dist-server/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      OTICA_DATA_DIR: dataDirectory,
      OTICA_DISABLE_SCHEDULER: 'true',
      LOCAL_SEED_ADMIN: 'true',
      LOCAL_ADMIN_EMAIL: adminEmail,
      LOCAL_ADMIN_PASSWORD: adminPassword,
      LOCAL_AUTH_SECRET: 'ci-smoke-secret-that-is-long-enough-2026',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr?.on('data', (chunk) => { output += chunk.toString(); });

  await waitForHealth();
  const health = await request('/api/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.database, 'sqlite');

  const unauthenticated = await request('/api/tables/customers');
  assert.equal(unauthenticated.response.status, 401);

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { email: adminEmail, password: adminPassword },
  });
  assert.equal(login.response.status, 200);
  assert.ok(login.body?.data?.access_token);

  console.log('Smoke API OK: health, banco, autenticação e autorização.');
} catch (error) {
  console.error('Smoke API FAILED.');
  console.error(error);
  if (child && output) console.error(output);
  process.exitCode = 1;
} finally {
  await stopServer();
  await rm(dataDirectory, { recursive: true, force: true });
}
