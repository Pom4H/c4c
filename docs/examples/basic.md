# Basic Example

A simple example demonstrating core c4c features.

## Overview

The basic example shows:
- Simple procedure definitions
- Auto-naming and explicit naming
- Workflow creation
- CLI execution
- Generated client usage

## Location

```
examples/basic/
├── procedures/
│   ├── math.ts          # Math operations
│   ├── data.ts          # Data manipulation
│   ├── auto-naming-demo.ts
│   └── explicit-naming-demo.ts
├── workflows/
│   ├── math.ts          # Math workflow
│   └── long.ts          # Long-running workflow
├── package.json
└── tsconfig.json
```

## Math Procedures

Simple arithmetic operations:

```typescript
// examples/basic/procedures/math.ts
import { z } from "zod";
import type { Procedure } from "@c4c/core";

export const add: Procedure = {
  contract: {
    input: z.object({
      a: z.number(),
      b: z.number(),
    }),
    output: z.object({
      result: z.number(),
    }),
  },
  handler: async (input) => {
    return { result: input.a + input.b };
  },
};

export const multiply: Procedure = {
  contract: {
    input: z.object({
      a: z.number(),
      b: z.number(),
    }),
    output: z.object({
      result: z.number(),
    }),
  },
  handler: async (input) => {
    return { result: input.a * input.b };
  },
};

export const subtract: Procedure = {
  contract: {
    input: z.object({
      a: z.number(),
      b: z.number(),
    }),
    output: z.object({
      result: z.number(),
    }),
  },
  handler: async (input) => {
    return { result: input.a - input.b };
  },
};
```

## Math Workflow

Orchestrate math operations:

```typescript
// examples/basic/workflows/math.ts
import { workflow, step } from "@c4c/workflow";
import { z } from "zod";

export default workflow("calculator")
  .name("Calculator Workflow")
  .version("1.0.0")
  .step(step({
    id: "multiply",
    input: z.object({ a: z.number(), b: z.number() }),
    output: z.object({ result: z.number() }),
    execute: ({ engine, inputData }) => 
      engine.run("multiply", inputData),
  }))
  .step(step({
    id: "add-ten",
    input: z.object({ result: z.number() }),
    output: z.object({ result: z.number() }),
    execute: ({ context }) => {
      const multiplyResult = context.get("multiply");
      return { result: multiplyResult.result + 10 };
    },
  }))
  .commit();
```

## Auto-Naming Example

Using export names as procedure names:

```typescript
// examples/basic/procedures/auto-naming-demo.ts
import { z } from "zod";
import type { Procedure } from "@c4c/core";

// Auto-named as "createUser"
export const createUser: Procedure = {
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
    return {
      id: crypto.randomUUID(),
      ...input,
    };
  },
};

// Auto-named as "getUser"
export const getUser: Procedure = {
  contract: {
    input: z.object({ id: z.string() }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
  handler: async (input) => {
    return {
      id: input.id,
      name: "John Doe",
      email: "john@example.com",
    };
  },
};
```

## Explicit Naming Example

Using explicit procedure names:

```typescript
// examples/basic/procedures/explicit-naming-demo.ts
import { z } from "zod";
import type { Procedure } from "@c4c/core";

export const create: Procedure = {
  contract: {
    name: "products.create",  // Explicit name
    input: z.object({
      name: z.string(),
      price: z.number(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      price: z.number(),
    }),
  },
  handler: async (input) => {
    return {
      id: crypto.randomUUID(),
      ...input,
    };
  },
};

export const list: Procedure = {
  contract: {
    name: "products.list",  // Explicit name
    input: z.object({
      limit: z.number().optional(),
    }),
    output: z.object({
      products: z.array(z.object({
        id: z.string(),
        name: z.string(),
        price: z.number(),
      })),
    }),
  },
  handler: async (input) => {
    return {
      products: [
        { id: "1", name: "Product 1", price: 10 },
        { id: "2", name: "Product 2", price: 20 },
      ].slice(0, input.limit || 10),
    };
  },
};
```

## Running the Example

### Install Dependencies

```bash
cd examples/basic
pnpm install
```

### Start Dev Server

```bash
pnpm dev
```

Server starts on `http://localhost:3000`

### Execute Procedures

```bash
# Math operations
pnpm c4c exec add --input '{"a": 5, "b": 3}'
# Result: { "result": 8 }

pnpm c4c exec multiply --input '{"a": 5, "b": 3}'
# Result: { "result": 15 }

# User operations
pnpm c4c exec createUser --input '{"name":"Alice","email":"alice@example.com"}'
# Result: { "id": "...", "name": "Alice", "email": "alice@example.com" }

# Product operations
pnpm c4c exec products.create --input '{"name":"Widget","price":9.99}'
# Result: { "id": "...", "name": "Widget", "price": 9.99 }
```

### Execute Workflows

```bash
pnpm c4c exec calculator --input '{"a": 5, "b": 3}'
# Result: { "result": 25 }  (5 * 3 + 10)
```

### Generate Client

```bash
pnpm c4c generate client --out ./client.ts
```

Use the generated client:

```typescript
import { createc4cClient } from "./client";

const client = createc4cClient({
  baseUrl: "http://localhost:3000"
});

// Fully typed!
const result = await client.procedures.add({ a: 5, b: 3 });
console.log(result.result); // 8

const user = await client.procedures.createUser({
  name: "Alice",
  email: "alice@example.com"
});
console.log(user.id);
```

### Generate OpenAPI

```bash
pnpm c4c generate openapi --out ./openapi.json
```

View the generated OpenAPI spec:

```bash
cat openapi.json
```

## HTTP API

With the dev server running:

### RPC Endpoints

```bash
# Add numbers
curl -X POST http://localhost:3000/rpc/add \
  -H "Content-Type: application/json" \
  -d '{"a": 5, "b": 3}'

# Create user
curl -X POST http://localhost:3000/rpc/createUser \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'
```

### List Procedures

```bash
curl http://localhost:3000/procedures
```

### OpenAPI Spec

```bash
curl http://localhost:3000/openapi.json
```

## Key Takeaways

1. **Simple Setup** - Minimal configuration required
2. **Type Safety** - Full TypeScript support
3. **Auto-Naming** - Optional names with IDE refactoring
4. **Multiple Transports** - CLI, HTTP, workflows
5. **Generated Clients** - Type-safe API clients

## Next Steps

- [Modules Example](/examples/modules) - Organized structure
- [Integrations Example](/examples/integrations) - External APIs
- [Cross-Integration Example](/examples/cross-integration) - Multi-app integration
