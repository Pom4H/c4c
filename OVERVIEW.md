# tsdev Framework Overview

## Visual Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TRANSPORTS                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   HTTP   │  │   CLI    │  │ GraphQL  │  │   gRPC   │       │
│  │  Adapter │  │  Adapter │  │  Adapter │  │  Adapter │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │             │              │              │  (future)   │
└───────┼─────────────┼──────────────┼──────────────┼─────────────┘
        │             │              │              │
        └─────────────┴──────────────┴──────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │    executeProcedure(proc, input)   │
        │         (core/executor.ts)         │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │      COMPOSABLE POLICIES            │
        │  ┌────────────────────────────┐    │
        │  │ withLogging                │    │
        │  │  withSpan                  │    │
        │  │   withRetry                │    │
        │  │    withRateLimit           │    │
        │  │     HANDLER (business)     │    │
        │  └────────────────────────────┘    │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │       CONTRACT VALIDATION           │
        │   Input (Zod) → Output (Zod)       │
        └─────────────────────────────────────┘
```

## Data Flow

### Example: Create User via HTTP

```
1. HTTP Request
   POST /rpc/users.create
   Body: {"name": "John", "email": "john@example.com"}
         ↓

2. HTTP Adapter (adapters/http.ts)
   - Parses JSON body
   - Creates ExecutionContext
   - Calls executeProcedure()
         ↓

3. Executor (core/executor.ts)
   - Validates input with Zod schema
   - Applies policies (rate limit → retry → span → logging)
   - Calls handler
         ↓

4. Handler (handlers/users.ts)
   - Pure business logic
   - Creates user object
   - Returns result
         ↓

5. Executor
   - Validates output with Zod schema
   - Returns to adapter
         ↓

6. HTTP Adapter
   - Formats as JSON
   - Sends HTTP response
         ↓

7. HTTP Response
   {"id": "uuid", "name": "John", "email": "john@example.com", ...}
```

### Same Flow via CLI

```
1. CLI Command
   npm run cli -- users.create --name "John" --email "john@example.com"
         ↓

2. CLI Adapter (adapters/cli.ts)
   - Parses CLI arguments
   - Creates ExecutionContext
   - Calls executeProcedure()
         ↓

3-5. [SAME AS HTTP - handlers don't know the difference!]
         ↓

6. CLI Adapter
   - Pretty-prints JSON
   - Outputs to console
         ↓

7. Console Output
   ✅ Success!
   📤 Output: {
     "id": "uuid",
     "name": "John",
     "email": "john@example.com",
     ...
   }
```

## Code Organization

### Contracts (Single Source of Truth)

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
  metadata: {
    tags: ["users", "write"],
    rateLimit: { maxTokens: 5 },
  },
};
```

**From this contract, we derive:**
- ✅ Input validation (Zod)
- ✅ Output validation (Zod)
- ✅ TypeScript types (inferred)
- ✅ API endpoints (auto-generated)
- ✅ CLI commands (auto-generated)
- ✅ Documentation (introspection)
- ✅ Rate limiting config (metadata)

### Handlers (Transport-Agnostic)

```typescript
// src/handlers/users.ts
export const createUser: Procedure = {
  contract: createUserContract,
  handler: applyPolicies(
    async (input, context) => {
      // This code doesn't know if it was called via:
      // - HTTP
      // - CLI
      // - GraphQL
      // - gRPC
      // - Message queue
      // - LLM agent
      
      const user = {
        id: crypto.randomUUID(),
        name: input.name,
        email: input.email,
        createdAt: new Date().toISOString(),
      };
      
      // Save to database, send email, etc.
      
      return user;
    },
    withLogging("users.create"),
    withSpan("users.create"),
    withRateLimit({ maxTokens: 5 })
  ),
};
```

### Registry (Auto-Discovery)

```typescript
// src/core/registry.ts
const registry = await collectRegistry("src/handlers");

// Automatically finds and registers:
// - users.create
// - users.get
// - users.list
// - math.add
// - math.multiply
// - ... any future handlers you add!
```

**No manual registration. Just export a Procedure and it's available.**

### Policies (Composable Cross-Cutting Concerns)

```typescript
// Rate limiting
export function withRateLimit(options): Policy {
  return (handler) => async (input, context) => {
    if (!hasTokens()) throw new Error("Rate limit exceeded");
    consumeToken();
    return handler(input, context);
  };
}

// Retry with backoff
export function withRetry(options): Policy {
  return (handler) => async (input, context) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await handler(input, context);
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        await sleep(delay * attempt);
      }
    }
  };
}

// OpenTelemetry tracing
export function withSpan(name): Policy {
  return (handler) => async (input, context) => {
    return tracer.startActiveSpan(name, async (span) => {
      try {
        const result = await handler(input, context);
        span.setStatus({ code: OK });
        return result;
      } catch (error) {
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  };
}
```

**Policies compose via pure functions:**

```typescript
const handler = applyPolicies(
  baseHandler,
  policyA,  // Applied last (outermost)
  policyB,
  policyC   // Applied first (innermost)
);

// Execution order:
// policyA → policyB → policyC → baseHandler → policyC → policyB → policyA
```

## Framework Features

### ✅ Implemented in Prototype

1. **Core Framework**
   - Type-safe contracts with Zod
   - Auto-discovery registry
   - Execution engine with validation
   - Execution context

2. **Composable Policies**
   - `withSpan` - OpenTelemetry tracing
   - `withRetry` - Retry with exponential backoff
   - `withRateLimit` - Token bucket rate limiting
   - `withLogging` - Execution logging

3. **Transport Adapters**
   - HTTP adapter (RPC-style endpoints)
   - CLI adapter (command-line interface)

4. **Example Procedures**
   - User management (create, get, list)
   - Math operations (add, multiply)

5. **Documentation**
   - Philosophy document
   - Architecture guide
   - Usage examples
   - Prototype summary

### 🚧 Future Enhancements

1. **Additional Adapters**
   - GraphQL adapter
   - gRPC adapter
   - WebSocket adapter
   - Message queue adapter
   - Agent/LLM interface

2. **Additional Policies**
   - Authentication/authorization
   - Caching (Redis, in-memory)
   - Input sanitization
   - Circuit breakers
   - Timeouts

3. **Generators**
   - OpenAPI spec generator
   - SDK generator (TypeScript, Python, Go)
   - Documentation generator
   - Agent tool definitions

4. **Tooling**
   - CLI scaffolding (`tsdev init`, `tsdev generate`)
   - Contract validation in CI
   - Hot reload for development
   - Visual procedure explorer

5. **Production Features**
   - Database integration
   - Authentication providers
   - Error handling middleware
   - Health checks
   - Metrics collection

## Comparison Matrix

| Feature | Express | tRPC | gRPC | **tsdev** |
|---------|---------|------|------|-----------|
| Transport-agnostic | ❌ | ❌ | ❌ | ✅ |
| Auto-discovery | ❌ | ✅ | ❌ | ✅ |
| Type-safe | ⚠️ | ✅ | ✅ | ✅ |
| Schema validation | ⚠️ | ✅ | ✅ | ✅ |
| CLI support | ❌ | ❌ | ❌ | ✅ |
| HTTP support | ✅ | ✅ | ⚠️ | ✅ |
| Observability | ⚠️ | ⚠️ | ⚠️ | ✅ |
| Composable policies | ⚠️ | ⚠️ | ❌ | ✅ |
| Agent-friendly | ❌ | ❌ | ❌ | ✅ |
| Language-agnostic | ✅ | ❌ | ✅ | ✅* |

*Contracts are TypeScript/Zod but can be converted to JSON Schema

## Philosophy in Action

### Traditional Approach

```typescript
// Define HTTP route
app.post('/users', async (req, res) => {
  // Validate input
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error });
  
  // Business logic
  const user = await createUser(value);
  
  // Return response
  res.json(user);
});

// Separately define CLI command
program
  .command('create-user')
  .option('--name <name>')
  .option('--email <email>')
  .action(async (options) => {
    // Duplicate validation
    // Duplicate business logic
  });

// Separately write OpenAPI spec
// Separately write documentation
// Separately create SDK
```

**Problems:**
- ❌ Duplication across transports
- ❌ Manual synchronization
- ❌ Business logic mixed with transport
- ❌ No single source of truth

### tsdev Approach

```typescript
// 1. Define contract (ONCE)
export const createUserContract: Contract = {
  name: "users.create",
  input: z.object({ name: z.string(), email: z.string().email() }),
  output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
};

// 2. Implement handler (ONCE)
export const createUser: Procedure = {
  contract: createUserContract,
  handler: async (input, context) => {
    // Pure business logic
    return { id: uuid(), ...input };
  },
};

// 3. That's it! Automatically available via:
// - HTTP: POST /rpc/users.create
// - CLI: npm run cli -- users.create --name "..." --email "..."
// - Future: GraphQL, gRPC, agents, etc.
```

**Benefits:**
- ✅ Write once, use everywhere
- ✅ Single source of truth (contract)
- ✅ Auto-validated, auto-typed
- ✅ Self-documenting
- ✅ Transport-agnostic

## Summary

**tsdev is a meta-framework** that unifies application code through contracts, not transports.

Instead of thinking:
> "I need to build a REST API, then maybe add GraphQL, then create a CLI..."

Think:
> "I need to implement these procedures. They'll automatically work via any transport."

**Write once — describe forever.**
