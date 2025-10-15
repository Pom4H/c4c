import { NextResponse } from 'next/server';

const RUNTIME_URL = process.env.RUNTIME_URL || 'http://localhost:3000';

export async function GET() {
  const res = await fetch(`${RUNTIME_URL}/routes`, { cache: 'no-store' });
  const json = await res.json();
  return NextResponse.json(json);
}
