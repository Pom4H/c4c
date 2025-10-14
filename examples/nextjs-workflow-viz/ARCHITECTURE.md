# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │          Page Component (page.tsx)                 │     │
│  │  - Workflow selection                              │     │
│  │  - Execute button                                  │     │
│  │  - Tab navigation                                  │     │
│  └───────────┬────────────────────────────────────────┘     │
│              │                                               │
│       ┌──────┴──────┐                                        │
│       ▼             ▼                                        │
│  ┌─────────┐  ┌──────────┐                                  │
│  │ WorkflowVisualizer │  TraceViewer │                      │
│  │                    │             │                        │
│  │ - React Flow       │  - Timeline │                       │
│  │ - Node rendering   │  - Spans    │                       │
│  │ - Animation        │  - Details  │                       │
│  └────────────────────┴─────────────┘                       │
│              │                                               │
└──────────────┼───────────────────────────────────────────────┘
               │ Server Action Call
               │ executeWorkflowAction(id)
               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Next.js Server                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │         Server Actions (actions.ts)                │     │
│  │  - executeWorkflowAction()                         │     │
│  │  - getAvailableWorkflows()                         │     │
│  │  - getWorkflowDefinition()                         │     │
│  └───────────┬────────────────────────────────────────┘     │
│              │                                               │
│              ▼                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │      Workflow Runtime (runtime.ts)                 │     │
│  │                                                     │     │
│  │  executeWorkflow()                                 │     │
│  │    ├─→ TraceCollector (OpenTelemetry)             │     │
│  │    ├─→ executeNode() for each node                │     │
│  │    │    ├─→ executeProcedureNode()                │     │
│  │    │    ├─→ executeConditionNode()                │     │
│  │    │    └─→ executeParallelNode()                 │     │
│  │    └─→ Collect spans & results                    │     │
│  │                                                     │     │
│  └───────────┬────────────────────────────────────────┘     │
│              │                                               │
│              ▼                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │         Mock Procedures (runtime.ts)               │     │
│  │  - math.add                                        │     │
│  │  - math.multiply                                   │     │
│  │  - math.subtract                                   │     │
│  │  - data.fetch                                      │     │
│  │  - data.process                                    │     │
│  │  - data.save                                       │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Workflow Execution Flow

```
User Click
    │
    ▼
┌──────────────────────┐
│ handleExecute()      │ (Client)
└─────────┬────────────┘
          │ Server Action call
          ▼
┌──────────────────────┐
│ executeWorkflowAction│ (Server)
│ - Get workflow def   │
└─────────┬────────────┘
          │
          ▼
┌──────────────────────┐
│ executeWorkflow()    │ (Server)
│ - Start trace        │
│ - Execute nodes      │
│ - Collect spans      │
└─────────┬────────────┘
          │
          ▼
┌──────────────────────┐
│ Return result        │ (Serialized)
│ - executionId        │
│ - status             │
│ - outputs            │
│ - spans              │
└─────────┬────────────┘
          │ Automatic serialization
          ▼
┌──────────────────────┐
│ setExecutionResult() │ (Client)
│ - Update state       │
│ - Trigger re-render  │
└──────────────────────┘
          │
          ▼
┌──────────────────────┐
│ UI Updates           │
│ - Graph animation    │
│ - Trace visualization│
│ - Statistics         │
└──────────────────────┘
```

### 2. OpenTelemetry Span Hierarchy

```
workflow.execute (Root Span)
│
├─→ workflow.node.procedure (Node 1)
│   └─→ procedure.math.add
│       ├─→ event: procedure.input
│       └─→ event: procedure.output
│
├─→ workflow.node.procedure (Node 2)
│   └─→ procedure.math.multiply
│       ├─→ event: procedure.input
│       └─→ event: procedure.output
│
└─→ workflow.node.parallel (Node 3)
    ├─→ workflow.parallel.branch (Branch 1)
    │   └─→ procedure.task1
    ├─→ workflow.parallel.branch (Branch 2)
    │   └─→ procedure.task2
    └─→ workflow.parallel.branch (Branch 3)
        └─→ procedure.task3
```

## Component Hierarchy

```
RootLayout
  │
  └─→ Page (Client Component)
      │
      ├─→ Header
      │   └─→ Title & Description
      │
      ├─→ Controls Panel
      │   ├─→ Workflow Selector
      │   ├─→ Execute Button
      │   └─→ Execution Status
      │
      ├─→ Tab Navigation
      │   ├─→ Graph Tab Button
      │   └─→ Trace Tab Button
      │
      ├─→ Tab Content
      │   ├─→ WorkflowVisualizer (if graph tab)
      │   │   ├─→ ReactFlow
      │   │   │   ├─→ Nodes (auto-generated)
      │   │   │   ├─→ Edges (auto-generated)
      │   │   │   ├─→ Background
      │   │   │   ├─→ Controls
      │   │   │   ├─→ MiniMap
      │   │   │   └─→ Panels
      │   │   │       ├─→ Workflow Info
      │   │   │       └─→ Execution Stats
      │   │
      │   └─→ TraceViewer (if trace tab)
      │       ├─→ Timeline (for each span)
      │       ├─→ Span Details (collapsible)
      │       └─→ Summary Stats
      │
      └─→ Workflow Details
          ├─→ Information Grid
          ├─→ Node Types Legend
          └─→ Node List Table
```

## State Management

```
┌─────────────────────────────────────┐
│         Component State             │
├─────────────────────────────────────┤
│                                     │
│  workflows: WorkflowInfo[]          │
│    ↓ (loaded on mount)              │
│  selectedWorkflowId: string         │
│    ↓ (triggers load)                │
│  selectedWorkflow: WorkflowDef      │
│    ↓ (used for visualization)       │
│  executionResult: ExecutionResult   │
│    ↓ (updates after execution)      │
│  isExecuting: boolean               │
│    ↓ (controls UI state)            │
│  activeTab: 'graph' | 'trace'       │
│    ↓ (determines active view)       │
│                                     │
└─────────────────────────────────────┘
```

## Workflow Node Types

```
┌──────────────────────────────────────────────┐
│           Workflow Node Types                │
├──────────────────────────────────────────────┤
│                                              │
│  ┌─────────────────┐                        │
│  │   Procedure     │ Execute a function     │
│  │   🟢 Green      │ with input/output      │
│  └─────────────────┘                        │
│                                              │
│  ┌─────────────────┐                        │
│  │   Condition     │ Branch based on        │
│  │   🟡 Yellow     │ expression result      │
│  └─────────────────┘                        │
│                                              │
│  ┌─────────────────┐                        │
│  │   Parallel      │ Execute multiple       │
│  │   🟣 Purple     │ branches at once       │
│  └─────────────────┘                        │
│                                              │
│  ┌─────────────────┐                        │
│  │   Sequential    │ Simple pass-through    │
│  │   🔵 Blue       │ to next node           │
│  └─────────────────┘                        │
│                                              │
└──────────────────────────────────────────────┘
```

## Execution Timeline Example

```
Time →
0ms    500ms   1000ms  1500ms  2000ms  2500ms
│──────│───────│───────│───────│───────│
│
├─ workflow.execute ─────────────────────────┤
│                                            │
├─ node: add-numbers ──────┤                │
│  ├─ procedure.math.add ──┤                │
│                           │                │
│                           ├─ node: multiply ──────┤
│                           │  ├─ procedure.math.mul │
│                                                    │
│                                                    ├─ node: subtract ──┤
│                                                    │  ├─ proc.subtract  │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

## File Dependencies

```
page.tsx
  │
  ├─→ actions.ts (Server Actions)
  │   └─→ runtime.ts
  │       └─→ types.ts
  │       └─→ examples.ts
  │
  ├─→ WorkflowVisualizer.tsx
  │   └─→ @xyflow/react
  │   └─→ types.ts
  │
  └─→ TraceViewer.tsx
      └─→ types.ts
```

## Type Flow

```
┌────────────────────┐
│ WorkflowDefinition │ (Input)
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ executeWorkflow()  │ (Runtime)
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ ExecutionResult    │ (Output)
│ - executionId      │
│ - status           │
│ - outputs          │
│ - nodesExecuted    │
│ - spans[]          │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ React Components   │ (Visualization)
└────────────────────┘
```

## Integration Points

### With Main Project

```
Current (Standalone)              Future (Integrated)
─────────────────────             ───────────────────

mockProcedures                    registry.procedures
  ↓                                 ↓
executeWorkflow()        →        executeWorkflow()
  │                                 │
  └─ Mock execution                 └─ Real execution
                                    │
                                    └─ Real telemetry export
```

### Extension Points

```
┌──────────────────────────────────────┐
│       Extension Points               │
├──────────────────────────────────────┤
│                                      │
│  1. Custom Procedures                │
│     mockProcedures = {               │
│       "custom.action": async () {}   │
│     }                                │
│                                      │
│  2. Custom Workflows                 │
│     export const myWorkflow = {...}  │
│                                      │
│  3. Custom Node Rendering            │
│     <ReactFlow nodeTypes={...} />    │
│                                      │
│  4. Custom Trace Export              │
│     collector.getSpans()             │
│       → send to backend              │
│                                      │
│  5. Real-time Updates                │
│     WebSocket / Server-Sent Events   │
│                                      │
└──────────────────────────────────────┘
```

## Performance Considerations

```
┌─────────────────────────────────────┐
│      Performance Profile            │
├─────────────────────────────────────┤
│                                     │
│  Server Action Overhead: ~10-20ms   │
│  Serialization: ~5-10ms             │
│  Network: ~50-100ms (local)         │
│  Workflow Execution: 500-3000ms     │
│  React Rendering: ~20-50ms          │
│  React Flow Layout: ~50-100ms       │
│                                     │
│  Total: ~650-3300ms per execution   │
│                                     │
└─────────────────────────────────────┘
```

## Security Considerations

```
┌─────────────────────────────────────┐
│       Security Layers               │
├─────────────────────────────────────┤
│                                     │
│  1. Server Actions                  │
│     - "use server" directive        │
│     - Server-only execution         │
│                                     │
│  2. Input Validation                │
│     - Zod schemas (if added)        │
│     - Type checking                 │
│                                     │
│  3. Rate Limiting (TODO)            │
│     - Per-user limits               │
│     - Per-workflow limits           │
│                                     │
│  4. Authentication (TODO)           │
│     - User verification             │
│     - Access control                │
│                                     │
└─────────────────────────────────────┘
```

## Deployment Architecture

```
Production Deployment
─────────────────────

┌─────────────────────────────────────┐
│           Vercel / Cloud            │
├─────────────────────────────────────┤
│                                     │
│  Edge Runtime                       │
│    └─→ Static Pages                │
│                                     │
│  Node.js Runtime                    │
│    ├─→ Server Actions               │
│    ├─→ Workflow Execution           │
│    └─→ Telemetry Collection         │
│                                     │
│  Database (Optional)                │
│    └─→ Execution History            │
│                                     │
│  Telemetry Backend (Optional)       │
│    ├─→ Jaeger                       │
│    ├─→ Zipkin                       │
│    └─→ Custom Collector             │
│                                     │
└─────────────────────────────────────┘
```

---

This architecture enables:
- ✅ Clean separation of concerns
- ✅ Type-safe communication
- ✅ Scalable workflow execution
- ✅ Comprehensive observability
- ✅ Easy extensibility
