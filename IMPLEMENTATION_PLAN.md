# c4c Implementation Plan

Roadmap for introducing the Hono transport layer, richer procedure metadata, streaming workflow APIs, unified CLI tooling, and generated clients.

---

## 1. Transport Modernization (Hono)
- Replace `packages/adapters/src/http.ts` with a `Hono` app that composes modular routers (`rpc`, `rest`, `workflow`, `docs`).
- Refactor `packages/adapters/src/rest.ts` into `createRestRouter(registry)` that uses Hono request helpers while reusing existing contract-to-route mapping.
- Port RPC handling to `createRpcRouter(registry)` with shared error handling and context creation.
- Convert `packages/adapters/src/workflow-http.ts` into a Hono router, preserving current endpoints.
- Introduce shared middleware (CORS, health, context injection, logging) to be reused in every deployment mode.

## 2. Workflow Streaming API
- Add execution event hooks/emitter inside `@c4c/workflow` to surface node start/completion, errors, and final status.
- Expose SSE endpoint (e.g. `GET /workflow/executions/:id/stream`) using `streamSSE` that subscribes to execution events and streams JSON payloads (`workflow-start`, `node-start`, `node-complete`, `node-error`, `workflow-complete`, `heartbeat`).
- Ensure long-running streams flush after every event and close cleanly once execution finishes or errors.
- Update workflow HTTP routes to return `executionId` so clients can immediately connect to the SSE stream.

## 3. Procedure Catalog & Metadata
- Extend `Contract` metadata to include exposure and usage hints:
  - `exposure: "external" | "internal"` for transport-level visibility.
  - `roles: Array<"workflow-node" | "api-endpoint" | "sdk-client">` to drive generators.
  - Optional `category`, `auth`, or `rateLimit` fields for future policies.
- Update registry introspection (`/procedures`, OpenAPI generator, workflow palette) to respect metadata filters.
- Ensure integrations (e.g. `examples/integrations`) mark generated procedures as `internal` and `workflow-node`.
- Add catalog helper utilities for consistent filtering across transports, CLI, and generators.

## 4. Ports & Adapters Alignment
- Document primary ports the core exposes:
  - **ProcedureExecutionPort** — `executeProcedure(registry, input, context)`.
  - **WorkflowExecutionPort** — `executeWorkflow`, `resumeWorkflow`, `validateWorkflow`.
  - **WorkflowEventPort** — event emitter delivering execution lifecycle events.
  - **ProcedureCatalogPort** — discovery of contracts/metadata for inspectors and generators.
  - **ClientGenerationPort** — transform catalog metadata into SDK artifacts.
- Map existing and planned adapters to these ports:
  - Hono HTTP (`rpc`, `rest`, `workflow`, `docs`) → ProcedureExecutionPort, ProcedureCatalogPort.
  - SSE workflow router → WorkflowEventPort.
  - CLI → ProcedureExecutionPort.
  - Workflow UI → ProcedureCatalogPort + WorkflowEventPort.
  - Client generator CLI → ProcedureCatalogPort + ClientGenerationPort.
- Ensure new functionality plugs into ports instead of coupling to transports directly (e.g. metadata filters, auth policies, event streaming).
- Update docs to reflect the hexagonal architecture narrative and keep adapters transport-agnostic.

## 4. Unified CLI (`c4c serve …`)
- Introduce a small CLI package/bin exposing `c4c serve <mode>` with modes: `rpc`, `rest`, `workflow`, `ui`, `all`.
- Each mode composes the relevant Hono routers (or launches the UI dev server), sharing configuration for port/host and registry loading.
- Provide configuration via flags/env (`--port`, `--host`, `--config-file`) and emit startup diagnostics (available routes, SSE endpoints, etc.).
- Support monolithic (`all`) mode in a single process and optional microservice mode via multiple CLI invocations.

## 5. Workflow UI Integration
- Wrap `examples/workflow-viz` into a runnable artifact (dev server or static build) that the CLI can launch with the correct API base URLs and SSE endpoint.
- Ensure the UI consumes the new introspection catalog and SSE stream to visualize workflow execution in real time.
- Optionally proxy the UI through the main Hono app for simplified deployment.

## 6. Typed Client Generation
- Extend `@c4c/generators` to emit a TypeScript client (REST and/or RPC) using metadata-filtered contracts.
- Generate:
  - Typed function wrappers (`createUser(input)`).
  - Zod schemas or inferred types for inputs/outputs.
  - Fetch implementation with pluggable transport (node/fetch).
- Provide CLI command (`c4c generate client --out ./src/generated`) and document the workflow.
- Align OpenAPI output with exposed procedures only, ensuring frontend clients match published endpoints.

## 7. Documentation & Validation
- Update `README.md`/`ARCHITECTURE.md` with Hono-based architecture, SSE usage, metadata semantics, and CLI instructions.
- Add examples demonstrating internal vs external procedures and workflow streaming.
- Cover new functionality with tests:
  - Router smoke tests using supertest/hono test utilities.
  - Workflow execution emitting events.
  - CLI integration (spawn tests where feasible).
  - Generated client type assertions.
- Provide migration guide for existing users moving from the Node HTTP server to Hono.

## Open Questions / Decisions
- Confirm desired default ports and whether `c4c serve all` should hot-reload during development.
- Decide on configuration source of truth (JSON/YAML manifest vs programmatic setup).
- Determine if SSE events require persistence/history for late subscribers.
- Clarify packaging strategy for the generated client (npm package vs per-project codegen).
