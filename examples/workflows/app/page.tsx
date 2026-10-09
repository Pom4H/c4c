export default function Home() {
  return <main style={{ maxWidth: 760, margin: '64px auto', padding: 24, fontFamily: 'system-ui' }}>
    <h1>c4c tools + Workflow SDK</h1>
    <p>Contracts and integration tools stay in c4c. Durable steps, hooks, replay and execution history belong to Workflow SDK.</p>
    <p>This is a runnable review example, not a provider integration or a replacement for application authorization.</p>
    <pre>POST /api/reviews → step → approval hook → step → result</pre>
    <p>API routes require C4C_ADMIN_TOKEN. Use the smoke script and native workflow web/inspect commands from this directory.</p>
    <p>Run locally, deploy with Vercel World, or start a persistent server with Postgres World. A PostgreSQL business database on Vercel does not require Postgres World.</p>
  </main>;
}
