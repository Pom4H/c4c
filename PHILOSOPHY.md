# tsdev Philosophy

> **AI agents should build with procedures, not prompts.**  
> Workflows are the compiled logic agents reuse instead of re-thinking.

---

## The Core Problem

**AI agents are stateless problem-solvers.**

Every interaction, they:
1. Re-read available context
2. Re-reason about the task
3. Re-compose the solution
4. Re-execute similar patterns

**This is wasteful.**

If an agent successfully completes "create user → send email → track analytics", why should it re-solve this next time?

**What if agents could cache solutions as executable workflows?**

---

## 1. Procedures as Agent Building Blocks

### Traditional Approach: Documentation

Agents read human documentation:

```markdown
# Users API

## Create User
POST /api/users

**Request:**
{
  "name": "string",
  "email": "string"
}

**Response:**
{
  "id": "string",
  "name": "string",
  "email": "string"
}
```

**Problems:**
- Documentation drifts from reality
- Agents must parse unstructured text
- No validation schema
- No introspection
- No compositional semantics

### tsdev Approach: Machine-Readable Contracts

Agents introspect structured contracts:

```typescript
// GET /procedures
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
```

**Benefits:**
- ✅ Always accurate (generated from code)
- ✅ Structured (JSON schema)
- ✅ Validated (runtime + compile-time)
- ✅ Introspectable (agents discover automatically)
- ✅ Composable (procedures → workflows)

---

## 2. Workflows as Cached Agent Logic

### The Insight

**Workflows are compiled agent reasoning.**

When an agent successfully solves a task, that solution is valuable:
- It works (proven by execution)
- It's optimized (debugged through iterations)
- It's reusable (same pattern recurs)

**Why not save it?**

### Workflow as DSL

Agents compose procedures into workflows with the builder API:

```typescript
import { workflow, step } from "@tsdev/workflow";
import { z } from "zod";

const createAccount = step({
  id: "create-account",
  input: z.object({ name: z.string(), email: z.string().email() }),
  output: z.object({ id: z.string() }),
  execute: ({ engine, inputData }) => engine.run("users.create", inputData),
});

const sendEmail = step({
  id: "send-email",
  input: createAccount.output,
  output: z.object({ delivered: z.boolean() }),
  execute: ({ engine }) => engine.run("emails.sendWelcome"),
});

const trackEvent = step({
  id: "track-event",
  input: sendEmail.output,
  output: z.object({ tracked: z.boolean() }),
  execute: ({ engine, variables }) =>
    engine.run("analytics.track", {
      event: "user.signup",
      userId: variables.createAccount?.id,
    }),
});

export const userOnboarding = workflow("user-onboarding")
  .step(createAccount)
  .step(sendEmail)
  .step(trackEvent)
  .commit();
```

**This is executable TypeScript.**

The agent can:
- Execute it: `POST /workflow/execute`
- Save it: commit the `.ts` module to git
- Reuse it: import the module next time
- Improve it: edit the TypeScript and re-run validation

### Performance Impact

**Without workflow caching:**
```
Task: "Onboard user Alice"
Agent reasoning: 30s
API calls: 1.5min
Total: 2min
```

**With workflow caching:**
```
Task: "Onboard user Alice"
Load workflow: 0.1s
Execute workflow: 5s
Total: 5s
```

**40x speedup** by reusing compiled logic.

---

## 3. Git as Workflow Evolution Layer

### Workflows are Code

Workflows are TypeScript modules:
- **Version controlled** - Track changes over time
- **Reviewable** - PR workflow for changes
- **Testable** - Validate before merge
- **Deployable** - CI/CD integration

### Agent + Human Collaboration

**Workflow lifecycle:**

```
1. Agent discovers task pattern
   ↓
2. Agent composes initial workflow
   ↓
3. Agent commits to git (branch)
   ↓
4. Human reviews PR
   ↓
5. Human suggests improvements:
   - Add error handling
   - Optimize parallel execution
   - Add monitoring
   ↓
6. Agent or human updates workflow
   ↓
7. Merge to main → workflow deployed
   ↓
8. Agent uses improved workflow
```

**This is collaborative intelligence:**
- Agents contribute automation
- Humans contribute domain expertise
- Both iterate on shared codebase

### Decomposition at Scale

Complex workflows decompose into sub-workflows:

```
workflows/
├── e-commerce/
│   ├── order-processing.ts        # Main workflow
│   ├── payment-flow.ts            # Sub-workflow
│   ├── inventory-check.ts         # Sub-workflow
│   └── fraud-detection.ts         # Sub-workflow
│
├── user-management/
│   ├── user-onboarding.ts
│   ├── user-offboarding.ts
│   └── password-reset.ts
│
└── data-pipelines/
    ├── etl-main.ts
    ├── extract-users.ts
    ├── transform-events.ts
    └── load-warehouse.ts
```

**Benefits:**
- Each workflow focused on one task
- Reusable across different contexts
- Independently versioned
- Easier to review and test

---

## 4. OpenTelemetry as Agent Feedback

### Workflows Create Traces Automatically

Every workflow execution produces:
- **Span hierarchy** - Shows execution flow
- **Timing data** - Reveals bottlenecks
- **Error details** - Explains failures
- **Input/output** - Validates behavior

**Example trace:**

```
workflow.execute (2.5s)
├── workflow.node.procedure: create-account (1.2s)
│   └── procedure.users.create (1.1s)
│       ├── attribute: input = {"name":"Alice","email":"..."}
│       └── attribute: output = {"id":"user_123",...}
├── workflow.node.procedure: send-email (800ms)
│   └── procedure.emails.send (750ms)
│       └── attribute: status = "sent"
└── workflow.node.procedure: track-event (150ms)
    └── procedure.analytics.track (100ms)
```

### Agents Learn from Traces

Agents can:

**1. Detect bottlenecks**
```typescript
// Agent analyzes trace
const slowestNode = trace.spans
  .filter(s => s.name.includes('workflow.node'))
  .sort((a, b) => b.duration - a.duration)[0];

if (slowestNode.duration > 1000) {
  // Agent suggests: "send-email is slow, add async processing"
  suggestWorkflowImprovement({
    node: "send-email",
    optimization: "make-async"
  });
}
```

**2. Detect failures**
```typescript
// Agent sees error pattern
const failedSpans = trace.spans.filter(s => s.status.code === 'ERROR');

if (failedSpans.length > 0) {
  // Agent suggests: "payment-charge fails, add retry policy"
  suggestWorkflowImprovement({
    node: "payment-charge",
    fix: "add-retry",
    policy: { maxAttempts: 3, backoff: "exponential" }
  });
}
```

**3. Optimize execution**
```typescript
// Agent detects independent nodes
const nodeA = workflow.nodes.find(n => n.id === 'send-email');
const nodeB = workflow.nodes.find(n => n.id === 'track-analytics');

if (!nodeB.dependsOn(nodeA)) {
  // Agent suggests: "execute in parallel"
  suggestWorkflowImprovement({
    change: "parallelize",
    nodes: ["send-email", "track-analytics"]
  });
}
```

**Agents evolve workflows based on production data.**

---

## 5. Convention-Driven Discovery

### Zero Configuration

Agents don't need configuration files or setup:

```typescript
// Agent starts exploring
const response = await fetch('http://api/procedures');
const { procedures } = await response.json();

// Agent now knows everything available
procedures.forEach(proc => {
  agent.knowledgeBase.add({
    name: proc.name,
    capability: proc.description,
    interface: { input: proc.input, output: proc.output },
    constraints: proc.metadata
  });
});
```

### Naming Conventions as Semantics

Procedure names encode meaning:

```
users.create     → Creates a user
users.get        → Retrieves a user
users.update     → Updates a user
users.delete     → Deletes a user

emails.send      → Sends an email
emails.template  → Renders email template

payments.charge  → Charges payment
payments.refund  → Refunds payment
```

**Agents infer relationships:**

```typescript
// Agent reasoning:
// - "users.create" creates a resource
// - "emails.send" is an action
// - After creating user, sending email makes sense
// - Compose workflow: users.create → emails.send
```

**Convention eliminates documentation.**

---

## 6. Composability Over Coupling

### Procedures are Pure Functions

```typescript
type Procedure = (input: Input, context: Context) => Promise<Output>
```

**No side-channel dependencies:**
- No global state
- No implicit context
- No framework coupling
- Just input → output

**This enables:**
- Testing in isolation
- Composition via workflows
- Parallel execution
- Caching/memoization

### Policies as Composition

Cross-cutting concerns compose via policies:

```typescript
import { applyPolicies } from '@tsdev/core';
import { withRetry, withLogging, withSpan, withRateLimit } from '@tsdev/policies';

const handler = applyPolicies(
  baseHandler,
  withRetry({ maxAttempts: 3 }),
  withLogging("users.create"),
  withSpan("users.create"),
  withRateLimit({ maxTokens: 10 })
);
```

**Agents can suggest policies:**

```typescript
// Agent analyzes failure trace
if (error.type === 'NetworkError') {
  suggestPolicy("withRetry", { maxAttempts: 3 });
}

if (trace.duration > SLA_THRESHOLD) {
  suggestPolicy("withCache", { ttl: 3600 });
}
```

---

## 7. Self-Describing Systems

### The Agent's View

Traditional API:
```
Agent: "What can I do?"
System: "Read the docs at /docs"
Agent: *parses HTML*
Agent: *hopes docs are current*
```

tsdev API:
```
Agent: "What can I do?"
System: GET /procedures → [{ name, input, output, description }]
Agent: *structured data*
Agent: *guaranteed accurate*
```

### Introspection as First-Class Feature

Endpoints for agent discovery:

```typescript
GET /procedures              // All available procedures
GET /procedures/:name        // Specific procedure details
GET /openapi.json            // OpenAPI spec (for compatibility)
GET /workflow/list           // Available workflows
GET /workflow/:id/definition // Workflow structure
GET /workflow/:id/history    // Past executions
```

**Agents build mental models:**

```typescript
class AgentKnowledge {
  procedures: Map<string, ProcedureContract>;
  workflows: Map<string, WorkflowDefinition>;
  executionHistory: ExecutionTrace[];
  
  async learn() {
    // Discover procedures
    const procs = await fetch('/procedures').then(r => r.json());
    procs.forEach(p => this.procedures.set(p.name, p));
    
    // Discover workflows
    const workflows = await fetch('/workflow/list').then(r => r.json());
    workflows.forEach(w => this.workflows.set(w.id, w));
    
    // Analyze past executions
    const history = await fetch('/workflow/history').then(r => r.json());
    this.executionHistory = history;
  }
  
  findWorkflowForTask(task: string): WorkflowDefinition | null {
    // Agent matches task to existing workflow
    for (const [id, workflow] of this.workflows) {
      if (this.matchesTask(workflow, task)) {
        return workflow;
      }
    }
    return null;
  }
  
  composeNewWorkflow(task: string): WorkflowDefinition {
    // Agent creates new workflow from procedures
    const relevantProcs = this.findRelevantProcedures(task);
    return this.combineIntoWorkflow(relevantProcs);
  }
}
```

---

## 8. Transport Agnostic = Future Proof

### Same Logic, Different Interfaces

Procedures work across any transport:

```typescript
// HTTP
POST /rpc/users.create

// CLI
tsdev users.create --name Alice --email alice@example.com

// Workflow
{ type: "procedure", procedureName: "users.create" }

// SDK (future)
client.users.create({ name: "Alice", email: "alice@example.com" })

// GraphQL (future)
mutation { createUser(name: "Alice", email: "alice@example.com") { id } }

// gRPC (future)
UsersService.Create({ name: "Alice", email: "alice@example.com" })
```

**Agent doesn't care about transport.**

Agent just knows:
- Procedure name
- Input schema
- Output schema

**Execute via any adapter.**

---

## Design Principles

| Principle | Meaning | Agent Benefit |
|-----------|---------|---------------|
| **Contracts-first** | Procedures defined by schema | Introspectable interface |
| **Workflow caching** | Save successful compositions | Reuse instead of re-think |
| **Git versioning** | Workflows as code | Evolve logic over time |
| **OpenTelemetry** | Automatic tracing | Learn from production data |
| **Convention-driven** | Names encode semantics | Infer relationships |
| **Composable** | Pure functions + policies | Safe to combine |
| **Self-describing** | Built-in introspection | Zero configuration |
| **Transport-agnostic** | Logic independent of API | Future-proof |

---

## Agent Workflow Lifecycle

```
┌─────────────────────────────────────────────────┐
│ 1. Agent explores available procedures         │
│    GET /procedures                              │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│ 2. Agent receives task                          │
│    "Onboard new user with premium features"     │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│ 3. Agent checks: Do I have workflow for this?  │
│    git ls workflows/user-*                      │
└─────────────┬───────────────────────────────────┘
              │
         ┌────┴────┐
         │         │
    Found?      Not Found
         │         │
         ▼         ▼
    ┌────────┐  ┌──────────────────────────┐
    │ Reuse  │  │ 4. Compose new workflow  │
    │ existing│  │    - Select procedures   │
    │ workflow│  │    - Define order        │
    └────┬───┘  │    - Add error handling  │
         │      └────────┬─────────────────┘
         │               │
         │               ▼
         │      ┌──────────────────────────┐
         │      │ 5. Validate workflow     │
         │      │    POST /workflow/validate│
         │      └────────┬─────────────────┘
         │               │
         └───────┬───────┘
                 │
                 ▼
        ┌──────────────────────────┐
        │ 6. Execute workflow      │
        │    POST /workflow/execute │
        └────────┬─────────────────┘
                 │
                 ▼
        ┌──────────────────────────┐
        │ 7. Analyze trace         │
        │    - Check for errors    │
        │    - Measure performance │
        │    - Suggest improvements│
        └────────┬─────────────────┘
                 │
                 ▼
        ┌──────────────────────────┐
        │ 8. Commit workflow       │
        │    git add workflows/    │
        │    git commit            │
        │    git push              │
        └────────┬─────────────────┘
                 │
                 ▼
        ┌──────────────────────────┐
        │ 9. Next task uses        │
        │    cached workflow       │
        └──────────────────────────┘
```

---

## Real-World Impact

### Before tsdev

```
Agent task: "Process customer order"

Agent reasoning (30s):
- Need to validate order
- Check inventory
- Process payment
- Create shipment
- Send confirmation

Agent execution (90s):
- Call validation API
- Call inventory API
- Call payment API
- Call shipping API
- Call email API

Total: 2 minutes per order
```

### After tsdev

```
Agent task: "Process customer order"

Agent checks: workflows/order-processing.ts exists

Agent execution (5s):
- Load workflow
- Execute with order data
- Return result

Total: 5 seconds per order
```

**24x faster for repeated tasks.**

### Scaling to 100 Agents

**Without workflow caching:**
- Each agent re-solves same tasks
- 100 agents = 100x duplicated work
- No knowledge transfer

**With workflow caching:**
- First agent solves task → commits workflow
- Other 99 agents reuse workflow
- Knowledge compounds across agents

**This is how agent systems scale.**

---

## Conclusion

tsdev is built on one insight:

**Agents should compose with procedures, not prompts.**

When agents can:
- Discover procedures automatically
- Compose workflows declaratively
- Cache successful solutions in git
- Learn from execution traces
- Evolve workflows over time

**They become 10-100x more effective.**

The framework doesn't just serve agents—it turns them into software engineers who commit their work to version control.

---

See [ARCHITECTURE.md](./ARCHITECTURE.md) for implementation details.
