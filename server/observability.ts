import { randomUUID } from 'node:crypto';

type RequestMetric = {
  total: number;
  in_flight: number;
  by_status: Record<string, number>;
  by_method: Record<string, number>;
  errors: number;
  last_request_at: string | null;
  average_duration_ms: number;
};

type SafeLogFields = Record<string, unknown>;

const startedAt = Date.now();
const metric: RequestMetric = {
  total: 0,
  in_flight: 0,
  by_status: {},
  by_method: {},
  errors: 0,
  last_request_at: null,
  average_duration_ms: 0,
};
let durationSamples = 0;

function safeLogFields(fields: SafeLogFields) {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !/(password|token|secret|authorization|cookie|refresh)/i.test(key)));
}

export function createRequestId(value?: unknown) {
  const candidate = String(value || '').trim();
  return /^[a-zA-Z0-9._:-]{8,100}$/.test(candidate) ? candidate : randomUUID();
}

export function beginRequest() {
  metric.in_flight += 1;
}

export function recordRequest(method: string, statusCode: number, durationMs: number) {
  metric.total += 1;
  metric.in_flight = Math.max(0, metric.in_flight - 1);
  metric.by_status[String(statusCode)] = (metric.by_status[String(statusCode)] || 0) + 1;
  metric.by_method[method] = (metric.by_method[method] || 0) + 1;
  if (statusCode >= 500) metric.errors += 1;
  durationSamples += 1;
  metric.average_duration_ms = Number((((metric.average_duration_ms * (durationSamples - 1)) + durationMs) / durationSamples).toFixed(2));
  metric.last_request_at = new Date().toISOString();
}

export function getOperationalMetrics() {
  return {
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    process: { pid: process.pid, node: process.version, memory_rss_bytes: process.memoryUsage().rss },
    requests: {
      total: metric.total,
      in_flight: metric.in_flight,
      errors: metric.errors,
      average_duration_ms: metric.average_duration_ms,
      last_request_at: metric.last_request_at,
      by_status: { ...metric.by_status },
      by_method: { ...metric.by_method },
    },
  };
}

export function resetOperationalMetrics() {
  metric.total = 0;
  metric.in_flight = 0;
  metric.by_status = {};
  metric.by_method = {};
  metric.errors = 0;
  metric.last_request_at = null;
  metric.average_duration_ms = 0;
  durationSamples = 0;
}

export function logOperationalEvent(event: string, fields: SafeLogFields = {}) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', event, ...safeLogFields(fields) }));
}

export function logOperationalError(event: string, error: unknown, fields: SafeLogFields = {}) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', event, error: message, ...safeLogFields(fields) }));
}
