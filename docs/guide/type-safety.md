# Type Safety

c4c provides end-to-end type safety using TypeScript and Zod.

## Overview

Type safety in c4c ensures:
- Input validation at runtime
- Output validation at runtime
- Type checking at compile time
- Inference from schemas
- Type-safe generated clients

## Zod Schemas

c4c uses [Zod](https://zod.dev/) for runtime validation and type inference:

```typescript
import { z } from "zod";

const inputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

// Infer TypeScript type from schema
type Input = z.infer<typeof inputSchema>;
// { name: string; email: string; age?: number }
```

## Type-Safe Procedures

Procedures are fully typed:

```typescript
import type { Procedure } from "@c4c/core";

const createUser: Procedure = {
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
    // input is typed as { name: string, email: string }
    
    return {
      id: crypto.randomUUID(),
      name: input.name,      // ✅ Type-safe
      email: input.email,    // ✅ Type-safe
      // age: 25,            // ❌ Type error - not in output schema
    };
  },
};
```

## Runtime Validation

All inputs and outputs are validated at runtime:

```typescript
// Invalid input
const result = await execute(registry, "createUser", {
  name: "Alice",
  email: "not-an-email"  // ❌ Fails validation
});
// Throws: ZodError: Invalid email
```

## Generic Type Support

Use generics for reusable typed procedures:

```typescript
import type { Procedure, Handler } from "@c4c/core";

function createCrudProcedure<T extends z.ZodType>(
  name: string,
  schema: T
): Procedure<z.infer<T>, z.infer<T>> {
  return {
    contract: {
      name,
      input: schema,
      output: schema,
    },
    handler: async (input) => {
      return input; // Type-safe!
    },
  };
}
```

## Type-Safe Generated Clients

Generated clients are fully typed:

```typescript
import { createClient } from "./client";

const client = createClient();

// ✅ Fully typed
const user = await client.createUser({
  name: "Alice",
  email: "alice@example.com"
});
// user: { id: string; name: string; email: string }

// ❌ Type error - missing required field
await client.createUser({
  name: "Alice"
  // Error: Property 'email' is missing
});

// ❌ Type error - wrong type
await client.createUser({
  name: 123,  // Error: Type 'number' is not assignable to type 'string'
  email: "alice@example.com"
});
```

## Type Inference

Let TypeScript infer types from Zod schemas:

```typescript
const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["admin", "user"]),
  metadata: z.record(z.string()),
});

type User = z.infer<typeof userSchema>;
// {
//   id: string;
//   name: string;
//   email: string;
//   role: "admin" | "user";
//   metadata: Record<string, string>;
// }
```

## Best Practices

1. **Use Zod for all schemas** - Runtime safety + type inference
2. **Share schemas** - Define once, use everywhere
3. **Leverage inference** - Let TypeScript infer types
4. **Validate early** - Catch errors at boundaries
5. **Generate clients** - Type-safe APIs for free

## Next Steps

- [Learn about Procedures](/guide/procedures)
- [Generate Clients](/guide/client-generation)
- [Explore Zod Documentation](https://zod.dev/)
