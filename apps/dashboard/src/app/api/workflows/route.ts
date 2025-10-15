import { NextResponse } from 'next/server';
import { collectWorkflows, listWorkflows } from '@tsdev/workflow';

export async function GET() {
  // Load workflows from an example project in this monorepo
  // Load from published example barrel file path
  const map = await collectWorkflows('examples/workflows/src');
  return NextResponse.json({ workflows: listWorkflows(map) });
}
