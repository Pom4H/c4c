# tsdev Examples

This document demonstrates how to use the tsdev framework.

## Starting the HTTP Server

```bash
npm run dev:http
```

The server will start on `http://localhost:3000` with:
- 📚 Swagger UI at `http://localhost:3000/docs`
- 📄 OpenAPI spec at `http://localhost:3000/openapi.json`
- 🔧 RPC endpoints at `POST /rpc/:procedureName`
- 🌐 REST endpoints at `/:resource` (conventional routes)

## Documentation & Introspection

### Swagger UI (Interactive API Docs)

```bash
open http://localhost:3000/docs
```

Browse and test all API endpoints directly in your browser!

### OpenAPI Specification

```bash
curl http://localhost:3000/openapi.json
```

Get the complete OpenAPI 3.0 specification auto-generated from contracts.

### List all available procedures

```bash
curl http://localhost:3000/procedures
```

### List all REST routes

```bash
curl http://localhost:3000/routes
```

## HTTP Examples

### Create a user (RPC style)

```bash
curl -X POST http://localhost:3000/rpc/users.create \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Doe",
  "email": "john@example.com",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Get a user (RPC style)

```bash
curl -X POST http://localhost:3000/rpc/users.get \
  -H "Content-Type: application/json" \
  -d '{"id": "550e8400-e29b-41d4-a716-446655440000"}'
```

### List users (RPC style)

```bash
curl -X POST http://localhost:3000/rpc/users.list \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "offset": 0}'
```

## REST API Examples

The same procedures are automatically available as RESTful endpoints!

### Create a user (REST style)

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Smith", "email": "alice@example.com"}'
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Alice Smith",
  "email": "alice@example.com",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Get a user (REST style)

```bash
curl http://localhost:3000/users/550e8400-e29b-41d4-a716-446655440000
```

### List users (REST style)

```bash
curl "http://localhost:3000/users?limit=10&offset=0"
```

Response:
```json
{
  "users": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Alice Smith",
      "email": "alice@example.com"
    }
  ],
  "total": 1
}
```

### Math operations

```bash
# Add numbers
curl -X POST http://localhost:3000/rpc/math.add \
  -H "Content-Type: application/json" \
  -d '{"a": 5, "b": 3}'

# Multiply numbers
curl -X POST http://localhost:3000/rpc/math.multiply \
  -H "Content-Type: application/json" \
  -d '{"a": 4, "b": 7}'
```

## CLI Examples

### List all available procedures

```bash
npm run cli -- --list
```

### Create a user

```bash
npm run cli -- users.create --name "Jane Doe" --email "jane@example.com"
```

### Create a user with JSON input

```bash
npm run cli -- users.create --json '{"name": "Bob Smith", "email": "bob@example.com"}'
```

### Get a user

```bash
npm run cli -- users.get --id "550e8400-e29b-41d4-a716-446655440000"
```

### List users

```bash
npm run cli -- users.list --limit 5 --offset 0
```

### Math operations

```bash
# Add numbers
npm run cli -- math.add --a 10 --b 20

# Multiply numbers
npm run cli -- math.multiply --a 6 --b 7
```

## Key Observations

### Transport-Agnostic

The same `users.create` handler works identically via:
- **RPC**: `POST /rpc/users.create`
- **REST**: `POST /users`
- **CLI**: `npm run cli -- users.create`

The handler code doesn't know which transport called it!

### Auto-Generated Documentation

From a single Zod contract, you automatically get:
- ✅ OpenAPI 3.0 specification
- ✅ Swagger UI documentation
- ✅ RPC endpoints
- ✅ REST endpoints
- ✅ Type definitions
- ✅ Runtime validation

No manual documentation needed!

### Self-Describing

The registry automatically discovers all procedures:
- HTTP: `GET /procedures` returns all available procedures
- CLI: `npm run cli -- --list` shows all commands

### Composable Policies

Each handler uses composable policies:
- `withLogging`: Logs execution
- `withSpan`: OpenTelemetry tracing
- `withRetry`: Automatic retries
- `withRateLimit`: Rate limiting

These policies work regardless of transport!

### Contract Validation

Both transports automatically validate:
- Input against contract schema
- Output against contract schema

Try sending invalid data:
```bash
curl -X POST http://localhost:3000/rpc/users.create \
  -H "Content-Type: application/json" \
  -d '{"name": "", "email": "invalid"}'
```

You'll get validation errors from Zod.

## Creating New Procedures

1. **Define the contract** in `src/contracts/`:

```typescript
export const greetContract: Contract<
  { name: string },
  { message: string }
> = {
  name: "greet",
  description: "Greet a user",
  input: z.object({ name: z.string() }),
  output: z.object({ message: z.string() }),
};
```

2. **Implement the handler** in `src/handlers/`:

```typescript
export const greet: Procedure<{ name: string }, { message: string }> = {
  contract: greetContract,
  handler: applyPolicies(
    async (input, _context) => {
      return { message: `Hello, ${input.name}!` };
    },
    withLogging("greet"),
    withSpan("greet")
  ),
};
```

3. **It's automatically available!**

No registration needed - the procedure is automatically discovered and works via HTTP and CLI:

```bash
# Via HTTP
curl -X POST http://localhost:3000/rpc/greet \
  -d '{"name": "World"}'

# Via CLI
npm run cli -- greet --name "World"
```

This is the **zero boilerplate, maximum reflection** principle in action!
