# Workflows around tools

## Responsibilities

c4c provides contracts, tools, integrations, and their descriptions. Write orchestration in ordinary TypeScript with `use workflow` and put I/O in named `use step` functions. Workflow SDK provides execution, queues, logs, replay, waits, hooks, and inspection. c4c does not maintain a separate run database, polling daemon, DSL interpreter, or scheduler.

`define()` creates an ordinary callable function with `.contract` metadata. In `examples/workflows/lib/tools.ts`, the same functions serve an HTTP handler and a durable step, and expose descriptions to external clients. `describeTools()` demonstrates JSON Schema introspection that MCP or AI adapters can consume. The example provides this metadata; implementing an MCP server or exposing additional modules requires an application adapter.

## Statically declared steps

The SDK must statically discover a function containing `use step`. A runtime wrapper such as `durable(tool)` around an arbitrary closure cannot replace this compilation step. The example therefore declares explicit, typed functions in `workflows/steps.ts` and a native workflow in `review-change.ts`. Tool logic remains independent of the runtime.

Keep workflow control flow deterministic. Network requests, database access, LLM calls, and ordinary timers belong in steps. Use SDK `sleep()` inside the workflow for long waits, rather than `setTimeout` or a pending HTTP response. Pass small, serializable values across workflow boundaries. Keep functions, client objects, tokens, and large documents outside those inputs and outputs.

## Contracts, errors, and side effects

The example converts tool input/output `ContractError` failures and approval hash mismatches to `FatalError`, because retries cannot resolve them. Provider adapters must classify permission and business errors separately from transient failures. Let the SDK handle retries and use `RetryableError` where appropriate; avoid a nested custom retry loop.

Durable replay does not guarantee exactly-once effects in an external API. For sending messages, taking payments, writing data, or creating PRs, the application must use provider idempotency keys or unique business identifiers and verify the actual result. The example returns an approval decision; financial operations and SDK deployment remain outside its scope.

## Hooks and authorization

Declare a hook with `defineHook({schema})`, call `.create()` in the workflow, and call `.resume()` from an authorized endpoint. The token binds `runId` and `candidateHash`. An approval for another snapshot must not resume the process. The token routes the event; authorization requires a separate check. `using` disposes of the hook after a decision or timeout.

The example uses one service token. A multi-tenant application must enforce membership, scopes, and ownership of each run. External webhooks need signature verification and event deduplication. The POST endpoint that creates runs does not deduplicate by business task; add application-level deduplication when a repeated client request should refer to the same run.

## Deployment

| Mode | Execution and state | Application setup |
|---|---|---|
| Local World | SDK development backend | Run `next dev`; queue recovery after a restart is not guaranteed |
| Vercel World | Managed SDK backend on Vercel | Use `withWorkflow`; tools can access PostgreSQL for business data |
| Postgres World | PostgreSQL and Graphile Worker in a long-lived Node server | Set environment variables, run the official bootstrap, and call `world.start()` at server startup |

Postgres World requires a long-lived server and cannot run inside a Vercel serverless function. Choosing PostgreSQL for business data is separate from choosing it as the workflow runtime backend. For self-hosted deployments, protect the internal `/.well-known/workflow/*` endpoints from public access with private ingress or a reverse proxy. `C4C_ADMIN_TOKEN` protects only the example's application API. Keep the local backend and inspection UI private.

On Vercel, existing runs are tied to their deployment. For self-hosted upgrades, follow the selected SDK's versioning rules and preserve the executable code required by existing runs. The old c4c 0.1 execution records are incompatible with the SDK log.

## Verification

Default checks cover pure business logic and configuration boundaries. Compiled steps, pause/resume, restart recovery, and real Vercel or Postgres connections require separate verification. Follow the procedures in the [workflow example](../examples/workflows/README.md); unit tests alone do not establish deployed runtime behavior.

## References

- [Workflow SDK with Next.js](https://workflow-sdk.dev/docs/getting-started/next)
- [Vercel World](https://workflow-sdk.dev/worlds/vercel)
- [Postgres World](https://workflow-sdk.dev/worlds/postgres)
- [Local World](https://workflow-sdk.dev/worlds/local)
- [Official PostgreSQL example](https://github.com/vercel/workflow-examples/tree/main/postgres)

The `workflow` and `@workflow/world-postgres` versions, 5.0.1, were taken from the official example. Consult the documentation for the installed version before upgrading.
