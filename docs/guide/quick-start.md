# Quick Start

Get started with c4c in under 5 minutes.

## Installation

```bash
# Install dependencies
pnpm install

# Or with npm
npm install

# Or with yarn
yarn install
```

## Create Your First Procedure

Create a file `procedures/math.ts`:

```typescript
import { z } from "zod";
import type { Procedure } from "@c4c/core";

// Simple addition procedure
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

// Multiply procedure
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
```

## Start the Development Server

```bash
c4c dev
```

The server will:
- Scan your project for procedures
- Start HTTP server on `http://localhost:3000`
- Enable hot reload
- Provide OpenAPI documentation

## Execute Your Procedure

### Via CLI

```bash
c4c exec add --input '{"a": 5, "b": 3}'
# Output: { "result": 8 }
```

### Via HTTP

```bash
# RPC endpoint
curl -X POST http://localhost:3000/rpc/add \
  -H "Content-Type: application/json" \
  -d '{"a": 5, "b": 3}'

# Response: { "result": 8 }
```

### Via Generated Client

Generate a typed client:

```bash
c4c generate client --out ./client.ts
```

Use it in your code:

```typescript
import { createc4cClient } from "./client";

const client = createc4cClient({
  baseUrl: "http://localhost:3000"
});

// Fully typed!
const result = await client.procedures.add({ a: 5, b: 3 });
console.log(result.result); // 8
```

## Create Your First Workflow

Create a file `workflows/calculator.ts`:

```typescript
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

## Execute Your Workflow

```bash
c4c exec calculator --input '{"a": 5, "b": 3}'
# Output: { "result": 25 }  (5 * 3 + 10)
```

## View OpenAPI Documentation

Visit `http://localhost:3000/openapi.json` to see your auto-generated API documentation.

Or generate it to a file:

```bash
c4c generate openapi --out ./openapi.json
```

## Project Structure

Your project can be organized any way you want:

```
my-project/
├── procedures/
│   ├── math.ts
│   └── users.ts
├── workflows/
│   └── calculator.ts
└── package.json
```

Or with modules:

```
my-project/
├── modules/
│   ├── users/
│   │   ├── procedures.ts
│   │   └── workflows.ts
│   └── products/
│       └── procedures.ts
└── package.json
```

## Next Steps

- [Learn about Procedures](/guide/procedures)
- [Build Workflows](/guide/workflows)
- [Explore CLI Commands](/guide/cli)
- [Set up Authentication](/guide/authentication)
- [Add Policies](/guide/policies)

## Full Example

Here's a complete example with a user management system:

```typescript
// procedures/users.ts
import { z } from "zod";
import type { Procedure } from "@c4c/core";

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

export const createUser: Procedure = {
  contract: {
    input: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    output: userSchema,
  },
  handler: async (input) => {
    const user = {
      id: crypto.randomUUID(),
      ...input,
    };
    // Save to database...
    return user;
  },
};

export const getUser: Procedure = {
  contract: {
    input: z.object({ id: z.string() }),
    output: userSchema,
  },
  handler: async (input) => {
    // Load from database...
    return {
      id: input.id,
      name: "John Doe",
      email: "john@example.com",
    };
  },
};
```

```typescript
// workflows/onboarding.ts
import { workflow, step } from "@c4c/workflow";
import { z } from "zod";

export default workflow("user-onboarding")
  .name("User Onboarding Flow")
  .version("1.0.0")
  .step(step({
    id: "create-user",
    input: z.object({ name: z.string(), email: z.string() }),
    output: z.object({ id: z.string() }),
    execute: ({ engine, inputData }) => 
      engine.run("createUser", inputData),
  }))
  .step(step({
    id: "send-welcome-email",
    input: z.object({ userId: z.string() }),
    output: z.object({ sent: z.boolean() }),
    execute: ({ context }) => {
      const user = context.get("create-user");
      console.log(`Sending welcome email to user ${user.id}`);
      return { sent: true };
    },
  }))
  .commit();
```

Start the server and execute:

```bash
c4c dev

# In another terminal
c4c exec user-onboarding --input '{"name":"Alice","email":"alice@example.com"}'
```

That's it! You've created your first c4c project with procedures and workflows.
