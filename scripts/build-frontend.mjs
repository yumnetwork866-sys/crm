import { spawnSync } from 'node:child_process';
import { lstat, mkdir, realpath, rename, symlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const releases = path.join(root, '.runtime/frontend-releases');
const release = path.join(releases, id);
await mkdir(release, { recursive: true });
const build = spawnSync(process.execPath, [
  path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', release,
], { cwd: root, stdio: 'inherit' });
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status || 1);

const current = path.join(root, 'frontend-dist');
const info = await lstat(current).catch((err) => {
  if (err.code !== 'ENOENT') throw err;
  return null;
});
let previous = info ? await realpath(current) : null;
// Migrate the original preview directory once; subsequent publishes swap a symlink.
if (info && !info.isSymbolicLink()) {
  previous = path.join(releases, `legacy-${id}`);
  await rename(current, previous);
}
async function publishLink(target, name) {
  const temp = path.join(root, `.runtime/frontend-link-${name}-${id}`);
  await symlink(target, temp, 'dir');
  await rename(temp, path.join(root, name));
}
if (previous) await publishLink(previous, 'frontend-previous');
await publishLink(release, 'frontend-dist');
process.stdout.write(`Frontend published: ${id}\n`);
