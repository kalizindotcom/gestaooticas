import assert from 'node:assert/strict';

const url = process.env.HEALTH_URL || 'https://gestaooticas.online/api/health';
const timeoutMs = Number(process.env.HEALTH_TIMEOUT_MS || 10_000);
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);

try {
  const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json', 'user-agent': 'gestao-oticas-health-check/1.0' } });
  const body = await response.json();
  assert.equal(response.status, 200, `HTTP ${response.status}`);
  assert.equal(body.ok, true, 'health não está ok');
  assert.equal(body.database, 'sqlite', 'banco inesperado');
  console.log(`Health OK: ${url} · ${response.status} · ${body.service || 'api'}`);
} catch (error) {
  console.error(`Health FAILED: ${url}`);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
}
