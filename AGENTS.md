# c4c — tools and workflows; execution belongs to Workflow SDK

Read README.md, docs/workflows.md and docs/migration.md before changing architecture.

**Preserve workflow capabilities around typed tools. Replace only our custom runtime.** The agreed runtime is Workflow SDK (workflow-sdk.dev): literal `use workflow` / `use step`, `start`, `getRun`, typed hooks, durable sleep and SDK observability. Do not narrow c4c to an SDK generator again, and do not restore our own scheduler, replay log, queue or workflow interpreter.

Core stays independently usable, with zero runtime dependencies and callable contracts. CLI emits independent Fetch/Zod SDKs through the pinned upstream generator. Workflows call statically declared steps, which invoke the same tools; contract metadata remains available to HTTP/MCP/AI adapters. Do not hide directives inside higher-order functions or auto-run arbitrary modules discovered from untrusted content.

Deployment modes: Vercel World on Vercel (business data may still be in PostgreSQL); Postgres World with a long-lived self-hosted server. Do not start a Postgres worker inside a serverless request or claim the Local World has durable queue recovery. Old engine runs cannot be replayed by the SDK.

`check` is read-only: 0 unchanged, 2 review, 1 unavailable/error. An update needs the reviewed hash. A structural diff is not a proof of semantic compatibility. Preserve hand edits, previous snapshots on failed generation, and explicit approval boundaries.

Default checks: `npm run check` and `npm run test:codegen`. No browsers, DB services, model downloads or GPU in automatic CI. Native SDK smoke/restart checks are separate: see examples/workflows/README.md. Be precise about what actually ran; unit tests are not a deployed-backend test.

The example HTTP API uses a single service token, not multi-tenant authorization. Real apps own identity, scopes, run ownership, webhook signatures and side-effect idempotency. Never log tokens or return internal runtime errors. Keep workflow input/output small and serializable. Await long waits in workflows, not steps or HTTP handlers.
