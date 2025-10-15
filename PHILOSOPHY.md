# tsdev Philosophy

> **The framework that gets out of your way.**  
> Write business logic, not boilerplate.

This document explains the design principles behind tsdev and why they matter.

---

## The Core Insight

**Traditional frameworks bind you to transport layers.**

- Express: HTTP-first
- GraphQL: Query-language-first
- gRPC: Protocol-first
- CLI frameworks: Command-first

**tsdev is domain-first.**

You define what your system does (contracts), not how it's accessed (transport).

---

## 1. Contracts as the Single Source of Truth

### The Problem

In typical applications:

```typescript
// OpenAPI definition (YAML)
paths:
  /users:
    post:
      requestBody: { ... }
      
// TypeScript types
interface CreateUserInput { ... }

// Runtime validation
app.post('/users', (req, res) => {
  if (!req.body.name) throw new Error('...');
});

// CLI
program.command('create-user')
  .option('--name <name>')
  
// Documentation
/** Creates a user with the given name... */
```

**Five places to maintain the same information.**

### The Solution

```typescript
export const createUserContract = {
  name: "users.create",
  description: "Creates a new user",
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
```

**One contract. Everything else derives from it:**

- TypeScript types: `z.infer<typeof contract.input>`
- Runtime validation: `contract.input.parse(data)`
- OpenAPI schema: `zodToJsonSchema(contract.input)`
- CLI arguments: Auto-parsed from schema
- Documentation: `contract.description`
- REST routes: Naming convention (`users.create` → `POST /users`)

---

## 2. Transport Agnosticism

### The Principle

Business logic doesn't care about transport.

Whether called from:
- HTTP request
- CLI command
- Message queue
- Workflow node
- Test suite
- AI agent

**The behavior is identical.**

### How It Works

Every handler receives:

```typescript
handler(input: TInput, context: ExecutionContext)
```

Where:
- `input`: Already validated against contract
- `context`: Transport-agnostic metadata

```typescript
interface ExecutionContext {
  requestId: string;
  timestamp: Date;
  metadata: Record<string, unknown>;  // Transport-specific details
}
```

Handlers never see `req`, `res`, `process.argv`, or transport specifics.

**Adapters handle transport → core translation:**

```typescript
// HTTP Adapter
const input = JSON.parse(req.body);
const context = createExecutionContext({
  transport: "http",
  method: req.method,
  url: req.url
});
const result = await executeProcedure(procedure, input, context);
res.json(result);

// CLI Adapter
const input = parseCliArgs(process.argv);
const context = createExecutionContext({
  transport: "cli",
  args: process.argv
});
const result = await executeProcedure(procedure, input, context);
console.log(JSON.stringify(result, null, 2));
```

**Same `executeProcedure()`, different adapters.**

---

## 3. Zero Configuration Through Reflection

### The Problem

Traditional frameworks require registration:

```typescript
// Express
app.post('/users', createUserHandler);
app.get('/users', listUsersHandler);

// tRPC
const appRouter = router({
  users: {
    create: procedure.input(...).mutation(...),
    list: procedure.input(...).query(...),
  }
});
```

**Manual registration = boilerplate + mistakes.**

### The Solution

```typescript
// handlers/users.ts
export const createUser: Procedure = { contract, handler };
export const listUsers: Procedure = { contract, handler };
```

**That's it.** No registration.

The framework discovers procedures via reflection:

```typescript
const registry = await collectRegistry("./handlers");
// 1. Finds all *.ts files in handlers/
// 2. Dynamic imports each file
// 3. Extracts exports matching Procedure interface
// 4. Registers by contract.name
```

**Benefits:**
- No route files
- No manual registration
- Can't forget to register
- Self-documenting (introspection)

---

## 4. Convention-Driven Automation

### Naming Convention → REST API

Procedure names follow `resource.action` pattern:

```
users.create  → POST /users
users.list    → GET /users
users.get     → GET /users/:id
users.update  → PUT /users/:id
users.delete  → DELETE /users/:id
```

**Write the procedure once, get both RPC and REST:**

```bash
# RPC style
POST /rpc/users.create

# REST style (auto-generated)
POST /users
```

### File Structure → Registry

```
handlers/
├── users.ts        # All user procedures
├── products.ts     # All product procedures
└── orders.ts       # All order procedures
```

**Structure becomes the organization.**

No need for:
- Route files
- Controller classes
- Service registries

**The file system IS the registry.**

---

## 5. Composability Over Inheritance

### The Problem

Traditional frameworks use classes and inheritance:

```typescript
class UserController extends BaseController {
  @Post()
  @UseGuards(AuthGuard)
  @UseInterceptors(LoggingInterceptor)
  async createUser() { ... }
}
```

**Issues:**
- Tight coupling to framework
- Magic decorators
- Hard to test in isolation
- Framework lock-in

### The Solution

Pure function composition:

```typescript
import { applyPolicies } from '@tsdev/core';

const handler = applyPolicies(
  baseHandler,
  withRetry({ maxAttempts: 3 }),
  withLogging("users.create"),
  withSpan("users.create")
);
```

**Policies are just functions:**

```typescript
export function withRetry(options): Policy {
  return (handler) => async (input, context) => {
    for (let i = 0; i < options.maxAttempts; i++) {
      try {
        return await handler(input, context);
      } catch (error) {
        if (i === options.maxAttempts - 1) throw error;
        await sleep(100 * Math.pow(2, i));
      }
    }
  };
}
```

**Benefits:**
- No framework magic
- Testable in isolation
- Standard JavaScript
- Easy to understand
- Easy to extend

---

## 6. Observability as a First-Class Citizen

### The Insight

**Observability is part of the domain model, not infrastructure.**

When you execute a workflow, you care about:
- Which user triggered it?
- Which organization?
- Which workflow step failed?
- What were the inputs?

**This is business-level telemetry, not just logs.**

### Implementation

Every procedure execution happens in an OpenTelemetry span:

```typescript
export function withSpan(name: string): Policy {
  return (handler) => async (input, context) => {
    return tracer.startActiveSpan(name, async (span) => {
      // Add business attributes
      span.setAttributes({
        "procedure.name": name,
        "user.id": context.metadata.userId,
        "org.id": context.metadata.orgId,
        "input": JSON.stringify(input)
      });
      
      const result = await handler(input, context);
      
      span.setAttributes({
        "output": JSON.stringify(result)
      });
      
      return result;
    });
  };
}
```

**Workflows create span hierarchies automatically:**

```
workflow.execute
├── node.procedure (users.create)
│   └── withSpan(users.create)
│       └── withRetry(users.create)
└── node.procedure (emails.send)
    └── withSpan(emails.send)
```

**You get Jaeger/Zipkin traces without instrumentation code.**

---

## 7. Self-Describing for Humans and AI

### The Problem

Traditional APIs require:
- Human-written documentation
- SDK generation tools
- API clients
- Integration guides

**And they go out of sync.**

### The Solution

Contracts are machine-readable:

```typescript
const contract = {
  name: "users.create",
  description: "Creates a new user account",
  input: z.object({
    name: z.string().describe("User's full name"),
    email: z.string().email().describe("User's email address")
  }),
  output: z.object({
    id: z.string().describe("Generated user ID"),
    name: z.string(),
    email: z.string()
  }),
  metadata: {
    tags: ["users", "write"],
    rateLimit: { maxTokens: 10, windowMs: 60000 }
  }
};
```

**From this, generate:**

```typescript
// OpenAPI spec
GET /openapi.json

// Swagger UI
GET /docs

// Procedure list (for agents)
GET /procedures

// TypeScript SDK
// (future: auto-generated from contracts)

// Python SDK
// (future: auto-generated from contracts)
```

**AI agents can introspect procedures:**

```typescript
const procedures = await fetch('/procedures').then(r => r.json());
// LLM sees:
// - Available procedures
// - Input/output schemas
// - Descriptions
// - Can call via /rpc/:name
```

---

## 8. Workflows as First-Class Citizens

### The Insight

Most workflow engines are separate systems:
- Temporal
- Apache Airflow
- AWS Step Functions

**They require:**
- Learning a new DSL
- Deploying separate infrastructure
- Translating business logic to workflow syntax

### The Solution

**Procedures ARE workflow nodes.**

```typescript
const workflow: WorkflowDefinition = {
  nodes: [
    {
      id: "create-user",
      type: "procedure",
      procedureName: "users.create",  // Reference to your procedure
      next: "send-email"
    },
    {
      id: "send-email",
      type: "procedure",
      procedureName: "emails.send",
      next: undefined
    }
  ]
};
```

**Benefits:**
- No DSL to learn
- Same validation as direct calls
- Same tracing as direct calls
- Visual composition
- Pause/resume built-in

**Execution creates OpenTelemetry spans:**

```typescript
const result = await executeWorkflow(workflow, registry);
// Creates:
// - workflow.execute span (parent)
//   - workflow.node.procedure (create-user)
//     - procedure.users.create
//       - withRetry
//       - withLogging
//   - workflow.node.procedure (send-email)
//     - procedure.emails.send
```

**You get distributed tracing for free.**

---

## Design Principles Summary

| Principle | Traditional Approach | tsdev Approach |
|-----------|---------------------|----------------|
| **Source of Truth** | Split across types, validation, docs | Single contract |
| **Transport** | Framework-specific (Express, GraphQL) | Transport-agnostic core |
| **Registration** | Manual route/controller setup | Auto-discovery via reflection |
| **Cross-cutting** | Decorators, middleware, classes | Function composition |
| **Observability** | Added after the fact | Built into domain model |
| **Documentation** | Written separately | Generated from contracts |
| **Workflows** | Separate system (Temporal, Airflow) | Procedures as nodes |

---

## What This Enables

### For Developers

- Write business logic once
- Get HTTP, CLI, workflows automatically
- Change transport without changing logic
- Compose behavior via pure functions
- Full observability by default

### For Organizations

- Consistent API across all services
- Self-documenting systems
- Easy to build internal tools (CLI, admin panels)
- Future-proof (new transports = new adapters)
- AI-ready (machine-readable contracts)

### For AI Agents

- Introspectable procedures (`GET /procedures`)
- Clear input/output schemas
- Can call via RPC (`POST /rpc/:name`)
- No need to parse human docs

---

## Anti-Patterns We Avoid

### ❌ Framework Magic

No decorators, no reflection on classes, no runtime type generation.

**Just TypeScript + Zod.**

### ❌ Inheritance Hierarchies

No `extends BaseController`, no `implements IService`.

**Just functions and composition.**

### ❌ Global State

No singleton registries that require initialization order.

**Pass registry explicitly.**

### ❌ Transport Coupling

No `req` / `res` in business logic.

**Pure input → output functions.**

### ❌ Separate Documentation

No hand-written OpenAPI that goes stale.

**Generated from contracts.**

---

## When NOT to Use tsdev

tsdev is designed for:
- Backend APIs
- Internal tools
- Workflow automation
- Multi-transport systems

**Not ideal for:**
- Frontend-only apps (use Next.js, etc.)
- Pure data processing (no need for contracts)
- Real-time collaborative editing (use CRDTs)
- Extremely high-performance systems where reflection overhead matters

---

## Future Vision

The contract-first approach enables:

1. **Auto-generated SDKs**
   ```bash
   tsdev generate sdk --language python --output ./sdk
   ```

2. **Agent-first APIs**
   ```typescript
   // AI agent discovers and calls procedures
   const procedures = await agent.introspect();
   const result = await agent.call("users.create", { ... });
   ```

3. **Contract Evolution**
   ```typescript
   // Version 2 adds optional field
   input: z.object({
     name: z.string(),
     email: z.string(),
     phone: z.string().optional()  // Backward compatible
   })
   ```

4. **Visual Programming**
   - Drag-and-drop workflow editor
   - Connect procedures visually
   - Execute with full tracing

**All while keeping the core simple: Contract + Handler.**

---

## Conclusion

tsdev is built on one core belief:

**Define your domain once, derive everything else.**

Contracts are the source of truth.  
Everything else—routes, validation, docs, CLI, workflows—is generated.

This isn't magic. It's systematic application of:
- Type-driven development (Zod)
- Function composition (policies)
- Convention over configuration (naming)
- Reflection (auto-discovery)
- Observability by design (OpenTelemetry)

**The result: You write less, get more, and stay flexible.**

---

See [ARCHITECTURE.md](./ARCHITECTURE.md) for implementation details.
