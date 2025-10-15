# tsdev

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Zod](https://img.shields.io/badge/Zod-Schema-green.svg)](https://zod.dev/)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Enabled-orange.svg)](https://opentelemetry.io/)

> **Write your business logic once.**  
> Get HTTP API, CLI, OpenAPI docs, and visual workflows—automatically.

## What You Get

Define a contract and handler:

```typescript
// contracts/math.ts
export const addContract = {
  name: "math.add",
  input: z.object({ a: z.number(), b: z.number() }),
  output: z.object({ result: z.number() })
};

// handlers/math.ts
export const add: Procedure = {
  contract: addContract,
  handler: async (input) => ({ result: input.a + input.b })
};
```

**Automatically available as:**

```bash
# HTTP RPC
curl -X POST http://localhost:3000/rpc/math.add \
  -d '{"a": 5, "b": 3}'

# REST (convention-based)
# math.add → no REST equivalent (not CRUD)

# CLI
tsdev math.add --a 5 --b 3

# Workflow node (visual composition)
{
  id: "add-step",
  type: "procedure",
  procedureName: "math.add"
}
```

**Plus:**
- ✅ OpenAPI spec at `/openapi.json`
- ✅ Swagger UI at `/docs`
- ✅ Input/output validation (runtime)
- ✅ Full OpenTelemetry tracing
- ✅ Type safety (compile-time)

## Quick Start

```bash
pnpm install
pnpm dev              # Workflow visualization (port 3000)
pnpm dev:basic        # Basic HTTP/CLI example (port 3000)
```

## Core Value Proposition

**Problem:** Building an API requires:
- Defining routes/endpoints
- Writing handlers
- Adding validation
- Creating documentation
- Building CLI tools
- Setting up tracing
- Maintaining consistency across transports

**Solution:** Define contracts once, get everything else automatically.

### How It Works

1. **Auto-discovery via reflection**
   ```typescript
   const registry = await collectRegistry("./handlers");
   // Scans handlers/*.ts and finds all Procedure exports
   ```

2. **Convention-based routing**
   ```typescript
   // Naming convention → REST endpoints
   "users.create" → POST /users
   "users.list"   → GET /users
   "users.get"    → GET /users/:id
   "users.update" → PUT /users/:id
   "users.delete" → DELETE /users/:id
   ```

3. **Transport adapters**
   ```typescript
   createHttpServer(registry, 3000);  // HTTP + REST
   runCli(registry);                  // CLI
   executeWorkflow(workflow, registry); // Workflows
   ```

## Real-World Example

```typescript
// contracts/users.ts
export const createUserContract = {
  name: "users.create",
  input: z.object({
    name: z.string(),
    email: z.string().email()
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string()
  })
};

// handlers/users.ts
export const createUser: Procedure = {
  contract: createUserContract,
  handler: async (input, context) => {
    const user = await db.users.create(input);
    return user;
  }
};
```

**Start server:**
```typescript
// apps/http.ts
const registry = await collectRegistry("./handlers");
createHttpServer(registry, 3000);
```

**Available endpoints:**
```bash
# RPC style
POST /rpc/users.create

# REST style (auto-generated from name)
POST /users

# Documentation
GET /docs            # Swagger UI
GET /openapi.json    # OpenAPI spec
GET /procedures      # List all procedures
```

## Workflows: Visual Composition

Turn procedures into workflow nodes:

```typescript
const workflow: WorkflowDefinition = {
  id: "user-onboarding",
  name: "User Onboarding",
  version: "1.0.0",
  startNode: "create-user",
  nodes: [
    {
      id: "create-user",
      type: "procedure",
      procedureName: "users.create",  // References your procedure
      next: "send-welcome-email"
    },
    {
      id: "send-welcome-email",
      type: "procedure",
      procedureName: "emails.sendWelcome",
      next: "check-premium"
    },
    {
      id: "check-premium",
      type: "condition",
      config: {
        expression: "isPremium === true",
        trueBranch: "premium-setup",
        falseBranch: "basic-setup"
      }
    }
    // ... more nodes
  ]
};

const result = await executeWorkflow(workflow, registry);
// Full OpenTelemetry tracing automatically
```

**Features:**
- Sequential, parallel, and conditional execution
- Pause/resume workflows
- Full OpenTelemetry span hierarchy
- Visual workflow editor (Next.js example included)

## Composability

Add cross-cutting concerns via function composition:

```typescript
import { applyPolicies } from '@tsdev/core';
import { withRetry, withLogging, withSpan, withRateLimit } from '@tsdev/policies';

const handler = applyPolicies(
  baseHandler,
  withRetry({ maxAttempts: 3 }),
  withLogging("users.create"),
  withSpan("users.create"),
  withRateLimit({ maxTokens: 10 })
);
```

Policies are pure functions—no framework magic, no decorators, no classes.

## Project Structure

```
your-app/
├── src/
│   ├── contracts/       # Contract definitions
│   │   ├── users.ts
│   │   └── math.ts
│   │
│   ├── handlers/        # Handler implementations
│   │   ├── users.ts     # Export Procedure objects
│   │   └── math.ts
│   │
│   └── apps/
│       ├── http.ts      # HTTP server
│       └── cli.ts       # CLI app
│
└── package.json
```

**That's it.** No controllers, no decorators, no route files.

## Packages

```
@tsdev/core           # Contract, Procedure, Registry, Executor
@tsdev/workflow       # Workflow runtime with OpenTelemetry
@tsdev/adapters       # HTTP, REST, CLI adapters
@tsdev/policies       # withRetry, withLogging, withSpan, etc.
@tsdev/generators     # OpenAPI generation
```

## Examples

### Basic Example
Full HTTP + CLI app with math operations:
```bash
cd examples/basic
pnpm install
pnpm dev
```

### Workflows Example
Workflow execution with mock procedures:
```bash
cd examples/workflows
pnpm install
pnpm dev
```

### Workflow Visualization
Next.js + React Flow visual workflow editor:
```bash
cd examples/workflow-viz
pnpm install
pnpm dev
```

## Why tsdev?

| Traditional Approach | tsdev Approach |
|---------------------|----------------|
| Define routes manually | Auto-generated from contracts |
| Write OpenAPI by hand | Generated from Zod schemas |
| Separate CLI implementation | Same handler for HTTP + CLI |
| Add tracing to each function | OpenTelemetry built-in |
| Maintain docs separately | Self-documenting contracts |
| Build workflows from scratch | Compose procedures visually |

## Philosophy

**Contracts-first, not API-first.**

Most frameworks design APIs as transport layers (REST/gRPC/GraphQL).  
We design domain contracts—Zod schemas expressing business logic.

**From contracts, everything else is derived:**
- REST endpoints
- CLI commands
- OpenAPI specs
- SDK clients
- Workflow nodes
- Agent interfaces

See [PHILOSOPHY.md](./PHILOSOPHY.md) for deeper insights.

## Documentation

- [PHILOSOPHY.md](./PHILOSOPHY.md) - Why and how tsdev works
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical deep dive

## License

MIT

---

**Built with ❤️ using contracts-first architecture**
