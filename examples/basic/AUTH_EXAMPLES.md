# Authentication & Authorization Examples

This directory contains complete examples of implementing authentication and authorization in c4c procedures and using generated clients with auth.

## Files Overview

### Handlers (Server-Side)

#### `src/handlers/auth-example.ts`
Complete examples showing different auth patterns:
- **`getUserProfile`** - Simple authentication requirement
- **`updateUserProfile`** - Permission-based access control
- **`deleteUser`** - Role-based access control (admin only)
- **`listUsers`** - Multiple roles (moderator or admin)
- **`customAuthExample`** - Custom authorization logic

#### `src/handlers/auth-simplified-example.ts`
Simplified examples using `createAuthProcedure` helper:
- **`getMyProfile`** - Basic authenticated procedure
- **`getAdminDashboard`** - Admin role required
- **`exportUserData`** - Permission-based
- **`moderateContent`** - Multiple roles
- **`updateSettings`** - Custom authorization with ownership checks

### Usage Examples

#### `src/auth-usage-example.ts`
Server-side examples showing:
- Creating auth context
- Authenticated vs unauthenticated requests
- Role validation
- Permission validation
- Token expiration
- Admin access scenarios

#### `src/client-auth-example.ts`
Client-side examples demonstrating:
- Static auth tokens
- Dynamic token retrieval
- React integration
- Backend service usage
- Error handling

### Scripts

#### `scripts/generate-client-demo.ts`
Demo script showing:
- Client generation from registry
- Auth metadata embedding
- Preview of generated code

## Quick Start

### 1. Define Protected Procedure

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
    // Your business logic
    return { success: true };
  },
  auth: {
    requiredRoles: ["admin"],
  },
});
```

### 2. Generate Client

```bash
pnpm tsx scripts/generate-client-demo.ts
```

Or programmatically:

```typescript
import { generateRpcClientModule } from "@c4c/generators";
import { collectRegistry } from "@c4c/core";

const registry = await collectRegistry("src/handlers");
const clientCode = generateRpcClientModule(registry);
```

### 3. Use Generated Client

```typescript
import { createTsdevClient } from "./generated/client";

const client = createTsdevClient({
  baseUrl: "http://localhost:3000",
  authToken: "your-jwt-token",
});

// Auth header added automatically
await client.procedures.deleteUser({ userId: "123" });
```

## Authentication Patterns

### 1. Simple Authentication

Any authenticated user can access:

```typescript
export const getMyProfile = createAuthProcedure({
  contract: myProfileContract,
  handler: async (input, context) => {
    const userId = context.metadata.userId;
    return await loadProfile(userId);
  },
  auth: {}, // No specific roles/permissions
});
```

### 2. Role-Based Access Control (RBAC)

Only users with specific roles:

```typescript
export const deleteUser = createAuthProcedure({
  contract: deleteUserContract,
  handler: async (input) => {
    return await deleteUserFromDB(input.userId);
  },
  auth: {
    requiredRoles: ["admin"],
  },
});
```

Multiple roles (any of):

```typescript
export const moderateContent = createAuthProcedure({
  contract: moderateContract,
  handler: async (input) => {
    return await moderate(input.contentId, input.action);
  },
  auth: {
    requiredRoles: ["moderator", "admin"],
  },
});
```

### 3. Permission-Based Access Control

Specific permissions required:

```typescript
export const exportUserData = createAuthProcedure({
  contract: exportContract,
  handler: async (input) => {
    return await generateExport(input.format);
  },
  auth: {
    requiredPermissions: ["export:users"],
  },
});
```

### 4. Custom Authorization Logic

Complex authorization rules:

```typescript
export const updateSettings = createAuthProcedure({
  contract: settingsContract,
  handler: async (input) => {
    return await updateUserSettings(input.userId, input.settings);
  },
  auth: {
    authorize: async (authData, context) => {
      const requestingUserId = authData.userId;
      const targetUserId = (context.metadata.input as any)?.userId;
      
      // Allow if updating own settings
      if (requestingUserId === targetUserId) {
        return true;
      }
      
      // Or if user is admin
      return authData.roles?.includes("admin") ?? false;
    },
  },
});
```

## Auth Data Structure

The auth policy expects this structure in `context.metadata.auth`:

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

## HTTP Integration

### Setting Auth Context (Server)

The HTTP adapter automatically extracts auth from headers:

```typescript
// RPC/REST adapters extract auth from:
// - Authorization: Bearer <token>
// - Authorization: Basic <encoded>
// - X-API-Key: <key>

// In production, decode JWT and extract claims:
const authData = {
  userId: decoded.sub,
  username: decoded.username,
  email: decoded.email,
  roles: decoded.roles,
  permissions: decoded.permissions,
  token: token,
  expiresAt: new Date(decoded.exp * 1000),
};
```

### Client Requests

```bash
# Protected procedure
curl -X POST http://localhost:3000/rpc/deleteUser \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"userId":"123"}'

# Public procedure
curl -X POST http://localhost:3000/rpc/add \
  -H "Content-Type: application/json" \
  -d '{"a":1,"b":2}'
```

## Generated Client Features

### Static Token

```typescript
const client = createTsdevClient({
  baseUrl: "http://localhost:3000",
  authToken: "static-jwt-token",
});

// Token automatically added to protected procedures
await client.procedures.deleteUser({ userId: "123" });
```

### Dynamic Token

```typescript
const client = createTsdevClient({
  baseUrl: "http://localhost:3000",
  getAuthToken: async () => {
    // Fetch from storage
    let token = localStorage.getItem("authToken");
    
    // Refresh if expired
    if (isExpired(token)) {
      token = await refreshToken();
      localStorage.setItem("authToken", token);
    }
    
    return token;
  },
});

// getAuthToken() called automatically for protected procedures
await client.procedures.deleteUser({ userId: "123" });
```

### React Integration

```typescript
import { useMemo } from "react";
import { createTsdevClient } from "./generated/client";
import { useAuth } from "./hooks/useAuth";

function useApiClient() {
  const { token } = useAuth();
  
  return useMemo(
    () => createTsdevClient({
      baseUrl: import.meta.env.VITE_API_URL,
      authToken: token,
    }),
    [token]
  );
}

function MyComponent() {
  const client = useApiClient();
  
  const handleDelete = async () => {
    try {
      await client.procedures.deleteUser({ userId: "123" });
    } catch (error) {
      if (error.message.includes("401")) {
        // Handle unauthorized
      }
    }
  };
  
  return <button onClick={handleDelete}>Delete</button>;
}
```

## Testing Protected Procedures

### Unit Tests

```typescript
import { createExecutionContext } from "@c4c/core";
import { deleteUser } from "./handlers/auth-example";

test("deleteUser requires admin role", async () => {
  const context = createExecutionContext();
  
  // No auth data
  await expect(
    deleteUser.handler({ userId: "123" }, context)
  ).rejects.toThrow("Unauthorized");
  
  // With admin role
  context.metadata.auth = {
    userId: "admin-user",
    roles: ["admin"],
  };
  
  const result = await deleteUser.handler({ userId: "123" }, context);
  expect(result.success).toBe(true);
});
```

### Integration Tests

```typescript
import { createTsdevClient } from "./generated/client";

test("client adds auth header to protected procedures", async () => {
  const client = createTsdevClient({
    baseUrl: "http://localhost:3000",
    authToken: "test-token",
  });
  
  // Mock fetch to inspect headers
  global.fetch = jest.fn((url, options) => {
    if (url.includes("deleteUser")) {
      expect(options.headers["Authorization"]).toBe("Bearer test-token");
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });
  
  await client.procedures.deleteUser({ userId: "123" });
});
```

## Common Patterns

### API Gateway Pattern

```typescript
// Gateway extracts user from token and adds to context
app.use(async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    try {
      const decoded = jwt.verify(token, SECRET);
      req.authData = {
        userId: decoded.sub,
        roles: decoded.roles,
        permissions: decoded.permissions,
      };
    } catch (error) {
      // Invalid token
    }
  }
  next();
});

// RPC handler uses extracted auth
router.post("/rpc/:name", async (req, res) => {
  const context = createExecutionContext({
    auth: req.authData, // From middleware
  });
  
  const result = await executeProcedure(procedure, input, context);
  res.json(result);
});
```

### Service-to-Service Auth

```typescript
// Backend service authenticating to another service
const client = createTsdevClient({
  baseUrl: "http://internal-api:3000",
  getAuthToken: async () => {
    // Use service account token
    return process.env.SERVICE_ACCOUNT_TOKEN;
  },
});

// Or OAuth client credentials flow
const client = createTsdevClient({
  baseUrl: "http://api.example.com",
  getAuthToken: async () => {
    const response = await fetch("https://auth.example.com/oauth/token", {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
      }),
    });
    const data = await response.json();
    return data.access_token;
  },
});
```

## Error Handling

### Server-Side

```typescript
try {
  const result = await executeProcedure(procedure, input, context);
  return result;
} catch (error) {
  if (error.message.includes("Unauthorized")) {
    return { statusCode: 401, error: "Authentication required" };
  }
  if (error.message.includes("Forbidden")) {
    return { statusCode: 403, error: "Insufficient permissions" };
  }
  return { statusCode: 400, error: error.message };
}
```

### Client-Side

```typescript
try {
  const result = await client.procedures.deleteUser({ userId: "123" });
} catch (error) {
  if (error.message.includes("401")) {
    // Redirect to login
    window.location.href = "/login";
  } else if (error.message.includes("403")) {
    // Show permission denied message
    alert("You don't have permission to perform this action");
  } else {
    // Generic error
    console.error("Operation failed:", error);
  }
}
```

## Best Practices

1. **Always use HTTPS in production** - Protect tokens in transit
2. **Set token expiration** - Short-lived tokens (15min) with refresh
3. **Validate on server** - Never trust client-side validation
4. **Log auth failures** - Monitor for suspicious activity
5. **Use specific permissions** - Prefer permissions over roles when possible
6. **Test auth logic** - Unit test authorization rules
7. **Rotate secrets** - Regular rotation of signing keys
8. **Rate limit** - Prevent brute force attacks
9. **Audit trail** - Log who did what and when
10. **Graceful degradation** - Handle missing/expired tokens gracefully

## Resources

- **Main docs**: See [README.md](../../README.md) for overview
- **Architecture**: See [ARCHITECTURE.md](../../ARCHITECTURE.md) for implementation details
- **Auth policy source**: `packages/policies/src/withAuth.ts`
- **Client generator**: `packages/generators/src/client.ts`
- **HTTP adapter**: `packages/adapters/src/rpc.ts`
