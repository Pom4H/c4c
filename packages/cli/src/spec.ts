import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { request } from 'node:https';
import { lookup } from 'node:dns';
import { isIP } from 'node:net';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type ObjectValue = { [key: string]: Json };
export const LIMIT = 10 * 1024 * 1024;
export const object = (v: Json | undefined): v is ObjectValue => !!v && typeof v === 'object' && !Array.isArray(v);
const methods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

/** Deterministic hashes: property order is irrelevant; array order is NOT discarded. */
export function canonical(value: Json): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k]!)).join(',') + '}';
  return JSON.stringify(value);
}
export const hash = (value: Json): string => createHash('sha256').update(canonical(value)).digest('hex');
export function operations(spec: ObjectValue): string[] {
  const found: string[] = [];
  if (!object(spec.paths)) return found;
  for (const [path, item] of Object.entries(spec.paths)) {
    if (!object(item)) continue;
    for (const [method, op] of Object.entries(item)) {
      if (methods.has(method) && object(op)) found.push(`${method.toUpperCase()} ${path}`);
    }
  }
  return found.sort();
}

export function parseSpec(text: string): ObjectValue {
  if (Buffer.byteLength(text) > LIMIT) throw new Error('Specification exceeds 10 MiB');
  let spec: Json;
  try { spec = JSON.parse(text) as Json; } catch { throw new Error('Expected bundled OpenAPI JSON (YAML/WSDL are not supported)'); }
  if (!object(spec) || typeof spec.openapi !== 'string' || !/^3\.[01]\.\d+$/.test(spec.openapi) ||
      !object(spec.info) || typeof spec.info.title !== 'string' || typeof spec.info.version !== 'string' || !object(spec.paths)) {
    throw new Error('Expected OpenAPI 3.0.x/3.1.x with info.title, info.version and paths');
  }
  let nodes = 0;
  const refs: string[] = [];
  const visit = (v: Json, depth: number): void => {
    if (++nodes > 200_000 || depth > 100) throw new Error('Specification complexity limit exceeded');
    if (object(v)) {
      if ('$ref' in v) {
        if (typeof v.$ref !== 'string' || !(v.$ref === '#' || v.$ref.startsWith('#/'))) {
          throw new Error('Only bundled local JSON-pointer $ref values are supported; bundle external references first');
        }
        refs.push(v.$ref);
      }
      for (const entry of Object.values(v)) visit(entry, depth + 1);
    } else if (Array.isArray(v)) for (const entry of v) visit(entry, depth + 1);
  };
  visit(spec, 0);
  for (const ref of refs) {
    let resolved: Json | undefined = spec;
    for (const part of ref === '#' ? [] : decodeURIComponent(ref.slice(2)).split('/').map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'))) {
      if (!(object(resolved) || Array.isArray(resolved)) || !Object.hasOwn(resolved, part)) throw new Error(`Unresolved local reference: ${ref}`);
      resolved = (resolved as ObjectValue)[part];
    }
  }
  // Fail on ambiguous operation identifiers instead of overwriting generated exports.
  const ids = new Set<string>();
  for (const [path, item] of Object.entries(spec.paths)) {
    if (path.startsWith('x-')) continue;
    if (!path.startsWith('/')) throw new Error('OpenAPI path must start with /');
    if (!object(item)) throw new Error('Invalid path item');
    if ('$ref' in item) throw new Error('Dereference path-item references before importing');
    for (const [method, op] of Object.entries(item)) if (methods.has(method)) {
      if (!object(op) || !object(op.responses)) throw new Error('Operation has no responses');
      if ('$ref' in op) throw new Error('Dereference operation references before importing');
      if (op.operationId !== undefined) {
        if (typeof op.operationId !== 'string' || !op.operationId || ids.has(op.operationId)) throw new Error('Missing or duplicate operationId');
        ids.add(op.operationId);
      }
    }
  }
  return spec;
}

/** Fail closed for metadata, loopback, link-local and private destinations. DNS is
 * validated in the very lookup used by HTTPS: no check-then-fetch DNS rebinding gap.
 */
export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a !== undefined && b !== undefined && !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 ||
      a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19));
  }
  // Permit global IPv6 only, not mapped IPv4, multicast, ULA or link-local.
  return isIP(address) === 6 && /^[23]/i.test(address) && !address.toLowerCase().startsWith('2001:db8:');
}
function download(url: URL): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'c4c/0.2' },
      lookup(host, options, callback) {
        lookup(host, { all: true }, (error, addresses) => {
          if (error || !addresses.length || addresses.some(a => !publicAddress(a.address))) {
            callback(new Error('Specification host is unavailable or resolves to a non-public address'), '', 4); return;
          }
          if (options.all) callback(null, addresses);
          else callback(null, addresses[0]!.address, addresses[0]!.family);
        });
      },
    }, res => {
      if (res.statusCode !== 200) {
        res.resume(); reject(new Error(`Specification HTTP ${res.statusCode}; redirects are not followed`)); return;
      }
      if (Number(res.headers['content-length']) > LIMIT) { res.destroy(); reject(new Error('Specification exceeds 10 MiB')); return; }
      const chunks: Buffer[] = []; let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > LIMIT) { res.destroy(new Error('Specification exceeds 10 MiB')); return; }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    const timer = setTimeout(() => req.destroy(new Error('Specification download timed out')), 15_000);
    req.on('close', () => clearTimeout(timer));
    req.on('error', reject);
    req.end();
  });
}
export async function readSpec(source: string): Promise<ObjectValue> {
  if (/^https?:/i.test(source)) {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port) {
      throw new Error('Use a public HTTPS spec URL without credentials, query, fragment or nonstandard port; save private specs to a local file');
    }
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) && !publicAddress(host) || host.toLowerCase() === 'localhost') throw new Error('Non-public specification URL');
    return parseSpec(await download(url));
  }
  if (/^[a-z]+:\/\//i.test(source)) throw new Error('Unsupported source protocol');
  const info = await stat(source);
  if (!info.isFile() || info.size > LIMIT) throw new Error('Specification must be a file of at most 10 MiB');
  return parseSpec(await readFile(source, 'utf8'));
}
