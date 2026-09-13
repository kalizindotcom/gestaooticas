import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { withExclusiveFileLock } from '../../server/persistenceLock.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe('withExclusiveFileLock', () => {
  it('serializa operações e remove o lock após a conclusão', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'otica-lock-'));
    temporaryDirectories.push(directory);
    const lockPath = path.join(directory, 'database.lock');
    const result = withExclusiveFileLock(lockPath, () => 'ok');
    expect(result).toBe('ok');
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('remove lock obsoleto antes de executar a operação', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'otica-lock-'));
    temporaryDirectories.push(directory);
    const lockPath = path.join(directory, 'database.lock');
    fs.writeFileSync(lockPath, 'stale');
    const old = new Date(Date.now() - 10_000);
    fs.utimesSync(lockPath, old, old);
    expect(withExclusiveFileLock(lockPath, () => 42, { timeoutMs: 100, staleAfterMs: 50, retryMs: 5 })).toBe(42);
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('retorna erro operacional quando a contenção excede o timeout', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'otica-lock-'));
    temporaryDirectories.push(directory);
    const lockPath = path.join(directory, 'database.lock');
    fs.writeFileSync(lockPath, 'active');
    expect(() => withExclusiveFileLock(lockPath, () => 'never', { timeoutMs: 30, staleAfterMs: 60_000, retryMs: 5 })).toThrowError(/lock de escrita/);
    expect(fs.existsSync(lockPath)).toBe(true);
    fs.rmSync(lockPath, { force: true });
  });
});
