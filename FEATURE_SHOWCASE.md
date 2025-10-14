# 🌟 tsdev Feature Showcase

## The Ultimate "Write Once" Example

Let's demonstrate the full power of tsdev with one complete example.

---

## Step 1: Write a Contract (Once!)

```typescript
// src/contracts/posts.ts
import { z } from "zod";
import type { Contract } from "../core/types.js";

export const createPostContract: Contract = {
  name: "posts.create",
  description: "Create a new blog post",
  input: z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
    authorId: z.string().uuid(),
    tags: z.array(z.string()).optional(),
  }),
  output: z.object({
    id: z.string().uuid(),
    title: z.string(),
    content: z.string(),
    authorId: z.string(),
    tags: z.array(z.string()),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  metadata: {
    tags: ["posts", "write"],
    rateLimit: { maxTokens: 5, refillRate: 1 },
  },
};
```

---

## Step 2: Write a Handler (Once!)

```typescript
// src/handlers/posts.ts
import { applyPolicies } from "../core/executor.js";
import type { Procedure } from "../core/types.js";
import { createPostContract } from "../contracts/posts.js";
import { withLogging, withSpan, withRateLimit } from "../policies/index.js";

export const createPost: Procedure = {
  contract: createPostContract,
  handler: applyPolicies(
    async (input, context) => {
      // Pure business logic - no transport knowledge!
      const now = new Date().toISOString();
      
      return {
        id: crypto.randomUUID(),
        title: input.title,
        content: input.content,
        authorId: input.authorId,
        tags: input.tags || [],
        createdAt: now,
        updatedAt: now,
      };
    },
    withLogging("posts.create"),
    withSpan("posts.create", { domain: "posts" }),
    withRateLimit({ maxTokens: 5, refillRate: 1 })
  ),
};
```

---

## Step 3: That's It! Now Get Everything...

### ✅ 1. RPC Endpoint (Auto-Generated)

```bash
curl -X POST http://localhost:3000/rpc/posts.create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Getting Started with tsdev",
    "content": "This framework is amazing!",
    "authorId": "550e8400-e29b-41d4-a716-446655440000",
    "tags": ["tutorial", "typescript"]
  }'
```

### ✅ 2. REST Endpoint (Auto-Generated)

```bash
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Getting Started with tsdev",
    "content": "This framework is amazing!",
    "authorId": "550e8400-e29b-41d4-a716-446655440000",
    "tags": ["tutorial", "typescript"]
  }'
```

### ✅ 3. CLI Interface (Auto-Generated)

```bash
npm run cli -- posts.create \
  --title "Getting Started with tsdev" \
  --content "This framework is amazing!" \
  --authorId "550e8400-e29b-41d4-a716-446655440000" \
  --tags '["tutorial", "typescript"]'
```

### ✅ 4. OpenAPI Specification (Auto-Generated)

```bash
curl http://localhost:3000/openapi.json
```

Returns complete OpenAPI spec:

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "tsdev API",
    "version": "1.0.0"
  },
  "paths": {
    "/rpc/posts.create": {
      "post": {
        "operationId": "posts.create",
        "summary": "Create a new blog post",
        "tags": ["posts", "write"],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "title": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 200
                  },
                  "content": {
                    "type": "string",
                    "minLength": 1
                  },
                  "authorId": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "tags": {
                    "type": "array",
                    "items": { "type": "string" }
                  }
                },
                "required": ["title", "content", "authorId"]
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
                    "id": { "type": "string", "format": "uuid" },
                    "title": { "type": "string" },
                    "content": { "type": "string" },
                    "authorId": { "type": "string" },
                    "tags": { "type": "array" },
                    "createdAt": { "type": "string" },
                    "updatedAt": { "type": "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/posts": {
      "post": { /* REST endpoint */ }
    }
  }
}
```

### ✅ 5. Swagger UI (Auto-Generated)

```bash
open http://localhost:3000/docs
```

Interactive documentation with:
- 📖 All endpoints listed
- 🧪 Try it out functionality
- 📋 Request/response examples
- 🔍 Schema validation info

### ✅ 6. TypeScript Types (Auto-Inferred)

```typescript
// Automatically inferred from Zod schemas!
type CreatePostInput = {
  title: string;
  content: string;
  authorId: string;
  tags?: string[];
};

type CreatePostOutput = {
  id: string;
  title: string;
  content: string;
  authorId: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};
```

### ✅ 7. Runtime Validation (Auto-Applied)

```bash
# Invalid input - automatically rejected!
curl -X POST http://localhost:3000/posts \
  -d '{
    "title": "",
    "content": "Test",
    "authorId": "not-a-uuid"
  }'

# Response:
# {
#   "error": "Validation failed: title must be at least 1 character, authorId must be a valid UUID"
# }
```

### ✅ 8. Observability (Built-In)

Every request automatically includes:
- OpenTelemetry spans
- Request ID tracking
- Business-level attributes (domain, resource, action)
- Error tracking
- Duration metrics

### ✅ 9. Rate Limiting (Composable Policy)

```bash
# Try this 10 times quickly...
for i in {1..10}; do
  curl -X POST http://localhost:3000/posts -d '{"title":"Test","content":"Test","authorId":"..."}'
done

# Response after limit:
# { "error": "Rate limit exceeded" }
```

### ✅ 10. Introspection (Self-Describing)

```bash
# List all procedures
curl http://localhost:3000/procedures

# List all REST routes
curl http://localhost:3000/routes

# Get OpenAPI spec
curl http://localhost:3000/openapi.json
```

---

## What You Get From One Contract

```
┌─────────────────────────────────────────────────────────────┐
│  Write Once: Contract + Handler                             │
│  (2 TypeScript objects)                                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
     ┌────────────┴───────────────┐
     │   tsdev Framework          │
     │   "Describe Forever"       │
     └────────────┬───────────────┘
                  │
     ┌────────────┴────────────────────────────────────────┐
     │                                                      │
     ▼                                                      ▼
┌─────────────┐                                    ┌──────────────┐
│  Endpoints  │                                    │ Documentation│
├─────────────┤                                    ├──────────────┤
│ • RPC       │                                    │ • OpenAPI    │
│ • REST      │                                    │ • Swagger UI │
│ • CLI       │                                    │ • Types      │
└─────────────┘                                    └──────────────┘
     │                                                      │
     ▼                                                      ▼
┌─────────────┐                                    ┌──────────────┐
│  Features   │                                    │  Guarantees  │
├─────────────┤                                    ├──────────────┤
│ • Validation│                                    │ • Type safe  │
│ • Telemetry │                                    │ • Validated  │
│ • Policies  │                                    │ • Documented │
│ • Rate Limit│                                    │ • Observable │
└─────────────┘                                    └──────────────┘
```

---

## The Power: Before & After

### ❌ Traditional Approach

```typescript
// 1. Define route
app.post('/posts', async (req, res) => { ... });

// 2. Define validation
const createPostSchema = joi.object({ ... });

// 3. Define types
interface CreatePostRequest { ... }
interface CreatePostResponse { ... }

// 4. Write OpenAPI manually
openapi.paths['/posts'] = { 
  post: { 
    requestBody: { ... },
    responses: { ... }
  }
};

// 5. Add CLI separately
program
  .command('create-post')
  .option('--title <title>')
  .action(...);

// 6. Add telemetry manually
span = tracer.startSpan('create-post');
// ... business logic ...
span.end();

// 7. Add rate limiting manually
if (!rateLimiter.check(userId)) {
  return res.status(429).json({ error: 'Rate limit' });
}

// 8. Update docs manually
// ... write markdown docs ...

// Total: ~200+ lines of code
// Maintenance: 8+ places to update when logic changes
```

### ✅ tsdev Approach

```typescript
// 1. Define contract
const createPostContract: Contract = {
  name: "posts.create",
  input: z.object({ ... }),
  output: z.object({ ... }),
  metadata: { tags: ["posts"], rateLimit: { ... } }
};

// 2. Write handler
const createPost: Procedure = {
  contract: createPostContract,
  handler: applyPolicies(
    async (input) => { /* business logic */ },
    withLogging("posts.create"),
    withSpan("posts.create"),
    withRateLimit({ ... })
  )
};

// Total: ~30 lines of code
// Maintenance: 1 place to update (the contract)
// Features: Everything from traditional approach + more
```

---

## Real-World Benefit

### Scenario: Add a new field to the API

**Traditional:**
1. Update route handler ✏️
2. Update validation schema ✏️
3. Update TypeScript types ✏️
4. Update OpenAPI spec ✏️
5. Update CLI command ✏️
6. Update documentation ✏️
7. Update tests ✏️

**tsdev:**
1. Update contract ✏️

Everything else updates automatically! 🎉

---

## Feature Matrix

| Feature | Traditional | tsdev |
|---------|-------------|-------|
| RPC endpoint | Manual | ✅ Auto |
| REST endpoint | Manual | ✅ Auto |
| CLI interface | Manual | ✅ Auto |
| OpenAPI spec | Manual | ✅ Auto |
| Swagger UI | Manual setup | ✅ Auto |
| Type safety | Separate defs | ✅ Auto inferred |
| Input validation | Manual code | ✅ Auto (Zod) |
| Output validation | Rarely done | ✅ Auto (Zod) |
| Telemetry | Manual spans | ✅ Auto (policy) |
| Rate limiting | Manual code | ✅ Auto (policy) |
| Logging | Manual code | ✅ Auto (policy) |
| Retry logic | Manual code | ✅ Auto (policy) |
| Documentation | Manual writing | ✅ Auto from contracts |
| Consistency | Manual sync | ✅ Guaranteed |
| Maintenance | 8+ locations | ✅ 1 location |

---

## Summary

### You Write:
```typescript
const contract = { ... };  // 10 lines
const handler = { ... };   // 20 lines
```

### You Get:
- ✅ RPC endpoint
- ✅ REST endpoint
- ✅ CLI interface
- ✅ OpenAPI spec
- ✅ Swagger UI
- ✅ TypeScript types
- ✅ Input validation
- ✅ Output validation
- ✅ OpenTelemetry tracing
- ✅ Rate limiting
- ✅ Logging
- ✅ Error handling
- ✅ Documentation
- ✅ Introspection

**That's 14+ features from 2 definitions!**

## This is "Write Once — Describe Forever" ✨
