import { NextRequest, NextResponse } from 'next/server';
import { executeWorkflow } from '@/lib/workflow/execute';
import { collectWorkflows, getWorkflowById } from '@tsdev/workflow';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workflowId, input = {} } = body as { workflowId: string; input?: Record<string, unknown> };
    const map = await collectWorkflows('examples/workflows/src');
    const workflow = getWorkflowById(map, workflowId);
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }
    const result = await executeWorkflow(workflow, input);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
