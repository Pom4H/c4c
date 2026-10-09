import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
const base = process.env.C4C_BASE_URL ?? 'http://localhost:3000';
const token = process.env.C4C_ADMIN_TOKEN;
assert.ok(token?.length >= 32, 'C4C_ADMIN_TOKEN is required');
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
async function call(path, method = 'GET', body) {
  const response = await fetch(new URL(path, base), { method, headers, signal: AbortSignal.timeout(10_000),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { response, value: await response.json() };
}
assert.equal((await fetch(new URL('/api/tools', base))).status, 401);
const description = await call('/api/tools');
assert.equal(description.response.status, 200);
assert.deepEqual(description.value.tools.map(t => t.name).sort(), ['prepareReview', 'recordDecision']);
// Synthetic contract report only. No live provider, AI inference or model download.
const candidateHash = 'b'.repeat(64);
const started = await call('/api/reviews', 'POST', { integration: 'smoke', report: {
  previousHash: 'a'.repeat(64), candidateHash, changes: [{ path: '/paths/example', kind: 'changed' }],
  truncated: false, generatorChanged: false,
} });
assert.equal(started.response.status, 202);
const { runId } = started.value;
assert.ok(runId);
let accepted = false;
for (let i = 0; i < 100; i++) {
  const result = await call(`/api/reviews/${runId}/approval`, 'POST', { candidateHash, approved: true });
  if (result.response.status === 202) { accepted = true; break; }
  assert.equal(result.response.status, 409, JSON.stringify(result.value));
  await pause(300); // Test-client polling only; not workflow orchestration.
}
assert.ok(accepted, 'Hook was never ready');
let completed = false;
for (let i = 0; i < 100; i++) {
  const result = await call(`/api/reviews/${runId}`);
  assert.equal(result.response.status, 200);
  if (result.value.status === 'completed') {
    assert.equal(result.value.result.decision, 'approved');
    assert.equal(result.value.result.candidateHash, candidateHash);
    completed = true; break;
  }
  assert.ok(!['failed', 'cancelled'].includes(result.value.status), JSON.stringify(result.value));
  await pause(300);
}
assert.ok(completed, 'Native workflow did not finish');
console.log(JSON.stringify({ runId, decision: 'approved', backend: process.env.WORKFLOW_TARGET_WORLD ?? 'automatic' }));
