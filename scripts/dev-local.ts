import { spawn } from 'node:child_process';
import process from 'node:process';

const node = process.execPath;
const tsxCli = './node_modules/tsx/dist/cli.mjs';
const viteCli = './node_modules/vite/bin/vite.js';
const children = [
  spawn(node, [tsxCli, 'server/index.ts'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } }),
  spawn(node, [viteCli, '--host', '0.0.0.0', '--port', '8080'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' } }),
];

let shuttingDown = false;
const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
};

for (const child of children) {
  child.on('exit', (code) => {
    if (!shuttingDown && code && code !== 0) shutdown(code);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
