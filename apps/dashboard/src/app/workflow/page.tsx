"use client";
import { useEffect, useRef, useState } from 'react';

export default function WorkflowPage() {
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  async function startWorkflow() {
    setEvents([]);
    const res = await fetch('/api/workflow/start', { method: 'POST' });
    const { executionId } = await res.json();
    setExecutionId(executionId);
  }

  useEffect(() => {
    if (!executionId) return;
    const es = new EventSource(`/api/workflow/stream?executionId=${encodeURIComponent(executionId)}`);
    eventSourceRef.current = es;
    es.onmessage = (e) => {
      try {
        setEvents((prev) => [...prev, JSON.parse(e.data)]);
      } catch {}
    };
    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [executionId]);

  return (
    <main style={{ padding: 24 }}>
      <h1>Workflow Execution</h1>
      <button onClick={startWorkflow}>Start example workflow</button>
      {executionId && <p>Execution ID: {executionId}</p>}
      <pre style={{ maxHeight: 400, overflow: 'auto', background: '#111', color: '#0f0', padding: 12 }}>
        {events.map((e, i) => JSON.stringify(e, null, 2)).join('\n')}
      </pre>
    </main>
  );
}
