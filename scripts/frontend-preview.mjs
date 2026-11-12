import { spawn } from 'node:child_process';
import { mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const check = process.argv.includes('--check');
await access(path.join(root, 'frontend-dist/index.html')).catch(() => {
  throw new Error('Frontend build is missing. Run npm run frontend:build first.');
});
await Promise.all(['body', 'proxy'].map((name) =>
  mkdir(path.join(root, '.runtime/frontend-preview', name), { recursive: true })
));

const child = spawn('/usr/sbin/nginx', [
  '-e', 'stderr', '-p', root, '-c', 'deploy/frontend-preview.nginx.conf',
  ...(check ? ['-t'] : process.argv.includes('--reload') ? ['-s', 'reload'] : ['-g', 'daemon off;']),
], { cwd: root, stdio: 'inherit' });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { child.kill('SIGQUIT'); });
}
child.on('error', (err) => {
  process.stderr.write(`Frontend preview failed: ${err.message}\n`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGQUIT' ? 0 : 1);
});
