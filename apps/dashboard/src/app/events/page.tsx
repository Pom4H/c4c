"use client";
import { useEffect, useRef, useState } from 'react';

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_RUNTIME_URL || 'http://localhost:3000';
    const es = new EventSource(`${url}/events/procedures`);
    esRef.current = es;
    es.onmessage = (e) => {
      try { setEvents((prev) => [...prev, JSON.parse(e.data)]); } catch {}
    };
    return () => { es.close(); esRef.current = null; };
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>Live Procedure Events</h1>
      <pre style={{ maxHeight: 500, overflow: 'auto', background: '#111', color: '#0f0', padding: 12 }}>
        {events.map((e, i) => JSON.stringify(e, null, 2)).join('\n')}
      </pre>
    </main>
  );
}
