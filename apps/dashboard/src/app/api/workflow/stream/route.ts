import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RUNTIME_URL = process.env.RUNTIME_URL || 'http://localhost:3000';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const executionId = searchParams.get('executionId');
  if (!executionId) {
    return new Response('Missing executionId', { status: 400 });
  }

  const upstream = await fetch(`${RUNTIME_URL}/workflow/events?executionId=${encodeURIComponent(executionId)}`);
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
