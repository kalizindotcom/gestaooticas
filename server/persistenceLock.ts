import fs from 'node:fs';

export type ExclusiveLockOptions = {
  timeoutMs?: number;
  staleAfterMs?: number;
  retryMs?: number;
};

const sleepBuffer = new Int32Array(new SharedArrayBuffer(4));

function sleep(milliseconds: number) {
  Atomics.wait(sleepBuffer, 0, 0, milliseconds);
}

export function withExclusiveFileLock<T>(lockPath: string, operation: () => T, options: ExclusiveLockOptions = {}) {
  const timeoutMs = Math.max(100, options.timeoutMs ?? 5_000);
  const staleAfterMs = Math.max(timeoutMs, options.staleAfterMs ?? 30_000);
  const retryMs = Math.max(5, options.retryMs ?? 25);
  const startedAt = Date.now();
  let descriptor: number | undefined;

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      descriptor = fs.openSync(lockPath, 'wx', 0o600);
      fs.writeSync(descriptor, `${process.pid}\n${new Date().toISOString()}\n`);
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw error;
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - stat.mtimeMs > staleAfterMs) fs.rmSync(lockPath, { force: true });
      } catch {
        // O lock pode ter sido liberado entre stat e rm.
      }
      sleep(retryMs);
    }
  }

  if (descriptor === undefined) {
    const error = Object.assign(new Error('Não foi possível obter o lock de escrita do banco.'), { code: 'DATABASE_WRITE_LOCK_TIMEOUT', statusCode: 503 });
    throw error;
  }

  try {
    return operation();
  } finally {
    try { fs.closeSync(descriptor); } catch { /* fechamento best effort */ }
    try { fs.rmSync(lockPath, { force: true }); } catch { /* limpeza best effort */ }
  }
}
