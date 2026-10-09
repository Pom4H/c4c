import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { integrate, check, update, outputDirectory } from '../packages/cli/dist/project.js';
import { hash } from '../packages/cli/dist/spec.js';
const fixture = JSON.parse(await readFile(new URL('../examples/tender/openapi.json', import.meta.url), 'utf8'));
// Stub tests prove transaction/integrity behavior, NOT upstream codegen compatibility.
// tests/codegen.test.mjs separately runs the real pinned compiler and SDK calls.
async function compiler(input, output) {
  await mkdir(output);
  for (const name of ['sdk.gen.ts','types.gen.ts','zod.gen.ts']) await writeFile(join(output,name), '// fixture compiler\n' + await readFile(input,'utf8'));
}
async function setup(t) {
  const dir = await mkdtemp(join(tmpdir(), 'c4c-test-')); t.after(() => rm(dir, {recursive:true,force:true}));
  const source = join(dir,'source.json'), out = join(dir,'provider');
  await writeFile(source, JSON.stringify(fixture)); return {dir,source,out};
}
test('integrate stores immutable snapshot and independently checks upstream', async t => {
  const {source,out} = await setup(t);
  const lock = await integrate(source,out,compiler);
  assert.equal(lock.specHash,hash(fixture));
  assert.equal((await check(out)).status,'unchanged');
  const changed = {...fixture,info:{...fixture.info,version:'2.0'}};
  await writeFile(source,JSON.stringify(changed));
  const report = await check(out);
  assert.equal(report.status,'changed');
  assert.equal(JSON.parse(await readFile(join(out,'openapi.json'),'utf8')).info.version,'1.0.0');
  const updated = await update(out,report.candidateHash,undefined,compiler);
  assert.equal(updated.specHash,hash(changed));
  assert.equal((await check(out)).status,'unchanged');
});
test('failed codegen cannot corrupt or replace existing integration', async t => {
  const {source,out,dir} = await setup(t); await integrate(source,out,compiler);
  const changed = {...fixture,info:{...fixture.info,version:'2.0'}};
  await writeFile(source,JSON.stringify(changed));
  await assert.rejects(update(out,hash(changed),undefined,async()=>{throw new Error('compiler crashed');}),/compiler crashed/);
  assert.equal(JSON.parse(await readFile(join(out,'openapi.json'),'utf8')).info.version,'1.0.0');
  assert.equal((await readdir(dir)).some(name=>name.includes('.c4c-')),false);
});
test('upstream changes after review require another review', async t => {
  const {source,out} = await setup(t); await integrate(source,out,compiler);
  await writeFile(source,JSON.stringify({...fixture,security:[]}));
  await assert.rejects(update(out,hash(fixture),undefined,compiler),/since review/);
});
test('never overwrite handmade SDK edits', async t => {
  const {source,out} = await setup(t); await integrate(source,out,compiler);
  await writeFile(join(out,'sdk','sdk.gen.ts'),'handwritten');
  await assert.rejects(check(out),/edited/);
  await assert.rejects(update(out,hash(fixture),undefined,compiler),/edited/);
});
test('failed first integration leaves no falsely valid destination', async t => {
  const {source,out} = await setup(t);
  await assert.rejects(integrate(source,out,async()=>{throw new Error('fail');}));
  await assert.rejects(readFile(join(out,'c4c.lock.json')), {code:'ENOENT'});
  assert.equal((await integrate(source,out,compiler)).format,1);
});
test('concurrent generation has one writer; existing integrations are never reset', async t => {
  const {source,out} = await setup(t);
  const result = await Promise.allSettled([integrate(source,out,compiler),integrate(source,out,compiler)]);
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
  await assert.rejects(integrate(source,out,compiler),/already exists/);
});
test('local adapters must live outside the managed generated directory', async t => {
  const {source,out} = await setup(t); await integrate(source,out,compiler);
  await writeFile(join(out,'adapter.ts'),'keep me');
  await assert.rejects(check(out),/handwritten adapters outside/);
  assert.equal(await readFile(join(out,'adapter.ts'),'utf8'),'keep me');
});
test('CLI exit codes distinguish unavailable, unchanged and drift', async t => {
  const {source,out} = await setup(t); await integrate(source,out,compiler);
  const cli = new URL('../packages/cli/dist/bin.js', import.meta.url);
  const run = (...args) => spawnSync(process.execPath,[cli.pathname,...args],{encoding:'utf8'});
  assert.equal(run('check',out,'--json').status,0);
  await writeFile(source,JSON.stringify({...fixture,security:[]}));
  const drift = run('check',out,'--json'); assert.equal(drift.status,2); assert.equal(JSON.parse(drift.stdout).reviewRequired,true);
  await rm(source); assert.equal(run('check',out).status,1);
  assert.equal(run('update',out).status,1);
});
test('integration names cannot escape the project', () => {
  for (const name of ['../x','/tmp','x/y','','A B']) assert.throws(()=>outputDirectory(name));
  assert.ok(outputDirectory('gosplan').endsWith('/integrations/gosplan'));
});
