import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseSpec, readSpec, canonical, hash, operations, publicAddress, LIMIT } from '../packages/cli/dist/spec.js';
import { diff } from '../packages/cli/dist/drift.js';
const base = JSON.parse(await readFile(new URL('../examples/tender/openapi.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(base);

test('bundled local refs and explicit server base path survive untouched', () => {
  const spec = parseSpec(JSON.stringify(base));
  assert.equal(spec.servers[0].url, 'https://sandbox.example.test/v2');
  assert.deepEqual(operations(spec), ['GET /tenders', 'GET /tenders/{id}']);
});
test('canonical hashing ignores object order, not array order', () => {
  assert.equal(hash({ b: 2, a: 1 }), hash({ a: 1, b: 2 }));
  assert.notEqual(hash([1, 2]), hash([2, 1]));
  assert.equal(canonical({ '__proto__': 'ignored', a: 1 }), '{"a":1}');
});
test('JSON-pointer changes expose fields without including private values', () => {
  const changed = clone(); changed.components.schemas.Tender.properties.title.type = 'integer';
  const report = diff(base, changed);
  assert.equal(report.status, 'changed');
  assert.equal(report.reviewRequired, true);
  assert.ok(report.changes.some(c => c.path === '/components/schemas/Tender/properties/title/type'));
  assert.equal(JSON.stringify(report).includes('integer'), false);
});
test('removed operations and auth drift need review', () => {
  const changed = clone(); delete changed.paths['/tenders']; changed.security = [];
  const report = diff(base, changed);
  assert.deepEqual(report.removedOperations, ['GET /tenders']);
  assert.ok(report.changes.some(c => c.path === '/security'));
});
test('even additive and documentation changes are not declared safe', () => {
  const changed = clone(); changed.info.description = 'New docs';
  assert.equal(diff(base, changed).reviewRequired, true);
  assert.equal(diff(base, clone()).status, 'unchanged');
});
test('bounded drift reports explicitly disclose truncation', () => {
  const changed = clone();
  for (let i = 0; i < 250; i++) changed.components.schemas.Tender.properties['x' + i] = { type: 'string' };
  const report = diff(base, changed);
  assert.equal(report.changes.length, 200); assert.equal(report.truncated, true);
});
for (const reference of ['https://evil.test/spec', 'file:///etc/passwd', '../schema.json', '#/components/schemas/missing']) {
  test('reject untracked/unresolved ref ' + reference, () => {
    const changed = clone(); changed.components.schemas.Tender.properties.title = { $ref: reference };
    assert.throws(() => parseSpec(JSON.stringify(changed)), /reference|bundled/);
  });
}
test('cyclic schema refs are allowed without unbounded dereferencing', () => {
  const changed = clone(); changed.components.schemas.Tender.properties.child = { $ref: '#/components/schemas/Tender' };
  assert.ok(parseSpec(JSON.stringify(changed)));
});
test('malformed OpenAPI fails instead of partially generating silently', () => {
  for (const data of ['{}', '<html>login</html>', 'openapi: 3.1.0', JSON.stringify({ ...base, openapi: '2.0.0' })]) assert.throws(() => parseSpec(data));
  const duplicate = clone(); duplicate.paths['/tenders/{id}'].get.operationId = 'listTenders';
  assert.throws(() => parseSpec(JSON.stringify(duplicate)), /duplicate/);
  assert.throws(() => parseSpec(' '.repeat(LIMIT + 1)), /10 MiB/);
});
test('specification transport never accepts credential-bearing or insecure URLs', async () => {
  for (const url of ['http://example.com/spec', 'https://u:p@example.com/spec', 'https://example.com/spec?key=secret', 'https://example.com:8000/spec', 'https://127.0.0.1/spec', 'https://[::1]/spec', 'ftp://example.com/spec']) await assert.rejects(readSpec(url));
});
test('block private and metadata DNS addresses', () => {
  for (const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1','fe80::1','fd00::1']) assert.equal(publicAddress(ip), false, ip);
  for (const ip of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111']) assert.equal(publicAddress(ip), true, ip);
});
