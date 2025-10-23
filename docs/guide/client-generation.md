# Client Generation

Generate type-safe TypeScript clients from your procedures.

## Generate Client

```bash
c4c generate client --out ./client.ts
```

This creates a fully-typed client with all your procedures.

## Using the Client

```typescript
import { createc4cClient } from "./client";

const client = createc4cClient({
  baseUrl: "http://localhost:3000"
});

// Fully typed!
const user = await client.procedures.createUser({
  name: "Alice",
  email: "alice@example.com"
});
```

## Client Options

```typescript
const client = createc4cClient({
  baseUrl: "http://localhost:3000",
  authToken: "your-token",
  headers: {
    "X-Custom-Header": "value"
  }
});
```

## Dynamic Tokens

```typescript
const client = createc4cClient({
  baseUrl: "http://localhost:3000",
  getAuthToken: async () => {
    return await getToken();
  }
});
```

## Type Safety

Generated clients are fully typed:

```typescript
// ✅ Type-safe
const user = await client.procedures.createUser({
  name: "Alice",
  email: "alice@example.com"
});

// ❌ Type error
const user = await client.procedures.createUser({
  name: "Alice"
  // Error: Property 'email' is missing
});
```

## Next Steps

- [View @c4c/generators Documentation](/packages/generators)
- [Learn about HTTP API](/guide/http-api)
- [Explore Examples](/examples/basic)
