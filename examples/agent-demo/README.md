# AI Agent Demo

Demonstrates AI agent integration with tsdev and Git workflow management.

## What This Shows

This example demonstrates how AI agents can:

1. **Discover procedures** via `/procedures` endpoint
2. **Search for existing workflows** in git
3. **Create new workflows** when none exist
4. **Execute workflows** with full tracing
5. **Analyze traces** to find optimization opportunities
6. **Create draft PRs** with workflow improvements

## Quick Start

### 1. Setup Git Repository

```bash
# Initialize workflows directory
mkdir -p workflows
git init
git add .
git commit -m "Initial commit"
```

### 2. Configure GitHub (Optional)

For PR creation, set environment variables:

```bash
export GITHUB_TOKEN="your_github_token"
export GITHUB_REPO="owner/repo"
```

### 3. Start Server

```bash
pnpm dev
# Server starts on http://localhost:3000
```

### 4. Run Agent Client

In another terminal:

```bash
pnpm agent
```

## How It Works

### Architecture

```
┌──────────────────────────────────────────────┐
│          AI Agent Client                     │
│  1. Receives task                            │
│  2. Calls POST /agent/task                   │
│  3. Receives execution result + PR info      │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│        tsdev HTTP Server                     │
│  ┌────────────────────────────────────────┐ │
│  │ AgentWorkflowManager                   │ │
│  │ 1. Search for workflow in git          │ │
│  │ 2. If not found, expect from agent     │ │
│  │ 3. Execute workflow                    │ │
│  │ 4. Analyze traces                      │ │
│  │ 5. Apply improvements                  │ │
│  │ 6. Create branch + draft PR            │ │
│  └────────────────────────────────────────┘ │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│          Git Repository                      │
│  workflows/                                  │
│  ├── user-onboarding.json                   │
│  ├── payment-processing.json                │
│  └── data-pipeline.json                     │
│                                              │
│  GitHub Pull Requests (Draft)               │
│  #123: Improve user-onboarding workflow     │
└──────────────────────────────────────────────┘
```

### Agent Workflow

```
Task: "Onboard new user"
  ↓
Agent calls: POST /agent/task
  Body: {
    "task": "Onboard new user",
    "workflow": { /* composed workflow */ },
    "input": { "userName": "Alice", "email": "alice@example.com" }
  }
  ↓
Server searches git for existing workflow
  ↓
Not found → Use provided workflow
  ↓
Validate workflow against registry
  ↓
Save to git:
  - Create branch: workflows/user-onboarding-1234567890
  - Commit workflow
  - Push to GitHub
  - Create draft PR
  ↓
Execute workflow
  ↓
Analyze execution traces
  - Found: Slow email sending (1.2s)
  - Suggestion: Add cache
  ↓
Apply improvements
  ↓
Create improvement PR:
  - Branch: workflows/user-onboarding-1234567891
  - Improved workflow with cache metadata
  - Draft PR with statistics
  ↓
Return to agent:
  {
    "execution": { /* result */ },
    "workflowSource": "created",
    "workflow": { /* used workflow */ },
    "improvements": [
      {
        "type": "add-cache",
        "nodes": ["send-email"],
        "reason": "Node taking > 1s",
        "expectedImpact": "50-80% faster"
      }
    ],
    "pr": {
      "url": "https://github.com/owner/repo/pull/124",
      "number": 124
    }
  }
```

## Files

### Server

- **`src/server.ts`** - HTTP server with agent endpoints
- **`src/contracts/`** - Procedure contracts
- **`src/handlers/`** - Procedure implementations

### Agent Client

- **`src/agent-client.ts`** - Simulated AI agent
- **`src/agent-composer.ts`** - Workflow composition logic

## API Endpoints

### Agent Endpoints

```bash
# Main endpoint: Handle task
POST /agent/task
Body: {
  "task": "string",
  "workflow": WorkflowDefinition | null,
  "input": { ... },
  "options": {
    "minConfidence": 0.6,
    "autoImprove": true,
    "agentId": "agent-1"
  }
}

# Search for workflow
GET /agent/workflow/search?task=...&minConfidence=0.6

# Save workflow
POST /agent/workflow/save
Body: {
  "workflow": WorkflowDefinition,
  "task": "string",
  "agentId": "string"
}

# Improve workflow
POST /agent/workflow/improve
Body: {
  "workflow": WorkflowDefinition,
  "executions": WorkflowExecutionResult[],
  "agentId": "string"
}

# List workflows
GET /agent/workflows

# Get workflow by ID
GET /agent/workflow/:id
```

## Example Workflows

### 1. User Onboarding

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
      "procedureName": "emails.sendWelcome",
      "next": "track-signup"
    },
    {
      "id": "track-signup",
      "type": "procedure",
      "procedureName": "analytics.track",
      "config": {
        "event": "user.signup"
      }
    }
  ]
}
```

### 2. Payment Processing

```json
{
  "id": "payment-processing",
  "name": "Payment Processing Flow",
  "version": "1.0.0",
  "startNode": "validate-payment",
  "nodes": [
    {
      "id": "validate-payment",
      "type": "procedure",
      "procedureName": "payments.validate",
      "next": "check-amount"
    },
    {
      "id": "check-amount",
      "type": "condition",
      "config": {
        "expression": "amount > 1000",
        "trueBranch": "require-approval",
        "falseBranch": "process-payment"
      }
    },
    {
      "id": "require-approval",
      "type": "procedure",
      "procedureName": "approvals.request",
      "next": "process-payment"
    },
    {
      "id": "process-payment",
      "type": "procedure",
      "procedureName": "payments.charge"
    }
  ]
}
```

## Workflow Improvements

The agent automatically suggests and applies improvements:

### 1. Retry Logic

**Detected:** Failures in network calls

**Applied:**
```json
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

### 2. Caching

**Detected:** Slow nodes (> 1s)

**Applied:**
```json
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

### 3. Parallelization

**Detected:** Independent sequential nodes

**Applied:**
```json
{
  "id": "parallel-tasks",
  "type": "parallel",
  "config": {
    "branches": ["send-email", "update-crm", "notify-slack"],
    "waitForAll": true
  }
}
```

## Environment Variables

```bash
# Required for Git operations
GIT_REPO_PATH="."
GIT_DEFAULT_BRANCH="main"
GIT_WORKFLOWS_DIR="workflows"

# Optional for GitHub PR creation
GITHUB_TOKEN="ghp_..."
GITHUB_REPO="owner/repo"

# Agent configuration
AGENT_ID="agent-1"
AGENT_MIN_CONFIDENCE="0.6"
AGENT_AUTO_IMPROVE="true"
```

## Testing

```bash
# Test agent workflow
curl -X POST http://localhost:3000/agent/task \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Onboard new user",
    "workflow": {
      "id": "user-onboarding",
      "name": "User Onboarding",
      "version": "1.0.0",
      "startNode": "create-user",
      "nodes": [
        {
          "id": "create-user",
          "type": "procedure",
          "procedureName": "users.create"
        }
      ]
    },
    "input": {
      "userName": "Alice",
      "userEmail": "alice@example.com"
    }
  }'

# Search for workflow
curl "http://localhost:3000/agent/workflow/search?task=onboard%20user"

# List all workflows
curl http://localhost:3000/agent/workflows
```

## Git Workflow

### Branches Created

```
main
  ├── workflows/user-onboarding-1234567890 (initial)
  ├── workflows/user-onboarding-1234567891 (improved)
  └── workflows/payment-processing-1234567892
```

### Pull Requests

Each workflow change creates a draft PR:

```
🤖 Add User Onboarding workflow

## AI Agent Workflow Contribution

**Task:** Onboard new user

### Workflow Details
- **ID:** user-onboarding
- **Name:** User Onboarding Flow
- **Nodes:** 3

### Execution Statistics
| Metric | Value |
|--------|-------|
| Total Executions | 1 |
| Success Rate | 100.0% |
| Avg Duration | 1234ms |
| P95 Duration | 1234ms |

---
*This PR was automatically created by an AI agent.*
*Agent: agent-1*
```

## Next Steps

1. **Merge PR** - Human reviews and merges workflow
2. **Agent reuses** - Next time agent finds workflow in git
3. **Continuous improvement** - Agent analyzes traces and suggests optimizations
4. **Workflow evolution** - Workflows improve over time through agent-human collaboration

## See Also

- [Main README](../../README.md) - Framework overview
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - Detailed architecture
- [@tsdev/git Package](../../packages/git/) - Git integration

## License

MIT
