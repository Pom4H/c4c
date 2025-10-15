export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <h1>tsdev Dashboard</h1>
      <p>Workflows, endpoints, traces</p>
      <ul>
        <li><a href="/api/procedures" target="_blank">Procedures</a></li>
        <li><a href="/api/routes" target="_blank">REST Routes</a></li>
        <li><a href="/api/workflows" target="_blank">Workflows</a></li>
      </ul>
    </main>
  );
}
