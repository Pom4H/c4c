# tsdev Architecture

This document explains the internal architecture of the tsdev framework.

## Monorepo Structure

```
tsdev/
├── packages/
│   ├── tsdev/              # Core framework package
│   │   ├── core/           # Core framework functionality
│   │   │   ├── types.ts    # Type definitions
│   │   │   ├── registry.ts # Procedure registry and discovery
│   │   │   ├── executor.ts # Procedure execution engine
│   │   │   └── workflow/   # Workflow runtime with OTEL
│   │   ├── policies/       # Composable policies
│   │   │   ├── withSpan.ts # OpenTelemetry tracing
│   │   │   ├── withRetry.ts # Retry with backoff
│   │   │   ├── withRateLimit.ts # Rate limiting
│   │   │   └── withLogging.ts # Logging
│   │   ├── adapters/       # Transport adapters
│   │   │   ├── http.ts     # HTTP/REST adapter
│   │   │   └── cli.ts      # CLI adapter
│   │   └── generators/     # Code generators
│   │       └── openapi.ts  # OpenAPI spec generator
│   │
│   └── tsdev-react/        # React integration package
│       └── src/
│           ├── index.ts
│           └── useWorkflow.ts # React hooks for workflows
│
└── examples/
    ├── tsdev-example/      # Basic framework usage
    │   ├── contracts/      # Contract definitions (Zod schemas)
    │   ├── handlers/       # Handler implementations
    │   ├── apps/           # Application entry points
    │   └── workflow/       # Workflow examples
    │
    └── nextjs-workflow-viz/  # Next.js visualization demo
        └── src/            # React Flow workflow visualization
```

## Core Concepts

### Contracts (Single Source of Truth)

Contracts are Zod schemas that define:
- **Input schema**: What data the procedure accepts
- **Output schema**: What data the procedure returns
- **Metadata**: Tags, rate limits, descriptions, etc.

```typescript
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
// In your application (e.g., examples/tsdev-example/apps/http-server.ts)
import { collectRegistry } from 'tsdev/core';

const registry = await collectRegistry("./handlers");
```

This scans all TypeScript files in the `handlers/` directory and registers any exports that match the `Procedure` interface.

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

Each policy:
- Receives a handler
- Returns a new handler
- Can run code before/after the handler
- Can modify input/output/context
- Can catch and handle errors

### Adapters (Transport Layer)

Adapters bridge transports to the core:

1. **Parse transport-specific input** (HTTP body, CLI args)
2. **Create ExecutionContext** with transport metadata
3. **Call executeProcedure()** with the procedure, input, and context
4. **Format output** for the transport (JSON response, CLI output)

Adapters are **thin layers** - all business logic lives in handlers.

## Data Flow

### HTTP Request Flow

```
HTTP Request
  ↓
HTTP Adapter
  ↓
Parse JSON body
  ↓
Create ExecutionContext { transport: "http", ... }
  ↓
executeProcedure(procedure, input, context)
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

### CLI Request Flow

```
CLI Arguments
  ↓
CLI Adapter
  ↓
Parse --key value arguments
  ↓
Create ExecutionContext { transport: "cli", ... }
  ↓
executeProcedure(procedure, input, context)
  ↓
[Same as HTTP flow]
  ↓
CLI Adapter formats as pretty-printed JSON
  ↓
Console Output
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

1. Create an adapter in `src/adapters/`:

```typescript
export async function createWebSocketServer(registry: Registry) {
  // Parse WebSocket messages
  // Create ExecutionContext
  // Call executeProcedure()
  // Send result back via WebSocket
}
```

2. Create an app in `src/apps/`:

```typescript
const registry = await collectRegistry("src/handlers");
createWebSocketServer(registry);
```

**That's it!** All existing handlers now work via WebSocket.

### Adding a New Policy

1. Create a policy in `src/policies/`:

```typescript
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
handler: applyPolicies(
  baseHandler,
  withCache(60000), // 1 minute cache
  withLogging("procedure.name")
)
```

### Adding a New Procedure

1. Define contract in your application's `contracts/` directory
2. Implement handler in `handlers/` directory
3. Export the procedure

**It's automatically discovered and available via all transports!**

Example structure (see `examples/tsdev-example/`):
```
my-app/
├── contracts/
│   └── myfeature.ts
├── handlers/
│   └── myfeature.ts
└── apps/
    └── server.ts
```

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
const registry = await collectRegistry("src/handlers");
const server = createHttpServer(registry, 3001);

const response = await fetch("http://localhost:3001/rpc/users.create", {
  method: "POST",
  body: JSON.stringify({ name: "Test", email: "test@example.com" }),
});

expect(response.ok).toBe(true);
```

### Contract Tests

Contracts ensure type safety:

```typescript
// TypeScript will error if input doesn't match contract
const result = await executeProcedure(
  createUser,
  { name: "Test", email: "invalid" }, // Zod will validate and throw
  context
);
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

1. **OpenAPI Generator**: Generate OpenAPI specs from contracts
2. **SDK Generator**: Generate TypeScript/Python SDKs from contracts
3. **GraphQL Adapter**: Expose procedures via GraphQL
4. **gRPC Adapter**: Expose procedures via gRPC
5. **Message Queue Adapter**: Consume procedures from queues
6. **Agent Interface**: Let LLMs call procedures directly
7. **Schema Registry**: Central registry for contract versioning
8. **Contract Evolution**: Backward-compatible contract changes

All of these maintain the core principle: **write the contract once, derive everything else**.
