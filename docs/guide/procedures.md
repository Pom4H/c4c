# Procedures

Procedures are the fundamental building blocks of c4c. They are type-safe functions with contracts that define inputs, outputs, and business logic.

## What is a Procedure?

A procedure consists of two parts:

1. **Contract** - Defines the interface (input/output schemas)
2. **Handler** - Implements the business logic

```typescript
export const createUser: Procedure = {
  contract: {
    input: z.object({ name: z.string(), email: z.string() }),
    output: z.object({ id: z.string(), name: z.string(), email: z.string() })
  },
  handler: async (input) => {
    // Business logic here
    return { id: generateId(), ...input };
  }
};
```

## Basic Procedure

Here's a simple procedure:

```typescript
import { z } from "zod";
import type { Procedure } from "@c4c/core";

export const greet: Procedure = {
  contract: {
    input: z.object({
      name: z.string(),
    }),
    output: z.object({
      message: z.string(),
    }),
  },
  handler: async (input) => {
    return {
      message: `Hello, ${input.name}!`
    };
  },
};
```

## Contract Definition

Contracts use [Zod](https://zod.dev/) for schema validation:

```typescript
const contract = {
  input: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().min(0).optional(),
    role: z.enum(["admin", "user"]),
    metadata: z.record(z.string()),
  }),
  output: z.object({
    id: z.string().uuid(),
    success: z.boolean(),
  })
};
```

### Common Schema Types

```typescript
// Strings
z.string()
z.string().min(5)
z.string().max(100)
z.string().email()
z.string().url()
z.string().uuid()

// Numbers
z.number()
z.number().int()
z.number().positive()
z.number().min(0).max(100)

// Booleans
z.boolean()

// Dates
z.date()
z.string().datetime() // ISO 8601 string

// Arrays
z.array(z.string())
z.string().array()

// Objects
z.object({ key: z.string() })

// Unions
z.union([z.string(), z.number()])

// Enums
z.enum(["red", "green", "blue"])

// Optional
z.string().optional()

// Nullable
z.string().nullable()

// Default values
z.string().default("default value")
```

## Auto-Naming

Procedures can use auto-naming, where the export name becomes the procedure name:

```typescript
// Auto-named as "createUser"
export const createUser: Procedure = {
  contract: {
    // No name specified - uses export name
    input: ...,
    output: ...
  },
  handler: ...
};
```

**Benefits:**
- Less boilerplate
- IDE refactoring support (F2 rename works!)
- Single source of truth

## Explicit Naming

For public APIs or when you need specific names:

```typescript
export const create: Procedure = {
  contract: {
    name: "users.create",  // Explicit name
    input: ...,
    output: ...
  },
  handler: ...
};
```

## Handler Implementation

The handler is an async function that receives input and context:

```typescript
handler: async (input, context) => {
  // Access validated input
  console.log(input.name);
  
  // Access execution context
  console.log(context.requestId);
  console.log(context.metadata);
  
  // Perform business logic
  const result = await database.save(input);
  
  // Return validated output
  return result;
}
```

### Execution Context

The context object provides:

```typescript
interface ExecutionContext {
  requestId: string;              // Unique request ID
  metadata: Record<string, any>;  // Custom metadata
  trace?: {                       // OpenTelemetry trace info
    traceId: string;
    spanId: string;
  };
}
```

## Error Handling

Procedures can throw errors which are automatically handled:

```typescript
handler: async (input) => {
  if (!input.email.includes("@")) {
    throw new Error("Invalid email format");
  }
  
  try {
    return await api.createUser(input);
  } catch (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }
}
```

## Contract Metadata

Add metadata to your contracts for documentation and tooling:

```typescript
const contract = {
  name: "users.create",
  description: "Create a new user account",
  input: z.object({ ... }),
  output: z.object({ ... }),
  metadata: {
    exposure: "external",           // "internal" | "external"
    roles: ["api-endpoint", "sdk-client"],
    tags: ["users", "write"],
    version: "1.0.0",
    deprecated: false,
  }
};
```

## Complete Example

Here's a complete procedure with all features:

```typescript
import { z } from "zod";
import type { Procedure } from "@c4c/core";

// Shared schemas
const userInputSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(18).optional(),
});

const userOutputSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  age: z.number().optional(),
  createdAt: z.string().datetime(),
});

// Create user procedure
export const createUser: Procedure = {
  contract: {
    name: "users.create",
    description: "Create a new user account",
    input: userInputSchema,
    output: userOutputSchema,
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      tags: ["users", "write"],
    },
  },
  handler: async (input, context) => {
    console.log(`[${context.requestId}] Creating user: ${input.email}`);
    
    // Validate business rules
    const existing = await database.users.findByEmail(input.email);
    if (existing) {
      throw new Error("User already exists");
    }
    
    // Create user
    const user = {
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };
    
    await database.users.create(user);
    
    console.log(`[${context.requestId}] User created: ${user.id}`);
    
    return user;
  },
};

// Get user procedure
export const getUser: Procedure = {
  contract: {
    name: "users.get",
    description: "Get user by ID",
    input: z.object({ id: z.string().uuid() }),
    output: userOutputSchema,
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      tags: ["users", "read"],
    },
  },
  handler: async (input, context) => {
    const user = await database.users.findById(input.id);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
  },
};

// Update user procedure
export const updateUser: Procedure = {
  contract: {
    name: "users.update",
    description: "Update user information",
    input: z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      email: z.string().email().optional(),
      age: z.number().int().min(18).optional(),
    }),
    output: userOutputSchema,
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      tags: ["users", "write"],
    },
  },
  handler: async (input, context) => {
    const user = await database.users.findById(input.id);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const updated = {
      ...user,
      ...input,
    };
    
    await database.users.update(updated);
    
    return updated;
  },
};

// Delete user procedure
export const deleteUser: Procedure = {
  contract: {
    name: "users.delete",
    description: "Delete user account",
    input: z.object({ id: z.string().uuid() }),
    output: z.object({ success: z.boolean() }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      tags: ["users", "delete"],
    },
  },
  handler: async (input, context) => {
    await database.users.delete(input.id);
    return { success: true };
  },
};
```

## Organizing Procedures

### Single File

```typescript
// procedures.ts
export const createUser: Procedure = { ... };
export const getUser: Procedure = { ... };
export const updateUser: Procedure = { ... };
```

### Multiple Files

```typescript
// procedures/users.ts
export const createUser: Procedure = { ... };
export const getUser: Procedure = { ... };

// procedures/products.ts
export const createProduct: Procedure = { ... };
export const getProduct: Procedure = { ... };
```

### Module Structure

```typescript
// modules/users/procedures.ts
export const create: Procedure = {
  contract: { name: "users.create", ... },
  ...
};

// modules/products/procedures.ts
export const create: Procedure = {
  contract: { name: "products.create", ... },
  ...
};
```

## Best Practices

1. **Use Zod for validation** - Let Zod handle input/output validation
2. **Keep handlers focused** - One procedure = one responsibility
3. **Use descriptive names** - Make names self-documenting
4. **Add descriptions** - Document what procedures do
5. **Handle errors gracefully** - Throw descriptive errors
6. **Reuse schemas** - Define common schemas once
7. **Add metadata** - Use metadata for documentation and tooling
8. **Test thoroughly** - Write tests for your procedures

## Next Steps

- [Learn about Workflows](/guide/workflows)
- [Add Policies](/guide/policies)
- [Generate Clients](/guide/client-generation)
- [Set up Authentication](/guide/authentication)
