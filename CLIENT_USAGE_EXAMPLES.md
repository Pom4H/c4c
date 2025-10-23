# Client Usage Examples

## Generate Client

```bash
c4c generate client --out ./client.ts
```

This generates a fully typed client from your procedures.

---

## Basic Usage

```typescript
import { createClient } from "./client";

// Create client instance
const client = createClient({ 
  baseUrl: "http://localhost:3000" 
});

// Call procedures directly
const user = await client.createUser({
  name: "Alice",
  email: "alice@example.com"
});
```

---

## Naming Convention

The generated client converts procedure names to camelCase:

| Procedure Name | Client Method |
|---------------|---------------|
| `createUser` | `client.createUser()` |
| `users.create` | `client.usersCreate()` |
| `users.v2.get` | `client.usersV2Get()` |
| `math.add` | `client.mathAdd()` |

---

## With Authentication

```typescript
import { createClient } from "./client";

// Static token
const client = createClient({ 
  baseUrl: "http://localhost:3000",
  authToken: "your-jwt-token"
});

// Dynamic token (refreshes automatically)
const client = createClient({ 
  baseUrl: "http://localhost:3000",
  getAuthToken: async () => {
    const token = localStorage.getItem("token");
    if (isExpired(token)) {
      return await refreshToken();
    }
    return token;
  }
});

// Protected procedures automatically include auth header
await client.deleteUser({ userId: "123" });
```

---

## Error Handling

```typescript
import { createClient } from "./client";

const client = createClient({ 
  baseUrl: "http://localhost:3000" 
});

try {
  const user = await client.createUser({
    name: "Alice",
    email: "invalid-email"
  });
} catch (error) {
  console.error("Failed to create user:", error.message);
  // "RPC request to createUser failed — 400 Bad Request: Invalid email format"
}
```

---

## Custom Fetch Options

```typescript
import { createClient } from "./client";

const client = createClient({ 
  baseUrl: "http://localhost:3000",
  headers: {
    "X-Custom-Header": "value"
  },
  fetch: customFetchImplementation
});
```

---

## Example: Complete Flow

```typescript
import { createClient } from "./client";

// Setup client
const client = createClient({ 
  baseUrl: process.env.API_BASE_URL || "http://localhost:3000",
  authToken: process.env.API_TOKEN
});

// Create user
const user = await client.createUser({
  name: "Alice",
  email: "alice@example.com"
});

console.log("Created user:", user.id);

// Get user
const fetchedUser = await client.getUser({
  id: user.id
});

console.log("Fetched user:", fetchedUser);

// Update user
const updatedUser = await client.updateUser({
  id: user.id,
  name: "Alice Smith"
});

console.log("Updated user:", updatedUser);

// List users
const users = await client.listUsers({
  limit: 10,
  offset: 0
});

console.log("Total users:", users.total);

// Calculate something
const result = await client.mathAdd({
  a: 5,
  b: 3
});

console.log("5 + 3 =", result.result);
```

---

## TypeScript Support

The generated client is fully typed:

```typescript
import { createClient, type Client } from "./client";

const client = createClient({ baseUrl: "http://localhost:3000" });

// ✅ TypeScript knows all available methods
client.createUser({ 
  name: "Alice",  // ✅ Type-checked
  email: "alice@example.com"  // ✅ Type-checked
});

// ❌ TypeScript error: Property 'nonexistent' does not exist
client.nonexistent();

// ❌ TypeScript error: Argument of type '{ foo: string }' is not assignable
client.createUser({ foo: "bar" });

// ✅ Full autocomplete support in IDE
client. // <-- IDE shows all available methods
```

---

## Examples by Procedure Type

### Auto-named Procedures

```typescript
// Source: export const createUser: Procedure = { ... }
await client.createUser({ name: "Alice", email: "alice@example.com" });

// Source: export const validateEmail: Procedure = { ... }
await client.validateEmail({ email: "test@example.com" });
```

### Explicitly Named Procedures

```typescript
// Source: { contract: { name: "users.create" } }
await client.usersCreate({ name: "Alice", email: "alice@example.com" });

// Source: { contract: { name: "users.v2.get" } }
await client.usersV2Get({ id: "123" });

// Source: { contract: { name: "products.list" } }
await client.productsList({ limit: 10 });
```

---

## Integration with React

```typescript
import { createClient } from "./client";
import { useState, useEffect } from "react";

const client = createClient({ 
  baseUrl: "http://localhost:3000" 
});

function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const result = await client.listUsers({ limit: 50 });
        setUsers(result.items);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

---

## Summary

**Simple API:**
```typescript
const client = createClient({ baseUrl: "..." });
await client.createUser({ ... });
await client.getUser({ ... });
await client.mathAdd({ ... });
```

**Benefits:**
- ✅ Direct method calls (no `.procedures.` nesting)
- ✅ Full TypeScript support
- ✅ Automatic auth header injection
- ✅ Clean, predictable naming (camelCase)
- ✅ Error handling built-in
