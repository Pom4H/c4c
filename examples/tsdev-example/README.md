# tsdev-example

Example usage of the tsdev framework demonstrating contracts-first, transport-agnostic application development.

## Structure

```
examples/tsdev-example/
├── contracts/          # Contract definitions (Zod schemas)
│   ├── math.ts
│   └── users.ts
├── handlers/           # Handler implementations
│   ├── math.ts
│   └── users.ts
├── apps/               # Application entry points
│   ├── http-server.ts  # HTTP/REST server
│   └── cli.ts          # CLI interface
└── workflow/           # Workflow examples
    ├── examples.ts
    ├── generator.ts
    └── telemetry-example.ts
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Start HTTP server
pnpm dev:http

# Or use CLI
pnpm cli users.create --name "Alice" --email "alice@example.com"
```

## Features Demonstrated

### Contracts-First Development

Contracts define the API surface:

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
```

### Transport-Agnostic Handlers

The same handler works via HTTP, CLI, or any other transport:

```typescript
// handlers/users.ts
export const createUser = {
  contract: createUserContract,
  handler: async (input) => {
    return {
      id: crypto.randomUUID(),
      name: input.name,
      email: input.email
    };
  }
};
```

### Multiple Transports

#### HTTP/REST
```bash
curl -X POST http://localhost:3000/users.create \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'
```

#### CLI
```bash
pnpm cli users.create --name Alice --email alice@example.com
```

### Composable Policies

Extend behavior with policies:

```typescript
import { withSpan, withRetry, withLogging } from 'tsdev/policies';

const handler = applyPolicies(
  baseHandler,
  withLogging('users.create'),
  withSpan('users.create'),
  withRetry({ maxAttempts: 3 })
);
```

### Workflow System

Define workflows with OpenTelemetry tracing:

```typescript
const workflow = {
  id: 'user-onboarding',
  nodes: [
    { type: 'procedure', procedureName: 'users.create' },
    { type: 'procedure', procedureName: 'emails.sendWelcome' }
  ]
};
```

## Learning Path

1. Read contracts in `contracts/`
2. Study handlers in `handlers/`
3. Run HTTP server in `apps/http-server.ts`
4. Try CLI in `apps/cli.ts`
5. Explore workflows in `workflow/`

## Integration

This example shows how to use tsdev in your own projects:

```bash
pnpm add tsdev
```

Then follow the same structure for your application.

## License

MIT
