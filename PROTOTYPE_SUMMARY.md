# tsdev Prototype Summary

This document summarizes the tsdev framework prototype implementation.

## What Was Built

A fully functional **contracts-first, transport-agnostic framework** that demonstrates all seven philosophical principles:

### ✅ 1. Contracts-first ≠ API-first

- Zod schemas define the single source of truth
- Located in `src/contracts/`
- Define input, output, metadata, and descriptions
- Examples: `users.ts`, `math.ts`

### ✅ 2. Transport-agnostic core

- Handlers don't know about HTTP, CLI, or any transport
- Same handler works via multiple transports
- Pure business logic separated from I/O
- Demonstrated by `src/handlers/users.ts` and `src/handlers/math.ts`

### ✅ 3. Zero boilerplate, maximum reflection

- `collectRegistry()` automatically discovers handlers via file system scanning
- No manual registration required
- Export a `Procedure` object and it's automatically available
- Implemented in `src/core/registry.ts`

### ✅ 4. OpenTelemetry by design

- `withSpan()` policy wraps handlers in tracing spans
- Automatic span attributes from execution context
- Business-level observability baked in
- Implemented in `src/policies/withSpan.ts`

### ✅ 5. Unified developer & AI interface

- CLI and HTTP adapters expose the same procedures
- Machine-readable contracts enable agent introspection
- `/procedures` endpoint lists all available procedures
- Future: SDK generation, OpenAPI generation, agent tools

### ✅ 6. Composability over inheritance

- Policies are pure functions that wrap handlers
- `applyPolicies()` composes multiple policies
- Examples: `withRetry`, `withRateLimit`, `withLogging`, `withSpan`
- No framework magic, just function composition

### ✅ 7. Convention over configuration

- Strict directory structure: `contracts/`, `handlers/`, `apps/`
- Biome enforces code style and structure
- File topology enables automatic discovery
- Configuration in `biome.json`

## File Structure

```
tsdev/
├── src/
│   ├── core/                    # Framework core
│   │   ├── types.ts            # Type definitions
│   │   ├── registry.ts         # Auto-discovery system
│   │   ├── executor.ts         # Execution engine
│   │   └── index.ts            # Core exports
│   │
│   ├── policies/               # Composable policies
│   │   ├── withSpan.ts        # OpenTelemetry tracing
│   │   ├── withRetry.ts       # Retry with exponential backoff
│   │   ├── withRateLimit.ts   # Token bucket rate limiting
│   │   ├── withLogging.ts     # Execution logging
│   │   └── index.ts           # Policy exports
│   │
│   ├── adapters/              # Transport adapters
│   │   ├── http.ts           # HTTP/REST adapter
│   │   └── cli.ts            # CLI adapter
│   │
│   ├── contracts/            # Contract definitions
│   │   ├── users.ts         # User domain contracts
│   │   └── math.ts          # Math domain contracts
│   │
│   ├── handlers/            # Handler implementations
│   │   ├── users.ts        # User domain handlers
│   │   └── math.ts         # Math domain handlers
│   │
│   ├── apps/               # Application entry points
│   │   ├── http-server.ts # HTTP server app
│   │   └── cli.ts         # CLI app
│   │
│   └── index.ts           # Main framework export
│
├── PHILOSOPHY.md          # Framework philosophy (English)
├── ARCHITECTURE.md        # Architecture documentation
├── EXAMPLES.md           # Usage examples
├── README.md            # Main README
├── package.json        # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
├── biome.json        # Biome (linter/formatter) config
└── test.sh          # Integration test script
```

## Key Implementation Details

### Registry Auto-Discovery

```typescript
// src/core/registry.ts
export async function collectRegistry(handlersPath = "src/handlers"): Promise<Registry> {
  // Uses glob to find all *.ts files in handlers/
  // Dynamic imports each file
  // Extracts and registers Procedure exports
  // Returns self-describing registry
}
```

### Procedure Execution

```typescript
// src/core/executor.ts
export async function executeProcedure(procedure, input, context) {
  // 1. Validate input with Zod
  // 2. Execute handler (with composed policies)
  // 3. Validate output with Zod
  // 4. Return result
}
```

### Policy Composition

```typescript
// Applied right-to-left (innermost first)
const handler = applyPolicies(
  baseHandler,
  withLogging("name"),      // Outermost - logs everything
  withSpan("name"),         // Traces execution
  withRetry({ ... }),       // Retries on failure
  withRateLimit({ ... })    // Innermost - checked first
);
```

### HTTP Adapter

- RPC-style endpoints: `POST /rpc/:procedureName`
- Introspection: `GET /procedures`
- Health check: `GET /health`
- Parses JSON body as input
- Returns JSON response

### CLI Adapter

- Syntax: `npm run cli -- procedureName --key value`
- JSON syntax: `npm run cli -- procedureName --json '{...}'`
- Lists procedures: `npm run cli -- --list`
- Pretty-prints output

## Example Procedures

### User Management

1. **users.create** - Create a new user
   - Input: `{ name: string, email: string }`
   - Output: `{ id: string, name: string, email: string, createdAt: string }`
   - Policies: logging, tracing, rate limiting

2. **users.get** - Get user by ID
   - Input: `{ id: string }`
   - Output: `{ id: string, name: string, email: string }`
   - Policies: logging, tracing, retry

3. **users.list** - List users with pagination
   - Input: `{ limit?: number, offset?: number }`
   - Output: `{ users: User[], total: number }`
   - Policies: logging, tracing

### Math Operations

1. **math.add** - Add two numbers
   - Input: `{ a: number, b: number }`
   - Output: `{ result: number }`
   
2. **math.multiply** - Multiply two numbers
   - Input: `{ a: number, b: number }`
   - Output: `{ result: number }`

## Usage Examples

### Via HTTP

```bash
# Start server
npm run dev:http

# Create user
curl -X POST http://localhost:3000/rpc/users.create \
  -H "Content-Type: application/json" \
  -d '{"name": "John", "email": "john@example.com"}'

# List procedures
curl http://localhost:3000/procedures
```

### Via CLI

```bash
# Create user
npm run cli -- users.create --name "John" --email "john@example.com"

# List procedures
npm run cli -- --list

# Math operations
npm run cli -- math.add --a 5 --b 3
```

## What Makes This Different

### Compared to Express/Fastify

- **Express**: Routes → Controllers → Services
  - Each route manually defined
  - No automatic validation
  - No introspection
  - Transport-specific logic in controllers

- **tsdev**: Contracts → Handlers → Auto-derived interfaces
  - Procedures auto-discovered
  - Automatic Zod validation
  - Self-describing registry
  - Transport-agnostic handlers

### Compared to tRPC

- **tRPC**: TypeScript RPC for full-stack apps
  - Great for TypeScript clients
  - Primarily HTTP-focused
  - Limited to TypeScript ecosystem

- **tsdev**: Meta-level abstraction
  - Transport-agnostic (HTTP, CLI, future: gRPC, GraphQL, etc.)
  - Language-agnostic contracts (Zod → JSON Schema)
  - Agent-friendly introspection
  - OpenTelemetry-first observability

### Compared to gRPC

- **gRPC**: Protocol Buffers + HTTP/2
  - Strong typing via .proto files
  - Single transport (gRPC)
  - Complex tooling

- **tsdev**: Zod schemas + multiple transports
  - Strong typing via TypeScript + Zod
  - Multiple transports from one definition
  - Simple JavaScript/TypeScript tooling

## Next Steps for Production

To take this prototype to production, consider:

1. **Testing**
   - Unit tests for handlers
   - Integration tests for adapters
   - Contract tests for validation
   - Load tests for performance

2. **Observability**
   - Configure OpenTelemetry exporters (Jaeger, DataDog, etc.)
   - Add metrics collection
   - Implement structured logging
   - Health checks and readiness probes

3. **Additional Policies**
   - Authentication/authorization
   - Caching
   - Input sanitization
   - Error handling/recovery
   - Circuit breakers

4. **Additional Adapters**
   - GraphQL adapter
   - gRPC adapter
   - WebSocket adapter
   - Message queue adapter (RabbitMQ, Kafka)
   - Agent/LLM interface

5. **Generators**
   - OpenAPI spec generator
   - TypeScript SDK generator
   - Python SDK generator
   - Documentation generator

6. **Developer Experience**
   - CLI scaffolding tool
   - Contract validation in CI
   - Hot reload for development
   - Better error messages

## Conclusion

This prototype demonstrates a **paradigm shift** in API design:

**Instead of:**
```
Define HTTP routes → Write handlers → Add validation → Write docs
```

**Do this:**
```
Write contract → Write handler → Everything else auto-generated
```

The contract becomes the **single source of truth** for:
- Runtime validation (Zod)
- Type safety (TypeScript)
- API surface (all transports)
- Documentation (introspection)
- Observability (telemetry)
- Agent interfaces (introspection)

**Write once — describe forever.**
