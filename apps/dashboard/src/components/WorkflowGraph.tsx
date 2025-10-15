"use client";
import dynamic from 'next/dynamic';
import type { WorkflowDefinition, TraceSpan } from '@tsdev/workflow';

const WorkflowVisualizer = dynamic(() => import('../../../examples/workflow-viz/src/components/WorkflowVisualizer'), { ssr: false });

export default function WorkflowGraph({ workflow, execution }: { workflow: WorkflowDefinition; execution?: { nodesExecuted: string[]; spans: TraceSpan[] } }) {
  return <WorkflowVisualizer workflow={workflow} executionResult={execution} />;
}
