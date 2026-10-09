# c4c

**Typed tools and workflows, powered by Workflow SDK.**

Define callable tools with input/output contracts, generate independent API clients, and compose them into durable workflows. c4c makes contracts available to HTTP and AI adapters; Workflow SDK handles execution.

| Part | Responsibility |
|---|---|
| `@c4c/core` | Callable tools, input/output validation, and `.contract` metadata for introspection. Zero runtime dependencies. |
| `@c4c/cli` | OpenAPI snapshots, standalone Fetch SDKs and Zod validators, and reviewed contract updates. |
| Workflow SDK | Durable execution, steps, hooks, waits, retries, state, execution history and observability. |
| Application | Business workflows, access control, side-effect idempotency and domain data. |

Core and CLI work independently of workflows. Generated SDKs do not import c4c. Compose durable processes with native Workflow SDK functions and directives.

## A tool is an ordinary function

```ts
import { define } from '@c4c/core';
import { z } from 'zod';

export const normalizeTask = define(
  { input: z.object({ id: z.string(), title: z.string() }),
    output: z.object({ id: z.string(), title: z.string() }) },
  ({ id, title }) => ({ id: id.trim(), title: title.trim() }),
);
const task = await normalizeTask({ id: ' 42 ', title: ' Review API changes ' });
```

Input is validated before the handler and output afterward. Core supports Standard Schema v1; the application chooses its schema library. Schemas remain available through `normalizeTask.contract`. Module discovery and authorization are explicit application choices.

## The same tool in a durable workflow

```ts
import { normalizeTask } from './tools';

export async function normalizeTaskStep(input: { id: string; title: string }) {
  'use step';
  return normalizeTask(input);
}
export async function prepareTask(input: { id: string; title: string }) {
  'use workflow';
  const task = await normalizeTaskStep(input);
  return { task };
}
// Server endpoint: await start(prepareTask, [input]) from workflow/api.
```

Keep directives inside statically declared functions so the SDK can compile and execute them. The runnable example converts contract failures into `FatalError` to avoid retrying invalid input or output. Hooks, durable waits and cancellation also come from the SDK.

**[Runnable example](examples/workflows/README.md):** a c4c tool prepares an API change review, a workflow waits for human approval, and another tool records the decision for the same candidate hash. It includes direct HTTP tool calls, JSON Schema introspection, start/status endpoints, a typed approval hook and cancellation. Apply an approved SDK update separately with `c4c update --expect`.

```sh
# Node 22.18+. Version 0.2 is not published to npm; run from a checkout.
npm ci
npm run workflow:setup
cp examples/workflows/.env.example examples/workflows/.env.local
# Set a random C4C_ADMIN_TOKEN of at least 32 characters in .env.local.
npm run workflow:dev
# In another terminal, once the application is running:
npm run workflow:smoke
```

### Production deployment

**Vercel:** use `withWorkflow()` and the automatically selected Vercel World. Tools can access PostgreSQL for application data.

**Self-hosted PostgreSQL:** use `@workflow/world-postgres`, the official schema bootstrap, a persistent Node server and `world.start()` at startup. This mode requires a long-lived worker. Instructions and Compose configuration are [in the example](examples/workflows/README.md).

Inspect executions with `workflow inspect` / `workflow web`, or the Vercel dashboard. See [workflow architecture](docs/workflows.md) for execution and deployment boundaries.

## Integrations are application-owned code

```sh
npm run build
npm run c4c -- integrate examples/tasks/openapi.json --name tasks-demo
npm run c4c -- check integrations/tasks-demo --json
```

The sample OpenAPI document describes a synthetic tasks API for demonstrating code generation.

```text
integrations/tasks-demo/
├── openapi.json       # Snapshot used for generation
├── c4c.lock.json      # Source, specification/SDK hashes and generator version
└── sdk/              # Fetch client, TypeScript types and Zod validation
```

Generation uses a pinned `@hey-api/openapi-ts` version. c4c consumes its output directly; server URLs and base paths come from the specification.

```ts
import { getTask } from './integrations/tasks-demo/sdk/sdk.gen';
import { client } from './integrations/tasks-demo/sdk/client.gen';
client.setConfig({ baseUrl: 'https://YOUR_PROVIDER/api' });
const { data } = await getTask({ path: { id: '123' }, throwOnError: true });
```

The generated SDK requires Zod 4 but has no production dependency on c4c or the generator. Use separate client instances and authorization for separate accounts. Keep handwritten domain adapters outside the managed directory and invoke them directly or from a `use step` function.

## Check and update

```sh
c4c check integrations/tasks-demo --json
c4c update integrations/tasks-demo --expect <candidateHash>
```

`check` is read-only. Exit codes: `0` means unchanged, `2` means review required, and `1` means unavailable or failed. Use `--against ./candidate.json` to compare a prepared snapshot without changing the upstream source.

Updates are generated in a temporary directory. Failed generation preserves the previous integration. Upstream changes after review and handwritten SDK edits block replacement. See [the integration lifecycle and recovery guide](docs/integrations.md).

**A structural diff does not establish semantic compatibility.** Check response meaning, authorization and pagination with contract fixtures and limited read-only provider checks. Workflow approval records a decision about the supplied report; deployment has its own validation.

## Validation and supported inputs

```sh
npm run check              # Lightweight tests/types, including review logic and World selection
npm run test:codegen       # Real generator → TypeScript → injected Fetch mock
npm run workflow:typecheck # After workflow:setup
npm run workflow:build     # Native workflow/step compilation; separate from lightweight CI
```

Automatic CI runs lightweight checks. Native SDK smoke tests and PostgreSQL restart/recovery checks run separately and require the example application. Unit and mock tests establish local behavior; live API and backend checks establish deployment behavior.

CLI input is **bundled OpenAPI 3.0/3.1 JSON**. Bundle external `$ref` values first; unresolved references are rejected. YAML, WSDL and SOAP inputs are not implemented. The CLI runs on a trusted machine. Remote sources require public HTTPS without credentials, query parameters or redirects; DNS addresses are checked at connection time. Supply private specifications as local files and keep secrets out of commits.

## Migration

The previous engine and visualizer are preserved in [archive/v0.1](https://github.com/Pom4H/c4c/tree/archive/v0.1). Move workflow execution to Workflow SDK while retaining tools, contracts and automation capabilities. [Migration guide](docs/migration.md) · [Workflow architecture](docs/workflows.md).

MIT.
