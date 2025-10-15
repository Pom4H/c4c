# AI Agent Workflow with Git Integration

Complete guide for AI agents to discover, compose, execute, and improve workflows using tsdev with Git version control.

---

## Quick Overview

```
AI Agent Task → Search Git → Found? Reuse : Compose New → Execute → Analyze → Improve → Create PR
```

## Table of Contents

1. [Agent Lifecycle](#agent-lifecycle)
2. [Discovery API](#discovery-api)
3. [Workflow Composition](#workflow-composition)
4. [Git Integration](#git-integration)
5. [Trace Analysis](#trace-analysis)
6. [Continuous Improvement](#continuous-improvement)
7. [Examples](#examples)

---

## Agent Lifecycle

### Complete Flow

```
┌──────────────────────────────────────┐
│  1. Agent receives task              │
│     "Onboard new user Alice"         │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  2. Discover available procedures    │
│     GET /procedures                  │
│     → [users.create, emails.send...] │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  3. Search for existing workflow     │
│     GET /agent/workflow/search       │
│       ?task=onboard+user             │
└──────────┬───────────────────────────┘
           │
     ┌─────┴─────┐
     │           │
   Found?    Not found
     │           │
     ▼           ▼
┌─────────┐  ┌────────────────────────┐
│ Reuse   │  │ 4. Compose workflow    │
│ cached  │  │    from procedures     │
│ workflow│  │    POST /agent/task    │
└────┬────┘  └──────┬─────────────────┘
     │              │
     │              ▼
     │      ┌────────────────────────┐
     │      │ 5. Save to git         │
     │      │    - Create branch     │
     │      │    - Commit workflow   │
     │      │    - Create draft PR   │
     │      └──────┬─────────────────┘
     │             │
     └──────┬──────┘
            │
            ▼
┌──────────────────────────────────────┐
│  6. Execute workflow                 │
│     Full OpenTelemetry tracing       │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  7. Analyze traces                   │
│     - Find bottlenecks               │
│     - Detect failures                │
│     - Identify optimization          │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  8. Suggest improvements             │
│     - Add retry logic                │
│     - Add caching                    │
│     - Parallelize nodes              │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  9. Apply improvements (optional)    │
│     - Create new branch              │
│     - Improved workflow              │
│     - Create improvement PR          │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  10. Return result to agent          │
│      - Execution data                │
│      - Workflow source               │
│      - Improvements                  │
│      - PR URLs                       │
└──────────────────────────────────────┘
```

---

## Discovery API

### 1. List All Procedures

**Endpoint:** `GET /procedures`

**Response:**
```json
{
  "procedures": [
    {
      "name": "users.create",
      "description": "Create a new user account",
      "metadata": {
        "tags": ["users", "write"]
      }
    },
    {
      "name": "emails.sendWelcome",
      "description": "Send welcome email to new user",
      "metadata": {
        "tags": ["emails", "notifications"]
      }
    }
  ]
}
```

**Agent Usage:**
```typescript
// Agent discovers capabilities
const { procedures } = await fetch('/procedures').then(r => r.json());

// Build knowledge base
const knowledgeBase = new Map();
for (const proc of procedures) {
  knowledgeBase.set(proc.name, proc);
}

// Agent can now compose workflows from available procedures
```

### 2. Get OpenAPI Specification

**Endpoint:** `GET /openapi.json`

**Response:** Full OpenAPI 3.0 spec with all procedures

**Agent Usage:**
```typescript
// For agents that understand OpenAPI
const spec = await fetch('/openapi.json').then(r => r.json());

// Extract operation schemas
for (const [path, methods] of Object.entries(spec.paths)) {
  // Build structured understanding
}
```

---

## Workflow Composition

### Agent Composes Workflow

Based on discovered procedures, agent creates workflow definition:

```typescript
const workflow: WorkflowDefinition = {
  id: "user-onboarding",
  name: "User Onboarding Flow",
  description: "Complete user registration process",
  version: "1.0.0",
  startNode: "create-user",
  nodes: [
    {
      id: "create-user",
      type: "procedure",
      procedureName: "users.create",  // From discovery
      config: {
        name: "{{ input.userName }}",  // Variable interpolation
        email: "{{ input.userEmail }}"
      },
      next: "send-welcome"
    },
    {
      id: "send-welcome",
      type: "procedure",
      procedureName: "emails.sendWelcome",
      config: {
        userId: "{{ createUser.id }}",  // Reference previous output
        email: "{{ createUser.email }}",
        name: "{{ createUser.name }}"
      },
      next: "track-event"
    },
    {
      id: "track-event",
      type: "procedure",
      procedureName: "analytics.track",
      config: {
        event: "user.signup",
        userId: "{{ createUser.id }}"
      }
    }
  ],
  metadata: {
    tags: ["onboarding", "users"],
    author: "ai-agent",
    createdAt: "2025-10-15T12:00:00Z"
  }
};
```

### Node Types

#### Procedure Node
```typescript
{
  id: "step-1",
  type: "procedure",
  procedureName: "users.create",  // Must exist in registry
  config: { /* input data */ },
  next: "step-2",
  onError: "error-handler"  // Optional error handling
}
```

#### Condition Node
```typescript
{
  id: "check-premium",
  type: "condition",
  config: {
    expression: "isPremium === true",  // JavaScript expression
    trueBranch: "premium-flow",
    falseBranch: "basic-flow"
  }
}
```

#### Parallel Node
```typescript
{
  id: "parallel-tasks",
  type: "parallel",
  config: {
    branches: ["send-email", "update-crm", "notify-slack"],
    waitForAll: true  // or false for race
  },
  next: "next-step"
}
```

---

## Git Integration

### Workflow Storage Structure

```
repo/
├── workflows/
│   ├── user-onboarding.json
│   ├── payment-processing.json
│   ├── data-pipeline.json
│   └── e-commerce/
│       ├── order-processing.json
│       └── inventory-sync.json
├── .github/
│   └── workflows/
│       └── validate-workflows.yml
└── src/
    ├── contracts/
    └── handlers/
```

### Git Operations

#### 1. Search for Workflow

**Endpoint:** `GET /agent/workflow/search?task={task}&minConfidence=0.6`

**Response:**
```json
{
  "workflow": {
    "id": "user-onboarding",
    "name": "User Onboarding Flow",
    ...
  }
}
```

**Agent Code:**
```typescript
const response = await fetch(
  `/agent/workflow/search?task=${encodeURIComponent(task)}&minConfidence=0.6`
);
const { workflow } = await response.json();

if (workflow) {
  // Reuse existing workflow
  console.log(`Found workflow: ${workflow.id}`);
} else {
  // Compose new workflow
  const newWorkflow = await composeWorkflow(task);
}
```

#### 2. Save Workflow

**Endpoint:** `POST /agent/workflow/save`

**Request:**
```json
{
  "workflow": { /* WorkflowDefinition */ },
  "task": "Onboard new user",
  "agentId": "agent-1"
}
```

**Response:**
```json
{
  "workflowId": "user-onboarding",
  "branch": "workflows/user-onboarding-1729012345678",
  "commitSha": "abc123...",
  "prUrl": "https://github.com/owner/repo/pull/123",
  "prNumber": 123
}
```

**What Happens:**
1. Creates new git branch
2. Commits workflow to `workflows/{id}.json`
3. Pushes to GitHub
4. Creates draft pull request
5. Returns PR info to agent

#### 3. Handle Task (All-in-One)

**Endpoint:** `POST /agent/task`

**Request:**
```json
{
  "task": "Onboard new user",
  "workflow": { /* WorkflowDefinition or null */ },
  "input": {
    "userName": "Alice",
    "userEmail": "alice@example.com"
  },
  "options": {
    "minConfidence": 0.6,
    "autoImprove": true,
    "agentId": "agent-1"
  }
}
```

**Response:**
```json
{
  "execution": {
    "executionId": "exec_123",
    "status": "completed",
    "executionTime": 1234,
    "nodesExecuted": ["create-user", "send-welcome", "track-event"],
    "outputs": {
      "createUser": { "id": "user_789", ... },
      "sendWelcome": { "messageId": "msg_456", ... },
      "trackEvent": { "eventId": "evt_123", ... }
    },
    "spans": [ /* OpenTelemetry spans */ ]
  },
  "workflowSource": "created",  // or "cached"
  "workflow": { /* used workflow */ },
  "improvements": [
    {
      "type": "add-cache",
      "nodes": ["send-welcome"],
      "reason": "Node taking > 1s: send-welcome(1234ms)",
      "expectedImpact": "50-80% faster",
      "confidence": 0.8
    }
  ],
  "pr": {
    "url": "https://github.com/owner/repo/pull/124",
    "number": 124
  }
}
```

### Pull Request Structure

When agent creates or improves workflow, draft PR is created:

```markdown
🤖 Add User Onboarding workflow

## AI Agent Workflow Contribution

**Task:** Onboard new user

### Workflow Details
- **ID:** `user-onboarding`
- **Name:** User Onboarding Flow
- **Version:** 1.0.0
- **Nodes:** 3

**Description:** Complete user registration with email and analytics

### Improvements Applied

#### add-cache
- **Reason:** Node taking > 1s: send-welcome(1234ms)
- **Nodes affected:** send-welcome
- **Expected impact:** 50-80% faster execution
- **Confidence:** 80.0%

### Execution Statistics

| Metric | Value |
|--------|-------|
| Total Executions | 1 |
| Success Rate | 100.0% |
| Avg Duration | 1234ms |
| P95 Duration | 1234ms |

### Workflow Structure

```json
{
  "id": "user-onboarding",
  ...
}
```

---

*This PR was automatically created by an AI agent.*
*Agent: agent-1*

Please review the workflow structure and approve if it looks good.
```

---

## Trace Analysis

### Automatic Improvements

Agent analyzes OpenTelemetry traces to suggest improvements:

#### 1. Detect Failures → Add Retry

```typescript
// Trace shows failures
{
  "spanId": "span_1",
  "name": "workflow.node.procedure",
  "status": { "code": "ERROR" },
  "attributes": {
    "node.id": "send-email",
    "error.type": "NetworkError"
  }
}

// Agent suggests
{
  "type": "add-retry",
  "nodes": ["send-email"],
  "reason": "Detected failures in execution",
  "expectedImpact": "Improve success rate by 10-20%"
}

// Applied to workflow
{
  "id": "send-email",
  "metadata": {
    "retry": {
      "maxAttempts": 3,
      "backoff": "exponential",
      "delayMs": 100
    }
  }
}
```

#### 2. Detect Slow Nodes → Add Cache

```typescript
// Trace shows slow execution
{
  "spanId": "span_2",
  "name": "workflow.node.procedure",
  "duration": 1234,  // > 1000ms
  "attributes": {
    "node.id": "fetch-user-data"
  }
}

// Agent suggests
{
  "type": "add-cache",
  "nodes": ["fetch-user-data"],
  "reason": "Node taking > 1s: fetch-user-data(1234ms)",
  "expectedImpact": "50-80% faster"
}

// Applied
{
  "id": "fetch-user-data",
  "metadata": {
    "cache": {
      "enabled": true,
      "ttl": 3600
    }
  }
}
```

#### 3. Detect Independent Nodes → Parallelize

```typescript
// Workflow has sequential independent nodes
nodes: [
  { id: "send-email", next: "update-crm" },
  { id: "update-crm", next: "notify-slack" },
  { id: "notify-slack" }
]

// Agent detects: update-crm doesn't use send-email output

// Agent suggests
{
  "type": "parallelize",
  "nodes": ["send-email", "update-crm", "notify-slack"],
  "reason": "Found 3 independent nodes",
  "expectedImpact": "2x faster"
}

// Applied
nodes: [
  {
    id: "parallel-notifications",
    type: "parallel",
    config: {
      branches: ["send-email", "update-crm", "notify-slack"],
      waitForAll: true
    }
  }
]
```

---

## Continuous Improvement

### Improvement Workflow

```
Execute workflow (N times)
  ↓
Collect traces
  ↓
Analyze patterns:
  - Failure rate > 5% → add retry
  - Duration > SLA → add cache/optimize
  - Sequential independent → parallelize
  ↓
Apply improvements
  ↓
Create PR with:
  - Updated workflow
  - Execution statistics
  - Improvement reasoning
  ↓
Human reviews and merges
  ↓
Workflow deployed
  ↓
Agent uses improved version
```

### Improvement API

**Endpoint:** `POST /agent/workflow/improve`

**Request:**
```json
{
  "workflow": { /* WorkflowDefinition */ },
  "executions": [
    { /* WorkflowExecutionResult 1 */ },
    { /* WorkflowExecutionResult 2 */ },
    ...
  ],
  "agentId": "agent-1"
}
```

**Response:**
```json
{
  "workflowId": "user-onboarding",
  "branch": "workflows/user-onboarding-1729012345679",
  "commitSha": "def456...",
  "prUrl": "https://github.com/owner/repo/pull/125",
  "prNumber": 125
}
```

---

## Examples

### Example 1: Agent Handles New Task

```typescript
// 1. Agent receives task
const task = "Onboard new user Alice";

// 2. Search for workflow
const response = await fetch(
  `/agent/workflow/search?task=${encodeURIComponent(task)}`
);
const { workflow } = await response.json();

// 3. If not found, compose
if (!workflow) {
  workflow = {
    id: "user-onboarding",
    nodes: [ /* ... */ ]
  };
}

// 4. Execute via agent API
const result = await fetch('/agent/task', {
  method: 'POST',
  body: JSON.stringify({
    task,
    workflow,
    input: {
      userName: "Alice",
      userEmail: "alice@example.com"
    },
    options: {
      autoImprove: true,
      agentId: "agent-1"
    }
  })
}).then(r => r.json());

// 5. Result includes everything
console.log("Status:", result.execution.status);
console.log("PR created:", result.pr?.url);
console.log("Improvements:", result.improvements);
```

### Example 2: Agent Improves Workflow

```typescript
// Agent has collected 100 executions
const executions = await loadExecutions("user-onboarding", 100);

// Analyze and improve
const improvement = await fetch('/agent/workflow/improve', {
  method: 'POST',
  body: JSON.stringify({
    workflow: currentWorkflow,
    executions,
    agentId: "agent-1"
  })
}).then(r => r.json());

if (improvement) {
  console.log("Improvement PR:", improvement.prUrl);
} else {
  console.log("No improvements needed");
}
```

---

## Configuration

### Environment Variables

```bash
# Git Configuration
GIT_REPO_PATH="."
GIT_DEFAULT_BRANCH="main"
GIT_WORKFLOWS_DIR="workflows"

# GitHub (for PR creation)
GITHUB_TOKEN="ghp_..."
GITHUB_REPO="owner/repo"

# Agent Settings
AGENT_MIN_CONFIDENCE="0.6"
AGENT_AUTO_IMPROVE="true"
```

### Initialize Agent Manager

```typescript
import { initializeAgentManager } from '@tsdev/adapters';

const gitConfig = {
  repoPath: process.env.GIT_REPO_PATH,
  defaultBranch: "main",
  workflowsDir: "workflows",
  githubToken: process.env.GITHUB_TOKEN,
  githubRepo: process.env.GITHUB_REPO
};

initializeAgentManager(gitConfig, registry);
```

---

## Summary

### Agent Capabilities

✅ **Discovery** - Find available procedures via `/procedures`  
✅ **Search** - Find existing workflows in git  
✅ **Compose** - Create new workflows from procedures  
✅ **Execute** - Run workflows with full tracing  
✅ **Analyze** - Detect optimization opportunities  
✅ **Improve** - Apply improvements automatically  
✅ **Version** - All workflows in git with PR workflow  
✅ **Collaborate** - Humans review and approve changes  

### Key Benefits

🚀 **10-100x faster** - Reuse workflows instead of re-composing  
📈 **Continuous improvement** - Workflows evolve based on production data  
🤝 **Human-AI collaboration** - Agents propose, humans approve  
📦 **Version controlled** - Full git history of all workflows  
🔍 **Full observability** - OpenTelemetry traces for every execution  

---

## See Also

- [@tsdev/git Package](./packages/git/) - Git integration implementation
- [Agent Demo Example](./examples/agent-demo/) - Complete working example
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical details

## License

MIT
