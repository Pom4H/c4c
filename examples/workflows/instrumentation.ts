import { worldMode } from './lib/world';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const mode = worldMode(process.env);
  if (mode === 'postgres') {
    const { getWorld } = await import('workflow/runtime');
    const world = await getWorld();
    // Postgres World owns Graphile Worker. Start once per long-lived server,
    // NOT per request, and NOT in a Vercel function.
    await world.start?.();
  }
}
