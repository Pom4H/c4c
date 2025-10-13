# REST API & OpenAPI Generation

One of tsdev's most powerful features: **automatic REST API and OpenAPI spec generation** from contracts.

## 🎯 The Magic

Define a contract **once**, get **three interfaces automatically**:

1. **RPC Endpoint** - `POST /rpc/users.create`
2. **REST Endpoint** - `POST /users`
3. **OpenAPI Spec** - Auto-generated documentation

No additional code required!

---

## 📝 OpenAPI Schema Generation

### Access the OpenAPI Specification

```bash
# Get OpenAPI JSON
curl http://localhost:3000/openapi.json

# View in browser with Swagger UI
open http://localhost:3000/docs
```

### Features

The OpenAPI generator automatically:
- ✅ Converts Zod schemas to JSON Schema
- ✅ Generates both RPC and REST endpoints
- ✅ Includes request/response schemas
- ✅ Adds error responses (400, 404, 500)
- ✅ Extracts tags from contract metadata
- ✅ Uses contract descriptions

### Example

Given this contract:

```typescript
export const createUserContract: Contract = {
  name: "users.create",
  description: "Create a new user",
  input: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: z.string(),
  }),
  metadata: {
    tags: ["users", "write"],
  },
};
```

OpenAPI generates:

```json
{
  "paths": {
    "/rpc/users.create": {
      "post": {
        "operationId": "users.create",
        "summary": "Create a new user",
        "tags": ["users", "write"],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "name": { "type": "string", "minLength": 1 },
                  "email": { "type": "string", "format": "email" }
                },
                "required": ["name", "email"]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "id": { "type": "string" },
                    "name": { "type": "string" },
                    "email": { "type": "string" },
                    "createdAt": { "type": "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/users": {
      "post": { /* REST endpoint */ }
    }
  }
}
```

---

## 🌐 REST API Generation

### Convention-Based Routes

tsdev automatically maps procedure names to REST routes:

| Procedure Name | HTTP Method | REST Route | Description |
|----------------|-------------|------------|-------------|
| `users.create` | POST | `/users` | Create a resource |
| `users.list` | GET | `/users` | List resources |
| `users.get` | GET | `/users/:id` | Get a specific resource |
| `users.update` | PUT | `/users/:id` | Update a resource |
| `users.delete` | DELETE | `/users/:id` | Delete a resource |

### How It Works

The REST adapter:

1. **Parses the procedure name** - `resource.action`
2. **Maps to HTTP method** - Based on action (create → POST, list → GET, etc.)
3. **Constructs the path** - `/:resource` or `/:resource/:id`
4. **Extracts parameters** - Path params, query params, body
5. **Calls the same handler** - No duplicate code!

### Examples

#### Create User (POST)

```bash
# REST
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'

# RPC (same handler!)
curl -X POST http://localhost:3000/rpc/users.create \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

#### List Users (GET)

```bash
# REST with query params
curl "http://localhost:3000/users?limit=10&offset=0"

# RPC
curl -X POST http://localhost:3000/rpc/users.list \
  -d '{"limit": 10, "offset": 0}'
```

#### Get User (GET)

```bash
# REST with path param
curl http://localhost:3000/users/550e8400-e29b-41d4-a716-446655440000

# RPC
curl -X POST http://localhost:3000/rpc/users.get \
  -d '{"id": "550e8400-e29b-41d4-a716-446655440000"}'
```

---

## 🔍 Introspection Endpoints

### List All Procedures

```bash
curl http://localhost:3000/procedures
```

Returns:
```json
{
  "procedures": [
    {
      "name": "users.create",
      "description": "Create a new user",
      "metadata": { "tags": ["users", "write"] }
    },
    ...
  ]
}
```

### List All REST Routes

```bash
curl http://localhost:3000/routes
```

Returns:
```json
{
  "routes": [
    {
      "method": "POST",
      "path": "/users",
      "procedure": "users.create"
    },
    {
      "method": "GET",
      "path": "/users",
      "procedure": "users.list"
    },
    {
      "method": "GET",
      "path": "/users/:id",
      "procedure": "users.get"
    }
  ]
}
```

---

## 🎨 Swagger UI

Visual API documentation at `http://localhost:3000/docs`

Features:
- 📖 Browse all endpoints
- 🧪 Try API calls directly in browser
- 📋 Copy curl commands
- 📝 See request/response schemas
- 🏷️ Filter by tags

---

## 🚀 Complete Example

### 1. Define Contract

```typescript
// src/contracts/posts.ts
export const createPostContract: Contract = {
  name: "posts.create",
  description: "Create a new blog post",
  input: z.object({
    title: z.string().min(1).max(200),
    content: z.string(),
    authorId: z.string().uuid(),
  }),
  output: z.object({
    id: z.string().uuid(),
    title: z.string(),
    content: z.string(),
    authorId: z.string(),
    createdAt: z.string(),
  }),
  metadata: {
    tags: ["posts", "write"],
  },
};
```

### 2. Implement Handler

```typescript
// src/handlers/posts.ts
export const createPost: Procedure = {
  contract: createPostContract,
  handler: applyPolicies(
    async (input, context) => {
      return {
        id: crypto.randomUUID(),
        ...input,
        createdAt: new Date().toISOString(),
      };
    },
    withLogging("posts.create"),
    withSpan("posts.create")
  ),
};
```

### 3. It's Automatically Available!

```bash
# RPC Endpoint
curl -X POST http://localhost:3000/rpc/posts.create \
  -d '{"title": "Hello", "content": "World", "authorId": "..."}'

# REST Endpoint (auto-generated!)
curl -X POST http://localhost:3000/posts \
  -d '{"title": "Hello", "content": "World", "authorId": "..."}'

# OpenAPI Spec (auto-generated!)
curl http://localhost:3000/openapi.json | jq '.paths."/posts"'

# Swagger UI (auto-generated!)
open http://localhost:3000/docs
```

---

## 🎯 Benefits

### Single Source of Truth

```typescript
// Write this ONCE
const contract: Contract = {
  name: "users.create",
  input: z.object({ ... }),
  output: z.object({ ... }),
};

// Get ALL of this automatically:
// ✅ RPC endpoint
// ✅ REST endpoint
// ✅ OpenAPI schema
// ✅ TypeScript types
// ✅ Runtime validation
// ✅ Swagger UI
// ✅ API documentation
```

### No Code Duplication

Traditional approach:
```typescript
// Define route
app.post('/users', ...)

// Define OpenAPI manually
openapi.paths['/users'] = { ... }

// Define types separately
interface CreateUserRequest { ... }
interface CreateUserResponse { ... }

// Validate manually
const { error } = schema.validate(...)
```

tsdev approach:
```typescript
// Define contract (that's it!)
const contract: Contract = { ... }
```

### Always In Sync

- Schema changes → OpenAPI updates automatically
- No manual documentation updates
- No drift between code and docs
- Types and runtime validation always match

---

## 🔧 Advanced Usage

### Custom OpenAPI Options

```typescript
import { generateOpenAPISpec } from "./generators/openapi.js";

const spec = generateOpenAPISpec(registry, {
  title: "My API",
  version: "2.0.0",
  description: "Custom description",
  servers: [
    { url: "https://api.example.com", description: "Production" },
    { url: "http://localhost:3000", description: "Development" },
  ],
});
```

### Export OpenAPI to File

```typescript
import { generateOpenAPIJSON } from "./generators/openapi.js";
import { writeFileSync } from "fs";

const spec = generateOpenAPIJSON(registry, options);
writeFileSync("openapi.json", spec);
```

### Generate Client SDKs

Use the OpenAPI spec to generate clients:

```bash
# Generate TypeScript client
npx openapi-generator-cli generate \
  -i http://localhost:3000/openapi.json \
  -g typescript-axios \
  -o ./client

# Generate Python client
npx openapi-generator-cli generate \
  -i http://localhost:3000/openapi.json \
  -g python \
  -o ./client-python
```

---

## 📊 Comparison

| Feature | Manual | tsdev |
|---------|--------|-------|
| REST endpoints | Write routes manually | Auto-generated from contracts |
| OpenAPI spec | Write/maintain separately | Auto-generated from Zod schemas |
| API docs | Update manually | Always in sync |
| Type safety | Separate type definitions | Inferred from contracts |
| Validation | Manual validation code | Automatic Zod validation |
| Consistency | Manual synchronization | Guaranteed by design |

---

## 🎉 Summary

**Write a contract once:**
```typescript
const contract: Contract = {
  name: "users.create",
  input: z.object({ name: z.string(), email: z.string().email() }),
  output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
};
```

**Get everything automatically:**
- ✅ RPC endpoint: `POST /rpc/users.create`
- ✅ REST endpoint: `POST /users`
- ✅ OpenAPI schema
- ✅ Swagger UI
- ✅ Type safety
- ✅ Runtime validation
- ✅ Documentation

**That's the power of contracts-first!** 🚀
