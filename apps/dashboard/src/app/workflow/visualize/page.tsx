"use client";
import { useEffect, useState } from 'react';
import WorkflowGraph from '@/components/WorkflowGraph';

export default function VisualizePage() {
  const [workflow, setWorkflow] = useState<any | null>(null);
  const [execution, setExecution] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const listRes = await fetch('/api/workflows');
      const listJson = await listRes.json();
      const wf = listJson.workflows?.[0];
      if (!wf) return;
      // Get full workflow via execute API planning (execute without run not available yet); use stored example by id
      // We'll call execute endpoint to obtain spans as well
      const execRes = await fetch('/api/workflow/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workflowId: wf.id }) });
      const execJson = await execRes.json();
      setWorkflow({ ...execJson, id: wf.id, name: wf.name, version: wf.version });
      setExecution({ nodesExecuted: execJson.nodesExecuted || [], spans: execJson.spans || [] });
    })();
  }, []);

  if (!workflow) return <main style={{ padding: 24 }}>Loading...</main>;

  return (
    <main style={{ padding: 24 }}>
      <h1>Workflow Graph</h1>
      <WorkflowGraph workflow={workflow} execution={execution || undefined} />
    </main>
  );
}
