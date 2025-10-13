# 🔄 Workflow System - Visual Programming from Contracts

## Концепция

Раз у каждой процедуры есть **строго типизированные input и output** через Zod-схемы, их можно **автоматически превратить в ноды для workflow-системы**.

**Один contract → множество представлений:**
- ✅ RPC endpoint
- ✅ REST endpoint
- ✅ CLI command
- ✅ OpenAPI schema
- ✅ **Workflow node** ⭐

---

## 🎯 Философия

```
Contract (Zod schema)
         ↓
┌────────┴────────┐
│   Procedure     │
│  input  output  │
└────────┬────────┘
         ↓
    Workflow Node
    ┌─────────┐
    │  Input  │
    │   ↓↓    │
    │ [LOGIC] │
    │   ↓↓    │
    │ Output  │
    └─────────┘
```

**Каждая процедура = готовая нода для workflow!**

---

## 🚀 Quick Start

### 1. Определите процедуры как обычно

```typescript
// src/contracts/users.ts
export const createUserContract: Contract = {
  name: "users.create",
  input: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
};
```

### 2. Они автоматически становятся workflow-нодами!

```bash
# Откройте визуальный редактор
open http://localhost:3000/workflow/palette

# Или получите JSON конфигурацию
curl http://localhost:3000/workflow/ui-config
```

### 3. Создайте workflow из нод

```typescript
const workflow: WorkflowDefinition = {
  id: "user-registration",
  name: "User Registration",
  version: "1.0.0",
  startNode: "create-user",
  nodes: [
    {
      id: "create-user",
      type: "procedure",
      procedureName: "users.create", // ← Ваша процедура!
      config: {},
      next: "send-welcome-email",
    },
    {
      id: "send-welcome-email",
      type: "procedure",
      procedureName: "emails.send",
      config: { template: "welcome" },
      next: undefined,
    },
  ],
};
```

### 4. Выполните workflow

```bash
curl -X POST http://localhost:3000/workflow/execute \
  -d '{
    "workflow": { ...workflow definition... },
    "input": {
      "name": "Alice",
      "email": "alice@example.com"
    }
  }'
```

---

## 📊 Features

### ✅ Automatic Node Generation

**From:** Procedure with Zod schemas  
**To:** Workflow node with:
- Input ports (from input schema)
- Output ports (from output schema)
- Configuration panel
- Visual representation
- Drag-and-drop capability

### ✅ Multiple Node Types

#### 1. Procedure Node
Executes a registered procedure:
```typescript
{
  id: "my-node",
  type: "procedure",
  procedureName: "users.create",
  config: { /* override inputs */ },
  next: "next-node-id"
}
```

#### 2. Condition Node
Branches based on condition:
```typescript
{
  id: "check-premium",
  type: "condition",
  config: {
    expression: "subscription === 'premium'",
    trueBranch: "advanced-features",
    falseBranch: "basic-features"
  }
}
```

#### 3. Parallel Node
Execute multiple branches in parallel:
```typescript
{
  id: "parallel-tasks",
  type: "parallel",
  config: {
    branches: ["task-1", "task-2", "task-3"],
    waitForAll: true
  },
  next: "aggregate"
}
```

#### 4. Sequential Node
Chain nodes sequentially:
```typescript
{
  id: "step-1",
  type: "sequential",
  next: "step-2"
}
```

### ✅ Runtime Execution

```typescript
import { executeWorkflow } from "./workflow/runtime.js";

const result = await executeWorkflow(workflow, registry, initialInput);

// Result:
// {
//   executionId: "wf_exec_...",
//   status: "completed",
//   outputs: { /* outputs from each node */ },
//   executionTime: 1234,
//   nodesExecuted: ["node1", "node2", "node3"]
// }
```

### ✅ Visual UI Generation

```typescript
import { generateWorkflowUI } from "./workflow/generator.js";

// Generate node palette for visual editor
const uiConfig = generateWorkflowUI(registry);

// Result:
// {
//   nodes: [
//     {
//       id: "users.create",
//       name: "Create User",
//       category: "users",
//       icon: "👤",
//       color: "#3b82f6",
//       inputSchema: { ... },
//       outputSchema: { ... }
//     },
//     ...
//   ],
//   categories: ["users", "posts", "auth", ...]
// }
```

### ✅ Multiple Export Formats

#### React Flow
```typescript
import { generateReactFlowConfig } from "./workflow/generator.js";

const config = generateReactFlowConfig(registry);
// → React Flow compatible node/edge configuration
```

#### n8n
```typescript
import { generateN8NConfig } from "./workflow/generator.js";

const nodes = generateN8NConfig(registry);
// → n8n compatible node definitions
```

#### Mermaid
```typescript
import { generateMermaidDiagram } from "./workflow/generator.js";

const diagram = generateMermaidDiagram(registry);
// → Mermaid flowchart syntax
```

---

## 🎨 HTTP Endpoints

### GET /workflow/palette
Visual node palette (HTML)
```bash
open http://localhost:3000/workflow/palette
```

Интерактивная палитра всех доступных нод с:
- Категориями (users, posts, auth, etc.)
- Описаниями
- Drag-and-drop functionality
- Цветовой кодировкой

### GET /workflow/ui-config
JSON configuration for UI builders
```bash
curl http://localhost:3000/workflow/ui-config
```

Returns:
```json
{
  "nodes": [
    {
      "id": "users.create",
      "name": "Create User",
      "description": "Create a new user",
      "category": "users",
      "icon": "👤",
      "color": "#3b82f6",
      "inputSchema": { ... },
      "outputSchema": { ... }
    }
  ],
  "categories": ["users", "posts", "math"]
}
```

### POST /workflow/execute
Execute a workflow
```bash
curl -X POST http://localhost:3000/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": {
      "id": "my-workflow",
      "name": "My Workflow",
      "version": "1.0.0",
      "startNode": "node-1",
      "nodes": [...]
    },
    "input": {
      "key": "value"
    }
  }'
```

Returns:
```json
{
  "executionId": "wf_exec_1234567890_abc123",
  "status": "completed",
  "outputs": {
    "node-1": { ... },
    "node-2": { ... }
  },
  "executionTime": 1234,
  "nodesExecuted": ["node-1", "node-2"]
}
```

### POST /workflow/validate
Validate a workflow
```bash
curl -X POST http://localhost:3000/workflow/validate \
  -H "Content-Type: application/json" \
  -d '{ "workflow": { ... } }'
```

Returns:
```json
{
  "valid": false,
  "errors": [
    "Node node-1: procedure users.xyz not found in registry",
    "Node node-2: next node node-999 not found"
  ]
}
```

---

## 📚 Example Workflows

### Simple Sequential Workflow

```typescript
const mathWorkflow: WorkflowDefinition = {
  id: "math-calculation",
  name: "Math Calculation",
  version: "1.0.0",
  startNode: "add",
  nodes: [
    {
      id: "add",
      type: "procedure",
      procedureName: "math.add",
      config: { a: 10, b: 5 },
      next: "multiply"
    },
    {
      id: "multiply",
      type: "procedure",
      procedureName: "math.multiply",
      config: { a: 2 },
      // b will come from previous step's output
      next: undefined
    }
  ]
};

// Execute
const result = await executeWorkflow(mathWorkflow, registry);
// outputs.multiply.result = (10 + 5) * 2 = 30
```

### Conditional Branching

```typescript
const conditionalWorkflow: WorkflowDefinition = {
  id: "user-tier-processing",
  name: "User Tier Processing",
  version: "1.0.0",
  startNode: "get-user",
  nodes: [
    {
      id: "get-user",
      type: "procedure",
      procedureName: "users.get",
      next: "check-tier"
    },
    {
      id: "check-tier",
      type: "condition",
      config: {
        expression: "tier === 'premium'",
        trueBranch: "premium-processing",
        falseBranch: "basic-processing"
      }
    },
    {
      id: "premium-processing",
      type: "procedure",
      procedureName: "process.premium",
      next: "save"
    },
    {
      id: "basic-processing",
      type: "procedure",
      procedureName: "process.basic",
      next: "save"
    },
    {
      id: "save",
      type: "procedure",
      procedureName: "storage.save",
      next: undefined
    }
  ]
};
```

### Parallel Execution

```typescript
const parallelWorkflow: WorkflowDefinition = {
  id: "parallel-tasks",
  name: "Parallel Tasks",
  version: "1.0.0",
  startNode: "parallel",
  nodes: [
    {
      id: "parallel",
      type: "parallel",
      config: {
        branches: ["task-1", "task-2", "task-3"],
        waitForAll: true
      },
      next: "aggregate"
    },
    {
      id: "task-1",
      type: "procedure",
      procedureName: "math.add",
      config: { a: 1, b: 2 }
    },
    {
      id: "task-2",
      type: "procedure",
      procedureName: "math.multiply",
      config: { a: 3, b: 4 }
    },
    {
      id: "task-3",
      type: "procedure",
      procedureName: "math.add",
      config: { a: 5, b: 6 }
    },
    {
      id: "aggregate",
      type: "procedure",
      procedureName: "math.add",
      next: undefined
    }
  ]
};
```

---

## 🎨 Visual Editor Integration

### React Flow Example

```tsx
import ReactFlow from 'reactflow';
import { generateReactFlowConfig } from 'tsdev/workflow/generator';

function WorkflowEditor() {
  const { nodeTypes, edgeTypes } = generateReactFlowConfig(registry);
  
  return (
    <ReactFlow
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodes={nodes}
      edges={edges}
    />
  );
}
```

### Custom UI Builder

```typescript
// Fetch available nodes
const response = await fetch('http://localhost:3000/workflow/ui-config');
const { nodes, categories } = await response.json();

// Build UI
categories.forEach(category => {
  const categoryNodes = nodes.filter(n => n.category === category);
  
  // Render category
  renderCategory(category, categoryNodes);
});

// Each node shows:
// - Icon
// - Name
// - Description
// - Input/output ports (from schemas)
// - Draggable for workflow builder
```

---

## 📊 OpenTelemetry Integration

### Полная трассировка workflow

**Workflow полностью интегрирован с OpenTelemetry из коробки!**

Каждое выполнение workflow создаёт иерархию spans:

```
workflow.execute (root span)
  ├─ workflow.node.procedure (node-1)
  │  └─ users.create (procedure span from withSpan)
  │     └─ [business logic]
  ├─ workflow.node.condition
  │  └─ [condition evaluation]
  └─ workflow.node.procedure (node-2)
     └─ emails.send (procedure span from withSpan)
        └─ [email logic]
```

### Автоматические атрибуты

#### Workflow-level attributes:
```typescript
{
  "workflow.id": "user-onboarding",
  "workflow.name": "User Onboarding",
  "workflow.version": "1.0.0",
  "workflow.execution_id": "wf_exec_1234567890_abc123",
  "workflow.start_node": "create-user",
  "workflow.node_count": 5,
  "workflow.nodes_executed_total": 5,
  "workflow.execution_time_ms": 1234,
  "workflow.status": "completed"
}
```

#### Node-level attributes:
```typescript
{
  "node.id": "create-user",
  "node.type": "procedure",
  "node.procedure": "users.create",
  "node.status": "completed",
  "node.next": "send-email",
  "procedure.input": "{\"name\":\"Alice\",\"email\":\"alice@example.com\"}",
  "procedure.output": "{\"id\":\"123\",\"name\":\"Alice\"}"
}
```

#### Condition-level attributes:
```typescript
{
  "condition.expression": "subscription === 'premium'",
  "condition.variables": "{\"subscription\":\"premium\"}",
  "condition.result": true,
  "condition.branch_taken": "premium-features"
}
```

#### Parallel execution attributes:
```typescript
{
  "parallel.node_id": "parallel-tasks",
  "parallel.branch_id": "task-1",
  "parallel.branch_index": 0
}
```

### Policies работают автоматически

Процедуры в workflow используют те же policies, что и в обычных вызовах:

```typescript
export const createUser: Procedure = {
  contract: createUserContract,
  handler: applyPolicies(
    baseHandler,
    withLogging("users.create"),
    withSpan("users.create"),  // ← Создаёт span автоматически
    withRetry({ maxAttempts: 3 })
  )
};

// В workflow эта процедура создаст span как child node span
```

### Span Hierarchy Example

```
Trace ID: abc123def456
│
└─ workflow.execute (1234ms)
   │  workflow.id: "user-registration"
   │  workflow.status: "completed"
   │
   ├─ workflow.node.procedure (234ms)
   │  │  node.id: "create-user"
   │  │  node.procedure: "users.create"
   │  │
   │  └─ users.create (220ms)  ← from withSpan policy
   │     │  request.id: "req_..."
   │     │  context.transport: "workflow"
   │     │  context.workflowId: "user-registration"
   │     │
   │     └─ [business logic execution]
   │
   ├─ workflow.node.condition (5ms)
   │     condition.expression: "emailVerified === true"
   │     condition.result: true
   │
   └─ workflow.node.procedure (456ms)
      │  node.id: "send-welcome"
      │  node.procedure: "emails.send"
      │
      └─ emails.send (445ms)  ← from withSpan policy
         └─ [email sending logic]
```

### Viewing Traces

Работает со всеми OpenTelemetry-совместимыми инструментами:

**Jaeger:**
```bash
# View trace in Jaeger UI
http://localhost:16686/trace/<trace-id>
```

**DataDog:**
```bash
# Spans appear in APM > Traces
# Filter by: service:tsdev, operation:workflow.execute
```

**Honeycomb:**
```bash
# Query:
# WHERE workflow.id = "user-registration"
# GROUP BY node.id
```

### Error Tracking

При ошибках traces содержат полную информацию:

```typescript
{
  "workflow.status": "failed",
  "workflow.error": "User with email alice@example.com already exists",
  "node.status": "failed",
  "node.error": "Duplicate email",
  "error.type": "ValidationError",
  "error.stack": "..."
}
```

### Пример использования

```typescript
// Выполни workflow
const result = await executeWorkflow(workflow, registry, input);

// Trace автоматически создан!
// Смотри в Jaeger/DataDog/etc:
// - Полный путь выполнения
// - Время каждой ноды
// - Input/output данные
// - Ошибки с stack traces
```

## 🔧 Advanced Features

### Error Handling

```typescript
{
  id: "risky-node",
  type: "procedure",
  procedureName: "risky.operation",
  onError: "error-handler", // ← Error handling node
  next: "success-handler"
}
```

### Variables & Context

```typescript
const workflow: WorkflowDefinition = {
  variables: {
    userId: "123",
    environment: "production"
  },
  nodes: [
    {
      id: "node-1",
      type: "procedure",
      procedureName: "users.get",
      config: {
        // Can reference workflow variables
        id: "${userId}"
      }
    }
  ]
};
```

### Node Output Storage

```typescript
// During execution, outputs are stored in context
context.nodeOutputs.get("node-1"); // → output from node-1

// Next nodes can access previous outputs
// via context.variables (automatically merged)
```

---

## 💡 Use Cases

### 1. **Low-Code Platforms**
Превратите tsdev в low-code platform:
- Визуальный редактор workflow
- Drag-and-drop ноды
- Non-technical users создают бизнес-логику

### 2. **API Orchestration**
Комбинируйте multiple API calls в workflow:
```
Get User → Check Subscription → Send Email → Update Analytics
```

### 3. **Data Pipelines**
ETL процессы как workflow:
```
Extract → Transform → Validate → Load → Notify
```

### 4. **Business Process Automation**
Автоматизация бизнес-процессов:
```
Order Created → Check Inventory → Process Payment → Ship → Send Confirmation
```

### 5. **Testing Scenarios**
Integration тесты как workflow:
```
Setup → Create User → Login → Perform Action → Verify → Cleanup
```

---

## 🎯 Benefits

### ✅ Zero Additional Code
- Procedures уже определены
- Workflow ноды генерируются автоматически
- No manual node registration

### ✅ Type Safety
- Input/output валидация через Zod
- TypeScript types автоматически
- Runtime validation гарантирован

### ✅ Reusability
- Одна процедура = множество использований
- В RPC, REST, CLI, **и workflow**
- Single source of truth

### ✅ Visual Programming
- Drag-and-drop interface
- Visual debugging
- Easy to understand complex flows

### ✅ Observability
- Workflow execution tracking
- Each node traced via OpenTelemetry
- Clear execution logs

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│          Procedure Registry             │
│  (Auto-discovered from handlers/)       │
└──────────────┬──────────────────────────┘
               │
     ┌─────────┴─────────┐
     │                   │
     ▼                   ▼
┌─────────┐      ┌────────────────┐
│ Runtime │      │ UI Generator   │
│ Executor│      │                │
└────┬────┘      └───────┬────────┘
     │                   │
     ▼                   ▼
Execute           Visual Editor
Workflows         Configuration
```

### Components

1. **Workflow Runtime** (`src/workflow/runtime.ts`)
   - Executes workflows
   - Manages execution context
   - Handles conditions, parallelism
   - Validates workflows

2. **UI Generator** (`src/workflow/generator.ts`)
   - Generates node palette
   - Creates React Flow config
   - Exports n8n format
   - Generates Mermaid diagrams

3. **HTTP Adapter** (`src/adapters/workflow-http.ts`)
   - `/workflow/palette` - Visual editor
   - `/workflow/ui-config` - JSON config
   - `/workflow/execute` - Execute workflows
   - `/workflow/validate` - Validate workflows

---

## 🚀 Future Enhancements

- [ ] Visual workflow editor (React-based)
- [ ] Workflow versioning
- [ ] Workflow scheduling (cron-like)
- [ ] Sub-workflows (nested workflows)
- [ ] Workflow templates library
- [ ] Monitoring dashboard
- [ ] Webhook triggers
- [ ] Event-driven execution
- [ ] Workflow marketplace

---

## 📖 Summary

**Концепция:**  
Процедуры с Zod-контрактами → автоматически становятся workflow-нодами

**Результат:**  
- ✅ Visual programming platform
- ✅ Low-code capabilities
- ✅ Type-safe workflows
- ✅ Reusable procedures
- ✅ Multiple export formats
- ✅ Zero boilerplate

**One Contract → Everything:**
1. RPC endpoint
2. REST endpoint  
3. CLI command
4. OpenAPI schema
5. **Workflow node** ⭐

**"Write once — describe forever"** теперь включает визуальное программирование! ✨
