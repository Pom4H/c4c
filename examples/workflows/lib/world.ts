/** Deployment validation only. Actual selection, persistence and queues are SDK-owned. */
export function worldMode(env: Record<string, string | undefined>): 'vercel' | 'postgres' | 'local' {
  const target = env.WORKFLOW_TARGET_WORLD;
  if (env.VERCEL === '1') {
    if (target && target !== '@workflow/world-vercel') throw new Error('Vercel deployment must use Vercel World');
    return 'vercel';
  }
  if (target === '@workflow/world-postgres') {
    const address = env.WORKFLOW_POSTGRES_URL;
    if (!address) throw new Error('Postgres World requires WORKFLOW_POSTGRES_URL');
    let parsed: URL;
    try { parsed = new URL(address); } catch { throw new Error('Invalid PostgreSQL URL'); }
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('Invalid PostgreSQL URL');
    return 'postgres';
  }
  if (target && target !== '@workflow/world-local') throw new Error('Example supports local, Vercel or Postgres World');
  return 'local';
}
