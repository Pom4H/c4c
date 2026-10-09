import { canonical, hash, object, operations, type Json, type ObjectValue } from './spec.js';
export interface Change { path: string; kind: 'added' | 'removed' | 'changed' }
/** A structural drift report, NOT a sound proof of backward compatibility.
 * Even an additive field or HTTP 200 can alter semantics. Every change needs review.
 */
export function diff(before: ObjectValue, after: ObjectValue) {
  const changes: Change[] = []; let truncated = false;
  const add = (path: string, kind: Change['kind']) => {
    if (changes.length < 200) changes.push({ path: path || '/', kind }); else truncated = true;
  };
  const walk = (a: Json | undefined, b: Json | undefined, path: string): void => {
    if (a === undefined) { add(path, 'added'); return; }
    if (b === undefined) { add(path, 'removed'); return; }
    if (canonical(a) === canonical(b)) return;
    if (object(a) && object(b)) {
      for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
        walk(a[key], b[key], path + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1'));
      }
    } else add(path, 'changed');
  };
  walk(before, after, '');
  const previous = operations(before), next = operations(after);
  return { status: hash(before) === hash(after) ? 'unchanged' as const : 'changed' as const,
    previousHash: hash(before), candidateHash: hash(after), changes, truncated,
    removedOperations: previous.filter(op => !next.includes(op)), addedOperations: next.filter(op => !previous.includes(op)),
    reviewRequired: hash(before) !== hash(after) };
}
