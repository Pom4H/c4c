# c4c + Workflow SDK: tools → durable review

This application uses native Workflow SDK execution. c4c's `define()` creates callable tools with input/output contracts; explicitly declared steps call those tools, and the workflow controls the sequence and typed approval hook. The HTTP API exposes direct calls to the same tools and their contract metadata.

```text
POST /api/reviews
    start(reviewChange)
       prepareReviewStep → c4c prepareReview tool
       approvalHook + durable sleep (up to 7 days)
       recordDecisionStep → c4c recordDecision tool
    getRun(runId).status / returnValue
```

The example accepts a `c4c check` report from a trusted caller, prepares a review, and stores the decision as the workflow result. Your CLI/CI job checks the actual upstream and applies `c4c update --expect <hash>`. Accepting a supplied report does not independently verify API compatibility or update generated source on Vercel.

## 1. Run locally with Local World

From the repository root, using Node 22.18+:

```sh
npm ci
npm run workflow:setup
cp examples/workflows/.env.example examples/workflows/.env.local
# Generate a token and copy the value only into your local .env.local:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm run workflow:dev
```

Set `C4C_ADMIN_TOKEN` to at least 32 characters in `examples/workflows/.env.local`. Keep `.env.local` out of Git. Local World is selected automatically; `.workflow-data` is also excluded from Git.

In another terminal:

```sh
npm run workflow:typecheck
npm run workflow:smoke
cd examples/workflows
npm run inspect
npm run web
```

The smoke test sends a synthetic report and checks that anonymous access is denied, tool JSON Schemas are available, a run starts, the typed hook resumes it, and the result is `approved`. It exercises the compiled, running SDK. Calling the workflow function directly while ignoring its directive would not test that execution path. The smoke test requires a running server.

Root CI runs lightweight tests of pure logic and World selection. It does not install this example or build Next.js. The example's direct dependencies are pinned to versions from the official Postgres example (`workflow`/`world-postgres` 5.0.1). For reproducible production deployment, commit the generated `examples/workflows/package-lock.json` and use `npm ci` in the example directory.

## 2. Self-hosted Postgres World

```sh
cd examples/workflows
cp .env.postgres.example .env.local
# Set the token, POSTGRES_PASSWORD, and the full WORKFLOW_POSTGRES_URL.
# Use the same password in POSTGRES_PASSWORD and the URL.
docker compose --env-file .env.local up -d --wait
npm run db:migrate
npm run build
npm run start
```

`db:migrate` runs the official `bootstrap` from `@workflow/world-postgres`. The SDK manages its runtime tables and worker. `instrumentation.ts` calls `world.start()` only for Postgres World, once when the persistent process starts.

The PostgreSQL connection string stays in the server environment and is never sent to the browser. The PostgreSQL container is exposed only on `127.0.0.1`. On a production self-hosted server, back up the database and restrict external access to the SDK callback endpoints at `/.well-known/workflow/*` through private ingress or a reverse proxy. Keep Local World and `workflow web` private.

Test restart recovery separately from the regular smoke test:

1. Create a review and save its `runId` and `candidateHash`.
2. Run `npm run web -- --backend @workflow/world-postgres` and wait for the approval hook to be created.
3. Stop only the application; leave PostgreSQL and its volume intact.
4. Start the same build with the same `WORKFLOW_POSTGRES_URL`.
5. Resume the same `runId` through the approval API; verify `completed` and the preceding steps in SDK inspection.

Run this check in your environment before claiming restart/replay support for the chosen version. Compose files, configuration, and unit tests alone do not establish recovery behavior.

## 3. Vercel World

Set the Vercel project root to `examples/workflows` and allow access to files above that root for the local `@c4c/core` package. Build core before Next.js. For example, run these install/build commands from the example directory:

```sh
npm --prefix ../.. ci
npm --prefix ../.. run build
npm install
npm run build
```

After committing the example's lockfile, replace `npm install` with `npm ci`. Set the server-side `C4C_ADMIN_TOKEN` and enable Fluid compute. Leave `WORKFLOW_TARGET_WORLD=@workflow/world-postgres` unset: Vercel selects its managed World automatically. Tools can still access your application's PostgreSQL database inside steps.

Vercel World owns the queues, durable state, and execution history in this mode; no Postgres worker is started. The configuration in this repository does not establish that a Vercel deployment has been verified.

## API

All `/api/*` routes require `Authorization: Bearer <C4C_ADMIN_TOKEN>`.

| Method | Purpose |
|---|---|
| `GET /api/tools` | JSON Schemas and descriptions for the explicitly registered tools |
| `POST /api/tools` | `{name, input}`: call `prepareReview` or `recordDecision` directly, without durable execution |
| `POST /api/reviews` | `{integration, report}` → `202 {runId, statusUrl}` |
| `GET /api/reviews/:runId` | SDK status; result available only after `completed` |
| `POST /api/reviews/:runId/approval` | `{candidateHash, approved}` → native typed-hook resume |
| `DELETE /api/reviews/:runId` | SDK cancellation |

`report` contains the `previousHash`, `candidateHash`, `changes`, `truncated`, and `generatorChanged` fields from `c4c check --json`. Extra informational fields are ignored. The request body is limited to 128 KiB. Schema errors return 400; a missing token returns 401; an absent or closed hook returns 409; an unavailable backend returns 503.

The hook may not exist immediately after run creation returns 202. The client retries approval after 409. A 202 response means the event was accepted; check the run status for workflow completion. The hook token includes the `runId` and hash, so approval for an outdated snapshot cannot resume another review. Approval is rejected once the run has reached a terminal state.

**Scope:** the example uses a shared service token without tenant authorization, RBAC, or SSO. `start` is not deduplicated by a business request ID, and approval does not deploy code. Applications own identity, scopes, run ownership, event idempotency, and idempotency keys for side effects. The SDK does not guarantee exactly-once effects for arbitrary network writes.

## Structure

- `lib/tools.ts` — callable c4c tools and introspection; contracts are in `contracts.ts`.
- `workflows/steps.ts` — statically declared SDK steps; contract errors become `FatalError`.
- `workflows/review-change.ts` — control flow, hooks, durable sleep.
- `workflows/hooks.ts` — a typed SDK hook.
- `instrumentation.ts` / `lib/world.ts` — startup and World selection checks; execution belongs to the SDK.
- `app/api` — authenticated entry points for explicitly declared tools, with no `eval`, export scanning, or automatic invocation of unknown tools.

Documentation: [Next.js setup](https://workflow-sdk.dev/docs/getting-started/next), [Postgres World](https://workflow-sdk.dev/worlds/postgres), and [Vercel World](https://workflow-sdk.dev/worlds/vercel). The installed `workflow` package also contains documentation for its version.
