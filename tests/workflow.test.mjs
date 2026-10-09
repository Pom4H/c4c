import test from 'node:test';
import assert from 'node:assert/strict';
import { prepare, conclude, approvalToken, ReviewMismatchError } from '../examples/workflows/lib/review.ts';
import { worldMode } from '../examples/workflows/lib/world.ts';
const hash = 'a'.repeat(64), candidateHash = 'b'.repeat(64);
const input = { integration: 'tender', report: { previousHash: hash, candidateHash,
  changes: [{ path: '/paths/x', kind: 'removed' }], truncated: false, generatorChanged: false } };
test('a contract change requires a review; no claim about backward compatibility', () => {
  const review = prepare(input);
  assert.equal(review.needsReview, true); assert.equal(review.changes.removed, 1);
  assert.equal(conclude(review, { candidateHash, approved: true }).decision, 'approved');
});
test('unchanged spec skips review unless the generator changed', () => {
  const same = { ...input, report: { ...input.report, candidateHash: hash, changes: [] } };
  assert.equal(prepare(same).needsReview, false);
  assert.equal(prepare({ ...same, report: { ...same.report, generatorChanged: true } }).needsReview, true);
});
test('rejection remains rejection, and an approval for another snapshot is invalid', () => {
  const review = prepare(input);
  assert.equal(conclude(review, { candidateHash, approved: false }).decision, 'rejected');
  assert.throws(() => conclude(review, { candidateHash: hash, approved: true }), ReviewMismatchError);
});
test('truncated evidence remains explicit', () => {
  assert.equal(prepare({ ...input, report: { ...input.report, truncated: true } }).truncated, true);
});
test('hook identity is bound to both run and reviewed snapshot', () => {
  assert.notEqual(approvalToken('one', hash), approvalToken('two', hash));
  assert.notEqual(approvalToken('one', hash), approvalToken('one', candidateHash));
});
test('Vercel has its own SDK world, independent of business PostgreSQL', () => {
  assert.equal(worldMode({ VERCEL: '1', DATABASE_URL: 'postgres://example/db' }), 'vercel');
  assert.throws(() => worldMode({ VERCEL: '1', WORKFLOW_TARGET_WORLD: '@workflow/world-postgres' }), /Vercel World/);
});
test('self-hosted Postgres requires explicit durable storage', () => {
  assert.throws(() => worldMode({ WORKFLOW_TARGET_WORLD: '@workflow/world-postgres' }), /WORKFLOW_POSTGRES_URL/);
  assert.equal(worldMode({ WORKFLOW_TARGET_WORLD: '@workflow/world-postgres', WORKFLOW_POSTGRES_URL: 'postgres://example/db' }), 'postgres');
});
test('local and unknown backends are not misrepresented as durable Postgres', () => {
  assert.equal(worldMode({}), 'local');
  assert.throws(() => worldMode({ WORKFLOW_TARGET_WORLD: 'typo' }), /Example supports/);
});
