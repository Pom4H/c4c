# Authentication

Add authentication and authorization to your procedures.

## Using Auth Policies

```typescript
import { createAuthProcedure } from "@c4c/policies";

export const deleteUser = createAuthProcedure({
  contract: {
    name: "deleteUser",
    input: z.object({ userId: z.string() }),
    output: z.object({ success: z.boolean() }),
  },
  handler: async (input) => {
    // Only authenticated users with admin role can access
    return { success: true };
  },
  auth: {
    requiredRoles: ["admin"]
  }
});
```

## Manual Auth

```typescript
import { withAuth } from "@c4c/policies";

export const myProcedure: Procedure = {
  contract: { ... },
  handler: applyPolicies(
    async (input, context) => { ... },
    withAuth({ requiredRoles: ["admin"] })
  ),
};
```

## Auth Context

Access auth data in handlers:

```typescript
import { getUserId } from "@c4c/policies";

handler: async (input, context) => {
  const userId = getUserId(context);
  // Use userId
}
```

## Generated Clients

Clients automatically add auth headers:

```typescript
const client = createClient({
  baseUrl: "http://localhost:3000",
  authToken: "your-jwt-token"
});

// Authorization header added automatically
await client.deleteUser({ userId: "123" });
```

## Next Steps

- [View @c4c/policies Documentation](/packages/policies)
- [Learn about Policies](/guide/policies)
- [Generate Clients](/guide/client-generation)
