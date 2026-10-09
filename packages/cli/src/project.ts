import { createHash } from 'node:crypto';
import { open, readdir, lstat, mkdir, mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { resolve, dirname, basename, join, relative } from 'node:path';
import { canonical, hash, object, parseSpec, readSpec, type Json, type ObjectValue } from './spec.js';
import { diff } from './drift.js';
import { generate, GENERATOR } from './compiler.mjs';

export type Compiler = (snapshot: string, output: string) => Promise<void>;
interface Lock {
  format: 1;
  source: { kind: 'https' | 'file'; location: string };
  specHash: string;
  sdkHash: string;
  generator: string;
}
const missing = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'ENOENT';
const namePattern = /^[a-z][a-z0-9-]{0,62}$/;
export function outputDirectory(name: string, root = process.cwd()): string {
  if (!namePattern.test(name)) throw new Error('Integration name: lowercase letters, digits and hyphens; 1..63 characters');
  return resolve(root, 'integrations', name);
}
async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (error) { if (missing(error)) return false; throw error; }
}
/** Hash exactly the managed SDK. Refuse symlinks rather than following them out of tree. */
async function sdkHash(directory: string): Promise<string> {
  const digest = createHash('sha256'); let count = 0, bytes = 0;
  async function walk(path: string): Promise<void> {
    for (const file of (await readdir(path)).sort()) {
      if (++count > 10_000) throw new Error('Generated file limit exceeded');
      const absolute = join(path, file), info = await lstat(absolute);
      if (info.isSymbolicLink()) throw new Error('Managed integration contains a symlink');
      if (info.isDirectory()) { await walk(absolute); continue; }
      if (!info.isFile() || (bytes += info.size) > 50 * 1024 * 1024) throw new Error('Generated SDK size limit exceeded');
      digest.update(relative(directory, absolute).split('\\').join('/')).update('\0');
      digest.update(await readFile(absolute)).update('\0');
    }
  }
  const root = await lstat(directory);
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error('Invalid managed SDK directory');
  await walk(directory);
  for (const file of ['sdk.gen.ts', 'types.gen.ts', 'zod.gen.ts']) {
    if (!(await exists(join(directory, file)))) throw new Error(`Compiler did not produce ${file}`);
  }
  return digest.digest('hex');
}
async function state(directory: string): Promise<{ spec: ObjectValue; lock: Lock }> {
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Integration must be a real directory');
  const children = (await readdir(directory)).sort();
  if (children.join(',') !== ['c4c.lock.json', 'openapi.json', 'sdk'].join(',')) {
    throw new Error('Managed directory must contain only openapi.json, c4c.lock.json and sdk; keep handwritten adapters outside');
  }
  for (const filename of ['c4c.lock.json', 'openapi.json']) {
    const entry = await lstat(join(directory, filename));
    if (!entry.isFile() || entry.isSymbolicLink() || entry.size > 10 * 1024 * 1024) throw new Error('Invalid integration snapshot');
  }
  const raw: Json = JSON.parse(await readFile(join(directory, 'c4c.lock.json'), 'utf8')) as Json;
  if (!object(raw) || raw.format !== 1 || !object(raw.source) ||
      !['file', 'https'].includes(String(raw.source.kind)) || typeof raw.source.location !== 'string' ||
      typeof raw.generator !== 'string' || typeof raw.specHash !== 'string' || typeof raw.sdkHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(raw.specHash) || !/^[a-f0-9]{64}$/.test(raw.sdkHash)) throw new Error('Invalid c4c.lock.json');
  const lock = raw as unknown as Lock;
  const spec = parseSpec(await readFile(join(directory, 'openapi.json'), 'utf8'));
  if (hash(spec) !== lock.specHash || await sdkHash(join(directory, 'sdk')) !== lock.sdkHash) {
    throw new Error('Managed snapshot or SDK was edited; restore it before checking/updating (handwritten code belongs outside)');
  }
  return { spec, lock };
}
function sourceOf(lock: Lock, directory: string): string {
  return lock.source.kind === 'https' ? lock.source.location : resolve(directory, lock.source.location);
}
async function lease<T>(directory: string, run: () => Promise<T>): Promise<T> {
  if (dirname(directory) === directory) throw new Error('Cannot manage a filesystem root');
  await mkdir(dirname(directory), { recursive: true });
  const path = join(dirname(directory), '.' + basename(directory) + '.c4c-lock');
  let file;
  try { file = await open(path, 'wx'); } catch { throw new Error('Integration locked; after a crash inspect the adjacent .c4c-lock and .c4c-backup before retrying'); }
  try { await file.writeFile(String(process.pid)); return await run(); }
  finally { await file.close(); await rm(path); }
}
async function stage(directory: string, spec: ObjectValue, source: Lock['source'], compiler: Compiler) {
  const temporary = await mkdtemp(join(dirname(directory), '.' + basename(directory) + '.c4c-stage-'));
  try {
    const input = join(temporary, 'openapi.json');
    await writeFile(input, canonical(spec) + '\n');
    await compiler(input, join(temporary, 'sdk'));
    const lock: Lock = { format: 1, source, specHash: hash(spec), sdkHash: await sdkHash(join(temporary, 'sdk')), generator: GENERATOR };
    await writeFile(join(temporary, 'c4c.lock.json'), JSON.stringify(lock, null, 2) + '\n');
    return { temporary, lock };
  } catch (error) { await rm(temporary, { recursive: true, force: true }); throw error; }
}
export async function integrate(source: string, output: string, compiler: Compiler = generate): Promise<Lock> {
  const directory = resolve(output);
  return lease(directory, async () => {
    if (await exists(directory)) throw new Error('Integration already exists; use check then update --expect <hash>');
    const spec = await readSpec(source);
    const origin: Lock['source'] = /^https:/i.test(source)
      ? { kind: 'https', location: new URL(source).href }
      : { kind: 'file', location: relative(directory, resolve(source)).split('\\').join('/') };
    const { temporary, lock } = await stage(directory, spec, origin, compiler);
    try { await rename(temporary, directory); }
    finally { await rm(temporary, { recursive: true, force: true }); }
    return lock;
  });
}
export async function check(output: string, against?: string) {
  const directory = resolve(output);
  const saved = await state(directory);
  const candidate = await readSpec(against ?? sourceOf(saved.lock, directory));
  return { ...diff(saved.spec, candidate), generator: saved.lock.generator,
    generatorChanged: saved.lock.generator !== GENERATOR };
}
export async function update(output: string, expected: string, against?: string, compiler: Compiler = generate): Promise<Lock> {
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error('update requires --expect <candidateHash> from a reviewed check');
  const directory = resolve(output);
  return lease(directory, async () => {
    const saved = await state(directory);
    const candidate = await readSpec(against ?? sourceOf(saved.lock, directory));
    if (hash(candidate) !== expected) throw new Error('Upstream changed since review; run check again');
    const backup = directory + '.c4c-backup';
    if (await exists(backup)) throw new Error('Recovery backup exists; inspect it before proceeding');
    if (expected === saved.lock.specHash && saved.lock.generator === GENERATOR) return saved.lock;
    const { temporary, lock } = await stage(directory, candidate, saved.lock.source, compiler);
    try {
      // Recheck before promotion: do not lose edits made while codegen ran.
      const current = await state(directory);
      if (current.lock.specHash !== saved.lock.specHash || current.lock.sdkHash !== saved.lock.sdkHash) throw new Error('Integration changed during generation');
      await rename(directory, backup);
      try { await rename(temporary, directory); }
      catch (error) { await rename(backup, directory); throw error; }
      await rm(backup, { recursive: true });
    } finally { await rm(temporary, { recursive: true, force: true }); }
    return lock;
  });
}
