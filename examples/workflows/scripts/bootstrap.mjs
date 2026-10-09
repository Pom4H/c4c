import { spawn } from 'node:child_process';
import { worldMode } from '../lib/world.ts';
if (worldMode(process.env) !== 'postgres') throw new Error('Migration requires Postgres World configuration');
// npm run adds the official package's bootstrap executable to PATH.
const child = spawn(process.platform === 'win32' ? 'bootstrap.cmd' : 'bootstrap', [], {
  stdio: 'inherit', env: process.env, shell: process.platform === 'win32',
});
child.once('error', () => { console.error('Cannot start the official Postgres World bootstrap'); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
