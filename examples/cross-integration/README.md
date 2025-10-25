# 🔄 Cross-Integration Example

Demonstration of bidirectional interaction between two c4c applications through OpenAPI specifications.

## Architecture

```
┌─────────────────────────────────────────┐
│         App A: Task Manager             │
│                                         │
│  Procedures:                            │
│  - tasks.create                         │
│  - tasks.list                           │
│  - tasks.update                         │
│                                         │
│  Triggers:                              │
│  - task.created (webhook)               │
│  - task.updated (webhook)               │
│                                         │
│  Port: 3001                             │
│  OpenAPI: http://localhost:3001/openapi.json
└─────────────────────────────────────────┘
                    ↕
            c4c integrate
                    ↕
┌─────────────────────────────────────────┐
│    App B: Notification Service          │
│                                         │
│  Procedures:                            │
│  - notifications.send                   │
│  - notifications.list                   │
│  - notifications.subscribe              │
│                                         │
│  Triggers:                              │
│  - notification.sent (webhook)          │
│                                         │
│  Port: 3002                             │
│  OpenAPI: http://localhost:3002/openapi.json
└─────────────────────────────────────────┘
```

## Usage

### 1. Start both applications

```bash
# Terminal 1: App A
cd examples/cross-integration/app-a
pnpm install
pnpm dev  # Will start on :3001

# Terminal 2: App B
cd examples/cross-integration/app-b
pnpm install
pnpm dev  # Will start on :3002
```

### 2. Integrate App A → App B

```bash
cd examples/cross-integration/app-b

# Integrate App A into App B
c4c integrate http://localhost:3001/openapi.json --name task-manager

# Now App B can call App A procedures!
```

### 3. Integrate App B → App A

```bash
cd examples/cross-integration/app-a

# Integrate App B into App A
c4c integrate http://localhost:3002/openapi.json --name notifications

# Now App A can call App B procedures!
```

### 4. Interaction

After integration:

**App A can send notifications through App B:**
```typescript
// In app-a/workflows/task-workflow.ts
steps: [
  {
    id: 'create-task',
    procedure: 'tasks.create',
    input: { title: 'New task' },
  },
  {
    id: 'notify',
    procedure: 'notifications.send', // ← Procedure from App B!
    input: {
      message: 'New task created: {{ steps.create-task.output.title }}',
    },
  },
]
```

**App B can retrieve tasks from App A:**
```typescript
// In app-b/workflows/notification-workflow.ts
steps: [
  {
    id: 'get-tasks',
    procedure: 'task-manager.tasks.list', // ← Procedure from App A!
  },
  {
    id: 'send-summary',
    procedure: 'notifications.send',
    input: {
      message: 'You have {{ steps.get-tasks.output.length }} tasks',
    },
  },
]
```

## Scenarios

### Scenario 1: Automatic task notifications

1. User creates a task in App A
2. App A trigger `task.created` fires
3. Workflow in App A calls `notifications.send` (from App B)
4. App B sends a notification

### Scenario 2: Scheduled task checking

1. App B runs a periodic workflow
2. Calls `task-manager.tasks.list` (from App A)
3. Filters overdue tasks
4. Sends notifications via `notifications.send`

## OpenAPI specifications

Both applications automatically export their specifications:

- App A: http://localhost:3001/openapi.json
- App B: http://localhost:3002/openapi.json

Specifications include:
- ✅ All procedure endpoints (REST + RPC)
- ✅ Webhooks for triggers
- ✅ C4C metadata (`x-c4c-triggers`)
- ✅ Complete data schemas

## Project Structure

```
cross-integration/
├── app-a/                      # Task Manager
│   ├── package.json            # c4c serve in scripts
│   ├── procedures/
│   │   └── tasks.ts           # CRUD for tasks + triggers
│   ├── workflows/
│   │   └── task-workflow.ts   # Workflow with notifications
│   └── generated/             # After App B integration
│       └── notifications/
│           ├── sdk.gen.ts
│           ├── types.gen.ts
│           └── procedures.gen.ts
│
├── app-b/                      # Notification Service
│   ├── package.json            # c4c serve in scripts
│   ├── procedures/
│   │   └── notifications.ts   # Send notifications + triggers
│   ├── workflows/
│   │   └── check-tasks.ts     # Check tasks from App A
│   └── generated/             # After App A integration
│       └── task-manager/
│           ├── sdk.gen.ts
│           ├── types.gen.ts
│           └── procedures.gen.ts
│
├── scripts/
│   ├── integrate-apps.sh      # Automatic integration
│   └── test-integration.sh    # Integration testing
│
└── README.md

IMPORTANT: No server.ts files!
Applications are started via c4c serve,
which automatically scans and loads procedures.
```

## Result

After full integration:

1. ✅ App A has access to App B procedures
2. ✅ App B has access to App A procedures
3. ✅ Both applications can subscribe to each other's triggers
4. ✅ Workflows can freely combine procedures from both applications
5. ✅ Full TypeScript typing for all calls

**This creates an ecosystem of interacting microservices on c4c!** 🎉

## Important Notes

### ⚠️ No server.ts!

C4C applications **do not create their own server.ts**. Instead, use:

```bash
c4c serve --port 3001 --root .
```

**c4c serve automatically:**
- Scans `procedures/` and `workflows/`
- Loads all procedures
- Creates registry
- Starts HTTP server
- Serves `/openapi.json`

### 🔜 Future: c4c prune

For production there will be a `c4c prune` command that:
- Calculates dependencies
- Generates optimized `server.gen.ts` with explicit imports
- Removes dynamic scanning for fast cold starts

See `ARCHITECTURE.md` for details.
