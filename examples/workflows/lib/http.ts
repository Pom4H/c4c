import { createHash, timingSafeEqual } from 'node:crypto';
import { ContractError } from '@c4c/core';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
// This example is a single trusted service, NOT a multi-tenant authorization system.
// Production apps must check their own identity, workspace, scopes and run ownership.
export function authorize(request: Request): void {
  const configured = process.env.C4C_ADMIN_TOKEN;
  if (!configured || configured.length < 32) throw new HttpError(503, 'Configure C4C_ADMIN_TOKEN (at least 32 characters)');
  const actual = request.headers.get('authorization') ?? '';
  const digest = (s: string) => createHash('sha256').update(s).digest();
  if (!timingSafeEqual(digest(actual), digest(`Bearer ${configured}`))) throw new HttpError(401, 'Unauthorized');
}
export async function readJSON(request: Request): Promise<unknown> {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Use application/json');
  const limit = 128 * 1024;
  if (Number(request.headers.get('content-length')) > limit || !request.body) throw new HttpError(413, 'Invalid body size');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new HttpError(413, 'Body exceeds 128 KiB'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new HttpError(400, 'Invalid JSON'); }
}
export const runIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,160}$/);
export function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function failure(error: unknown): Response {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return json({ error: 'Invalid input' }, 400);
  if (error instanceof ContractError) return json({ error: `Tool contract failed: ${error.stage}` }, error.stage === 'input' ? 400 : 500);
  // Do not convert an unavailable backend into a successful empty result.
  if (error instanceof Error && error.name === 'HookNotFoundError') {
    return json({ error: 'Approval hook is not ready, is closed, or belongs to another candidate' }, 409);
  }
  return json({ error: 'Workflow backend could not complete the operation' }, 503);
}
