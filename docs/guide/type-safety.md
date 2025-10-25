# Type Safety Guide

This guide explains the advanced type safety features in c4c framework.

## Overview

c4c provides comprehensive compile-time and runtime type safety through:

1. **Typed Execution Context** - Type-safe metadata in every handler
2. **Type-safe Registry** - Preserve procedure types through get/set operations
3. **Policy Type Transformations** - Policies can type-safely transform context
4. **Workflow Type Validation** - Compile-time checking of workflow connections
5. **Enhanced Type Guards** - Schema-based runtime validation

## Typed Execution Context

### Basic Usage

Every handler receives a typed execution context:

```typescript
import type { ExecutionContext, BaseMetadata } from "@c4c/core";

// Default context with base metadata
const handler = async (input: Input, context: ExecutionContext) => {
  // Access basic metadata
  const requestId = context.requestId;
  const timestamp = context.timestamp;
  // metadata is typed as BaseMetadata
};
```

### Custom Metadata Types

Define your own metadata structure:

```typescript
import type { ExecutionContext, BaseMetadata } from "@c4c/core";

// Extend BaseMetadata with custom fields
interface CustomMetadata extends BaseMetadata {
  auth: {
    userId: string;
    roles: string[];
  };
  tenantId: string;
  locale: string;
}

// Handler with typed metadata
const handler = async (
  input: Input,
  context: ExecutionContext<CustomMetadata>
): Promise<Output> => {
  // ✅ Type-safe access to custom metadata
  const userId = context.metadata.auth.userId;
  const tenantId = context.metadata.tenantId;
  const locale = context.metadata.locale;
  
  // ❌ TypeScript error: Property doesn't exist
  // const invalid = context.metadata.nonExistent;
  
  return { /* ... */ };
};
```

### Built-in Metadata Fields

`BaseMetadata` includes common fields:

```typescript
interface BaseMetadata {
  // Authentication
  auth?: {
    userId?: string;
    username?: string;
    email?: string;
    roles?: string[];
    permissions?: string[];
    token?: string;
    expiresAt?: Date | string;
  };
  
  // OAuth
  oauth?: {
    accessToken?: string;
    refreshToken?: string;
    provider?: string;
    scope?: string[];
  };
  
  // Tracing
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  
  // Custom fields
  [key: string]: unknown;
}
```

## Type-safe Registry

### Module Augmentation

Declare your procedure types globally:

```typescript
// procedures/math.ts
import type { Procedure } from "@c4c/core";

export const addProcedure: Procedure<AddInput, AddOutput> = {
  contract: { /* ... */ },
  handler: async ({ a, b }) => ({ result: a + b })
};

// Augment ProcedureTypeMap
declare module "@c4c/core" {
  interface ProcedureTypeMap {
    "math.add": typeof addProcedure;
    "users.create": Procedure<UserInput, UserOutput>;
  }
}
```

### Usage

```typescript
import { createTypedRegistry, executeTyped } from "@c4c/core";

const registry = createTypedRegistry();
registry.set("math.add", addProcedure);

// ✅ Full type inference
const result = await executeTyped(
  registry,
  "math.add",
  { a: 5, b: 3 } // Input type inferred
);
console.log(result.result); // Output type inferred

// ❌ TypeScript errors:
// await executeTyped(registry, "math.add", { a: "not a number" }); // Type error
// await executeTyped(registry, "unknown.proc", {}); // Type error

// ✅ Get with preserved types
const proc = registry.get("math.add");
// proc is typed as Procedure<AddInput, AddOutput>
```

### Type Inference Helpers

```typescript
import type { InferInput, InferOutput, InferContext } from "@c4c/core";

// Extract types from procedure name
type MathAddInput = InferInput<"math.add">;
type MathAddOutput = InferOutput<"math.add">;
type MathAddContext = InferContext<"math.add">;
```

## Policy Type Transformations

Policies can transform the context type:

```typescript
import type { Policy, ExecutionContext } from "@c4c/core";

// Policy that adds authentication
const withAuth: Policy<
  ExecutionContext<AnonymousMetadata>,    // Input context
  ExecutionContext<AuthenticatedMetadata> // Output context
> = (handler) => {
  return async (input, context) => {
    const authData = await authenticate();
    
    const authenticatedContext: ExecutionContext<AuthenticatedMetadata> = {
      ...context,
      metadata: {
        ...context.metadata,
        auth: authData,
        userId: authData.userId
      }
    };
    
    return handler(input, authenticatedContext);
  };
};
```

### Composing Policies

Policies compose left-to-right, transforming context types:

```typescript
import { applyPolicies } from "@c4c/core";

// Handler expects OAuth context
const handler = async (
  input: Input,
  context: ExecutionContext<OAuthMetadata>
) => { /* ... */ };

// Compose policies that progressively add context data
const protectedHandler = applyPolicies(
  handler,
  withOAuth,    // Adds OAuth (requires auth)
  withAuth,     // Adds auth (requires anonymous)
  withLogging   // Doesn't transform context
);
// Final type: ExecutionContext<AnonymousMetadata> → ExecutionContext<OAuthMetadata>
```

## Workflow Type Validation

### Compile-time Validation

Use type helpers to validate workflows at compile-time:

```typescript
import type { ValidateStepChain } from "@c4c/workflow";

// Check if two steps are compatible
type IsValid = ValidateStepChain<Step1, Step2>;
// Returns: { valid: true } or { valid: false; error: string }
```

### Runtime Validation

Validate entire workflows:

```typescript
import { validateWorkflowTypes } from "@c4c/workflow";

const validation = validateWorkflowTypes(workflowDef, procedureRegistry);

if (validation.valid) {
  console.log("✅ Workflow is type-safe!");
} else {
  for (const error of validation.errors) {
    console.error(`Node ${error.nodeId}: ${error.error}`);
  }
}
```

### Type-safe Step Creation

```typescript
import { step, createTypedComponent } from "@c4c/workflow";

const typedStep = createTypedComponent({
  id: "getUser",
  nodes: [/* ... */],
  entryId: "getUser",
  exitIds: ["getUser"],
  input: getUserInputSchema,
  output: getUserOutputSchema,
});

// Access inferred types
type StepInput = typeof typedStep.__inputType;
type StepOutput = typeof typedStep.__outputType;
```

## Enhanced Type Guards

### Schema-based Validation

```typescript
import {
  isProcedure,
  isContract,
  assertProcedure,
  validateProcedure
} from "@c4c/core";

// Type guard with runtime validation
if (isProcedure(value)) {
  // value is typed as Procedure
  const result = await value.handler(input, context);
}

// Assertion
assertProcedure(value); // Throws if invalid
// value is now typed as Procedure

// Detailed validation
const validation = validateProcedure(value);
if (!validation.valid) {
  console.error("Validation errors:", validation.errors);
}
```

### Metadata Type Guards

```typescript
import { hasProcedureMetadata, hasRole, hasExposure } from "@c4c/core";

if (hasProcedureMetadata(procedure, "auth")) {
  // procedure.contract.metadata.auth exists
  const auth = procedure.contract.metadata.auth;
}

if (hasRole(procedure, "trigger")) {
  // Procedure has trigger role
}

if (hasExposure(procedure, "external")) {
  // Procedure is externally exposed
}
```

## Best Practices

### 1. Always Define Metadata Types

```typescript
// ✅ Good: Explicit metadata type
interface MyMetadata extends BaseMetadata {
  tenantId: string;
  userId: string;
}

const handler = async (
  input: Input,
  context: ExecutionContext<MyMetadata>
) => { /* ... */ };

// ❌ Bad: Using unknown metadata
const handler = async (
  input: Input,
  context: ExecutionContext
) => {
  const tenantId = context.metadata.tenantId; // No type safety
};
```

### 2. Use Module Augmentation for Registry

```typescript
// ✅ Good: Augment globally
declare module "@c4c/core" {
  interface ProcedureTypeMap {
    "users.create": Procedure<UserInput, UserOutput>;
  }
}

// ❌ Bad: Type assertions everywhere
const proc = registry.get("users.create") as Procedure<UserInput, UserOutput>;
```

### 3. Validate Workflows

```typescript
// ✅ Good: Validate before deployment
const validation = validateWorkflowTypes(workflow, registry);
if (!validation.valid) {
  throw new Error("Invalid workflow");
}

// ❌ Bad: Hope for the best at runtime
executeWorkflow(workflow, registry, input);
```

### 4. Use Type Guards

```typescript
// ✅ Good: Validate unknown data
if (isProcedure(exportedValue)) {
  registry.set(name, exportedValue);
}

// ❌ Bad: Assume structure
registry.set(name, exportedValue as Procedure);
```

## Examples

See full examples in:
- `/examples/typed-registry-example.ts`
- `/examples/typed-workflow-example.ts`
- `/examples/typed-policies-example.ts`

## Migration Guide

### From Generic Context to Typed Context

Before:
```typescript
const handler = async (input, context: ExecutionContext) => {
  const userId = context.metadata.userId as string; // Type assertion
};
```

After:
```typescript
interface MyMetadata extends BaseMetadata {
  userId: string;
}

const handler = async (input, context: ExecutionContext<MyMetadata>) => {
  const userId = context.metadata.userId; // Type-safe!
};
```

### From Map to TypedRegistry

Before:
```typescript
const registry = new Map<string, Procedure>();
const proc = registry.get("math.add"); // Type: Procedure | undefined
```

After:
```typescript
declare module "@c4c/core" {
  interface ProcedureTypeMap {
    "math.add": Procedure<AddInput, AddOutput>;
  }
}

const registry = createTypedRegistry();
const proc = registry.get("math.add"); // Type: Procedure<AddInput, AddOutput>
```
