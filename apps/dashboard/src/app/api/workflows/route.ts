import { NextResponse } from 'next/server';

const RUNTIME_URL = process.env.RUNTIME_URL || 'http://localhost:3000';

export async function GET() {
  // Placeholder: runtime may expose a workflow registry endpoint in future
  // For now, return empty list or proxy to a custom endpoint when available
  try {
    const res = await fetch(`${RUNTIME_URL}/workflow/ui-config`, { cache: 'no-store' });
    const json = await res.json();
    return NextResponse.json({ uiConfig: json });
  } catch {
    return NextResponse.json({ uiConfig: { nodes: [], categories: [], connections: [] } });
  }
}
