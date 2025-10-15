# tsdev Roadmap

> Living roadmap. Timelines are indicative; scope may adjust based on feedback.

## 0.1.x — Foundation hardening (short-term)
- Stabilize core contracts/procedures types (no breaking rename churn)
- Finalize workflow execution API (pause/resume semantics, error propagation)
- Improve adapters: clearer errors, input/output validation messages
- Add OpenTelemetry config presets and examples (console, OTLP exporter)
- Improve examples: end-to-end flows across `basic`, `workflows`, `workflow-viz`, `chat-automation`
- Documentation polish: Architecture, Philosophy, README alignment; add Generators and GitHub CI sections

## 0.2.x — Developer experience (short-term)
- CLI tooling: `tsdev` helper (scaffold contracts/handlers/apps, run servers)
- Better runtime diagnostics: pretty errors, trace IDs in logs
- Generators: improve OpenAPI output; JSON Schema export options; CLI command `tsdev generate openapi`
- React hooks: loading/error states, typed helpers, storybook examples
- Policies: add `withCache`, `withTimeout`, `withCircuitBreaker`

## 0.3.x — Extensibility (mid-term)
- New adapters: WebSocket (RPC over WS), background worker adapter
- SDK generator (TypeScript) from registry/contracts; publish client library template
- Graph visualization API for workflows (data model and serialization)
- Contract evolution guidelines (breaking/backward-compatible changes)
- Pluggable registry collectors (custom discovery strategies)

## 0.4.x — Integrations (mid-term)
- GraphQL adapter (contract → schema, resolvers)
- gRPC adapter (proto generation, server/client bindings)
- Message queue adapter (SQS/Kafka/RabbitMQ pattern)
- Authn/Authz policy examples (JWT, API key, RBAC)
- GitHub integration: official Actions to build registry, generate OpenAPI, preview docs on PRs

## 0.5.x — Observability and scale (long-term)
- Distributed tracing examples across multi-service registries
- Metrics and logs conventions alongside traces
- Performance tuning guide; benchmarks for core, policies, adapters
- Workflow persistence hooks (save/restore execution state)
- Registry provenance: signed artifacts for generated specs

## 0.6.x+ — Agents and automation (long-term)
- Agent interface: LLM-callable procedure registry with safeguards (read-only discovery, sandboxed PR authoring)
- Auto-docs site generator from registry (procedures, policies, workflows)
- Multi-language SDKs (Python first)

## Nice-to-haves (ongoing)
- Example gallery with real-world domains
- Tutorial series and reference cookbook
- Community templates and contribution guide

---

Feedback welcome — please open issues or discussions to influence priorities.
