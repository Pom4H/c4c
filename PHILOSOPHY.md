# 🧭 tsdev Philosophy

> **Write once — describe forever.**  
> By defining system behavior through contracts, we transform code into a self-documenting, self-generating application model.

---

## 1. Contracts-first ≠ API-first

Most frameworks design APIs as a transport layer (REST, gRPC, GraphQL).

**We design domain contracts** — a set of Zod schemas expressing:
- input and output data of procedures,
- their names and invariants,
- connections with the environment (context).

**A contract is the single source of truth**, from which everything else is automatically derived: REST endpoints, CLI commands, SDKs, OpenAPI specs, agents, test fixtures.

---

## 2. Transport-agnostic core

Transport is merely the surface through which the same procedures are executed.

**The logic doesn't know where the call came from:** HTTP, CLI, agent, worker, or SDK.

The same handler can be called by a browser, bot, or CI script — and the behavior remains consistent.

---

## 3. Zero boilerplate, maximum reflection

No manual registrations or "magical" declarations — everything exported from `handlers/*` files is automatically collected via `collectRegistry()`.

This creates a **self-describing registry** that serves as:
- documentation,
- entry point for generators,
- introspection object for agents.

---

## 4. OpenTelemetry by design

Our goal is not just to "trace" code, but to **understand domain behavior**.

Each procedure executes in a span context (`withSpan`), and attributes (`setAttributes`) form business-level telemetry (`organization_id`, `chat_id`, etc.).

Thus, **observability is built into the domain model level**.

---

## 5. Unified developer & AI interface

Procedures are described in machine-readable form (Zod schemas + metadata).

This means:
- **CLI and REST interfaces** are different "facades" of the same core.
- **LLM agents** can call these procedures directly, without parsing documentation.
- **SDKs and CLI utilities** can be generated automatically.

In the tsdev ecosystem, **an agent is also a tsdev client**.

---

## 6. Composability over inheritance

Each procedure is a pure function that can be combined through policy composition:

```typescript
withRetry, withBilling, withRateLimit, withFlags, withTracing
```

This makes the system **extensible without framework magic**, and behavior transparently deterministic.

---

## 7. Convention over configuration

**Biome + strict code structure rules** ensure:
- stable file topology (`contracts/`, `handlers/`, `apps/`),
- predictable procedure discovery,
- no dead code or duplication.

**Conventions form the foundation of "second-level compilation"** — a meta-view of the project.

---

## 🎯 Principles at a glance

| Principle | Meaning |
|-----------|---------|
| **Contracts-first** | Contracts are the source of truth for all interfaces |
| **Transport-agnostic** | One handler — multiple adapters |
| **Self-describing registry** | Automatic introspection for SDKs and agents |
| **Telemetry by default** | Every call is observable and attributed |
| **Composable policies** | Behavior extends via functions, not framework |
| **Convention-driven** | Structure → introspection → automation |

---

## Framework Philosophy

Meta-level unification of all application code through **contracts**, not through specific transport, framework, or infrastructure.

This enables:
- ✅ Write code once, describe its behavior forever
- ✅ Automatically generate documentation, SDKs, CLI
- ✅ Ensure uniformity for humans and AI
- ✅ Scale systems without rewriting logic
- ✅ Observe systems at the business logic level
