"use client";
import { useEffect, useState } from 'react';
import WorkflowGraph from '@/components/WorkflowGraph';
import TraceViewer from '@/components/TraceViewer';
import { Separator } from '@/components/ui/separator';

export default function OverviewPage() {
  const [items, setItems] = useState<Array<{ id: string; name: string; version: string; description?: string }>>([]);
  const [executions, setExecutions] = useState<Record<string, any>>({});

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/workflows');
      const json = await res.json();
      const list = json.workflows || [];
      setItems(list);
      // Execute all workflows sequentially to gather spans (demo)
      const results: Record<string, any> = {};
      for (const wf of list) {
        try {
          const execRes = await fetch('/api/workflow/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workflowId: wf.id }) });
          const execJson = await execRes.json();
          results[wf.id] = execJson;
        } catch {}
      }
      setExecutions(results);
    })();
  }, []);

  if (items.length === 0) return <main style={{ padding: 24 }}>No workflows found</main>;

  return (
    <main style={{ padding: 24 }}>
      <h1>Projects Overview</h1>
      <p className="text-sm text-gray-500">All workflows across projects with live traces</p>
      {items.map((wf, idx) => {
        const data = executions[wf.id];
        return (
          <section key={wf.id} style={{ margin: '24px 0' }}>
            <h2 className="text-lg font-semibold">{wf.name} <span className="text-xs text-gray-500">(v{wf.version})</span></h2>
            <p className="text-sm text-gray-500">{wf.description}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 12 }}>
              {/* Left: workflow graph */}
              {data?.nodes ? (
                <WorkflowGraph workflow={data} execution={{ nodesExecuted: data.nodesExecuted || [], spans: data.spans || [] }} />
              ) : (
                <div>Loading graph...</div>
              )}
              {/* Right: traces */}
              <div>
                {data?.spans ? <TraceViewer spans={data.spans} /> : <div>No spans</div>}
              </div>
            </div>
            <Separator />
          </section>
        );
      })}
    </main>
  );
}
