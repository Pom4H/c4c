# c4c - Code For Coders

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Zod](https://img.shields.io/badge/Zod-Schema-green.svg)](https://zod.dev/)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Enabled-orange.svg)](https://opentelemetry.io/)

> **TypeScript-first workflow automation framework.**  
> Build type-safe procedures and workflows with zero configuration. Full introspection, git versioning, and OpenTelemetry tracing out of the box.

## Features

- ✅ **Zero Config** - No hardcoded paths, pure introspection discovers your code
- ✅ **Type-Safe** - Full TypeScript support with Zod schema validation
- ✅ **Auto-Naming** - Optional procedure names with IDE refactoring support
- ✅ **Flexible Structure** - Organize code any way you want (modules, domains, flat, monorepo)
- ✅ **OpenTelemetry** - Automatic distributed tracing for debugging
- ✅ **Git-Friendly** - Workflows are just TypeScript files
- ✅ **Hot Reload** - Development server with instant updates
- ✅ **Multiple Transports** - HTTP (REST/RPC), CLI, webhooks, workflows

---

## Quick Start

```bash
# Install
pnpm install

# Start dev server with hot reload
pnpm c4c dev

# Execute a procedure
pnpm c4c exec myProcedure --input '{"data":"value"}'
```

---

## Define Procedures

Procedures are type-safe functions with contracts:

```typescript
import { z } from "zod";
import type { Procedure } from "@c4c/core";

// Auto-naming: uses export name "createUser"
export const createUser: Procedure = {
  contract: {
    input: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
  handler: async (input) => {
    // Business logic
    return { id: generateId(), ...input };
  }
};

// Or use explicit naming for public APIs
export const create: Procedure = {
  contract: {
    name: "users.create",  // Explicit name
    input: z.object({ ... }),
    output: z.object({ ... }),
  },
  handler: async (input) => { ... }
};
```

**Auto-naming benefits:**
- IDE refactoring works (F2 rename updates everywhere)
- Less boilerplate
- Single source of truth

---

## Define Workflows

Workflows orchestrate procedures with **branching** and **parallel execution**.

**Fluent Builder API (recommended):**

```typescript
import { workflow, step, parallel, condition } from "@c4c/workflow";
import { z } from "zod";

// Define reusable steps
const createUserStep = step({
  id: "create-user",
  input: z.object({ name: z.string(), email: z.string(), plan: z.string() }),
  output: z.object({ id: z.string(), plan: z.string() }),
  execute: ({ engine, inputData }) => engine.run("users.create", inputData),
});

// Parallel execution for premium users
const premiumSetup = parallel({
  id: "premium-setup",
  branches: [
    step({
      id: "setup-analytics",
      input: z.object({ userId: z.string() }),
      output: z.object({ trackingId: z.string() }),
      execute: ({ engine }) => engine.run("analytics.setup"),
    }),
    step({
      id: "assign-manager",
      input: z.object({ userId: z.string() }),
      output: z.object({ managerId: z.string() }),
      execute: ({ engine }) => engine.run("users.assignManager"),
    }),
    step({
      id: "enable-features",
      input: z.object({ userId: z.string() }),
      output: z.object({ features: z.array(z.string()) }),
      execute: ({ engine }) => engine.run("features.enablePremium"),
    }),
  ],
  waitForAll: true,
  output: z.object({ setupComplete: z.boolean() }),
});

// Branching based on user plan
const planCheck = condition({
  id: "check-plan",
  input: z.object({ plan: z.string() }),
  predicate: (ctx) => ctx.get("create-user")?.plan === "premium",
  whenTrue: premiumSetup,
  whenFalse: step({
    id: "free-setup",
    input: z.object({ userId: z.string() }),
    output: z.object({ trialDays: z.number() }),
    execute: ({ engine }) => engine.run("users.setupFreeTrial"),
  }),
});

// Build the complete workflow
export default workflow("user-onboarding")
  .name("User Onboarding Flow")
  .version("1.0.0")
  .step(createUserStep)
  .step(planCheck)
  .step(step({
    id: "send-welcome",
    input: z.object({ userId: z.string() }),
    output: z.object({ sent: z.boolean() }),
    execute: ({ engine }) => engine.run("emails.sendWelcome"),
  }))
  .commit();

// ✅ Both export styles work:
// export default workflow(...)     - default export (recommended)
// export const myWorkflow = ...    - named export
```

**Declarative API (also supported):**

```typescript
import type { WorkflowDefinition } from "@c4c/workflow";

export const userOnboarding: WorkflowDefinition = {
  id: "user-onboarding",
  name: "User Onboarding Flow",
  version: "1.0.0",
  startNode: "create-user",
  nodes: [
    {
      id: "create-user",
      type: "procedure",
      procedureName: "users.create",
      next: "check-plan",
    },
    {
      id: "check-plan",
      type: "condition",
      config: {
        expression: "get('create-user').plan === 'premium'",
        trueBranch: "premium-setup",
        falseBranch: "free-setup",
      },
    },
    {
      id: "premium-setup",
      type: "parallel",
      config: {
        branches: ["setup-analytics", "assign-manager", "enable-features"],
        waitForAll: true,
      },
      next: "send-welcome",
    },
    // ... other nodes
  ]
};
```

---

## Project Organization

**Zero configuration - organize any way you want:**

```
✅ Flat structure
src/
├── procedures.ts
└── workflows.ts

✅ Modular (recommended)
src/modules/
├── users/
│   ├── procedures.ts
│   └── workflows.ts
└── products/
    └── handlers.ts

✅ Domain-driven
domains/
├── billing/commands/
└── auth/flows/

✅ Monorepo
packages/
├── core/procedures/
└── integrations/stripe/
```

**The framework discovers procedures and workflows through introspection - no config needed!**

---

## CLI Commands

```bash
# Start dev server (scans current directory by default)
c4c dev

# Start production server (scans current directory by default)
c4c serve

# Or specify a different directory
c4c serve --root /path/to/project

# Execute procedure or workflow (input is optional, defaults to {})
c4c exec createUser
c4c exec userOnboarding

# With input
c4c exec createUser --input '{"name":"Alice","email":"alice@example.com"}'

# Execute with JSON output (for scripts)
c4c exec mathAdd --input '{"a":5,"b":3}' --json

# Generate typed client
c4c generate client --out ./client.ts

# Start workflow UI
c4c serve ui
```

---

## HTTP API

Start the server:
```bash
c4c serve
# or
c4c dev  # with hot reload
```

### Introspection
```bash
# List all procedures
GET /procedures

# OpenAPI spec
GET /openapi.json
```

### Execute Procedures
```bash
# RPC endpoint
POST /rpc/users.create
{
  "name": "Alice",
  "email": "alice@example.com"
}

# REST endpoint (auto-mapped)
POST /users
{
  "name": "Alice",
  "email": "alice@example.com"
}
```

### Execute Workflows
```bash
POST /workflow/execute
{
  "workflow": { ... },
  "input": { ... }
}
```

---

## Type-Safe Client

Generate a fully typed client:

```bash
c4c generate client --out ./client.ts
```

Use it:
```typescript
import { createClient } from "./client";

const client = createClient({ 
  baseUrl: "http://localhost:3000" 
});

// Fully typed with autocomplete!
const user = await client.createUser({
  name: "Alice",
  email: "alice@example.com"
});

// All procedures are available as direct methods
await client.getUser({ id: "123" });
await client.updateUser({ id: "123", name: "Bob" });
```

---

## OpenTelemetry Tracing

Every execution automatically creates distributed traces:

```typescript
// Execute any procedure or workflow
const result = await execute(registry, "users.create", input);

// Traces are automatically collected with:
// - Span hierarchy
// - Timing information
// - Input/output data
// - Error details
```

View traces in your favorite OpenTelemetry backend (Jaeger, Honeycomb, etc.)

---

## Policies

Add cross-cutting concerns with composable policies:

```typescript
import { applyPolicies } from "@c4c/core";
import { withRetry, withLogging, withSpan } from "@c4c/policies";

export const resilientCreate: Procedure = {
  contract: { ... },
  handler: applyPolicies(
    baseHandler,
    withRetry({ maxAttempts: 3 }),
    withLogging("users.create"),
    withSpan("users.create"),
  )
};
```

Available policies:
- `withRetry` - Automatic retries with exponential backoff
- `withLogging` - Structured logging
- `withSpan` - OpenTelemetry tracing
- `withAuth` - Authentication/authorization
- `withRateLimit` - Rate limiting

---

## Packages

```
@c4c/core             # Core contracts, registry, execution
@c4c/workflow         # Workflow runtime + OpenTelemetry
@c4c/adapters         # HTTP, CLI, REST adapters
@c4c/policies         # Composable policies (retry, auth, logging)
@c4c/generators       # OpenAPI + TypeScript client generation
@c4c/workflow-react   # React hooks for workflows
```

---

## Examples

```bash
# Basic example - simple procedures and workflows
cd examples/basic
pnpm dev

# Modules example - modular structure (users/, products/, analytics/)
cd examples/modules
pnpm dev
pnpm generate:client  # Generate typed client
pnpm test:client      # Test client API

# Integrations example - Google Drive, Avito
cd examples/integrations
pnpm dev
```

---

## Integrations

Integrate external APIs and other c4c applications using OpenAPI specifications:

```bash
# Integrate external API
c4c integrate https://api.apis.guru/v2/specs/googleapis.com/calendar/v3/openapi.json --name google-calendar

# Integrate another c4c app
c4c integrate http://localhost:3001/openapi.json --name task-manager
```

This command automatically:
- Generates TypeScript SDK and schemas from OpenAPI spec
- Creates typed procedures for all API endpoints
- Sets up authentication and base URL configuration
- Generates procedures in `procedures/integrations/{name}/procedures.gen.ts`

**Webhooks are automatically enabled** when you start the server:
```bash
c4c serve
# Server starts with webhook endpoints at /webhooks/{provider}
```

Use the generated procedures in your workflows:

```typescript
// External API integration
steps: [
  {
    id: 'create-event',
    procedure: 'google-calendar.calendar.events.insert',
    input: { 
      calendarId: 'primary',
      summary: 'Meeting',
      start: { dateTime: '2024-01-01T10:00:00Z' }
    }
  }
]

// c4c app integration
steps: [
  {
    id: 'create-task',
    procedure: 'task-manager.tasks.create',
    input: { title: 'New task', description: 'Task description' }
  }
]
```

---

## Key Concepts

### 1. Universal Introspection

No hardcoded paths! The framework scans your entire project and discovers:
- **Procedures** - Objects with `contract` and `handler` properties
- **Workflows** - Objects with `id`, `name`, `version`, `nodes`, `startNode`

This means you can organize your code however you want.

### 2. Auto-Naming

Procedure names are optional. If not specified, the export name is used:

```typescript
// Auto-naming
export const createUser: Procedure = {
  contract: { 
    // name = "createUser" automatically
    input: ..., 
    output: ... 
  },
  handler: ...
};

// Explicit naming (for public APIs)
export const create: Procedure = {
  contract: { 
    name: "users.create",  // Custom name
    input: ..., 
    output: ... 
  },
  handler: ...
};
```

**Benefit:** IDE refactoring (F2 rename) works completely with auto-naming!

### 3. Unified Execution

One command executes both procedures and workflows:

```bash
c4c exec createUser               # Executes procedure
c4c exec userOnboarding           # Executes workflow

# Input is optional (defaults to {})
c4c exec createUser --input '{"name":"Alice"}'

# Priority: procedures > workflows (if names conflict)
```

---

## Why c4c?

### vs Visual Tools (n8n, Zapier, Make)

| Feature | Visual Tools | c4c |
|---------|-------------|-----|
| Development Speed | Click through UI | Type in IDE |
| Version Control | Limited | Full git |
| Type Safety | None | Full TypeScript |
| Testing | Manual | Automated |
| Refactoring | Manual | IDE support |
| Code Reuse | Limited | Full |

### vs Code Frameworks (Temporal, Step Functions)

| Feature | Others | c4c |
|---------|--------|-----|
| Learning Curve | Complex DSLs | Just TypeScript |
| Setup | Configuration heavy | Zero config |
| Organization | Prescribed structure | Any structure |
| Introspection | Limited | Full automatic |
| Developer Tools | CLI, SDKs | Everything built-in |

---

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start example
cd examples/basic
pnpm dev
```

---

## Documentation

- **README** (this file) - Quick start and overview
- **examples/** - Working examples for different use cases
- **packages/*/README.md** - Package-specific documentation

---

## Philosophy

**Framework shouldn't dictate architecture.**

c4c embraces introspection over configuration. Organize your code the way that makes sense for your project - the framework will find your procedures and workflows automatically.

**Developer experience first:**
- Type-safe everything
- IDE refactoring support
- Git-friendly workflows
- Hot reload development
- No vendor lock-in

---

## License

MIT

---

**Build workflows like code, not clicks.**
