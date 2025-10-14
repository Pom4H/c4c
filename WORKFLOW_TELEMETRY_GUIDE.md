# 📊 Workflow Telemetry Guide

## OpenTelemetry Integration из коробки

tsdev workflow система полностью интегрирована с OpenTelemetry, следуя принципу **"Telemetry by design"**.

---

## 🎯 Философия

**Observability не опциональна — она встроена на уровне домена.**

```typescript
// Определяешь workflow
const workflow: WorkflowDefinition = { ... };

// Выполняешь
await executeWorkflow(workflow, registry);

// ✨ Автоматически получаешь:
// - Полную трассировку
// - Business-level метрики
// - Error tracking
// - Performance insights
```

Никакой дополнительной настройки!

---

## 🔀 Span Hierarchy

### Структура spans

```
workflow.execute (root)
  ├─ workflow.node.procedure
  │  └─ <procedure-name> (from withSpan policy)
  ├─ workflow.node.condition
  ├─ workflow.node.parallel
  │  ├─ workflow.parallel.branch
  │  │  └─ workflow.node.procedure
  │  ├─ workflow.parallel.branch
  │  │  └─ workflow.node.procedure
  │  └─ workflow.parallel.branch
  │     └─ workflow.node.procedure
  └─ workflow.node.procedure
     └─ <procedure-name>
```

### Пример реальной трассировки

```json
{
  "traceId": "abc123def456789",
  "spans": [
    {
      "spanId": "span-1",
      "name": "workflow.execute",
      "startTime": "2024-01-01T00:00:00.000Z",
      "duration": 1234,
      "attributes": {
        "workflow.id": "user-onboarding",
        "workflow.name": "User Onboarding",
        "workflow.version": "1.0.0",
        "workflow.execution_id": "wf_exec_1234567890_abc123",
        "workflow.start_node": "create-user",
        "workflow.node_count": 3,
        "workflow.nodes_executed_total": 3,
        "workflow.execution_time_ms": 1234,
        "workflow.status": "completed"
      },
      "status": "OK"
    },
    {
      "spanId": "span-2",
      "parentSpanId": "span-1",
      "name": "workflow.node.procedure",
      "duration": 234,
      "attributes": {
        "workflow.id": "user-onboarding",
        "workflow.execution_id": "wf_exec_1234567890_abc123",
        "node.id": "create-user",
        "node.type": "procedure",
        "node.procedure": "users.create",
        "node.status": "completed",
        "node.next": "send-welcome",
        "procedure.input": "{\"name\":\"Alice\",\"email\":\"alice@example.com\"}",
        "procedure.output": "{\"id\":\"123\",\"name\":\"Alice\",\"email\":\"alice@example.com\"}"
      }
    },
    {
      "spanId": "span-3",
      "parentSpanId": "span-2",
      "name": "users.create",
      "duration": 220,
      "attributes": {
        "request.id": "req_1234567890_xyz",
        "context.transport": "workflow",
        "context.workflowId": "user-onboarding",
        "context.nodeId": "create-user",
        "context.nodeProcedure": "users.create"
      }
    }
  ]
}
```

---

## 📋 Attributes Reference

### Workflow Attributes

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `workflow.id` | string | Workflow identifier | `"user-onboarding"` |
| `workflow.name` | string | Human-readable name | `"User Onboarding"` |
| `workflow.version` | string | Workflow version | `"1.0.0"` |
| `workflow.execution_id` | string | Unique execution ID | `"wf_exec_..."` |
| `workflow.start_node` | string | Starting node ID | `"create-user"` |
| `workflow.node_count` | number | Total nodes in workflow | `5` |
| `workflow.current_node` | string | Currently executing node | `"send-email"` |
| `workflow.current_node_index` | number | Node execution index | `2` |
| `workflow.nodes_executed` | number | Nodes executed so far | `3` |
| `workflow.nodes_executed_total` | number | Total nodes executed | `5` |
| `workflow.execution_time_ms` | number | Total execution time | `1234` |
| `workflow.status` | string | Execution status | `"completed"` / `"failed"` |
| `workflow.error` | string | Error message (if failed) | `"User already exists"` |

### Node Attributes

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `node.id` | string | Node identifier | `"create-user"` |
| `node.type` | string | Node type | `"procedure"` / `"condition"` / `"parallel"` |
| `node.procedure` | string | Procedure name (if type=procedure) | `"users.create"` |
| `node.status` | string | Node execution status | `"completed"` / `"failed"` |
| `node.next` | string | Next node ID | `"send-email"` |
| `node.error` | string | Error message (if failed) | `"Validation failed"` |
| `procedure.input` | string | JSON input to procedure | `"{\"name\":\"Alice\"}"` |
| `procedure.output` | string | JSON output from procedure | `"{\"id\":\"123\"}"` |
| `procedure.output_keys` | string | Output keys (comma-separated) | `"id,name,email"` |

### Condition Attributes

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `condition.expression` | string | Condition expression | `"subscription === 'premium'"` |
| `condition.variables` | string | Available variables (JSON) | `"{\"subscription\":\"premium\"}"` |
| `condition.result` | boolean | Evaluation result | `true` / `false` |
| `condition.branch_taken` | string | Branch that was taken | `"premium-features"` |

### Parallel Execution Attributes

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `parallel.node_id` | string | Parallel node ID | `"parallel-tasks"` |
| `parallel.branch_id` | string | Branch node ID | `"task-1"` |
| `parallel.branch_index` | number | Branch index | `0` |

---

## 🔍 Query Examples

### Jaeger Queries

```
# Find all workflow executions
service.name = "tsdev" AND operation.name = "workflow.execute"

# Find failed workflows
workflow.status = "failed"

# Find slow workflows (> 5 seconds)
duration > 5000ms

# Find workflows for specific user
context.userId = "123"

# Find workflows with specific error
workflow.error CONTAINS "already exists"
```

### DataDog Queries

```
# APM Traces view
service:tsdev operation:workflow.execute

# Filter by workflow ID
@workflow.id:user-onboarding

# Filter by status
@workflow.status:failed

# Group by node type
@node.type:procedure

# Show execution time distribution
@workflow.execution_time_ms
```

### Honeycomb Queries

```sql
-- Average execution time by workflow
SELECT AVG(workflow.execution_time_ms)
WHERE operation.name = "workflow.execute"
GROUP BY workflow.id

-- P95 execution time for each node
SELECT P95(duration)
WHERE operation.name = "workflow.node.procedure"
GROUP BY node.id

-- Error rate by workflow
SELECT COUNT(*)
WHERE workflow.status = "failed"
GROUP BY workflow.id

-- Most executed nodes
SELECT COUNT(*)
WHERE node.type = "procedure"
GROUP BY node.procedure
ORDER BY COUNT(*) DESC
```

---

## 🎨 Visualization Examples

### Gantt Chart (в Jaeger)

```
workflow.execute                 [=====================] 1234ms
├─ workflow.node.procedure      [=====]                234ms
│  └─ users.create             [====]                  220ms
├─ workflow.node.condition     [-]                      5ms
└─ workflow.node.procedure            [===========]    456ms
   └─ emails.send                     [==========]     445ms
```

### Flamegraph

```
workflow.execute (1234ms)
┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┃ workflow.node.procedure (234ms)
┃ ┗━━━ users.create (220ms)
┣━ workflow.node.condition (5ms)
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  workflow.node.procedure (456ms)
  ┗━━━ emails.send (445ms)
```

---

## 🐛 Debugging with Traces

### Example: Slow Workflow

**Problem:** Workflow `user-onboarding` takes 10+ seconds

**Investigation:**

1. Открой trace в Jaeger
2. Смотри flamegraph
3. Находишь медленную ноду:

```
workflow.execute                           [====================] 10,234ms
├─ workflow.node.procedure                [=]                     100ms
├─ workflow.node.procedure                [==================] 9,800ms ← slow!
│  └─ external.api.call                   [==================] 9,750ms
└─ workflow.node.procedure                [=]                     100ms
```

4. **Solution:** Add caching или retry timeout для `external.api.call`

### Example: Failed Workflow

**Problem:** Workflow fails intermittently

**Investigation:**

1. Query failed workflows:
```
workflow.status = "failed"
```

2. Look at error attributes:
```json
{
  "workflow.error": "Rate limit exceeded",
  "node.id": "send-email",
  "node.error": "Too many requests"
}
```

3. **Solution:** Add `withRetry` и `withRateLimit` policies

---

## 💡 Best Practices

### 1. Используй Business-Level Attributes

```typescript
// Good ✅
const execContext = createExecutionContext({
  transport: "workflow",
  workflowId: workflow.id,
  userId: input.userId,
  organizationId: input.organizationId,
  environment: process.env.NODE_ENV
});

// Bad ❌
const execContext = createExecutionContext({
  transport: "workflow"
});
```

### 2. Добавляй Custom Attributes в Procedures

```typescript
export const createUser: Procedure = {
  contract: createUserContract,
  handler: applyPolicies(
    async (input, context) => {
      const span = trace.getActiveSpan();
      
      // Add business context
      span?.setAttributes({
        "user.email": input.email,
        "user.subscription_tier": "free",
        "user.referral_code": input.referralCode || "none"
      });
      
      // Business logic
      return { ... };
    },
    withLogging("users.create"),
    withSpan("users.create")
  )
};
```

### 3. Используй Semantic Conventions

Следуй [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/):

```typescript
// Database operations
span.setAttributes({
  "db.system": "postgresql",
  "db.operation": "INSERT",
  "db.statement": "INSERT INTO users..."
});

// HTTP calls
span.setAttributes({
  "http.method": "POST",
  "http.url": "https://api.example.com/users",
  "http.status_code": 201
});

// Messaging
span.setAttributes({
  "messaging.system": "rabbitmq",
  "messaging.destination": "user.created",
  "messaging.operation": "publish"
});
```

### 4. Set Meaningful Span Names

```typescript
// Good ✅
tracer.startActiveSpan("workflow.execute", ...)
tracer.startActiveSpan("workflow.node.procedure", ...)
tracer.startActiveSpan("users.create", ...)

// Bad ❌
tracer.startActiveSpan("execute", ...)
tracer.startActiveSpan("node", ...)
tracer.startActiveSpan("handler", ...)
```

---

## 🚀 Production Setup

### Configure OpenTelemetry Exporter

```typescript
// src/telemetry/setup.ts
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'tsdev',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
});

// Jaeger exporter
const jaegerExporter = new JaegerExporter({
  endpoint: 'http://localhost:14268/api/traces',
});

provider.addSpanProcessor(
  new BatchSpanProcessor(jaegerExporter)
);

provider.register();
```

### Sampling

```typescript
import { TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';

const provider = new NodeTracerProvider({
  sampler: new TraceIdRatioBasedSampler(0.1), // Sample 10% of traces
});
```

---

## 📊 Metrics from Traces

Можно создать метрики из trace attributes:

```typescript
// Count workflow executions
metric: count(workflow.execute)
labels: [workflow.id, workflow.status]

// Average execution time
metric: avg(workflow.execution_time_ms)
labels: [workflow.id]

// Error rate
metric: count(workflow.execute WHERE workflow.status = "failed") / count(workflow.execute)
labels: [workflow.id]

// Node execution distribution
metric: count(workflow.node.procedure)
labels: [node.procedure]
```

---

## 🎯 Summary

**tsdev workflow = Full OpenTelemetry integration из коробки!**

- ✅ Автоматическая трассировка workflow и нод
- ✅ Policies (withSpan) работают автоматически
- ✅ Business-level attributes
- ✅ Error tracking
- ✅ Performance insights
- ✅ Совместимость со всеми OTel инструментами

**Никакой дополнительной настройки — просто используй workflow!** ✨
