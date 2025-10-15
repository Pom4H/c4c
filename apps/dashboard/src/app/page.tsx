export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <h1>tsdev Dashboard</h1>
      <p>Workflows, endpoints, traces</p>
      <ul>
        <li><a href="/api/procedures" target="_blank">Procedures (JSON)</a></li>
        <li><a href="/api/routes" target="_blank">REST Routes (JSON)</a></li>
        <li><a href="/api/workflows" target="_blank">Workflows (JSON)</a></li>
        <li><a href="/workflow">Workflow Runner (SSE)</a></li>
        <li><a href="/events">Live Procedure Events (SSE)</a></li>
      </ul>
    </main>
  );
}
