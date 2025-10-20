# Workflow Visualization Example

**Next.js 15 + React Flow + OpenTelemetry**

Live visual workflow execution with full distributed tracing.

## What This Demonstrates

This example shows how c4c workflows automatically provide:

1. **Visual workflow composition** - Drag-and-drop style node graphs
2. **Real-time execution tracing** - OpenTelemetry spans for every node
3. **Interactive visualization** - See your workflow execute in real-time
4. **Zero instrumentation** - Tracing is built into the workflow runtime

## Quick Start

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000

## Architecture

```
User clicks "Execute"
  ↓
Next.js Server Action
  ↓
executeWorkflow(workflow, registry)
  ↓ (creates OpenTelemetry spans automatically)
  ├─ workflow.execute (parent span)
  │  ├─ workflow.node.procedure (math.add)
  │  ├─ workflow.node.procedure (math.multiply)
  │  └─ workflow.node.procedure (math.subtract)
  ↓
Returns ExecutionResult with spans
  ↓
React components visualize:
  ├─ WorkflowVisualizer (React Flow graph)
  └─ TraceViewer (span timeline)
```

## What You Get

### 1. Visual Workflow Editor

Workflows are just JSON:

```typescript
const workflow: WorkflowDefinition = {
  id: "math-calculation",
  name: "Math Workflow",
  startNode: "add",
  nodes: [
    {
      id: "add",
      type: "procedure",
      procedureName: "math.add",  // References actual procedure
      config: { a: 10, b: 5 },
      next: "multiply"
    },
    {
      id: "multiply",
      type: "procedure",
      procedureName: "math.multiply",
      config: { a: 2 },
      next: "subtract"
    }
  ]
};
```

**Visualized as:**
- Interactive node graph (React Flow)
- Color-coded by type (procedure, condition, parallel)
- Shows execution flow
- Highlights active nodes

### 2. Automatic OpenTelemetry Tracing

**No instrumentation code needed.**

Every workflow execution automatically creates:

```
workflow.execute
├── workflow.node.procedure (add)
│   └── procedure.math.add
│       ├── attributes: { input: {...}, output: {...} }
│       └── duration: 5ms
├── workflow.node.procedure (multiply)
│   └── procedure.math.multiply
│       └── duration: 3ms
└── workflow.node.procedure (subtract)
    └── procedure.math.subtract
        └── duration: 4ms
```

**Displayed as:**
- Timeline view (like Jaeger/Zipkin)
- Span hierarchy
- Duration visualization
- Attribute inspection

### 3. Workflow Patterns

**Sequential:**
```typescript
node1 → node2 → node3
```

**Conditional:**
```typescript
check-premium
├─ true → premium-processing
└─ false → basic-processing
```

**Parallel:**
```typescript
parallel-node
├─ branch1 (runs concurrently)
├─ branch2 (runs concurrently)
└─ branch3 (runs concurrently)
```

All patterns automatically traced.

## Example Workflows

### 1. Math Calculation (Sequential)
```
add(10, 5) → multiply(result, 2) → subtract(100, result)
Result: 100 - (15 * 2) = 70
```

### 2. Conditional Processing
```
fetch-user → check-premium
             ├─ premium → premium-processing
             └─ basic → basic-processing
             → save-results
```

### 3. Parallel Execution
```
parallel-tasks (wait for all)
├─ math.add(10, 20)
├─ math.multiply(5, 6)
└─ math.subtract(100, 25)
→ aggregate-results
```

### 4. Complex (All Patterns)
```
init → parallel-checks → evaluate-results
       ├─ check1            ├─ high-score → finalize
       └─ check2            └─ low-score → finalize
```

### 5. Error Handling
```
math.add → math.divide(b=0)
           └─ ZodError: division by zero
```

**Shows:**
- Failed spans (red)
- Error messages
- Partial execution state

## Components

### WorkflowVisualizer (React Flow)

**Location:** `src/components/WorkflowVisualizer.tsx`

Renders workflow as interactive graph:

```typescript
<ReactFlow
  nodes={workflowNodes}  // Auto-generated from WorkflowDefinition
  edges={workflowEdges}  // Auto-generated from node.next
  nodeTypes={customNodeTypes}
>
  <Background />
  <Controls />
  <MiniMap />
</ReactFlow>
```

**Features:**
- Auto-layout (dagre algorithm)
- Color-coded nodes by type
- Execution state highlighting
- Node timing display

### TraceViewer (OpenTelemetry)

**Location:** `src/components/TraceViewer.tsx`

Renders spans as timeline:

```typescript
{spans.map(span => (
  <div style={{
    marginLeft: span.depth * 20,
    width: (span.duration / totalTime) * 100 + '%'
  }}>
    {span.name} - {span.duration}ms
  </div>
))}
```

**Features:**
- Hierarchical span display
- Relative timing visualization
- Attribute inspection
- Error highlighting

### SpanGanttChart

**Location:** `src/components/SpanGanttChart.tsx`

Advanced Gantt chart visualization:

```typescript
<SpanGanttChart spans={result.spans} />
```

Shows:
- Concurrent execution (parallel nodes)
- Timeline with scale
- Span overlap
- Critical path

## Server Actions

**Location:** `src/app/api/workflow/`

Next.js server actions execute workflows:

```typescript
"use server";

export async function executeWorkflowAction(workflowId: string) {
  const workflow = workflows[workflowId];
  const registry = await collectRegistry();
  
  // Executes with full OpenTelemetry tracing
  const result = await executeWorkflow(workflow, registry);
  
  // Returns serialized spans + results
  return result;
}
```

**Endpoints:**
- `/api/workflow/execute` - Execute workflow
- `/api/workflow/list` - List available workflows
- `/api/workflow/definition` - Get workflow JSON
- `/api/workflow/stream` - Stream execution events (TODO)

## Integration with Main Project

This example uses **mock procedures** for demo purposes:

```typescript
// Mock (current)
const mockProcedures = {
  "math.add": async (input) => ({ result: input.a + input.b })
};
```

**To use real procedures:**

```typescript
// Real (integration)
import { collectRegistry } from '@c4c/core';

const registry = await collectRegistry("./handlers");
const result = await executeWorkflow(workflow, registry);
```

**That's it.** Procedures become workflow nodes automatically.

## Extending

### Add a Custom Workflow

**Edit:** `src/lib/workflow/examples.ts`

```typescript
export const myWorkflow: WorkflowDefinition = {
  id: "my-workflow",
  name: "Custom Workflow",
  version: "1.0.0",
  startNode: "step1",
  nodes: [
    {
      id: "step1",
      type: "procedure",
      procedureName: "users.create",  // Your procedure
      config: { name: "Alice" },
      next: "step2"
    },
    {
      id: "step2",
      type: "condition",
      config: {
        expression: "isPremium === true",
        trueBranch: "premium-path",
        falseBranch: "basic-path"
      }
    }
  ]
};
```

### Add a Custom Node Type

**Edit:** `src/lib/workflow/runtime.ts`

```typescript
async function executeNode(node: WorkflowNode, context, registry, workflow) {
  switch (node.type) {
    case "procedure":
      return executeProcedureNode(node, context, registry);
    case "condition":
      return executeConditionNode(node, context);
    case "parallel":
      return executeParallelNode(node, context, registry, workflow);
    case "my-custom-type":  // New type
      return executeMyCustomNode(node, context);
  }
}
```

### Add Custom Visualization

**Edit:** `src/components/WorkflowVisualizer.tsx`

```typescript
const nodeTypes = {
  procedure: ProcedureNode,
  condition: ConditionNode,
  parallel: ParallelNode,
  myCustomType: MyCustomNodeComponent  // Custom rendering
};

<ReactFlow nodeTypes={nodeTypes} ... />
```

## Tech Stack

- **Next.js 15.0.5** - React framework with Server Actions
- **React 19** - UI library
- **React Flow** - Interactive node graphs
- **@opentelemetry/api** - Distributed tracing
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **Zod** - Schema validation

## Performance

**Typical execution:**
- Server Action overhead: ~10-20ms
- Workflow execution: 500-3000ms (depends on procedures)
- Span collection: ~5-10ms
- Serialization: ~5-10ms
- React rendering: ~20-50ms
- React Flow layout: ~50-100ms

**Total:** ~650-3300ms per execution

## Production Deployment

Deploy to Vercel:

```bash
pnpm build
vercel deploy
```

**Environment variables:**
```env
# Optional: Export traces to Jaeger/Zipkin
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-jaeger-instance
```

**Features in production:**
- Static page generation
- Server-side workflow execution
- Automatic span sampling (configurable)
- Optional trace export to backend

## Future Enhancements

1. **Real-time streaming**
   ```typescript
   // Stream execution events as they happen
   for await (const event of executeWorkflowStream(workflow)) {
     console.log(event);  // { type: "node.started", nodeId: "..." }
   }
   ```

2. **Workflow editor**
   - Drag-and-drop node creation
   - Save/load workflows
   - Procedure palette

3. **Execution history**
   - Store past executions
   - Compare traces
   - Performance analytics

4. **Distributed execution**
   - Execute nodes on different machines
   - Load balancing
   - Fault tolerance

## See Also

- [Main README](../../README.md) - Framework overview
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed architecture
- [React Flow Docs](https://reactflow.dev/)
- [OpenTelemetry JS](https://opentelemetry.io/docs/instrumentation/js/)

## License

MIT
