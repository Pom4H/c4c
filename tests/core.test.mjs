import test from 'node:test';
import assert from 'node:assert/strict';
import { define, ContractError } from '../packages/core/dist/index.js';
const text = { '~standard': { version: 1, vendor: 'test', validate: v => typeof v === 'string' ? { value: v } : { issues: [{ message: 'Expected string' }] } } };
const numericText = { '~standard': { ...text['~standard'], validate: async v => typeof v === 'string' && /^\d+$/.test(v) ? { value: Number(v) } : { issues: [{ message: 'Expected digits' }] } } };

test('procedure is directly callable with its contract attached', async () => {
  const greet = define({ input: text, output: text, description: 'Greeting' }, name => `Hello ${name}`);
  assert.equal(await greet('Roman'), 'Hello Roman');
  assert.equal(greet.contract.description, 'Greeting');
  assert.equal(Object.isFrozen(greet.contract), true);
  assert.throws(() => { greet.contract = {}; }, TypeError);
});
test('input boundary stops the handler before side effects', async () => {
  let calls = 0;
  const f = define({ input: text, output: text }, value => { calls++; return value; });
  await assert.rejects(f(13), error => error instanceof ContractError && error.stage === 'input');
  assert.equal(calls, 0);
});
test('output violation fails, never cast as valid data', async () => {
  const f = define({ input: text, output: text }, () => 12);
  await assert.rejects(f('x'), error => error instanceof ContractError && error.stage === 'output');
});
test('async input and output transformations stay inside the contract', async () => {
  const f = define({ input: numericText, output: numericText }, n => String(n + 1));
  assert.equal(await f('41'), 42);
});
test('business errors pass through once; no implicit retry or global context', async () => {
  let calls = 0; const error = new Error('denied');
  const f = define({ input: text, output: text }, () => { calls++; throw error; });
  await assert.rejects(f('value'), e => e === error);
  assert.equal(calls, 1);
});
test('empty issues still means validation failed under Standard Schema', async () => {
  const invalid = { '~standard': { version: 1, vendor: 'test', validate: () => ({ issues: [] }) } };
  await assert.rejects(define({ input: invalid, output: text }, () => 'bad')('x'), ContractError);
});
