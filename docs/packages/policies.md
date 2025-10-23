# @c4c/policies

Composable policies for authentication, retry, logging, rate limiting, and more.

## Installation

```bash
pnpm add @c4c/policies
```

## Overview

`@c4c/policies` provides:

- Retry with exponential backoff
- Structured logging
- OpenTelemetry spans
- Rate limiting
- OAuth authentication
- Role-based authorization

## Quick Example

```typescript
import { applyPolicies } from "@c4c/core";
import { withRetry, withLogging, withAuth } from "@c4c/policies";

export const myProcedure: Procedure = {
  contract: { ... },
  handler: applyPolicies(
    async (input) => { /* business logic */ },
    withLogging("myProcedure"),
    withRetry({ maxAttempts: 3 }),
    withAuth({ requiredRoles: ["admin"] })
  ),
};
```

## Available Policies

- `withRetry` - Retry failed operations
- `withLogging` - Log execution
- `withSpan` - OpenTelemetry tracing
- `withRateLimit` - Rate limiting
- `withOAuth` - OAuth authentication
- `withAuth` - Authorization
- `withAuthRequired` - Require authentication
- `withRole` - Require specific roles
- `withPermission` - Require permissions

## Next Steps

- [Learn about Policies](/guide/policies)
- [Set up Authentication](/guide/authentication)
- [View Examples](/examples/basic)
