# tsdev Architecture

This document explains the internal architecture of the tsdev framework.

## Monorepo Structure

```
tsdev/
├── packages/
│   ├── core/                    # @tsdev/core
│   │   ├── src/
│   │   │   ├── types.ts         # Contract, Procedure, Registry, Policy
│   │   │   ├── registry.ts      # collectRegistry(), getProcedure()
│   │   │   ├── executor.ts      # executeProcedure(), applyPolicies()
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── workflow/                # @tsdev/workflow
│   │   ├── src/
│   │   │   ├── types.ts         # WorkflowDefinition, WorkflowNode
│   │   │   ├── runtime.ts       # executeWorkflow() with OpenTelemetry
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── workflow-react/          # @tsdev/workflow-react
│   │   ├── src/
│   │   │   ├── useWorkflow.ts   # React hooks
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── adapters/                # @tsdev/adapters
│   │   ├── src/
│   │   │   ├── http.ts          # HTTP/RPC server
│   │   │   ├── rest.ts          # RESTful routing
│   │   │   ├── cli.ts           # CLI interface
│   │   │   ├── workflow-http.ts # Workflow HTTP endpoints
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── policies/                # @tsdev/policies
│   │   ├── src/
│   │   │   ├── withSpan.ts      # OpenTelemetry tracing
│   │   │   ├── withRetry.ts     # Retry logic
│   │   │   ├── withLogging.ts   # Logging
│   │   │   ├── withRateLimit.ts # Rate limiting
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── generators/              # @tsdev/generators
│       ├── src/
│       │   ├── openapi.ts       # OpenAPI spec generation
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
└── examples/
    ├── basic/                   # Basic usage example
    │   ├── src/
    │   │   ├── contracts/       # Contract definitions
    │   │   ├── handlers/        # Handler implementations
    │   │   └── apps/            # HTTP server & CLI
    │   ├── package.json
    │   └── tsconfig.json
    │
    ├── workflows/               # Workflow examples
    │   ├── src/
    │   │   ├── mock-procedures.ts
    │   │   ├── examples.ts
    │   │   └── server.ts
    │   ├── package.json
    │   └── tsconfig.json
    │
    └── workflow-viz/            # Next.js visualization
        └── src/                 # React Flow demo
```

## Core Concepts

### Contracts (Single Source of Truth)

Contracts are Zod schemas that define:
- **Input schema**: What data the procedure accepts
- **Output schema**: What data the procedure returns
- **Metadata**: Tags, rate limits, descriptions, etc.

```typescript
import { z } from 'zod';
import type { Contract } from '@tsdev/core';

const createUserContract: Contract = {
  name: "users.create",
  description: "Create a new user",
  input: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: z.string(),
  }),
  metadata: {
    tags: ["users", "write"],
  },
};
```

### Procedures (Contract + Handler)

A procedure combines a contract with a handler function:

```typescript
import type { Procedure } from '@tsdev/core';

const createUser: Procedure = {
  contract: createUserContract,
  handler: async (input, context) => {
    // Business logic here
    return { id: "...", name: input.name, ... };
  },
};
```

### Registry (Self-Describing)

The registry automatically discovers all procedures:

```typescript
import { collectRegistry } from '@tsdev/core';

const registry = await collectRegistry("./src/handlers");
```

This scans all TypeScript files in the `src/handlers/` directory and registers any exports that match the `Procedure` interface.

**No manual registration required!**

### Execution Context

Every procedure receives a context:

```typescript
interface ExecutionContext {
  requestId: string;      // Unique request ID
  timestamp: Date;        // Request timestamp
  metadata: Record<...>;  // Transport-specific metadata
}
```

The adapter populates metadata with transport-specific information (HTTP headers, CLI args, etc.).

### Policies (Composable)

Policies are functions that wrap handlers to add cross-cutting concerns:

```typescript
import { applyPolicies } from '@tsdev/core';
import { withLogging, withSpan, withRetry, withRateLimit } from '@tsdev/policies';

const handler = applyPolicies(
  baseHandler,
  withLogging("procedure.name"),
  withSpan("procedure.name"),
  withRetry({ maxAttempts: 3 }),
  withRateLimit({ maxTokens: 10 })
);
```

Policies are applied right-to-left (inner to outer):
1. Rate limit check
2. Retry wrapper
3. Tracing span
4. Logging

### Workflows (Composable Procedures)

Workflows compose procedures into visual graphs with OpenTelemetry tracing:

```typescript
import { executeWorkflow, type WorkflowDefinition } from '@tsdev/workflow';

const workflow: WorkflowDefinition = {
  id: "user-onboarding",
  name: "User Onboarding Flow",
  version: "1.0.0",
  startNode: "create-user",
  nodes: [
    {
      id: "create-user",
      type: "procedure",
      procedureName: "users.create",
      config: { /* input */ },
      next: "send-email"
    },
    {
      id: "send-email",
      type: "procedure",
      procedureName: "emails.sendWelcome",
      next: undefined
    }
  ]
};

const result = await executeWorkflow(workflow, registry);
```

### Adapters (Transport Layer)

Adapters bridge transports to the core:

1. **Parse transport-specific input** (HTTP body, CLI args)
2. **Create ExecutionContext** with transport metadata
3. **Call executeProcedure()** with the procedure, input, and context
4. **Format output** for the transport (JSON response, CLI output)

Adapters are **thin layers** - all business logic lives in handlers.

## Package Dependencies

```
@tsdev/core (no dependencies on other @tsdev packages)
    ↑
    ├── @tsdev/workflow (depends on @tsdev/core)
    │   └── @tsdev/workflow-react (depends on @tsdev/workflow, react)
    ├── @tsdev/adapters (depends on @tsdev/core, @tsdev/workflow, @tsdev/generators)
    ├── @tsdev/policies (depends on @tsdev/core)
    └── @tsdev/generators (depends on @tsdev/core, @tsdev/workflow)
```

## Data Flow

### HTTP Request Flow

```
HTTP Request
  ↓
HTTP Adapter (@tsdev/adapters)
  ↓
Parse JSON body
  ↓
Create ExecutionContext { transport: "http", ... }
  ↓
executeProcedure(@tsdev/core)
  ↓
Validate input (Zod)
  ↓
Apply policies (rate limit, retry, span, logging)
  ↓
Execute handler (business logic)
  ↓
Validate output (Zod)
  ↓
Return result
  ↓
HTTP Adapter formats as JSON
  ↓
HTTP Response
```

### Workflow Execution Flow

```
executeWorkflow(@tsdev/workflow)
  ↓
Create workflow-level OpenTelemetry span
  ↓
For each node in workflow:
  ├─→ procedure node → executeProcedure(@tsdev/core)
  ├─→ condition node → evaluate expression → branch
  ├─→ parallel node → execute branches concurrently
  └─→ sequential node → pass through
  ↓
Collect all spans
  ↓
Return WorkflowExecutionResult with spans
```

## Key Principles in Action

### 1. Contracts-first

Every procedure starts with a contract. The contract defines the API surface, not the transport.

### 2. Transport-agnostic

The handler doesn't know if it was called via HTTP, CLI, or future transports (WebSocket, gRPC, message queue, etc.).

### 3. Zero boilerplate

No decorators, no manual registration. Export a `Procedure` object and it's automatically discovered.

### 4. Self-describing

The registry contains all metadata needed for:
- Documentation generation
- OpenAPI spec generation
- SDK generation
- Agent introspection

### 5. Composable

Policies compose via pure functions. No framework magic, no class inheritance.

### 6. Observable

Every procedure runs in a tracing span. Business-level attributes (user_id, org_id, etc.) are added to spans for rich observability.

## Extending the Framework

### Adding a New Transport

1. Create an adapter in a new package or in `@tsdev/adapters`:

```typescript
import { createExecutionContext, executeProcedure, type Registry } from '@tsdev/core';

export async function createWebSocketServer(registry: Registry) {
  // Parse WebSocket messages
  // Create ExecutionContext
  // Call executeProcedure()
  // Send result back via WebSocket
}
```

2. Use it in your application

**That's it!** All existing handlers now work via WebSocket.

### Adding a New Policy

1. Create a policy in `@tsdev/policies` or your own package:

```typescript
import type { Policy } from '@tsdev/core';

export function withCache(ttl: number): Policy {
  const cache = new Map();
  
  return (handler) => {
    return async (input, context) => {
      const key = JSON.stringify(input);
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = await handler(input, context);
      cache.set(key, result);
      
      setTimeout(() => cache.delete(key), ttl);
      
      return result;
    };
  };
}
```

2. Use it in any handler:

```typescript
import { applyPolicies } from '@tsdev/core';
import { withCache } from './policies/withCache.js';

const handler = applyPolicies(
  baseHandler,
  withCache(60000), // 1 minute cache
);
```

### Adding a New Procedure

1. Define contract in your `contracts/` directory
2. Implement handler in `handlers/` directory
3. Export the procedure

**It's automatically discovered and available via all transports!**

## Testing Strategy

### Unit Tests

Test handlers in isolation:

```typescript
const result = await createUser.handler(
  { name: "Test", email: "test@example.com" },
  createExecutionContext()
);

expect(result).toMatchObject({
  id: expect.any(String),
  name: "Test",
  email: "test@example.com",
});
```

### Integration Tests

Test via adapters:

```typescript
import { collectRegistry } from '@tsdev/core';
import { createHttpServer } from '@tsdev/adapters';

const registry = await collectRegistry("./handlers");
const server = createHttpServer(registry, 3001);

const response = await fetch("http://localhost:3001/rpc/users.create", {
  method: "POST",
  body: JSON.stringify({ name: "Test", email: "test@example.com" }),
});

expect(response.ok).toBe(true);
```

## Performance Considerations

### Registry Collection

Registry collection happens once at startup (not per-request). It uses dynamic imports to load handlers.

### Policy Overhead

Policies add minimal overhead (function calls). They're applied at startup, not per-request.

### Validation

Zod validation happens twice per request (input and output). For high-performance scenarios, you can disable output validation in production.

### Tracing

OpenTelemetry spans have minimal overhead (~microseconds) and are sampled in production.

## Future Enhancements

Potential additions that maintain the philosophy:

1. **SDK Generator**: Generate TypeScript/Python SDKs from contracts
2. **GraphQL Adapter**: Expose procedures via GraphQL
3. **gRPC Adapter**: Expose procedures via gRPC
4. **Message Queue Adapter**: Consume procedures from queues
5. **Agent Interface**: Let LLMs call procedures directly
6. **Schema Registry**: Central registry for contract versioning
7. **Contract Evolution**: Backward-compatible contract changes

All of these maintain the core principle: **write the contract once, derive everything else**.

## License

MIT
