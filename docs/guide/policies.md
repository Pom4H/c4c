# Policies

Policies are composable functions that add cross-cutting concerns to procedures.

## Overview

Policies wrap handlers to add functionality like:

- Retry logic
- Logging
- Authentication
- Rate limiting
- Tracing

## Using Policies

Apply policies with `applyPolicies`:

```typescript
import { applyPolicies } from "@c4c/core";
import { withRetry, withLogging } from "@c4c/policies";

export const myProcedure: Procedure = {
  contract: { ... },
  handler: applyPolicies(
    async (input) => { /* business logic */ },
    withLogging("myProcedure"),
    withRetry({ maxAttempts: 3 })
  ),
};
```

## Available Policies

### withRetry

Retry failed operations:

```typescript
import { withRetry } from "@c4c/policies";

withRetry({
  maxAttempts: 3,
  delayMs: 100,
  backoffMultiplier: 2
})
```

### withLogging

Log execution:

```typescript
import { withLogging } from "@c4c/policies";

withLogging("procedureName")
```

### withAuth

Authenticate requests:

```typescript
import { withAuth } from "@c4c/policies";

withAuth({
  requiredRoles: ["admin"]
})
```

### withRateLimit

Rate limit requests:

```typescript
import { withRateLimit } from "@c4c/policies";

withRateLimit({
  maxTokens: 100,
  windowMs: 60000
})
```

## Creating Custom Policies

Define your own policies:

```typescript
import type { Policy } from "@c4c/core";

export function myPolicy(options: MyOptions): Policy {
  return (handler) => async (input, context) => {
    // Pre-processing
    const result = await handler(input, context);
    // Post-processing
    return result;
  };
}
```

## Policy Composition

Policies are applied right-to-left:

```typescript
const handler = applyPolicies(
  baseHandler,
  policy3,  // Outer
  policy2,  // Middle
  policy1   // Inner
);
```

## Next Steps

- [View @c4c/policies Documentation](/packages/policies)
- [Learn about Authentication](/guide/authentication)
- [Explore Examples](/examples/basic)
