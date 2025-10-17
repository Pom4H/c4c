# Workflow Visualization Architecture

Internal architecture of the Next.js workflow visualization example.

---

## System Layers

```
┌─────────────────────────────────────────────────────────┐
│                  Browser (Client Side)                   │
│  ┌────────────────────────────────────────────────┐    │
│  │ page.tsx (Client Component)                    │    │
│  │ - Manages workflow selection                   │    │
│  │ - Triggers execution via Server Action         │    │
│  │ - Renders results                              │    │
│  └───────────┬────────────────────────────────────┘    │
│              │                                          │
│     ┌────────┴─────────┐                               │
│     ▼                  ▼                                │
│  ┌──────────────┐  ┌─────────────┐                     │
│  │ Workflow     │  │ Trace       │                     │
│  │ Visualizer   │  │ Viewer      │                     │
│  │ (React Flow) │  │ (Timeline)  │                     │
│  └──────────────┘  └─────────────┘                     │
└─────────────────────────────────────────────────────────┘
                       │
                Server Action boundary
                       │
┌─────────────────────────────────────────────────────────┐
│                  Server (Next.js Runtime)                │
│  ┌────────────────────────────────────────────────┐    │
│  │ Server Actions (actions.ts)                    │    │
│  │ - executeWorkflowAction()                      │    │
│  │ - getAvailableWorkflows()                      │    │
│  │ - getWorkflowDefinition()                      │    │
│  └───────────┬────────────────────────────────────┘    │
│              │                                          │
│              ▼                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Workflow Runtime (runtime.ts)                  │    │
│  │ ┌────────────────────────────────────────┐    │    │
│  │ │ executeWorkflow()                      │    │    │
│  │ │ - Creates OpenTelemetry spans          │    │    │
│  │ │ - Executes nodes sequentially          │    │    │
│  │ │ - Collects execution state             │    │    │
│  │ └────────────────────────────────────────┘    │    │
│  │ ┌────────────────────────────────────────┐    │    │
│  │ │ executeNode()                          │    │    │
│  │ │ ├─ executeProcedureNode()              │    │    │
│  │ │ ├─ executeConditionNode()              │    │    │
│  │ │ ├─ executeParallelNode()               │    │    │
│  │ │ └─ executeSequentialNode()             │    │    │
│  │ └────────────────────────────────────────┘    │    │
│  └───────────┬────────────────────────────────────┘    │
│              │                                          │
│              ▼                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Mock Procedures (for demo)                     │    │
│  │ - math.add, math.multiply, math.subtract       │    │
│  │ - data.fetch, data.process, data.save          │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Execution Flow

```
1. User selects workflow + clicks "Execute"
   ↓
2. handleExecute() calls Server Action
   ↓
3. executeWorkflowAction(workflowId, input)
   ↓
4. Loads WorkflowDefinition from examples.ts
   ↓
5. executeWorkflow(workflow, registry, input)
   ├─ Creates root span: "workflow.execute"
   ├─ Iterates through nodes
   │  ├─ executeNode(node)
   │  │  └─ Creates child span: "workflow.node.{type}"
   │  ├─ Updates context.variables with outputs
   │  └─ Follows node.next to next node
   └─ Returns WorkflowExecutionResult
   ↓
6. Server Action serializes result
   ↓
7. Client receives result
   ↓
8. setExecutionResult(result) updates state
   ↓
9. React re-renders
   ├─ WorkflowVisualizer highlights executed nodes
   └─ TraceViewer displays span timeline
```

### OpenTelemetry Span Creation

```typescript
// In executeWorkflow()
tracer.startActiveSpan("workflow.execute", async (workflowSpan) => {
  workflowSpan.setAttributes({
    "workflow.id": workflow.id,
    "workflow.name": workflow.name,
    "workflow.execution_id": executionId
  });
  
  // Execute nodes
  while (currentNodeId) {
    await executeNode(node, context, registry, workflow);
  }
  
  workflowSpan.end();
});

// In executeNode()
tracer.startActiveSpan(`workflow.node.${node.type}`, async (nodeSpan) => {
  nodeSpan.setAttributes({
    "node.id": node.id,
    "node.type": node.type,
    "node.procedure": node.procedureName
  });
  
  // Execute based on type
  switch (node.type) {
    case "procedure":
      await executeProcedureNode(node, context, registry);
      break;
    case "condition":
      await executeConditionNode(node, context);
      break;
  }
  
  nodeSpan.end();
});
```

**Result:** Hierarchical spans that mirror workflow structure.

---

## Component Architecture

### page.tsx (Client Component)

**State management:**

```typescript
const [workflows, setWorkflows] = useState<WorkflowInfo[]>([]);
const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null);
const [executionResult, setExecutionResult] = useState<WorkflowExecutionResult | null>(null);
const [isExecuting, setIsExecuting] = useState(false);
const [activeTab, setActiveTab] = useState<"graph" | "trace">("graph");
```

**Effects:**

```typescript
// Load available workflows on mount
useEffect(() => {
  async function loadWorkflows() {
    const wfs = await getAvailableWorkflows();
    setWorkflows(wfs);
    setSelectedWorkflowId(wfs[0]?.id);
  }
  loadWorkflows();
}, []);

// Load workflow definition when selection changes
useEffect(() => {
  async function loadDefinition() {
    const def = await getWorkflowDefinition(selectedWorkflowId);
    setSelectedWorkflow(def);
  }
  if (selectedWorkflowId) loadDefinition();
}, [selectedWorkflowId]);
```

**Event handlers:**

```typescript
async function handleExecute() {
  setIsExecuting(true);
  try {
    const result = await executeWorkflowAction(selectedWorkflowId);
    setExecutionResult(result);
  } finally {
    setIsExecuting(false);
  }
}
```

### WorkflowVisualizer.tsx

**Props:**

```typescript
interface Props {
  workflow: WorkflowDefinition;
  executionResult?: WorkflowExecutionResult;
}
```

**Node generation:**

```typescript
const nodes: Node[] = workflow.nodes.map(node => {
  const isExecuted = executionResult?.nodesExecuted.includes(node.id);
  
  return {
    id: node.id,
    type: node.type,
    data: {
      label: node.procedureName || node.id,
      executed: isExecuted,
      duration: getNodeDuration(node.id, executionResult?.spans)
    },
    position: calculateNodePosition(node)  // Auto-layout
  };
});
```

**Edge generation:**

```typescript
const edges: Edge[] = workflow.nodes.flatMap(node => {
  if (!node.next) return [];
  
  const nextNodes = Array.isArray(node.next) ? node.next : [node.next];
  
  return nextNodes.map(nextId => ({
    id: `${node.id}-${nextId}`,
    source: node.id,
    target: nextId,
    animated: isExecuted(node.id) && isExecuted(nextId)
  }));
});
```

**Auto-layout:**

```typescript
import dagre from 'dagre';

function calculateLayout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB' });  // Top to bottom
  
  nodes.forEach(node => g.setNode(node.id, { width: 150, height: 50 }));
  edges.forEach(edge => g.setEdge(edge.source, edge.target));
  
  dagre.layout(g);
  
  return nodes.map(node => ({
    ...node,
    position: {
      x: g.node(node.id).x,
      y: g.node(node.id).y
    }
  }));
}
```

### TraceViewer.tsx

**Props:**

```typescript
interface Props {
  spans: TraceSpan[];
  executionResult: WorkflowExecutionResult;
}
```

**Span hierarchy:**

```typescript
function buildSpanTree(spans: TraceSpan[]): SpanTree {
  const spanMap = new Map(spans.map(s => [s.spanId, s]));
  const roots: TraceSpan[] = [];
  
  for (const span of spans) {
    if (!span.parentSpanId) {
      roots.push(span);
    } else {
      const parent = spanMap.get(span.parentSpanId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(span);
      }
    }
  }
  
  return roots;
}
```

**Timeline rendering:**

```typescript
function renderSpanTimeline(span: TraceSpan, totalDuration: number) {
  const startOffset = (span.startTime - executionStart) / totalDuration * 100;
  const width = span.duration / totalDuration * 100;
  
  return (
    <div
      className="span-bar"
      style={{
        marginLeft: `${startOffset}%`,
        width: `${width}%`,
        backgroundColor: span.status.code === "ERROR" ? "red" : "green"
      }}
    >
      {span.name} - {span.duration}ms
    </div>
  );
}
```

---

## Workflow Runtime Implementation

### executeWorkflow()

**Location:** `src/lib/workflow/runtime.ts`

```typescript
export async function executeWorkflow(
  workflow: WorkflowDefinition,
  registry: Registry,
  initialInput: Record<string, unknown> = {}
): Promise<WorkflowExecutionResult> {
  const executionId = generateExecutionId();
  const startTime = Date.now();
  
  return tracer.startActiveSpan("workflow.execute", async (workflowSpan) => {
    const context: WorkflowContext = {
      workflowId: workflow.id,
      executionId,
      variables: { ...workflow.variables, ...initialInput },
      nodeOutputs: new Map(),
      startTime: new Date()
    };
    
    const nodesExecuted: string[] = [];
    let currentNodeId: string | undefined = workflow.startNode;
    
    while (currentNodeId) {
      const node = workflow.nodes.find(n => n.id === currentNodeId);
      if (!node) throw new Error(`Node ${currentNodeId} not found`);
      
      nodesExecuted.push(currentNodeId);
      
      // Execute node (creates child span)
      const nextNodeId = await executeNode(node, context, registry, workflow);
      currentNodeId = nextNodeId;
    }
    
    return {
      executionId,
      status: "completed",
      outputs: Object.fromEntries(context.nodeOutputs),
      executionTime: Date.now() - startTime,
      nodesExecuted,
      spans: spanCollector.getSpans()  // From OpenTelemetry
    };
  });
}
```

### executeNode()

```typescript
async function executeNode(
  node: WorkflowNode,
  context: WorkflowContext,
  registry: Registry,
  workflow: WorkflowDefinition
): Promise<string | undefined> {
  return tracer.startActiveSpan(`workflow.node.${node.type}`, async (nodeSpan) => {
    nodeSpan.setAttributes({
      "node.id": node.id,
      "node.type": node.type
    });
    
    let nextNodeId: string | undefined;
    
    switch (node.type) {
      case "procedure":
        nextNodeId = await executeProcedureNode(node, context, registry);
        break;
      case "condition":
        nextNodeId = await executeConditionNode(node, context);
        break;
      case "parallel":
        nextNodeId = await executeParallelNode(node, context, registry, workflow);
        break;
      case "sequential":
        nextNodeId = await executeSequentialNode(node, context);
        break;
    }
    
    nodeSpan.setAttributes({ "node.next": nextNodeId });
    return nextNodeId;
  });
}
```

### executeProcedureNode()

```typescript
async function executeProcedureNode(
  node: WorkflowNode,
  context: WorkflowContext,
  registry: Registry
): Promise<string | undefined> {
  const procedure = registry.get(node.procedureName);
  if (!procedure) throw new Error(`Procedure ${node.procedureName} not found`);
  
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
    nodeId: node.id
  });
  
  const output = await executeProcedure(procedure, input, execContext);
  
  // Store output
  context.nodeOutputs.set(node.id, output);
  
  // Merge output into variables (for next nodes)
  Object.assign(context.variables, output);
  
  return typeof node.next === "string" ? node.next : node.next?.[0];
}
```

### executeConditionNode()

```typescript
async function executeConditionNode(
  node: WorkflowNode,
  context: WorkflowContext
): Promise<string | undefined> {
  const config = node.config as ConditionConfig;
  
  // Evaluate JavaScript expression with context variables
  const result = evaluateExpression(config.expression, context.variables);
  
  return result ? config.trueBranch : config.falseBranch;
}

function evaluateExpression(expression: string, variables: Record<string, unknown>): boolean {
  // Create function with variables in scope
  const func = new Function(...Object.keys(variables), `return ${expression}`);
  return func(...Object.values(variables));
}
```

### executeParallelNode()

```typescript
async function executeParallelNode(
  node: WorkflowNode,
  context: WorkflowContext,
  registry: Registry,
  workflow: WorkflowDefinition
): Promise<string | undefined> {
  const config = node.config as ParallelConfig;
  
  // Execute all branches concurrently
  const branchPromises = config.branches.map(branchNodeId => {
    return tracer.startActiveSpan("workflow.parallel.branch", async (branchSpan) => {
      branchSpan.setAttributes({ "branch.node_id": branchNodeId });
      
      const branchNode = workflow.nodes.find(n => n.id === branchNodeId);
      if (!branchNode) throw new Error(`Branch node ${branchNodeId} not found`);
      
      await executeNode(branchNode, context, registry, workflow);
    });
  });
  
  if (config.waitForAll) {
    await Promise.all(branchPromises);
  } else {
    await Promise.race(branchPromises);
  }
  
  return typeof node.next === "string" ? node.next : node.next?.[0];
}
```

---

## OpenTelemetry Integration

### Span Collection

**Using in-memory collector for demo:**

```typescript
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';

const memoryExporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider();
provider.addSpanProcessor(new SimpleSpanProcessor(memoryExporter));

// After workflow execution
const spans = memoryExporter.getFinishedSpans();
```

**In production, export to backend:**

```typescript
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const exporter = new OTLPTraceExporter({
  url: 'https://your-jaeger-instance/v1/traces'
});
```

### Span Attributes

**Workflow-level:**
```typescript
{
  "workflow.id": "math-calculation",
  "workflow.name": "Math Calculation Workflow",
  "workflow.version": "1.0.0",
  "workflow.execution_id": "wf_exec_123456",
  "workflow.status": "completed",
  "workflow.execution_time_ms": 1234
}
```

**Node-level:**
```typescript
{
  "node.id": "add-numbers",
  "node.type": "procedure",
  "node.procedure": "math.add",
  "node.status": "completed",
  "node.next": "multiply-result"
}
```

**Procedure-level:**
```typescript
{
  "procedure.name": "math.add",
  "procedure.input": "{\"a\":10,\"b\":5}",
  "procedure.output": "{\"result\":15}"
}
```

---

## Server Actions

### executeWorkflowAction

```typescript
"use server";

export async function executeWorkflowAction(
  workflowId: string,
  input?: Record<string, unknown>
): Promise<WorkflowExecutionResult> {
  const workflow = workflows[workflowId];
  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);
  
  const registry = createMockRegistry();
  const result = await executeWorkflow(workflow, registry, input);
  
  return result;
}
```

**Serialization:**

Next.js automatically serializes the result. All data must be JSON-serializable:

```typescript
// ✅ Works
return {
  executionId: "abc123",
  status: "completed",
  outputs: { result: 42 }
};

// ❌ Fails (Functions not serializable)
return {
  handler: async () => {}  // Error!
};
```

### getAvailableWorkflows

```typescript
"use server";

export async function getAvailableWorkflows(): Promise<WorkflowInfo[]> {
  return workflows.map(w => ({
    id: w.id,
    name: w.name,
    description: w.description,
    version: w.version
  }));
}
```

### getWorkflowDefinition

```typescript
"use server";

export async function getWorkflowDefinition(
  workflowId: string
): Promise<WorkflowDefinition> {
  const workflow = workflows[workflowId];
  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);
  
  return workflow;
}
```

---

## UI Components (shadcn/ui)

Using shadcn/ui for consistent styling:

```typescript
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
```

**Color scheme:**
- Procedure nodes: `bg-green-500`
- Condition nodes: `bg-yellow-500`
- Parallel nodes: `bg-purple-500`
- Sequential nodes: `bg-blue-500`

---

## Performance Optimizations

### Memoization

```typescript
const layoutedNodes = useMemo(
  () => calculateLayout(nodes, edges),
  [nodes, edges]
);

const spanTree = useMemo(
  () => buildSpanTree(executionResult?.spans || []),
  [executionResult]
);
```

### Lazy Loading

```typescript
const ReactFlow = dynamic(() => import('@xyflow/react'), {
  ssr: false,  // Don't render on server
  loading: () => <div>Loading graph...</div>
});
```

### Debouncing

```typescript
const debouncedHandleNodeClick = useMemo(
  () => debounce((nodeId) => {
    console.log("Node clicked:", nodeId);
  }, 300),
  []
);
```

---

## Future Enhancements

### 1. Real-time Streaming

```typescript
// Stream execution events as they happen
export async function* executeWorkflowStream(workflow: WorkflowDefinition) {
  for (const node of workflow.nodes) {
    yield { type: "node.started", nodeId: node.id };
    
    await executeNode(node);
    
    yield { type: "node.completed", nodeId: node.id };
  }
}

// Client
for await (const event of executeWorkflowStream(workflow)) {
  setActiveNode(event.nodeId);
}
```

### 2. Workflow Editor

```typescript
// Drag-and-drop workflow builder
<WorkflowEditor
  onSave={async (workflow) => {
    await saveWorkflow(workflow);
  }}
/>
```

### 3. Execution History

```typescript
// Store past executions
interface ExecutionHistory {
  id: string;
  workflowId: string;
  timestamp: Date;
  status: "completed" | "failed";
  duration: number;
  spans: TraceSpan[];
}

// Database integration
await db.executions.insert(executionHistory);
```

### 4. Performance Analytics

```typescript
// Analyze execution patterns
const stats = analyzeWorkflowPerformance(executions);
// {
//   avgDuration: 1234ms,
//   p50: 1000ms,
//   p95: 2000ms,
//   p99: 3000ms,
//   bottlenecks: ["node-3"]
// }
```

---

## Deployment

### Vercel

```bash
pnpm build
vercel deploy
```

**Environment variables:**
```env
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-jaeger.com
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

---

## Testing

### Unit Tests

```typescript
describe("executeWorkflow", () => {
  it("executes all nodes", async () => {
    const workflow = createTestWorkflow();
    const registry = createMockRegistry();
    
    const result = await executeWorkflow(workflow, registry);
    
    expect(result.status).toBe("completed");
    expect(result.nodesExecuted).toHaveLength(3);
  });
});
```

### Integration Tests

```typescript
describe("WorkflowVisualizer", () => {
  it("renders all nodes", () => {
    render(<WorkflowVisualizer workflow={testWorkflow} />);
    
    expect(screen.getByText("add-numbers")).toBeInTheDocument();
    expect(screen.getByText("multiply-result")).toBeInTheDocument();
  });
});
```

---

## Conclusion

This example demonstrates:

- ✅ Visual workflow composition
- ✅ Automatic OpenTelemetry tracing
- ✅ Real-time execution visualization
- ✅ Zero instrumentation overhead
- ✅ Production-ready architecture

**Key insight:** Workflows are just data structures that compose procedures. The runtime handles all the complexity (tracing, execution, state management) automatically.

---

See [README.md](./README.md) for usage guide.
