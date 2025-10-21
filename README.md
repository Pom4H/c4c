# c4c - Code For Coders

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Zod](https://img.shields.io/badge/Zod-Schema-green.svg)](https://zod.dev/)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Enabled-orange.svg)](https://opentelemetry.io/)

> **n8n but for coders.**  
> Build, version, and deploy workflows as TypeScript code. Full type safety, git versioning, and OpenTelemetry tracing out of the box.

## Why c4c?

**Love n8n's visual workflows but prefer code?**

c4c gives you the power of visual workflow automation tools like n8n, Zapier, and Make.com—but with the developer experience you deserve:

- ✅ **TypeScript-first** - Full type safety, autocomplete, and refactoring
- ✅ **Git versioning** - Version control your workflows like any other code
- ✅ **Code review** - PR workflows for automation changes
- ✅ **Test your workflows** - Unit test nodes, integration test flows
- ✅ **OpenTelemetry** - Automatic distributed tracing for every execution
- ✅ **No vendor lock-in** - Your workflows are just TypeScript files

**Think of it as n8n meets your IDE.**

```typescript
import { workflow, step } from "@c4c/workflow";
import { z } from "zod";

// Define workflow steps with full type safety
const createUser = step({
  id: "create",
  input: z.object({ name: z.string(), email: z.string().email() }),
  output: z.object({ id: z.string() }),
  execute: ({ engine, inputData }) => engine.run("users.create", inputData),
});

const sendEmail = step({
  id: "email",
  input: createUser.output, // Type-safe data flow
  output: z.object({ delivered: z.boolean() }),
  execute: ({ engine }) => engine.run("emails.send"),
});

// Compose workflow
export const userOnboarding = workflow("user-onboarding")
  .step(createUser)
  .step(sendEmail)
  .commit();

// Execute with full OpenTelemetry tracing
const result = await executeWorkflow(userOnboarding, registry);

// Commit to git like any other code
// git add workflows/user-onboarding.ts
// git commit -m "Add user onboarding workflow"
```

**Your workflow is now versioned, testable, and traceable.**

---

## What This Enables

### 1. Visual Workflow Power, Code-First Developer Experience

**Like n8n, but with TypeScript:**

- **Define nodes as procedures** - Each procedure is a reusable workflow node
- **Compose workflows in code** - Full IDE support with autocomplete
- **Type-safe data flow** - Know what data flows between nodes at compile time
- **Version in git** - Track changes, rollback, collaborate via PRs
- **Test like regular code** - Unit tests, integration tests, CI/CD

**Example: User Onboarding Workflow**

```typescript
// Each step is type-safe and composable
const workflow = workflow("user-onboarding")
  .step(createUser)      // Returns { id: string }
  .step(sendEmail)       // Uses createUser.output
  .step(trackAnalytics)  // All data flow is type-checked
  .commit();

// Execute with automatic tracing
const result = await executeWorkflow(workflow, registry);
```

### 2. Git-Based Workflow Management

**Workflows are TypeScript files** → perfect for version control:

```bash
workflows/
├── user-onboarding.ts        # User registration flow
├── payment-processing.ts     # Payment handling
└── data-pipeline.ts          # ETL workflow
```

**Better than visual tools:**
- ✅ **Code review** - Review workflow changes in PRs
- ✅ **Version history** - See who changed what and when
- ✅ **Branching** - Test workflow changes in feature branches
- ✅ **Rollback** - Revert to previous versions with `git revert`
- ✅ **Collaboration** - Multiple devs working on same workflows
- ✅ **CI/CD** - Test and deploy workflows automatically

**Example PR workflow:**

```bash
# AI creates initial workflow
git checkout -b feat/user-onboarding
pnpm tsx scripts/scaffold-workflow.ts user-onboarding
git add workflows/user-onboarding.ts
git commit -m "Add user onboarding workflow"
git push

# Human reviews and improves
# - Adds error handling
# - Adds conditional logic
# - Optimizes parallel execution

# Merge → workflow goes live
git checkout main
git merge feat/user-onboarding
```

### 3. Procedures as Reusable Nodes

**Each procedure is a workflow node:**

```typescript
// Define a procedure (like an n8n node)
const createUserContract = {
  name: "users.create",
  description: "Creates a new user account",
  input: z.object({
    name: z.string().describe("User's full name"),
    email: z.string().email().describe("Valid email address")
  }),
  output: z.object({
    id: z.string().describe("Generated user ID"),
    name: z.string(),
    email: z.string()
  }),
  metadata: {
    tags: ["users", "write"],
    rateLimit: { maxTokens: 10, windowMs: 60000 }
  }
};

export const createUser: Procedure = {
  contract: createUserContract,
  handler: async (input) => {
    const user = await db.users.create(input);
    return user;
  }
};
```

**Introspectable via API:**

```json
{
  "procedures": [
    {
      "name": "users.create",
      "description": "Creates a new user account",
      "input": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "description": "User's full name" },
          "email": { "type": "string", "format": "email" }
        }
      },
      "output": { ... },
      "metadata": { "tags": ["users", "write"] }
    }
  ]
}
```

**Benefits:**
- Discover available procedures programmatically
- Understand inputs/outputs with full schemas
- Compose procedures into workflows
- Build integrations and automations with full type safety

---

## Quick Start

```bash
pnpm install
pnpm dev:basic        # Start API server with procedures
```

### CLI usage

```bash
# Start all transports (RPC, REST, workflow) on port 3000
c4c serve

# Serve only the workflow HTTP surface from a specific project root
c4c serve workflow --root ./examples/integrations --port 4000

# Launch the workflow visualizer UI (defaults to ./workflows under the root)
c4c serve ui --root . --port 3100 --api-base http://localhost:3000

# Generate a typed RPC client with auth support
c4c generate client --root ./examples/integrations --out ./src/generated/client.ts

# Generate OpenAPI specification
c4c generate openapi --root ./src/handlers --out ./openapi.json
```

**Create procedures:**

```typescript
// contracts/users.ts
export const createUserContract = {
  name: "users.create",
  description: "Create a new user",
  input: z.object({ name: z.string(), email: z.string().email() }),
  output: z.object({ id: z.string(), name: z.string(), email: z.string() })
};

// handlers/users.ts
export const createUser: Procedure = {
  contract: createUserContract,
  handler: async (input) => {
    const user = await db.users.create(input);
    return user;
  }
};
```

**Start server:**

```typescript
// apps/http.ts
const registry = await collectRegistry("./handlers");
createHttpServer(registry, 3000);
```

**Server provides:**

```bash
# Introspection (for AI agents)
GET /procedures              # List all procedures
GET /openapi.json            # OpenAPI spec

# Execution
POST /rpc/:procedureName     # Call procedure
POST /workflow/execute       # Execute workflow

# Workflow management
GET /workflow/list           # List workflows
POST /workflow/validate      # Validate workflow definition
```

---

## Workflow as Code (Git Integration)

### Directory Structure

```
your-project/
├── src/
│   ├── contracts/           # Procedure contracts
│   ├── handlers/            # Procedure implementations
│   └── apps/
│
├── workflows/               # Workflow definitions (git)
│   ├── user-onboarding.ts
│   ├── payment-flow.ts
│   └── data-pipeline.ts
│
└── .github/workflows/
    └── deploy-workflows.yml  # CI/CD for workflows
```

### Workflow as JSON (Declarative)

```json
{
  "id": "user-onboarding",
  "name": "User Onboarding Flow",
  "version": "1.0.0",
  "startNode": "create-user",
  "nodes": [
    {
      "id": "create-user",
      "type": "procedure",
      "procedureName": "users.create",
      "config": {},
      "next": "send-email"
    },
    {
      "id": "send-email",
      "type": "procedure",
      "procedureName": "emails.send",
      "next": null
    }
  ]
}
```

### Git Workflow

**AI creates workflow:**
```bash
git checkout -b workflows/user-onboarding
# AI generates workflow JSON
git add workflows/user-onboarding.ts
git commit -m "Add user onboarding workflow"
git push origin workflows/user-onboarding
```

**Human reviews:**
```bash
# PR created automatically
# Human reviews workflow in GitHub UI
# Suggests improvements via comments
```

**Agent updates:**
```bash
# Agent reads review comments
# Updates workflow JSON
git add workflows/user-onboarding.ts
git commit -m "Address review: add error handling"
git push
```

**Merge to production:**
```bash
git checkout main
git merge workflows/user-onboarding
# Workflows automatically deployed
```

### CI/CD Integration

```yaml
# .github/workflows/deploy-workflows.yml
name: Deploy Workflows

on:
  push:
    branches: [main]
    paths:
      - 'workflows/**'

jobs:
  validate-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Validate workflows
        run: |
          for workflow in workflows/*.ts; do
            curl -X POST http://api/workflow/validate \
              -d @$workflow
          done
      
      - name: Deploy workflows
        run: |
          for workflow in workflows/*.ts; do
            curl -X POST http://api/workflow/deploy \
              -d @$workflow
          done
```

---

## Why This Matters

### For Developers

**Visual workflow tools (n8n, Zapier, Make.com):**
- ❌ Click-driven UI (slow, hard to scale)
- ❌ No version control
- ❌ Difficult to test
- ❌ Limited code reuse
- ❌ Vendor lock-in

**c4c (Code For Coders):**
- ✅ TypeScript workflows (fast, scalable)
- ✅ Git version control
- ✅ Test like regular code
- ✅ Maximum code reuse
- ✅ Open source, no lock-in

### For Teams

**Before c4c:**
- Workflows buried in visual tools
- No code review process
- Hard to track changes
- Difficult to collaborate

**With c4c:**
- ✅ Workflows in git repository
- ✅ PR-based code review
- ✅ Full change history
- ✅ Easy collaboration via branches
- ✅ CI/CD integration

### For Complex Systems

**Example: Data processing pipeline**

AI agent decomposes complex task:

```typescript
// Main workflow
{
  id: "data-pipeline",
  nodes: [
    { type: "procedure", procedureName: "data.extract", next: "transform" },
    { type: "parallel", 
      config: {
        branches: ["transform-users", "transform-events", "transform-analytics"],
        waitForAll: true
      },
      next: "load"
    },
    { type: "procedure", procedureName: "data.load" }
  ]
}

// Sub-workflow (decomposed)
{
  id: "transform-users",
  nodes: [
    { type: "procedure", procedureName: "data.validate", next: "enrich" },
    { type: "procedure", procedureName: "data.enrich", next: "dedupe" },
    { type: "procedure", procedureName: "data.dedupe" }
  ]
}
```

**Git structure:**
```
workflows/
├── data-pipeline.ts           # Main workflow
├── transform-users.ts         # Sub-workflow
├── transform-events.ts        # Sub-workflow
└── transform-analytics.ts     # Sub-workflow
```

**Agent can:**
- Compose complex workflows from sub-workflows
- Version each piece independently
- Reuse sub-workflows across different pipelines
- Improve one sub-workflow without touching others

---

## Real-World Example

### E-commerce Order Processing

**AI agent observes patterns in order processing:**

```typescript
// Agent discovers common flow
const orderWorkflow = {
  id: "order-processing",
  name: "E-commerce Order Processing",
  version: "1.0.0",
  startNode: "validate-order",
  nodes: [
    {
      id: "validate-order",
      type: "procedure",
      procedureName: "orders.validate",
      next: "check-inventory",
      onError: "notify-customer-invalid"
    },
    {
      id: "check-inventory",
      type: "procedure",
      procedureName: "inventory.check",
      next: "check-inventory-result"
    },
    {
      id: "check-inventory-result",
      type: "condition",
      config: {
        expression: "inStock === true",
        trueBranch: "process-payment",
        falseBranch: "notify-out-of-stock"
      }
    },
    {
      id: "process-payment",
      type: "procedure",
      procedureName: "payments.charge",
      next: "parallel-fulfillment",
      onError: "handle-payment-failure"
    },
    {
      id: "parallel-fulfillment",
      type: "parallel",
      config: {
        branches: [
          "create-shipment",
          "send-confirmation-email",
          "update-inventory",
          "track-analytics"
        ],
        waitForAll: false  // Don't wait for analytics
      },
      next: "complete-order"
    }
  ]
};
```

**Agent commits to git:**
```bash
workflows/order-processing.ts
```

**Team reviews and improves:**
```diff
+ {
+   "id": "fraud-check",
+   "type": "procedure",
+   "procedureName": "fraud.analyze",
+   "next": "check-fraud-result"
+ }
```

**Merge → All orders now include fraud check**

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Developer / AI Agent                    │
│  - Writes workflows in TypeScript                   │
│  - Discovers procedures via /procedures             │
│  - Executes workflows via /workflow/execute         │
│  - Versions workflows in git                        │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│              c4c HTTP Server                         │
│  ┌──────────────────────────────────────────────┐  │
│  │ Introspection Endpoints                      │  │
│  │ GET /procedures    - List all procedures     │  │
│  │ GET /openapi.json  - OpenAPI spec            │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │ Execution Endpoints                          │  │
│  │ POST /rpc/:name         - Call procedure     │  │
│  │ POST /workflow/execute  - Run workflow       │  │
│  │ POST /workflow/validate - Validate workflow  │  │
│  └──────────────────────────────────────────────┘  │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│                  Core Registry                      │
│  - Auto-discovered procedures                       │
│  - Contract validation (Zod)                        │
│  - OpenTelemetry tracing                           │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│                Business Logic                        │
│  handlers/                                          │
│  ├── users.ts    - User procedures                  │
│  ├── emails.ts   - Email procedures                 │
│  └── payments.ts - Payment procedures               │
└─────────────────────────────────────────────────────┘

             ┌────────────────┐
             │   Git Repo     │
             │  workflows/    │
             │  ├── *.ts      │
             └────────────────┘
```

---

## Packages

```
@c4c/core             # Contracts, registry, execution
@c4c/workflow         # Workflow runtime + OpenTelemetry
@c4c/adapters         # HTTP, CLI, REST adapters
@c4c/policies         # Composable policies (retry, logging, auth, etc.)
@c4c/generators       # OpenAPI + TypeScript client generation
@c4c/workflow-react   # React hooks for workflows
```

## Authentication & Authorization

**Protect procedures and auto-generate auth-aware clients:**

```typescript
import { createAuthProcedure } from "@c4c/policies";

// Define protected procedure
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
    // Only admins can execute this
    return { success: true };
  },
  auth: {
    requiredRoles: ["admin"],
  },
});

// Generate TypeScript client
const clientCode = generateRpcClientModule(registry);
// → Client automatically includes auth headers for protected procedures
```

**Use the generated client:**

```typescript
import { createc4cClient } from "./generated/client";

const client = createc4cClient({
  baseUrl: "http://localhost:3000",
  authToken: "your-jwt-token", // Auto-added to protected procedures
});

// Protected - Authorization: Bearer your-jwt-token added automatically
await client.procedures.deleteUser({ userId: "123" });

// Public - No auth header
await client.procedures.add({ a: 1, b: 2 });
```

**Features:**
- ✅ Role-based access control (RBAC)
- ✅ Permission-based authorization
- ✅ Custom authorization logic
- ✅ Auto-detection in generated clients
- ✅ Static or dynamic token support
- ✅ Token expiration validation
- ✅ HTTP header extraction (Bearer, Basic, API Key)

---

## Examples

### Basic Example
HTTP server with introspection:
```bash
cd examples/basic
pnpm dev
curl http://localhost:3000/procedures  # AI agent discovers procedures
```

### Workflows Example
Workflow execution server:
```bash
cd examples/workflows
pnpm dev
curl http://localhost:3001/workflow/execute -d @workflow.json
```

### Workflow Visualization
Visual workflow editor + execution:
```bash
cd examples/workflow-viz
pnpm dev  # http://localhost:3000
```

---

## Documentation

### Core Documentation
- **[PHILOSOPHY.md](./PHILOSOPHY.md)** - Why AI agents need this
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical implementation details

### Package Documentation
- **[@c4c/policies](./packages/policies/README.md)** - Composable policies (retry, logging, auth)
- **[@c4c/generators](./packages/generators/README.md)** - OpenAPI & TypeScript client generation

### Examples & Guides
- **[Auth Examples](./examples/basic/AUTH_EXAMPLES.md)** - Complete authentication & authorization guide
- **[Basic Example](./examples/basic)** - HTTP server with procedures
- **[Integrations Example](./examples/integrations)** - Google Drive & Avito integrations

---

## License

MIT

---

**n8n but for coders. Built by developers, for developers.**
