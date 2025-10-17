# tsdev Architecture

**Implementation details for AI agent integration and workflow management.**

This document explains the internals of tsdev with focus on:
- Agent discovery mechanisms
- Workflow composition and validation
- Git-based workflow versioning
- OpenTelemetry feedback loop

---

## System Overview

```
┌──────────────────────────────────────────────────────────┐
│                      AI Agent                            │
│  • Introspects procedures (GET /procedures)              │
│  • Composes workflows (JSON DSL)                         │
│  • Validates workflows (POST /workflow/validate)         │
│  • Executes workflows (POST /workflow/execute)           │
│  • Analyzes traces (OpenTelemetry spans)                 │
│  • Commits workflows (git)                               │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│                  Transport Layer                         │
│  HTTP Server with introspection endpoints                │
│  • GET /procedures       - Agent discovery               │
│  • GET /openapi.json     - OpenAPI spec                  │
│  • POST /rpc/:name       - Direct procedure calls        │
│  • POST /workflow/*      - Workflow operations           │
│  • GET /workflow/palette - Generated workflow catalog    │
│  • GET /workflow/executions/:id/stream - SSE events      │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│                    Core Layer                            │
│  @tsdev/core - Registry & Execution                      │
│  • Auto-discovery via collectRegistry()                  │
│  • Contract validation (Zod)                             │
│  • Procedure execution with policies                     │
│                                                          │
│  @tsdev/workflow - Workflow Runtime                      │
│  • Workflow validation                                   │
│  • Node execution (procedure, condition, parallel)       │
│  • OpenTelemetry span creation                          │
│  • State management                                      │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│                  Business Logic                          │
│  handlers/ - Procedure implementations                   │
│  • Pure functions: input → output                        │
│  • No transport coupling                                 │
│  • Fully testable                                        │
└──────────────────────────────────────────────────────────┘

                 ┌──────────────────┐
                 │    Git Repo      │
                 │   workflows/     │
                 │   ├── *.ts       │
                 │   Agent commits  │
                 │   Human reviews  │
                 └──────────────────┘
```

---

## Core Types

### Contract

The foundation of everything:

```typescript
interface Contract<TInput = unknown, TOutput = unknown> {
  name: string;              // e.g., "users.create"
  description?: string;
  input: z.ZodType<TInput>;  // Zod schema
  output: z.ZodType<TOutput>;
  metadata?: Record<string, unknown>;  // Arbitrary metadata
}
```

**What it enables:**
- Runtime validation: `contract.input.parse(data)`
- Type inference: `z.infer<typeof contract.input>`
- OpenAPI generation: `zodToJsonSchema(contract.input)`
- Documentation: `contract.description`
- Introspection: `contract.metadata`

### Handler

Business logic function:

```typescript
type Handler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  context: ExecutionContext
) => Promise<TOutput> | TOutput;
```

**Characteristics:**
- Pure function (given input, return output)
- Receives validated input
- Returns unvalidated output (validated by framework)
- Transport-agnostic

### Procedure

Contract + Handler:

```typescript
interface Procedure<TInput = unknown, TOutput = unknown> {
  contract: Contract<TInput, TOutput>;
  handler: Handler<TInput, TOutput>;
}
```

**This is what you export from handlers/:**

```typescript
export const createUser: Procedure = {
  contract: createUserContract,
  handler: async (input, context) => {
    // Business logic
  }
};
```

### Registry

Map of procedures:

```typescript
type Registry = Map<string, Procedure>;
```

**Created via auto-discovery:**

```typescript
const registry = await collectRegistry("./handlers");
// Key: contract.name (e.g., "users.create")
// Value: Procedure object
```

### Policy

Function that wraps handlers:

```typescript
type Policy = <TInput, TOutput>(
  handler: Handler<TInput, TOutput>
) => Handler<TInput, TOutput>;
```

**Example:**

```typescript
const withRetry: Policy = (handler) => {
  return async (input, context) => {
    for (let i = 0; i < 3; i++) {
      try {
        return await handler(input, context);
      } catch (error) {
        if (i === 2) throw error;
      }
    }
  };
};
```

---

## Core Mechanisms

### 1. Auto-Discovery (collectRegistry)

**Location:** `packages/core/src/registry.ts`

**How it works:**

```typescript
export async function collectRegistry(handlersPath = "src/handlers"): Promise<Registry> {
  const registry: Registry = new Map();

  // 1. Find all TypeScript files
  const handlerFiles = globSync(`${handlersPath}/**/*.ts`, {
    absolute: true,
    ignore: ["**/*.test.ts", "**/*.spec.ts"],
  });

  for (const file of handlerFiles) {
    // 2. Dynamic import
    const module = await import(file);

    // 3. Check each export
    for (const [exportName, exportValue] of Object.entries(module)) {
      if (isProcedure(exportValue)) {
        const procedureName = exportValue.contract.name || exportName;
        registry.set(procedureName, exportValue as Procedure);
      }
    }
  }

  return registry;
}

function isProcedure(value: unknown): value is Procedure {
  return (
    typeof value === "object" &&
    value !== null &&
    "contract" in value &&
    "handler" in value &&
    typeof (value as any).handler === "function"
  );
}
```

**Key points:**
- Uses `globSync` to find files
- Dynamic `import()` for each file
- Runtime type checking to identify Procedures
- No decorators, no manual registration

### 2. Execution Flow (executeProcedure)

**Location:** `packages/core/src/executor.ts`

**How it works:**

```typescript
export async function executeProcedure<TInput, TOutput>(
  procedure: Procedure<TInput, TOutput>,
  input: unknown,
  context: ExecutionContext
): Promise<TOutput> {
  // 1. Validate input against contract
  const validatedInput = procedure.contract.input.parse(input);

  // 2. Execute handler (with validated input)
  const result = await procedure.handler(validatedInput, context);

  // 3. Validate output against contract
  const validatedOutput = procedure.contract.output.parse(result);

  return validatedOutput;
}
```

**Validation guarantees:**
- Input is validated before handler runs
- Output is validated before returning
- Type safety at runtime AND compile-time
- Throws `ZodError` if validation fails

### 3. Policy Composition (applyPolicies)

**Location:** `packages/core/src/executor.ts`

**How it works:**

```typescript
export function applyPolicies<TInput, TOutput>(
  handler: Handler<TInput, TOutput>,
  ...policies: Policy[]
): Handler<TInput, TOutput> {
  return policies.reduce((h, policy) => policy(h), handler);
}
```

**Execution order (right to left):**

```typescript
const handler = applyPolicies(
  baseHandler,
  withLogging,    // 3. Outer wrapper
  withSpan,       // 2. Middle wrapper
  withRetry       // 1. Inner wrapper (executes first)
);
```

**Equivalent to:**

```typescript
withLogging(withSpan(withRetry(baseHandler)))
```

**Call stack:**

```
withLogging → start
  withSpan → start
    withRetry → start
      baseHandler → execute
    withRetry → end
  withSpan → end
withLogging → end
```

---

## Adapters in Detail

Adapters translate transport → core.

### HTTP Adapter

**Location:** `packages/adapters/src/http.ts`

**RPC Endpoint:**

```typescript
// POST /rpc/:procedureName
if (req.method === "POST" && req.url?.startsWith("/rpc/")) {
  const procedureName = req.url.slice(5);
  
  // 1. Parse JSON body
  const body = await parseBody(req);
  const input = JSON.parse(body);
  
  // 2. Get procedure
  const procedure = registry.get(procedureName);
  if (!procedure) {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Procedure not found" }));
    return;
  }
  
  // 3. Create execution context
  const context = createExecutionContext({
    transport: "http",
    method: req.method,
    url: req.url,
    userAgent: req.headers["user-agent"],
  });
  
  // 4. Execute procedure
  const result = await executeProcedure(procedure, input, context);
  
  // 5. Return JSON response
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}
```

**Key points:**
- Thin translation layer
- No business logic
- Calls `executeProcedure()` from core

### REST Adapter

**Location:** `packages/adapters/src/rest.ts`

**Convention-based routing:**

```typescript
function matchProcedure(
  procedureName: string,
  urlParts: string[],
  method: string
): Record<string, string> | null {
  const [resource, action] = procedureName.split(".");
  
  switch (action) {
    case "create":
      // POST /resource
      if (method === "POST" && urlParts.length === 1 && urlParts[0] === resource) {
        return {};
      }
      break;
      
    case "list":
      // GET /resource
      if (method === "GET" && urlParts.length === 1 && urlParts[0] === resource) {
        return {};
      }
      break;
      
    case "get":
      // GET /resource/:id
      if (method === "GET" && urlParts.length === 2 && urlParts[0] === resource) {
        return { id: urlParts[1] };
      }
      break;
      
    case "update":
      // PUT /resource/:id
      if (method === "PUT" && urlParts.length === 2 && urlParts[0] === resource) {
        return { id: urlParts[1] };
      }
      break;
      
    case "delete":
      // DELETE /resource/:id
      if (method === "DELETE" && urlParts.length === 2 && urlParts[0] === resource) {
        return { id: urlParts[1] };
      }
      break;
  }
  
  return null;
}
```

**Mapping table:**

| Procedure Name | HTTP Method | REST Path |
|---------------|-------------|-----------|
| `users.create` | `POST` | `/users` |
| `users.list` | `GET` | `/users` |
| `users.get` | `GET` | `/users/:id` |
| `users.update` | `PUT` | `/users/:id` |
| `users.delete` | `DELETE` | `/users/:id` |

**Input building:**

```typescript
// Merge params, query, and body
const input = {
  ...match.params,      // { id: "123" }
  ...match.query,       // { limit: "10" }
  ...bodyData           // { name: "Alice" }
};
```

### CLI Adapter

**Location:** `packages/adapters/src/cli.ts`

**Argument parsing:**

```typescript
function parseCliArgs(args: string[]): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      
      // --key=value format
      if (key.includes("=")) {
        const [k, ...valueParts] = key.split("=");
        input[k] = parseValue(valueParts.join("="));
      }
      // --key value format
      else {
        const value = args[i + 1];
        if (value && !value.startsWith("--")) {
          input[key] = parseValue(value);
          i++;
        } else {
          input[key] = true;  // Boolean flag
        }
      }
    }
  }
  
  return input;
}

function parseValue(value: string): unknown {
  // Try number
  if (!isNaN(Number(value))) {
    return Number(value);
  }
  
  // Try boolean
  if (value === "true") return true;
  if (value === "false") return false;
  
  // Try JSON
  if (value.startsWith("{") || value.startsWith("[")) {
    try {
      return JSON.parse(value);
    } catch {}
  }
  
  return value;
}
```

**Usage:**

```bash
tsdev users.create --name Alice --email alice@example.com
# Parsed as: { name: "Alice", email: "alice@example.com" }

tsdev math.add --a 5 --b 3
# Parsed as: { a: 5, b: 3 }

tsdev users.create --json '{"name":"Alice","email":"alice@example.com"}'
# Parsed as: { name: "Alice", email: "alice@example.com" }
```

---

## Agent Discovery Mechanism

### Introspection Endpoint

**Location:** `packages/adapters/src/http.ts`

Agents discover procedures via `/procedures`:

```typescript
// GET /procedures
if (req.url === "/procedures" && req.method === "GET") {
  const procedures = Array.from(registry.entries()).map(([name, proc]) => ({
    name,
    description: proc.contract.description,
    input: zodToJsonSchema(proc.contract.input),
    output: zodToJsonSchema(proc.contract.output),
    metadata: proc.contract.metadata,
  }));

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ procedures }));
  return;
}
```

**Agent receives:**

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
        },
        "required": ["name", "email"]
      },
      "output": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "email": { "type": "string" }
        }
      },
      "metadata": {
        "tags": ["users", "write"],
        "rateLimit": { "maxTokens": 10, "windowMs": 60000 }
      }
    }
  ]
}
```

### Why JSON Schema?

**Zod schemas are converted to JSON Schema:**

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';

const inputSchema = zodToJsonSchema(procedure.contract.input, {
  name: `${procedure.contract.name}.Input`,
  target: 'openApi3'
});
```

**Benefits:**
- Standard format agents understand
- Includes validation rules
- Describes structure and types
- Machine-readable

### Agent Usage Pattern

```typescript
// Agent discovers procedures
const { procedures } = await fetch('http://api/procedures').then(r => r.json());

// Agent builds knowledge graph
const knowledgeBase = new Map();
for (const proc of procedures) {
  knowledgeBase.set(proc.name, {
    description: proc.description,
    inputSchema: proc.input,
    outputSchema: proc.output,
    tags: proc.metadata?.tags || []
  });
}

// Agent finds relevant procedures for task
function findProceduresForTask(task: string): string[] {
  const relevant = [];
  for (const [name, info] of knowledgeBase) {
    if (matchesTask(task, info.description, info.tags)) {
      relevant.push(name);
    }
  }
  return relevant;
}

// Agent composes workflow
const workflow = composeProceduresIntoWorkflow(relevant);
```

---

## Workflow Lifecycle

### 1. Composition (Agent Creates Workflow)

Agent composes workflow from discovered procedures:

```typescript
// Agent's composition logic
const workflow: WorkflowDefinition = {
  id: generateWorkflowId(task),
  name: task,
  version: "1.0.0",
  startNode: "step-1",
  nodes: [
    {
      id: "step-1",
      type: "procedure",
      procedureName: "users.create",  // From introspection
      config: {
        name: "{{ input.userName }}",
        email: "{{ input.userEmail }}"
      },
      next: "step-2"
    },
    {
      id: "step-2",
      type: "procedure",
      procedureName: "emails.send",
      config: {
        to: "{{ step-1.email }}",  // Reference previous output
        subject: "Welcome!"
      }
    }
  ]
};
```

### 2. Validation (Before Execution)

**Endpoint:** `POST /workflow/validate`

**Location:** `packages/adapters/src/workflow-http.ts`

```typescript
if (req.url === "/workflow/validate" && req.method === "POST") {
  const workflow = JSON.parse(await parseBody(req));
  
  // Validate workflow structure
  const errors = validateWorkflow(workflow, registry);
  
  if (errors.length > 0) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ valid: false, errors }));
    return;
  }
  
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ valid: true }));
  return;
}
```

**Validation checks:**

```typescript
export function validateWorkflow(
  workflow: WorkflowDefinition,
  registry: Registry
): string[] {
  const errors: string[] = [];
  
  // Check start node exists
  if (!workflow.nodes.find(n => n.id === workflow.startNode)) {
    errors.push(`Start node ${workflow.startNode} not found`);
  }
  
  // Check all procedure nodes reference valid procedures
  for (const node of workflow.nodes) {
    if (node.type === "procedure" && node.procedureName) {
      if (!registry.has(node.procedureName)) {
        errors.push(`Node ${node.id}: procedure ${node.procedureName} not found`);
      }
    }
    
    // Check next nodes exist
    const nextNodes = Array.isArray(node.next) ? node.next : node.next ? [node.next] : [];
    for (const nextId of nextNodes) {
      if (!workflow.nodes.find(n => n.id === nextId)) {
        errors.push(`Node ${node.id}: next node ${nextId} not found`);
      }
    }
  }
  
  return errors;
}
```

**Agent validates before committing:**

```typescript
// Agent composed workflow
const validation = await fetch('http://api/workflow/validate', {
  method: 'POST',
  body: JSON.stringify(workflow)
}).then(r => r.json());

if (!validation.valid) {
  console.error('Workflow validation failed:', validation.errors);
  // Agent fixes errors and re-validates
} else {
  // Agent commits to git
  await commitWorkflow(workflow);
}
```

### 3. Execution (Run Workflow)

**Endpoint:** `POST /workflow/execute`

```typescript
if (req.url === "/workflow/execute" && req.method === "POST") {
  const { workflow, input } = JSON.parse(await parseBody(req));
  
  // Execute workflow with OpenTelemetry tracing
  const result = await executeWorkflow(workflow, registry, input);
  
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
  return;
}
```

**Returns:**

```json
{
  "executionId": "wf_exec_123456",
  "status": "completed",
  "outputs": {
    "step-1": { "id": "user_789", "name": "Alice", "email": "alice@example.com" },
    "step-2": { "messageId": "msg_456", "status": "sent" }
  },
  "executionTime": 1234,
  "nodesExecuted": ["step-1", "step-2"],
  "spans": [
    {
      "spanId": "span_1",
      "name": "workflow.execute",
      "startTime": 1234567890,
      "endTime": 1234569124,
      "duration": 1234,
      "status": { "code": "OK" },
      "attributes": {
        "workflow.id": "user-onboarding",
        "workflow.execution_id": "wf_exec_123456"
      }
    }
  ]
}
```

### 4. Caching (Agent Saves Workflow)

**Agent commits successful workflow to git:**

```typescript
// Agent executes workflow
const result = await executeWorkflow(workflow, input);

if (result.status === "completed") {
  // Save to git as TypeScript module
  const workflowPath = `workflows/${workflow.id}.ts`;
  const source = renderWorkflowModule(workflow); // builder -> TS string

  await fs.writeFile(workflowPath, source);
  await git.add(workflowPath);
  await git.commit(`Add ${workflow.id} workflow`);

  // Agent remembers: "For tasks like this, use workflows/user-onboarding.ts"
  agent.workflowCache.set(taskPattern, workflowPath);
}
```

### 5. Reuse (Agent Loads Cached Workflow)

**Next time agent sees similar task:**

```typescript
// Agent receives task
const task = "Onboard user Bob";

// Agent checks cache
const workflowPath = agent.workflowCache.get(matchTaskPattern(task));

if (workflowPath) {
  // Load from git (dynamic import of module)
  const { userOnboarding } = await import(`../${workflowPath}`);

  // Execute with new input
  const result = await executeWorkflow(userOnboarding, {
    userName: "Bob",
    userEmail: "bob@example.com"
  });
  
  // Done in 5s instead of 2min
} else {
  // Compose new workflow
  // Save to git
  // Cache for next time
}
```

---

## Git Integration Architecture

### Workflow Storage Structure

```
git-repo/
├── workflows/
│   ├── user-onboarding.ts
│   ├── payment-processing.ts
│   ├── data-pipeline.ts
│   │
│   ├── e-commerce/
│   │   ├── order-processing.ts
│   │   ├── inventory-check.ts
│   │   └── fraud-detection.ts
│   │
│   └── analytics/
│       ├── event-tracking.ts
│       └── report-generation.ts
│
├── .github/
│   └── workflows/
│       └── validate-workflows.yml
│
└── src/
    ├── contracts/
    └── handlers/
```

### Workflow as Code

**Workflow TypeScript is source code:**

```json
{
  "id": "user-onboarding",
  "name": "User Onboarding Flow",
  "description": "Complete user registration with email verification",
  "version": "1.0.0",
  "author": "ai-agent",
  "createdAt": "2024-01-15T10:30:00Z",
  "startNode": "create-account",
  "nodes": [
    {
      "id": "create-account",
      "type": "procedure",
      "procedureName": "users.create",
      "config": {},
      "next": "send-verification",
      "onError": "notify-admin"
    },
    {
      "id": "send-verification",
      "type": "procedure",
      "procedureName": "emails.sendVerification",
      "next": null
    },
    {
      "id": "notify-admin",
      "type": "procedure",
      "procedureName": "notifications.sendAdmin",
      "next": null
    }
  ],
  "metadata": {
    "tags": ["users", "onboarding"],
    "estimatedDuration": 2000,
    "sla": 5000
  }
}
```

### Git Workflow for Changes

**1. Agent creates branch:**

```bash
git checkout -b workflows/improve-user-onboarding
```

**2. Agent modifies workflow:**

```diff
 export const userOnboarding = workflow("user-onboarding")
-  .step(createAccount)
-  .step(sendVerification)
+  .step(createAccount)
+  .step(retryCreateAccount)
+  .step(sendVerification)
   .commit();

+const retryCreateAccount = step({
+  id: "retry-create-account",
+  input: createAccount.output,
+  output: createAccount.output,
+  execute: ({ engine, inputData }) => engine.run("users.create", { ...inputData, retry: true }),
+});
```

**3. Agent commits:**

```bash
git add workflows/user-onboarding.ts
git commit -m "Add retry logic to user-onboarding workflow

Detected failure pattern in execution traces:
- 15% of create-account calls fail transiently
- Network timeouts are the primary cause

Solution:
- Added retry-create-account node
- Activated via onError handler
- Falls back to notify-admin if retry fails"

git push origin workflows/improve-user-onboarding
```

**4. Agent creates PR:**

```bash
gh pr create \
  --title "Improve user-onboarding workflow reliability" \
  --body "$(cat <<EOF
## Changes
- Added retry logic to handle transient failures
- Added error notification path

## Metrics
- Current success rate: 85%
- Expected success rate with retry: 98%

## Trace Analysis
Analyzed 1000 recent executions:
- 150 failures due to network timeouts
- 0 failures due to invalid input
- Average retry success rate: 87%

## Testing
- Validated workflow structure
- Simulated 100 executions
- Confirmed retry behavior
EOF
)"
```

**5. Human reviews:**

```
Reviewer: "Looks good, but let's add exponential backoff"

Agent: "Updated with exponential backoff policy"
```

**6. Merge:**

```bash
git checkout main
git merge workflows/improve-user-onboarding
git push origin main
```

**7. Workflow deployed automatically via CI/CD**

### CI/CD Pipeline

**`.github/workflows/validate-workflows.yml`:**

```yaml
name: Validate and Deploy Workflows

on:
  pull_request:
    paths:
      - 'workflows/**'
  push:
    branches: [main]
    paths:
      - 'workflows/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Validate all workflows
        run: |
          for workflow in workflows/**/*.ts; do
            echo "Validating $workflow"
            curl -X POST http://localhost:3000/workflow/validate \
              -H "Content-Type: application/json" \
              -d @$workflow || exit 1
          done
      
      - name: Test execution (dry run)
        run: |
          pnpm test:workflows
  
  deploy:
    if: github.ref == 'refs/heads/main'
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - name: Deploy workflows
        run: |
          # Upload workflows to production server
          rsync -avz workflows/ production:/app/workflows/
          
          # Reload workflow registry
          curl -X POST https://api.production/workflow/reload
```

---

## OpenTelemetry as Agent Feedback

### Automatic Trace Collection

Every workflow execution creates OpenTelemetry spans:

```typescript
// In executeWorkflow()
return tracer.startActiveSpan("workflow.execute", async (workflowSpan) => {
  workflowSpan.setAttributes({
    "workflow.id": workflow.id,
    "workflow.name": workflow.name,
    "workflow.execution_id": executionId
  });
  
  // Execute nodes
  for (const node of workflow.nodes) {
    await executeNode(node, context, registry, workflow);
  }
  
  workflowSpan.setAttributes({
    "workflow.status": "completed",
    "workflow.duration_ms": Date.now() - startTime
  });
});
```

### Agent Analyzes Traces

**Agent queries execution history:**

```typescript
// GET /workflow/:id/executions
const executions = await fetch(`http://api/workflow/${workflowId}/executions`)
  .then(r => r.json());

// Agent analyzes patterns
const stats = {
  totalExecutions: executions.length,
  successRate: executions.filter(e => e.status === 'completed').length / executions.length,
  avgDuration: mean(executions.map(e => e.executionTime)),
  p95Duration: percentile(executions.map(e => e.executionTime), 95),
  
  // Bottlenecks
  slowestNodes: analyzeSlowNodes(executions),
  
  // Failures
  errorPatterns: analyzeErrors(executions)
};
```

**Agent suggests improvements:**

```typescript
function suggestImprovements(stats) {
  const suggestions = [];
  
  // Slow nodes → add caching
  if (stats.slowestNodes.some(n => n.avgDuration > 1000)) {
    suggestions.push({
      type: "add-cache",
      node: stats.slowestNodes[0].id,
      expectedImprovement: "50% faster"
    });
  }
  
  // High failure rate → add retry
  if (stats.successRate < 0.95) {
    suggestions.push({
      type: "add-retry",
      nodes: stats.errorPatterns.map(e => e.nodeId),
      expectedImprovement: `${((0.98 - stats.successRate) * 100).toFixed(1)}% higher success rate`
    });
  }
  
  // Independent nodes → parallelize
  const parallelizable = findIndependentNodes(workflow);
  if (parallelizable.length > 1) {
    suggestions.push({
      type: "parallelize",
      nodes: parallelizable,
      expectedImprovement: `${(parallelizable.length * 0.7).toFixed(1)}x faster`
    });
  }
  
  return suggestions;
}
```

**Agent applies improvements:**

```typescript
// Agent loads workflow
const { userOnboarding } = await import('../workflows/user-onboarding.js');

// Agent gets suggestions
const suggestions = suggestImprovements(analyzeExecutions(workflow.id));

// Agent modifies workflow
for (const suggestion of suggestions) {
  switch (suggestion.type) {
    case "add-retry":
      addRetryPolicy(workflow, suggestion.nodes);
      break;
    case "parallelize":
      convertToParallel(workflow, suggestion.nodes);
      break;
    case "add-cache":
      addCachePolicy(workflow, suggestion.node);
      break;
  }
}

// Agent commits improvement
await git.commit('workflows/user-onboarding.ts', workflow);
await git.createPR(`Optimize ${workflow.id}: ${suggestions.map(s => s.type).join(', ')}`);
```

---

## Workflow System

### Workflow Runtime

**Location:** `packages/workflow/src/runtime.ts`

**Core execution:**

```typescript
export async function executeWorkflow(
  workflow: WorkflowDefinition,
  registry: Registry,
  initialInput: Record<string, unknown> = {}
): Promise<WorkflowExecutionResult> {
  // Create workflow-level OpenTelemetry span
  return tracer.startActiveSpan("workflow.execute", async (workflowSpan) => {
    const context: WorkflowContext = {
      workflowId: workflow.id,
      executionId: generateExecutionId(),
      variables: { ...workflow.variables, ...initialInput },
      nodeOutputs: new Map(),
      startTime: new Date(),
    };
    
    let currentNodeId = workflow.startNode;
    const nodesExecuted: string[] = [];
    
    // Execute nodes sequentially
    while (currentNodeId) {
      const node = workflow.nodes.find(n => n.id === currentNodeId);
      if (!node) throw new Error(`Node ${currentNodeId} not found`);
      
      nodesExecuted.push(currentNodeId);
      
      // Execute node (creates its own span)
      const nextNodeId = await executeNode(node, context, registry, workflow);
      
      currentNodeId = nextNodeId;
    }
    
    // Return results
    return {
      executionId: context.executionId,
      status: "completed",
      outputs: Object.fromEntries(context.nodeOutputs),
      executionTime: Date.now() - context.startTime.getTime(),
      nodesExecuted,
    };
  });
}
```

### Node Types

**Procedure Node:**

```typescript
async function executeProcedureNode(
  node: WorkflowNode,
  context: WorkflowContext,
  registry: Registry
): Promise<string | undefined> {
  // Get procedure
  const procedure = registry.get(node.procedureName);
  
  // Build input from node config + context variables
  const input = {
    ...node.config,
    ...context.variables
  };
  
  // Execute procedure
  const execContext = createExecutionContext({
    transport: "workflow",
    workflowId: context.workflowId,
    executionId: context.executionId,
    nodeId: node.id,
  });
  
  const output = await executeProcedure(procedure, input, execContext);
  
  // Store output
  context.nodeOutputs.set(node.id, output);
  
  // Merge output into variables (for next nodes)
  Object.assign(context.variables, output);
  
  // Return next node
  return node.next;
}
```

**Condition Node:**

```typescript
async function executeConditionNode(
  node: WorkflowNode,
  context: WorkflowContext
): Promise<string | undefined> {
  const config = node.config as ConditionConfig;
  
  // Evaluate JavaScript expression with context variables
  const result = evaluateExpression(config.expression, context.variables);
  
  // Return appropriate branch
  return result ? config.trueBranch : config.falseBranch;
}

function evaluateExpression(expression: string, variables: Record<string, unknown>): boolean {
  // Create function with variables as parameters
  const func = new Function(...Object.keys(variables), `return ${expression}`);
  return func(...Object.values(variables));
}
```

**Parallel Node:**

```typescript
async function executeParallelNode(
  node: WorkflowNode,
  context: WorkflowContext,
  registry: Registry,
  workflow: WorkflowDefinition
): Promise<string | undefined> {
  const config = node.config as ParallelConfig;
  
  // Execute all branches in parallel
  const branchPromises = config.branches.map(async (branchNodeId) => {
    const branchNode = workflow.nodes.find(n => n.id === branchNodeId);
    return executeNode(branchNode, context, registry, workflow);
  });
  
  if (config.waitForAll) {
    await Promise.all(branchPromises);
  } else {
    await Promise.race(branchPromises);
  }
  
  return node.next;
}
```

### OpenTelemetry Integration

**Span hierarchy:**

```
workflow.execute (parent span)
├── workflow.node.procedure (node: create-user)
│   └── procedure.users.create (from withSpan policy)
│       └── withRetry (from withRetry policy)
├── workflow.node.condition (node: check-premium)
└── workflow.node.procedure (node: send-email)
    └── procedure.emails.send
```

**Attributes added:**

```typescript
workflowSpan.setAttributes({
  "workflow.id": workflow.id,
  "workflow.name": workflow.name,
  "workflow.version": workflow.version,
  "workflow.execution_id": executionId,
  "workflow.start_node": workflow.startNode,
  "workflow.node_count": workflow.nodes.length,
  "workflow.status": "completed",
  "workflow.execution_time_ms": executionTime,
});

nodeSpan.setAttributes({
  "workflow.id": workflow.id,
  "workflow.execution_id": executionId,
  "node.id": node.id,
  "node.type": node.type,
  "node.procedure": node.procedureName,
  "node.status": "completed",
});
```

---

## OpenAPI Generation

**Location:** `packages/generators/src/openapi.ts`

**How it works:**

```typescript
export function generateOpenAPISpec(registry: Registry): OpenAPISpec {
  const spec: OpenAPISpec = {
    openapi: "3.0.0",
    info: { title: "tsdev API", version: "1.0.0" },
    paths: {},
  };
  
  for (const [name, procedure] of registry.entries()) {
    // Convert Zod schemas to JSON Schema
    const inputSchema = zodToJsonSchema(procedure.contract.input);
    const outputSchema = zodToJsonSchema(procedure.contract.output);
    
    // RPC endpoint
    spec.paths[`/rpc/${name}`] = {
      post: {
        operationId: name,
        summary: procedure.contract.description,
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: inputSchema }
          }
        },
        responses: {
          "200": {
            description: "Success",
            content: {
              "application/json": { schema: outputSchema }
            }
          }
        }
      }
    };
    
    // REST endpoint (if applicable)
    const restPath = generateRESTPath(procedure.contract);
    if (restPath) {
      Object.assign(spec.paths, restPath);
    }
  }
  
  return spec;
}
```

**Key dependencies:**
- `zod-to-json-schema`: Converts Zod schemas to JSON Schema
- Runs at runtime (can be saved to file)

---

## Policy Implementation

### withRetry

**Location:** `packages/policies/src/withRetry.ts`

```typescript
export function withRetry(options: RetryOptions = {}): Policy {
  const { maxAttempts = 3, delayMs = 100, backoffMultiplier = 2 } = options;
  
  return (handler) => {
    return async (input, context) => {
      let lastError: Error | undefined;
      let currentDelay = delayMs;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await handler(input, context);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          
          if (attempt === maxAttempts) break;
          
          await sleep(currentDelay);
          currentDelay *= backoffMultiplier;  // Exponential backoff
        }
      }
      
      throw lastError;
    };
  };
}
```

### withLogging

**Location:** `packages/policies/src/withLogging.ts`

```typescript
export function withLogging(procedureName: string): Policy {
  return (handler) => {
    return async (input, context) => {
      console.log(`[${procedureName}] Starting execution`, {
        requestId: context.requestId,
        timestamp: context.timestamp.toISOString(),
      });
      
      const startTime = performance.now();
      
      try {
        const result = await handler(input, context);
        const duration = performance.now() - startTime;
        
        console.log(`[${procedureName}] Completed successfully`, {
          requestId: context.requestId,
          durationMs: duration.toFixed(2),
        });
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        console.error(`[${procedureName}] Failed with error`, {
          requestId: context.requestId,
          durationMs: duration.toFixed(2),
          error: error instanceof Error ? error.message : String(error),
        });
        
        throw error;
      }
    };
  };
}
```

### withSpan

**Location:** `packages/policies/src/withSpan.ts`

```typescript
import { trace } from "@opentelemetry/api";

const tracer = trace.getTracer("tsdev.procedures");

export function withSpan(procedureName: string): Policy {
  return (handler) => {
    return async (input, context) => {
      // Create OpenTelemetry span
      return tracer.startActiveSpan(procedureName, async (span) => {
        try {
          // Add attributes
          span.setAttributes({
            "procedure.name": procedureName,
            "request.id": context.requestId,
            "input": JSON.stringify(input),
          });
          
          // Execute handler
          const result = await handler(input, context);
          
          // Add output attributes
          span.setAttributes({
            "output": JSON.stringify(result),
          });
          
          span.setStatus({ code: SpanStatusCode.OK });
          
          return result;
        } catch (error) {
          // Record exception
          span.recordException(error instanceof Error ? error : new Error(String(error)));
          span.setStatus({ code: SpanStatusCode.ERROR });
          
          throw error;
        } finally {
          span.end();
        }
      });
    };
  };
}
```

---

## Package Structure

### Monorepo Setup

Uses pnpm workspaces:

```json
// pnpm-workspace.yaml
packages:
  - "packages/*"
  - "examples/*"
```

### Package Dependencies

```
@tsdev/core (base)
  ↓ depends on
  └── zod

@tsdev/workflow
  ↓ depends on
  ├── @tsdev/core
  └── @opentelemetry/api

@tsdev/adapters
  ↓ depends on
  ├── @tsdev/core
  ├── @tsdev/workflow
  └── @tsdev/generators

@tsdev/policies
  ↓ depends on
  ├── @tsdev/core
  └── @opentelemetry/api

@tsdev/generators
  ↓ depends on
  ├── @tsdev/core
  └── zod-to-json-schema
```

### Build Order

```bash
# 1. Build core first (no deps)
cd packages/core && pnpm build

# 2. Build workflow and policies (depend on core)
cd packages/workflow && pnpm build
cd packages/policies && pnpm build

# 3. Build generators (depends on core)
cd packages/generators && pnpm build

# 4. Build adapters (depends on core, workflow, generators)
cd packages/adapters && pnpm build
```

---

## Performance Characteristics

### Registry Collection

**Happens once at startup:**

```typescript
const registry = await collectRegistry("./handlers");
```

**Cost:**
- File system scan: O(n) where n = number of files
- Dynamic imports: One per file
- Type checking: One per export

**Typical startup time:** < 100ms for 100 procedures

### Procedure Execution

**Per request:**

1. Input validation (Zod): ~0.1-1ms
2. Handler execution: Depends on business logic
3. Output validation (Zod): ~0.1-1ms
4. Policy overhead: ~0.01ms per policy

**Total framework overhead:** < 2ms

### Policy Composition

**Applied at startup:**

```typescript
const handler = applyPolicies(baseHandler, ...policies);
```

**Runtime cost:** Just function calls (negligible)

### OpenTelemetry

**Span creation:** ~10μs per span  
**Attribute setting:** ~1μs per attribute

**Negligible overhead in production** (sampled traces)

---

## Extension Points

### Adding a New Transport

Create an adapter:

```typescript
import { createExecutionContext, executeProcedure, type Registry } from '@tsdev/core';

export function createWebSocketServer(registry: Registry) {
  const wss = new WebSocketServer({ port: 8080 });
  
  wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
      const { procedure, input } = JSON.parse(message);
      
      const proc = registry.get(procedure);
      if (!proc) {
        ws.send(JSON.stringify({ error: "Procedure not found" }));
        return;
      }
      
      const context = createExecutionContext({
        transport: "websocket",
        connectionId: generateConnectionId(),
      });
      
      try {
        const result = await executeProcedure(proc, input, context);
        ws.send(JSON.stringify({ result }));
      } catch (error) {
        ws.send(JSON.stringify({ error: error.message }));
      }
    });
  });
}
```

### Adding a New Policy

```typescript
export function withCache(ttl: number): Policy {
  const cache = new Map();
  
  return (handler) => {
    return async (input, context) => {
      const key = JSON.stringify(input);
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = await handler(input, context);
      cache.set(key, result);
      
      setTimeout(() => cache.delete(key), ttl);
      
      return result;
    };
  };
}
```

### Adding Workflow Node Types

```typescript
// In executeNode()
switch (node.type) {
  case "procedure":
    return executeProcedureNode(node, context, registry);
  case "condition":
    return executeConditionNode(node, context);
  case "parallel":
    return executeParallelNode(node, context, registry, workflow);
  case "custom-type":  // Your custom type
    return executeCustomNode(node, context);
}
```

---

## Testing Strategy

### Unit Testing Handlers

```typescript
import { createExecutionContext } from '@tsdev/core';
import { createUser } from './handlers/users';

test('createUser creates a user', async () => {
  const input = { name: "Alice", email: "alice@example.com" };
  const context = createExecutionContext();
  
  const result = await createUser.handler(input, context);
  
  expect(result).toMatchObject({
    id: expect.any(String),
    name: "Alice",
    email: "alice@example.com",
  });
});
```

### Integration Testing Adapters

```typescript
import { collectRegistry } from '@tsdev/core';
import { createHttpServer } from '@tsdev/adapters';

test('HTTP server executes procedures', async () => {
  const registry = await collectRegistry("./handlers");
  const server = createHttpServer(registry, 3001);
  
  const response = await fetch("http://localhost:3001/rpc/users.create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", email: "test@example.com" }),
  });
  
  expect(response.ok).toBe(true);
  
  const result = await response.json();
  expect(result).toHaveProperty("id");
  
  server.close();
});
```

### Testing Workflows

```typescript
import { executeWorkflow } from '@tsdev/workflow';

test('workflow executes all nodes', async () => {
  const workflow = { /* ... */ };
  const registry = await collectRegistry("./handlers");
  
  const result = await executeWorkflow(workflow, registry);
  
  expect(result.status).toBe("completed");
  expect(result.nodesExecuted).toEqual(["node1", "node2", "node3"]);
});
```

---

## Future Architecture Enhancements

### 1. SDK Generation

```typescript
// Generate TypeScript SDK
generateSDK(registry, {
  language: "typescript",
  output: "./sdk/client.ts"
});

// Usage
import { TsdevClient } from "./sdk/client";

const client = new TsdevClient("http://localhost:3000");
const user = await client.users.create({ name: "Alice", email: "alice@example.com" });
```

### 2. Contract Versioning

```typescript
const createUserContractV2 = {
  name: "users.create",
  version: "2.0.0",
  input: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string().optional(),  // New field
  }),
  // ...
};

// Registry supports multiple versions
registry.set("users.create@1.0.0", procedureV1);
registry.set("users.create@2.0.0", procedureV2);
```

### 3. Distributed Workflow Execution

```typescript
// Execute workflow nodes across multiple machines
executeWorkflow(workflow, registry, {
  executor: "distributed",
  workers: ["worker1:8080", "worker2:8080"],
});
```

### 4. gRPC Adapter

```typescript
createGrpcServer(registry, {
  port: 50051,
  // Auto-generate protobuf from Zod schemas
});
```

---

## Agent-Workflow Collaboration Pattern

### How Agents and Humans Work Together

```
┌────────────────────────────────────────────────────────┐
│                    AI Agent                            │
│  1. Receives task: "Onboard new user"                  │
│  2. Checks git: does workflows/user-onboarding.ts    │
│     exist?                                             │
│  3a. YES: Load from git, execute with new input        │
│  3b. NO: Compose new workflow from procedures          │
│  4. Execute workflow                                   │
│  5. Analyze OpenTelemetry traces                       │
│  6. Detect bottlenecks/failures                        │
│  7. Create PR with improvements                        │
└────────────┬───────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────┐
│                   Git Repository                       │
│  • workflows/*.ts (version controlled)               │
│  • Pull requests (agent-created)                       │
│  • Review comments (human feedback)                    │
└────────────┬───────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────┐
│                  Human Developer                       │
│  1. Reviews agent's PR                                 │
│  2. Adds domain knowledge:                             │
│     - "Refunds > $100 need approval"                   │
│     - "GDPR: log data access"                          │
│     - "Use exponential backoff for retries"            │
│  3. Approves or requests changes                       │
│  4. Merges to main → deployed                          │
└────────────┬───────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────┐
│                   CI/CD Pipeline                       │
│  • Validates workflow JSON                             │
│  • Runs workflow tests                                 │
│  • Deploys to production                               │
│  • Starts collecting traces                            │
└────────────┬───────────────────────────────────────────┘
             │
             ▼ (feedback loop)
┌────────────────────────────────────────────────────────┐
│              Production Metrics                        │
│  • OpenTelemetry traces                                │
│  • Success/failure rates                               │
│  • Performance data                                    │
│  → Agent analyzes → suggests improvements → new PR     │
└────────────────────────────────────────────────────────┘
```

### Real Example

**Agent creates initial workflow:**

```json
{
  "id": "customer-refund",
  "nodes": [
    { "id": "validate", "type": "procedure", "procedureName": "refunds.validate", "next": "process" },
    { "id": "process", "type": "procedure", "procedureName": "refunds.process" }
  ]
}
```

**Human reviews PR:**

```
Comment: "We need manager approval for refunds > $100"
```

**Agent updates workflow:**

```json
{
  "id": "customer-refund",
  "nodes": [
    { "id": "validate", "type": "procedure", "procedureName": "refunds.validate", "next": "check-amount" },
    { "id": "check-amount", "type": "condition",
      "config": {
        "expression": "amount > 100",
        "trueBranch": "request-approval",
        "falseBranch": "process"
      }
    },
    { "id": "request-approval", "type": "procedure", "procedureName": "approvals.request", "next": "process" },
    { "id": "process", "type": "procedure", "procedureName": "refunds.process" }
  ]
}
```

**Merged → Deployed → Agent learns the pattern → applies to similar workflows**

---

## Conclusion

tsdev architecture enables a new way of building software:

### For AI Agents

**Agents become software engineers who:**
- Discover available capabilities (procedures)
- Compose solutions (workflows)
- Commit their work (git)
- Learn from production (OpenTelemetry)
- Iterate on improvements (PR workflow)

**Result:** 10-100x speedup on repeated tasks through workflow caching.

### For Development Teams

**Collaborative intelligence:**
- Agents contribute automation
- Humans contribute domain expertise
- Git manages evolution
- CI/CD ensures quality
- OpenTelemetry provides feedback

**Result:** Workflows improve over time, knowledge compounds across agents.

### Technical Foundation

Built on:

1. **Auto-discovery via reflection**
   - Zero configuration
   - Runtime introspection
   - Agent-friendly JSON APIs

2. **Contracts as source of truth**
   - Zod schemas → validation
   - JSON Schema → agent discovery
   - OpenAPI → ecosystem compatibility

3. **Workflows as compiled logic**
   - Declarative JSON
   - Version controlled in git
   - Reusable across contexts

4. **Function composition**
   - Pure procedures
   - Composable policies
   - No framework magic

5. **Built-in observability**
   - OpenTelemetry everywhere
   - Automatic span hierarchy
   - Agent feedback loop

**Result:** Framework where AI agents build with procedures, humans guide with domain knowledge, and git manages continuous evolution.

---

See [PHILOSOPHY.md](./PHILOSOPHY.md) for the deeper "why" behind this design.
