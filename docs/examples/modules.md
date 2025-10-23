# Modules Example

Demonstrates modular project organization with users, products, and analytics modules.

## Overview

The modules example shows:
- Modular code organization
- Separate concerns by domain
- Shared workflows across modules
- Client generation
- Testing generated clients

## Structure

```
examples/modules/
├── users/
│   └── procedures.ts       # User management
├── products/
│   ├── procedures.ts       # Product CRUD
│   └── types.ts           # Shared types
├── analytics/
│   └── procedures.ts       # Analytics tracking
├── workflows/
│   └── user-onboarding.ts # Cross-module workflow
├── scripts/
│   └── generate-client.ts # Client generation script
├── generated/
│   └── client.ts          # Generated client
├── package.json
└── tsconfig.json
```

## Users Module

User management procedures:

```typescript
// examples/modules/users/procedures.ts
import { z } from "zod";
import type { Procedure } from "@c4c/core";

const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});

export const createUser: Procedure = {
  contract: {
    name: "users.create",
    description: "Create a new user",
    input: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    output: userSchema,
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      tags: ["users", "write"],
    },
  },
  handler: async (input) => {
    return {
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };
  },
};

export const getUser: Procedure = {
  contract: {
    name: "users.get",
    description: "Get user by ID",
    input: z.object({ id: z.string().uuid() }),
    output: userSchema,
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      tags: ["users", "read"],
    },
  },
  handler: async (input) => {
    return {
      id: input.id,
      name: "John Doe",
      email: "john@example.com",
      createdAt: new Date().toISOString(),
    };
  },
};

export const listUsers: Procedure = {
  contract: {
    name: "users.list",
    description: "List all users",
    input: z.object({
      limit: z.number().min(1).max(100).default(10),
      offset: z.number().min(0).default(0),
    }),
    output: z.object({
      users: z.array(userSchema),
      total: z.number(),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      tags: ["users", "read"],
    },
  },
  handler: async (input) => {
    return {
      users: [
        {
          id: crypto.randomUUID(),
          name: "Alice",
          email: "alice@example.com",
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
    };
  },
};
```

## Products Module

Product management procedures:

```typescript
// examples/modules/products/procedures.ts
import { z } from "zod";
import type { Procedure } from "@c4c/core";

const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  price: z.number().positive(),
  createdAt: z.string().datetime(),
});

export const createProduct: Procedure = {
  contract: {
    name: "products.create",
    description: "Create a new product",
    input: z.object({
      name: z.string(),
      description: z.string(),
      price: z.number().positive(),
    }),
    output: productSchema,
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      tags: ["products", "write"],
    },
  },
  handler: async (input) => {
    return {
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };
  },
};

export const listProducts: Procedure = {
  contract: {
    name: "products.list",
    description: "List all products",
    input: z.object({
      limit: z.number().min(1).max(100).default(10),
    }),
    output: z.object({
      products: z.array(productSchema),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      tags: ["products", "read"],
    },
  },
  handler: async (input) => {
    return {
      products: [
        {
          id: crypto.randomUUID(),
          name: "Widget",
          description: "A useful widget",
          price: 9.99,
          createdAt: new Date().toISOString(),
        },
      ],
    };
  },
};
```

## Analytics Module

Analytics tracking:

```typescript
// examples/modules/analytics/procedures.ts
import { z } from "zod";
import type { Procedure } from "@c4c/core";

export const trackEvent: Procedure = {
  contract: {
    name: "analytics.track",
    description: "Track an analytics event",
    input: z.object({
      userId: z.string().uuid(),
      event: z.string(),
      properties: z.record(z.any()).optional(),
    }),
    output: z.object({
      tracked: z.boolean(),
      eventId: z.string().uuid(),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
      tags: ["analytics", "write"],
    },
  },
  handler: async (input) => {
    console.log(`Tracking event: ${input.event} for user ${input.userId}`);
    return {
      tracked: true,
      eventId: crypto.randomUUID(),
    };
  },
};
```

## Cross-Module Workflow

Workflow using multiple modules:

```typescript
// examples/modules/workflows/user-onboarding.ts
import { workflow, step, parallel } from "@c4c/workflow";
import { z } from "zod";

export default workflow("user-onboarding")
  .name("User Onboarding Workflow")
  .version("1.0.0")
  .step(step({
    id: "create-user",
    input: z.object({ name: z.string(), email: z.string() }),
    output: z.object({ id: z.string() }),
    execute: ({ engine, inputData }) =>
      engine.run("users.create", inputData),
  }))
  .step(parallel({
    id: "parallel-setup",
    branches: [
      step({
        id: "track-signup",
        execute: ({ engine, context }) => {
          const user = context.get("create-user");
          return engine.run("analytics.track", {
            userId: user.id,
            event: "user_signed_up",
          });
        },
      }),
      step({
        id: "create-sample-product",
        execute: ({ engine }) =>
          engine.run("products.create", {
            name: "Sample Product",
            description: "Welcome product",
            price: 0,
          }),
      }),
    ],
    waitForAll: true,
  }))
  .commit();
```

## Running the Example

### Install Dependencies

```bash
cd examples/modules
pnpm install
```

### Start Dev Server

```bash
pnpm dev
```

### Execute Procedures

```bash
# User operations
pnpm c4c exec users.create --input '{"name":"Alice","email":"alice@example.com"}'
pnpm c4c exec users.list --input '{"limit":10}'

# Product operations
pnpm c4c exec products.create --input '{"name":"Widget","description":"A widget","price":9.99}'
pnpm c4c exec products.list

# Analytics
pnpm c4c exec analytics.track --input '{"userId":"123","event":"page_view"}'
```

### Execute Workflow

```bash
pnpm c4c exec user-onboarding --input '{"name":"Alice","email":"alice@example.com"}'
```

### Generate Client

```bash
pnpm generate:client
```

This creates `generated/client.ts` with type-safe procedures.

### Test Generated Client

```bash
pnpm test:client
```

## Using the Generated Client

```typescript
import { createClient } from "./generated/client";

const client = createClient({
  baseUrl: "http://localhost:3000"
});

// User operations
const user = await client.usersCreate({
  name: "Alice",
  email: "alice@example.com"
});

const users = await client.usersList({
  limit: 10,
  offset: 0
});

// Product operations
const product = await client.productsCreate({
  name: "Widget",
  description: "A useful widget",
  price: 9.99
});

// Analytics
await client.analyticsTrack({
  userId: user.id,
  event: "product_created",
  properties: { productId: product.id }
});
```

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "c4c dev",
    "serve": "c4c serve",
    "generate:client": "c4c generate client --out ./generated/client.ts",
    "generate:openapi": "c4c generate openapi --out ./openapi.json",
    "test:client": "tsx scripts/test-client.ts"
  }
}
```

## Key Takeaways

1. **Modular Organization** - Separate concerns by domain
2. **Cross-Module Workflows** - Workflows can use any procedure
3. **Type-Safe Clients** - Generated clients are fully typed
4. **Flexible Structure** - Organize code your way
5. **Zero Config** - Framework discovers everything automatically

## Next Steps

- [Integrations Example](/examples/integrations) - External API integration
- [Cross-Integration Example](/examples/cross-integration) - Multi-app integration
- [Triggers Example](/examples/triggers) - Webhook and event handling
