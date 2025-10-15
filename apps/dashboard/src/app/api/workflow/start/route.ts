import { NextResponse } from 'next/server';

const RUNTIME_URL = process.env.RUNTIME_URL || 'http://localhost:3000';

export async function POST() {
  // For demo: assume runtime accepts a built-in workflow via payload
  const payload = {
    workflow: {
      id: 'demo.parallel',
      name: 'Demo Parallel',
      version: '1.0.0',
      startNode: 'start',
      nodes: [
        { id: 'start', type: 'parallel', config: { branches: ['a', 'b'], waitForAll: true }, next: 'end' },
        { id: 'a', type: 'sequential', next: undefined },
        { id: 'b', type: 'sequential', next: undefined },
        { id: 'end', type: 'sequential', next: undefined },
      ],
    },
  };

  const res = await fetch(`${RUNTIME_URL}/workflow/execute-async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  return NextResponse.json(json, { status: res.status });
}
