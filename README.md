# tsdev

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Zod](https://img.shields.io/badge/Zod-Schema-green.svg)](https://zod.dev/)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Enabled-orange.svg)](https://opentelemetry.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> **Write once — describe forever.**  
> Meta-level unification of application code through contracts, not transport or infrastructure.

## About

tsdev is a framework implementing a **contracts-first** approach to application development. Instead of designing APIs as a transport layer, we create domain contracts (Zod schemas) from which REST endpoints, CLI commands, SDKs, OpenAPI specs, and AI agent interfaces are automatically derived.

## Key Features

- 🎯 **Contracts-first**: single source of truth for all interfaces
- 🔄 **Transport-agnostic**: one handler works via RPC, REST, CLI, SDK, agents
- 🌐 **Auto REST API**: RESTful endpoints auto-generated from contracts ⭐
- 📄 **Auto OpenAPI**: OpenAPI 3.0 spec + Swagger UI auto-generated ⭐
- 🔀 **Visual Workflows**: procedures become workflow nodes automatically ⭐
- 📝 **Self-describing**: automatic introspection and documentation
- 📊 **Telemetry by design**: OpenTelemetry built into the domain model
- 🧩 **Composable**: extensibility through function composition, not framework magic
- 📐 **Convention-driven**: code structure determines automation

## Quick Start

```bash
# Install dependencies
npm install

# Run the HTTP server
npm run dev:http

# 📚 View Swagger UI docs
open http://localhost:3000/docs

# 🌐 Try REST API (auto-generated!)
curl -X POST http://localhost:3000/users \
  -d '{"name": "Alice", "email": "alice@example.com"}'

# 🔧 Or use RPC style
curl -X POST http://localhost:3000/rpc/users.create \
  -d '{"name": "Bob", "email": "bob@example.com"}'

# 💻 Or use CLI
npm run cli -- users.create --name "Charlie" --email "charlie@example.com"

# 📄 Get OpenAPI spec
curl http://localhost:3000/openapi.json
```

## Documentation

**📌 Start Here:**
- [FEATURE_SHOWCASE.md](./FEATURE_SHOWCASE.md) - **See all 15+ features in action** ⭐
- [REST_AND_OPENAPI.md](./REST_AND_OPENAPI.md) - **REST API & OpenAPI generation** ⭐
- [WORKFLOW_QUICK_START.md](./WORKFLOW_QUICK_START.md) - **Try workflows in 3 minutes** ⚡
- [WORKFLOW_SYSTEM.md](./WORKFLOW_SYSTEM.md) - **Visual workflows from contracts** ⭐
- [WORKFLOW_TELEMETRY_GUIDE.md](./WORKFLOW_TELEMETRY_GUIDE.md) - **Full OpenTelemetry integration** 📊
- [OVERVIEW.md](./OVERVIEW.md) - Visual overview and comparison

**📚 Deep Dive:**
- [PHILOSOPHY.md](./PHILOSOPHY.md) - Framework philosophy and principles
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Internal architecture and design
- [EXAMPLES.md](./EXAMPLES.md) - Usage examples and tutorials

**📋 Reference:**
- [DX_COMPARISON.md](./DX_COMPARISON.md) - **DX comparison vs oRPC/tRPC** ⚡
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) - Current status and metrics
- [FINAL_DELIVERY.md](./FINAL_DELIVERY.md) - Complete delivery report
- [PROTOTYPE_SUMMARY.md](./PROTOTYPE_SUMMARY.md) - Implementation details
- [DELIVERABLES.md](./DELIVERABLES.md) - Deliverables checklist

## How It Works

### 1. Define a Contract

Contracts are Zod schemas - the single source of truth:

```typescript
// src/contracts/users.ts
export const createUserContract: Contract = {
  name: "users.create",
  description: "Create a new user",
  input: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: z.string(),
  }),
};
```

### 2. Implement the Handler

Handlers are pure functions with composable policies:

```typescript
// src/handlers/users.ts
export const createUser: Procedure = {
  contract: createUserContract,
  handler: applyPolicies(
    async (input, context) => {
      // Pure business logic - transport-agnostic
      const user = {
        id: crypto.randomUUID(),
        name: input.name,
        email: input.email,
        createdAt: new Date().toISOString(),
      };
      return user;
    },
    withLogging("users.create"),
    withSpan("users.create"),
    withRateLimit({ maxTokens: 5 })
  ),
};
```

### 3. It's Automatically Available!

No registration needed. The handler works via:
- **RPC**: `POST /rpc/users.create`
- **REST**: `POST /users` (auto-generated!)
- **CLI**: `npm run cli -- users.create --name "..." --email "..."`
- **OpenAPI**: Auto-generated spec at `/openapi.json`
- **Swagger UI**: Interactive docs at `/docs`
- **Workflow Node**: Visual programming at `/workflow/palette` ⭐
- **Future**: GraphQL, gRPC, WebSocket, etc.

## Project Structure

```
src/
├── core/          # Framework core (registry, executor, types)
├── policies/      # Composable policies (retry, rate limit, tracing)
├── adapters/      # Transport adapters (HTTP, CLI)
├── contracts/     # Contract definitions (Zod schemas)
├── handlers/      # Handler implementations
└── apps/          # Application entry points
```

## Philosophy

Read more about the framework's philosophy and principles in [PHILOSOPHY.md](./PHILOSOPHY.md).

## License

See [LICENSE](./LICENSE).