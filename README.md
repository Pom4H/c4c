# tsdev

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![Zod](https://img.shields.io/badge/Zod-Schema-green.svg)](https://zod.dev/)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Enabled-orange.svg)](https://opentelemetry.io/)

> **The framework where AI agents build logic from procedures.**  
> Introspect, compose, cache, version, and release workflows as code.

## Core Insight

**AI agents solve the same tasks repeatedly.**

Every time an agent needs to "create user → send email → update analytics", it:
- Re-reads documentation
- Re-thinks the logic
- Re-makes the same calls
- Re-handles the same errors

**What if agents could cache solved problems as workflows?**

```typescript
// AI discovers available procedures
const procedures = await fetch('/procedures').then(r => r.json());
// [
//   { name: "users.create", input: {...}, output: {...} },
//   { name: "emails.send", input: {...}, output: {...} },
//   { name: "analytics.track", input: {...}, output: {...} }
// ]

// AI composes workflow (DSL)
const workflow = {
  id: "user-onboarding",
  nodes: [
    { id: "create", type: "procedure", procedureName: "users.create", next: "email" },
    { id: "email", type: "procedure", procedureName: "emails.send", next: "track" },
    { id: "track", type: "procedure", procedureName: "analytics.track" }
  ]
};

// Save to git
await git.commit("workflows/user-onboarding.json", workflow);

// Reuse forever
const result = await executeWorkflow(workflow, registry);
```

**The agent never solves this problem again.**

---

## What This Enables

### 1. AI Agents as Workflow Composers

Agents can:
- **Discover** available procedures via introspection (`GET /procedures`)
- **Compose** workflows from procedures (visual DSL)
- **Execute** workflows with full tracing
- **Cache** successful workflows for reuse
- **Version** workflows in git

**Example flow:**

```
AI Agent receives task: "Onboard new user Alice"
  ↓
Agent calls: GET /procedures
  ↓
Agent sees: users.create, emails.send, analytics.track
  ↓
Agent composes workflow:
  {
    nodes: [
      { type: "procedure", procedureName: "users.create" },
      { type: "procedure", procedureName: "emails.send" },
      { type: "procedure", procedureName: "analytics.track" }
    ]
  }
  ↓
Agent executes: POST /workflow/execute
  ↓
Workflow runs with full OpenTelemetry tracing
  ↓
Agent commits workflow to git: workflows/user-onboarding.json
  ↓
Next time: Agent reuses workflow instead of re-thinking
```

### 2. Git-Based Workflow Management

**Workflows are just JSON** → version control works perfectly:

```bash
git/
├── workflows/
│   ├── user-onboarding.json      # AI-composed workflow
│   ├── payment-processing.json   # Human-decomposed workflow
│   └── data-pipeline.json        # Complex multi-step workflow
```

**Benefits:**
- **Decomposition** - Break complex workflows into smaller ones
- **Code review** - PR for workflow changes
- **Release** - Merge PR to deploy new workflow
- **Rollback** - Git revert to previous version
- **Collaboration** - Humans and AI edit same workflows

**Example PR workflow:**

```bash
# AI creates initial workflow
git checkout -b feat/user-onboarding
echo '{...}' > workflows/user-onboarding.json
git add workflows/user-onboarding.json
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

### 3. Procedures as Building Blocks

**Each procedure is discoverable:**

```typescript
// Contract defines everything agent needs to know
const contract = {
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
```

**Agent sees this via `/procedures`:**

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

**Agent can now:**
- Understand what each procedure does
- Know required inputs/outputs
- See relationships via tags
- Compose procedures into workflows

---

## Quick Start

```bash
pnpm install
pnpm dev:basic        # Start API server with procedures
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

## AI Agent Integration

### Agent Discovers Procedures

```typescript
// Agent explores API
const { procedures } = await fetch('http://localhost:3000/procedures').then(r => r.json());

// Agent sees structured information
procedures.forEach(proc => {
  console.log(`${proc.name}: ${proc.description}`);
  console.log(`Input:`, proc.input);
  console.log(`Output:`, proc.output);
});
```

### Agent Composes Workflow

```typescript
// Agent reasons: "To onboard user, I need to create account, send email, track event"
const workflow: WorkflowDefinition = {
  id: "user-onboarding",
  name: "User Onboarding Flow",
  version: "1.0.0",
  startNode: "create-user",
  nodes: [
    {
      id: "create-user",
      type: "procedure",
      procedureName: "users.create",  // Found via introspection
      config: {
        // Agent can use variables
        name: "{{ input.userName }}",
        email: "{{ input.userEmail }}"
      },
      next: "send-welcome"
    },
    {
      id: "send-welcome",
      type: "procedure",
      procedureName: "emails.sendWelcome",
      config: {
        userId: "{{ createUser.id }}"  // Use previous node output
      },
      next: "track-signup"
    },
    {
      id: "track-signup",
      type: "procedure",
      procedureName: "analytics.track",
      config: {
        event: "user.signup",
        userId: "{{ createUser.id }}"
      }
    }
  ]
};
```

### Agent Executes and Caches

```typescript
// Execute workflow
const result = await fetch('http://localhost:3000/workflow/execute', {
  method: 'POST',
  body: JSON.stringify({
    workflow,
    input: { userName: "Alice", userEmail: "alice@example.com" }
  })
});

// Result includes full trace
const { executionId, status, outputs, spans } = await result.json();

// Agent saves workflow to git
await saveToGit('workflows/user-onboarding.json', workflow);

// Next time agent sees "onboard user" task:
// 1. Loads workflow from git
// 2. Executes with new input
// 3. No re-composition needed
```

### Agent Improves Workflow

```typescript
// Agent detects failure pattern in traces
// Adds retry logic to email step

const improvedWorkflow = {
  ...workflow,
  nodes: workflow.nodes.map(node => {
    if (node.id === "send-welcome") {
      return {
        ...node,
        onError: "retry-email"  // Add error handling
      };
    }
    return node;
  })
};

// Commit improvement
await git.commit("workflows/user-onboarding.json", improvedWorkflow);
await git.createPR("Improve user onboarding: add email retry");
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
│   ├── user-onboarding.json
│   ├── payment-flow.json
│   └── data-pipeline.json
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
git add workflows/user-onboarding.json
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
git add workflows/user-onboarding.json
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
          for workflow in workflows/*.json; do
            curl -X POST http://api/workflow/validate \
              -d @$workflow
          done
      
      - name: Deploy workflows
        run: |
          for workflow in workflows/*.json; do
            curl -X POST http://api/workflow/deploy \
              -d @$workflow
          done
```

---

## Why This Matters

### For AI Agents

**Before tsdev:**
```
Task: "Onboard new user"
  ↓
Agent thinks through logic (30s)
  ↓
Agent makes API calls
  ↓
Agent handles errors
  ↓
Agent completes task (2min total)

Next time: Repeat everything (2min again)
```

**With tsdev:**
```
Task: "Onboard new user"
  ↓
Agent checks: "Do I have workflow for this?"
  ↓
Agent finds: workflows/user-onboarding.json
  ↓
Agent executes workflow (5s)
  ↓
Task done

Speedup: 24x faster
```

### For Development Teams

**Before:**
- AI agent outputs are ephemeral
- No way to version agent logic
- No code review for agent workflows
- Can't rollback agent decisions

**With tsdev:**
- ✅ Workflows in git (version controlled)
- ✅ PR review for workflow changes
- ✅ CI/CD validation
- ✅ Rollback via git revert
- ✅ Collaboration: humans improve AI workflows

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
├── data-pipeline.json           # Main workflow
├── transform-users.json         # Sub-workflow
├── transform-events.json        # Sub-workflow
└── transform-analytics.json     # Sub-workflow
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
workflows/order-processing.json
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
│                   AI Agent                          │
│  - Discovers procedures via /procedures             │
│  - Composes workflows (JSON)                        │
│  - Executes workflows via /workflow/execute         │
│  - Commits workflows to git                         │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│              tsdev HTTP Server                      │
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
             │  ├── *.json    │
             └────────────────┘
```

---

## Packages

```
@tsdev/core           # Contracts, registry, execution
@tsdev/workflow       # Workflow runtime + OpenTelemetry
@tsdev/adapters       # HTTP, CLI, REST adapters
@tsdev/policies       # Composable policies (retry, logging, etc.)
@tsdev/generators     # OpenAPI generation
```

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

- [PHILOSOPHY.md](./PHILOSOPHY.md) - Why AI agents need this
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical implementation
- [DEPLOYMENT.md](./DEPLOYMENT.md) - How to deploy applications
- [QUICK_DEPLOY.md](./QUICK_DEPLOY.md) - Quick deployment guide

---

## License

MIT

---

**Built for AI agents to compose, cache, and evolve workflows as code.**
