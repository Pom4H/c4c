# @c4c/core

The core framework providing type definitions, registry, execution engine, and policy system.

## Installation

```bash
pnpm add @c4c/core zod
```

## Overview

`@c4c/core` is the foundation of c4c. It provides:

- **Type definitions** for procedures and contracts
- **Registry system** for discovering procedures
- **Execution engine** with context management
- **Policy system** for cross-cutting concerns
- **Trigger support** for event-driven workflows

## Key Types

### Procedure

The main type for defining procedures:

```typescript
import type { Procedure } from "@c4c/core";
import { z } from "zod";

export const myProcedure: Procedure = {
  contract: {
    input: z.object({ name: z.string() }),
    output: z.object({ message: z.string() }),
  },
  handler: async (input, context) => {
    return { message: `Hello, ${input.name}!` };
  },
};
```

### Contract

Defines input/output schemas:

```typescript
import type { Contract } from "@c4c/core";
import { z } from "zod";

const myContract: Contract = {
  name: "myProcedure",
  description: "Example procedure",
  input: z.object({ ... }),
  output: z.object({ ... }),
  metadata: {
    exposure: "external",
    roles: ["api-endpoint"],
  },
};
```

### Handler

The function that implements procedure logic:

```typescript
import type { Handler } from "@c4c/core";

const myHandler: Handler<InputType, OutputType> = async (input, context) => {
  // Business logic
  return output;
};
```

### ExecutionContext

Context passed to handlers:

```typescript
interface ExecutionContext {
  requestId: string;
  metadata: Record<string, any>;
  trace?: {
    traceId: string;
    spanId: string;
  };
}
```

### Registry

Type for procedure registry:

```typescript
import type { Registry } from "@c4c/core";

const registry: Registry = {
  "procedure.name": {
    contract: { ... },
    handler: async (input) => { ... },
  },
};
```

## Registry Functions

### collectRegistry

Discover procedures automatically:

```typescript
import { collectRegistry } from "@c4c/core";

const registry = await collectRegistry("./src/procedures");
```

**Options:**

```typescript
interface CollectOptions {
  root?: string;           // Root directory (default: current)
  include?: string[];      // File patterns to include
  exclude?: string[];      // File patterns to exclude
  followSymlinks?: boolean;
}
```

### getProcedure

Get a specific procedure:

```typescript
import { getProcedure } from "@c4c/core";

const procedure = getProcedure(registry, "users.create");
if (procedure) {
  // Use procedure
}
```

### listProcedures

List all procedure names:

```typescript
import { listProcedures } from "@c4c/core";

const names = listProcedures(registry);
// ["users.create", "users.get", ...]
```

### describeRegistry

Get registry statistics:

```typescript
import { describeRegistry } from "@c4c/core";

const stats = describeRegistry(registry);
console.log(`Found ${stats.count} procedures`);
```

## Execution Functions

### execute

Execute a procedure by name:

```typescript
import { execute } from "@c4c/core";

const result = await execute(
  registry,
  "users.create",
  { name: "Alice", email: "alice@example.com" }
);
```

**With Context:**

```typescript
const result = await execute(
  registry,
  "users.create",
  { name: "Alice" },
  {
    requestId: "req-123",
    metadata: { userId: "user-456" }
  }
);
```

### executeProcedure

Execute a procedure directly:

```typescript
import { executeProcedure } from "@c4c/core";

const procedure = getProcedure(registry, "users.create");
const result = await executeProcedure(
  procedure,
  { name: "Alice" },
  context
);
```

### createExecutionContext

Create execution context:

```typescript
import { createExecutionContext } from "@c4c/core";

const context = createExecutionContext({
  requestId: "req-123",
  metadata: { userId: "user-456" },
});
```

## Policy System

### applyPolicies

Apply policies to handlers:

```typescript
import { applyPolicies } from "@c4c/core";

const handler = applyPolicies(
  async (input) => { ... },
  policy1,
  policy2,
  policy3
);
```

Policies are applied **right to left** (innermost to outermost).

### Creating Policies

Define custom policies:

```typescript
import type { Policy } from "@c4c/core";

export function myPolicy(options: MyOptions): Policy {
  return (handler) => {
    return async (input, context) => {
      // Pre-processing
      console.log("Before execution");
      
      // Execute handler
      const result = await handler(input, context);
      
      // Post-processing
      console.log("After execution");
      
      return result;
    };
  };
}
```

Usage:

```typescript
const handler = applyPolicies(
  baseHandler,
  myPolicy({ option: "value" })
);
```

## Metadata Functions

### getContractMetadata

Get metadata from contract:

```typescript
import { getContractMetadata } from "@c4c/core";

const metadata = getContractMetadata(contract);
console.log(metadata.exposure);  // "external" | "internal"
console.log(metadata.roles);     // ["api-endpoint", ...]
```

### getProcedureExposure

Check procedure exposure:

```typescript
import { getProcedureExposure } from "@c4c/core";

const exposure = getProcedureExposure(procedure);
// "internal" | "external"
```

### isProcedureVisible

Check if procedure is visible:

```typescript
import { isProcedureVisible } from "@c4c/core";

if (isProcedureVisible(procedure, "api-endpoint")) {
  // Procedure is visible to API endpoints
}
```

## Trigger System

### isTrigger

Check if procedure is a trigger:

```typescript
import { isTrigger } from "@c4c/core";

if (isTrigger(procedure)) {
  // This is a trigger procedure
}
```

### getTriggerMetadata

Get trigger metadata:

```typescript
import { getTriggerMetadata } from "@c4c/core";

const metadata = getTriggerMetadata(procedure);
console.log(metadata.provider);   // "github", "stripe", etc.
console.log(metadata.event);      // Event type
```

### findTriggers

Find all trigger procedures:

```typescript
import { findTriggers } from "@c4c/core";

const triggers = findTriggers(registry);
// Array of trigger procedures
```

### TriggerSubscriptionManager

Manage trigger subscriptions:

```typescript
import { TriggerSubscriptionManager } from "@c4c/core";

const manager = new TriggerSubscriptionManager(registry);

// Subscribe to trigger
await manager.subscribe("github.webhook", {
  url: "https://example.com/webhook",
  events: ["push", "pull_request"],
});

// Unsubscribe
await manager.unsubscribe("github.webhook");

// List subscriptions
const subscriptions = manager.listSubscriptions();
```

## Complete Example

Here's a complete example using core features:

```typescript
import {
  type Procedure,
  type Policy,
  collectRegistry,
  execute,
  applyPolicies,
  createExecutionContext,
} from "@c4c/core";
import { z } from "zod";

// Define a custom policy
function withTiming(name: string): Policy {
  return (handler) => async (input, context) => {
    const start = Date.now();
    const result = await handler(input, context);
    const duration = Date.now() - start;
    console.log(`[${name}] Executed in ${duration}ms`);
    return result;
  };
}

// Define a procedure with policy
export const createUser: Procedure = {
  contract: {
    name: "users.create",
    description: "Create a new user",
    input: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
    },
  },
  handler: applyPolicies(
    async (input, context) => {
      console.log(`[${context.requestId}] Creating user: ${input.email}`);
      
      return {
        id: crypto.randomUUID(),
        ...input,
      };
    },
    withTiming("users.create")
  ),
};

// Collect registry and execute
async function main() {
  // Discover procedures
  const registry = await collectRegistry("./procedures");
  
  // Create context
  const context = createExecutionContext({
    requestId: "req-123",
    metadata: { source: "cli" },
  });
  
  // Execute procedure
  const result = await execute(
    registry,
    "users.create",
    { name: "Alice", email: "alice@example.com" },
    context
  );
  
  console.log("Result:", result);
}

main();
```

## TypeScript Support

All types are fully typed with generics:

```typescript
import type { Handler, Procedure } from "@c4c/core";
import { z } from "zod";

// Define schemas
const inputSchema = z.object({ name: z.string() });
const outputSchema = z.object({ message: z.string() });

// Infer types
type Input = z.infer<typeof inputSchema>;
type Output = z.infer<typeof outputSchema>;

// Typed handler
const handler: Handler<Input, Output> = async (input, context) => {
  // input is typed as Input
  // return type must match Output
  return { message: `Hello, ${input.name}!` };
};

// Typed procedure
const procedure: Procedure<Input, Output> = {
  contract: {
    input: inputSchema,
    output: outputSchema,
  },
  handler,
};
```

## Best Practices

1. **Use type inference** - Let TypeScript infer types from Zod schemas
2. **Reuse schemas** - Define common schemas once
3. **Add metadata** - Use metadata for tooling and documentation
4. **Compose policies** - Build complex behavior from simple policies
5. **Handle errors** - Throw descriptive errors in handlers
6. **Test procedures** - Write unit tests for procedure logic

## See Also

- [Procedures Guide](/guide/procedures)
- [Registry Guide](/guide/registry)
- [Policies Package](/packages/policies)
- [Examples](/examples/basic)
