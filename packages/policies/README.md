# @c4c/policies

Composable policy functions for procedures: retry, logging, tracing, rate limiting, and authentication.

## Installation

```bash
pnpm add @c4c/policies
```

## Overview

Policies are higher-order functions that wrap handlers to add cross-cutting concerns:

```typescript
import { applyPolicies } from "@c4c/core";
import { withRetry, withLogging, withAuth } from "@c4c/policies";

export const myProcedure: Procedure = {
  contract: myContract,
  handler: applyPolicies(
    async (input, context) => {
      // Your business logic
    },
    withLogging("myProcedure"),
    withRetry({ maxAttempts: 3 }),
    withAuth({ requiredRoles: ["admin"] })
  ),
};
```

## Available Policies

### withRetry

Retry failed operations with exponential backoff:

```typescript
import { withRetry } from "@c4c/policies";

withRetry({
  maxAttempts: 3,        // Default: 3
  delayMs: 100,          // Default: 100ms
  backoffMultiplier: 2,  // Default: 2 (exponential)
});
```

**Example:**
```typescript
handler: applyPolicies(
  async (input) => {
    // May throw transient errors
    return await callExternalAPI(input);
  },
  withRetry({ maxAttempts: 5, delayMs: 200 })
)
```

### withLogging

Log procedure execution with timing:

```typescript
import { withLogging } from "@c4c/policies";

withLogging("procedureName");
```

**Output:**
```
[myProcedure] Starting execution { requestId: '123', timestamp: '...' }
[myProcedure] Completed successfully { requestId: '123', durationMs: '45.32' }
```

**Example:**
```typescript
handler: applyPolicies(
  async (input) => { /* ... */ },
  withLogging("users.create")
)
```

### withSpan

Create OpenTelemetry spans for distributed tracing:

```typescript
import { withSpan } from "@c4c/policies";

withSpan("procedureName");
```

**Example:**
```typescript
handler: applyPolicies(
  async (input) => { /* ... */ },
  withSpan("users.create")
)
```

**Span attributes:**
- `procedure.name`: Procedure name
- `request.id`: Request ID
- `input`: Stringified input
- `output`: Stringified output
- Status: OK/ERROR

### withRateLimit

Rate limit procedure calls (token bucket algorithm):

```typescript
import { withRateLimit } from "@c4c/policies";

withRateLimit({
  maxTokens: 10,       // Maximum tokens
  windowMs: 60000,     // Time window (1 minute)
  refillRate: 1,       // Tokens added per interval
});
```

**Example:**
```typescript
handler: applyPolicies(
  async (input) => { /* ... */ },
  withRateLimit({ maxTokens: 100, windowMs: 60000 })
)
```

### withOAuth

Add OAuth2 authentication headers:

```typescript
import { withOAuth } from "@c4c/policies";

withOAuth({
  provider: "github",
  headerName: "Authorization",   // Default
  scheme: "Bearer",              // Default
  envVar: "GITHUB_TOKEN",        // Fallback to env var
  tokenProvider: async (context) => {
    // Dynamic token retrieval
    return await getToken();
  },
});
```

**Example:**
```typescript
handler: applyPolicies(
  async (input) => {
    // OAuth headers automatically added
    return await fetch("https://api.github.com/user");
  },
  withOAuth({
    provider: "github",
    envVar: "GITHUB_TOKEN"
  })
)
```

**Helpers:**
```typescript
import { getOAuthHeaders, getOAuthToken } from "@c4c/policies";

// In handler
const headers = getOAuthHeaders(context, "github");
// → { "Authorization": "Bearer <token>" }

const token = getOAuthToken(context, "github");
// → "<token>"
```

## Authentication & Authorization

### withAuth

Validate authentication and authorization from execution context:

```typescript
import { withAuth } from "@c4c/policies";

withAuth({
  metadataKey: "auth",              // Context key (default: "auth")
  requiredFields: ["userId"],       // Required auth fields
  requiredRoles: ["admin"],         // Required roles (any of)
  requiredPermissions: ["write"],   // Required permissions (all of)
  allowAnonymous: false,            // Allow unauthenticated? (default: false)
  authorize: async (authData, context) => {
    // Custom authorization logic
    return authData.userId === context.metadata.targetUserId;
  },
  unauthorizedMessage: "Custom error message",
});
```

**Example:**
```typescript
handler: applyPolicies(
  async (input, context) => {
    const userId = context.metadata.userId; // Set by withAuth
    return await loadProfile(userId);
  },
  withAuth({ requiredFields: ["userId"] })
)
```

### Convenience Functions

**withAuthRequired** - Require any authenticated user:

```typescript
import { withAuthRequired } from "@c4c/policies";

handler: applyPolicies(
  async (input) => { /* ... */ },
  withAuthRequired()
)
```

**withRole** - Require specific role(s):

```typescript
import { withRole } from "@c4c/policies";

// Single role
withRole("admin")

// Multiple roles (any of)
withRole(["admin", "moderator"])
```

**withPermission** - Require specific permission(s):

```typescript
import { withPermission } from "@c4c/policies";

// Single permission
withPermission("write:users")

// Multiple permissions (all required)
withPermission(["read:users", "write:users"])
```

### Helper Functions

**getAuthData** - Extract auth data from context:

```typescript
import { getAuthData } from "@c4c/policies";

const authData = getAuthData(context);
// → { userId: "123", roles: ["admin"], ... }
```

**getUserId** - Get user ID from auth data:

```typescript
import { getUserId } from "@c4c/policies";

const userId = getUserId(context);
// → "123"
```

**hasRole** - Check if user has a role:

```typescript
import { hasRole } from "@c4c/policies";

if (hasRole(context, "admin")) {
  // User is admin
}
```

**hasPermission** - Check if user has a permission:

```typescript
import { hasPermission } from "@c4c/policies";

if (hasPermission(context, "write:users")) {
  // User can write users
}
```

**hasAnyRole** - Check if user has any of the roles:

```typescript
import { hasAnyRole } from "@c4c/policies";

if (hasAnyRole(context, ["admin", "moderator"])) {
  // User is admin OR moderator
}
```

**hasAllRoles** - Check if user has all roles:

```typescript
import { hasAllRoles } from "@c4c/policies";

if (hasAllRoles(context, ["user", "premium"])) {
  // User has both roles
}
```

### Auth Data Structure

Expected structure in `context.metadata.auth`:

```typescript
interface AuthData {
  userId: string;
  username?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  token?: string;
  expiresAt?: Date | string;
  [key: string]: unknown;
}
```

### Creating Auth Procedures

**requireAuth** - Add auth metadata to contract:

```typescript
import { requireAuth } from "@c4c/policies";

const contract = requireAuth(baseContract, {
  requiredRoles: ["admin"],
  requiredPermissions: ["delete:users"],
  authScheme: "Bearer",
});
```

This adds metadata for client generation:

```typescript
contract.metadata.auth = {
  requiresAuth: true,
  requiredRoles: ["admin"],
  requiredPermissions: ["delete:users"],
  authScheme: "Bearer",
};
```

**createAuthProcedure** - Create procedure with auth (metadata + policy):

```typescript
import { createAuthProcedure } from "@c4c/policies";

export const deleteUser = createAuthProcedure({
  contract: {
    name: "deleteUser",
    description: "Delete user",
    input: z.object({ userId: z.string() }),
    output: z.object({ success: z.boolean() }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
    },
  },
  handler: async (input) => {
    // Only admins can execute this
    return { success: true };
  },
  auth: {
    requiredRoles: ["admin"],
  },
});
```

This:
1. Adds auth metadata to contract (for client generation)
2. Applies appropriate auth policy to handler
3. Returns ready-to-use procedure

## Policy Composition

Policies are applied **right to left** (innermost to outermost):

```typescript
const handler = applyPolicies(
  baseHandler,
  withLogging,    // 3. Outer (logs start/end)
  withSpan,       // 2. Middle (creates span)
  withRetry       // 1. Inner (retries failures)
);
```

**Execution flow:**
```
withLogging → start
  withSpan → start span
    withRetry → attempt 1
      baseHandler → execute
    withRetry → attempt 2 (if failed)
      baseHandler → execute
  withSpan → end span
withLogging → log duration
```

## Custom Policies

Create your own policies:

```typescript
import type { Policy } from "@c4c/core";

export function withCache(ttl: number): Policy {
  const cache = new Map();
  
  return (handler) => {
    return async (input, context) => {
      const key = JSON.stringify(input);
      
      // Check cache
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      // Execute and cache
      const result = await handler(input, context);
      cache.set(key, result);
      
      // Expire after TTL
      setTimeout(() => cache.delete(key), ttl);
      
      return result;
    };
  };
}
```

**Usage:**
```typescript
handler: applyPolicies(
  async (input) => { /* ... */ },
  withCache(60000) // Cache for 1 minute
)
```

## Examples

### Complete Example

```typescript
import { applyPolicies } from "@c4c/core";
import { 
  withLogging, 
  withRetry, 
  withSpan, 
  withRateLimit,
  withAuth
} from "@c4c/policies";

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
  },
  handler: applyPolicies(
    async (input, context) => {
      // Business logic
      const user = await db.users.create(input);
      return user;
    },
    withLogging("users.create"),
    withSpan("users.create"),
    withRetry({ maxAttempts: 3 }),
    withRateLimit({ maxTokens: 10, windowMs: 60000 }),
    withAuth({ requiredPermissions: ["create:users"] })
  ),
};
```

### Auth Procedure Example

```typescript
import { createAuthProcedure } from "@c4c/policies";

export const deleteUser = createAuthProcedure({
  contract: {
    name: "deleteUser",
    description: "Delete user - requires admin role",
    input: z.object({ userId: z.string() }),
    output: z.object({ success: z.boolean() }),
    metadata: {
      exposure: "external",
      roles: ["api-endpoint", "sdk-client"],
    },
  },
  handler: async (input) => {
    await db.users.delete(input.userId);
    return { success: true };
  },
  auth: {
    requiredRoles: ["admin"],
  },
});
```

## TypeScript

All policies are fully typed:

```typescript
import type { Policy, Handler } from "@c4c/core";

export function withMyPolicy<TInput, TOutput>(
  handler: Handler<TInput, TOutput>
): Handler<TInput, TOutput> {
  return async (input: TInput, context) => {
    // Your logic
    return await handler(input, context);
  };
}
```

## See Also

- [@c4c/core](../core) - Core types and execution
- [@c4c/adapters](../adapters) - HTTP/REST/CLI adapters
- [@c4c/generators](../generators) - Client generation
- [Examples](../../examples/basic) - Complete examples
