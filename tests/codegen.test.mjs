import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { integrate } from '../packages/cli/dist/project.js';

// Uses the real pinned compiler; all SDK traffic is injected, not a live provider.
test('actual codegen → typed standalone SDK → validated response, without c4c runtime',
  {skip: process.env.C4C_CODEGEN_TEST !== '1'}, async t => {
    const root = resolve('.tmp'); await mkdir(root,{recursive:true});
    const temp = await mkdtemp(join(root,'real-codegen-')); t.after(()=>rm(temp,{recursive:true,force:true}));
    const out = join(temp,'integration');
    await integrate(resolve('examples/tasks/openapi.json'),out);
    const sdkText = await readFile(join(out,'sdk','sdk.gen.ts'),'utf8');
    assert.equal(sdkText.includes('@c4c/'),false);
    const tsc = resolve('node_modules/typescript/bin/tsc');
    const typed = spawnSync(process.execPath,[tsc,'--noEmit','--skipLibCheck','--target','ES2022','--module','ESNext','--moduleResolution','Bundler',join(out,'sdk','sdk.gen.ts')],{encoding:'utf8'});
    assert.equal(typed.status,0,typed.stdout+'\n'+typed.stderr);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('Unexpected network call in contract test'); };
    t.after(() => { globalThis.fetch = originalFetch; });
    const { tsImport } = await import('tsx/esm/api');
    const { getTask } = await tsImport(join(out,'sdk','sdk.gen.ts'),import.meta.url);
    const { client } = await tsImport(join(out,'sdk','client.gen.ts'),import.meta.url);
    let seen;
    client.setConfig({baseUrl:'https://example.test/v2',fetch:async request=>{
      seen=request;return new Response(JSON.stringify({id:'42',title:'Review API changes',updatedAt:'2026-01-01T00:00:00Z'}),{headers:{'content-type':'application/json'}});
    }});
    // Explicit injection avoids reliance on singleton identity across TS module loaders
    // and is also how independent tenants should supply their clients.
    const result = await getTask({client,path:{id:'42'},throwOnError:true});
    assert.equal(result.data.id,'42');
    assert.equal(seen.url,'https://example.test/v2/tasks/42');
    client.setConfig({fetch:async()=>new Response(JSON.stringify({id:42,title:'invalid',updatedAt:'x'}),{headers:{'content-type':'application/json'}})});
    await assert.rejects(getTask({client,path:{id:'42'},throwOnError:true}));
  });
