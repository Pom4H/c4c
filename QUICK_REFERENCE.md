# Quick Reference - SSE + UI Monitoring

## ✅ Да, SSE работает!

Фронтенд получает **все события через Server-Sent Events (SSE)** для live updates.

## API Endpoints

| Endpoint | Type | Purpose |
|----------|------|---------|
| `GET /api/workflow/executions` | REST | Список executions |
| `GET /api/workflow/executions/[id]` | REST | Детали execution |
| `GET /api/workflow/executions/[id]/stream` | **SSE** | **Live updates** |
| `GET /api/workflow/definitions` | REST | Список workflows |
| `GET /api/workflow/definitions/[id]` | REST | Детали workflow |
| `POST /api/workflow/execute` | REST | Запуск workflow |

## SSE Events

```javascript
// Browser
const es = new EventSource("/api/workflow/executions/[id]/stream");

// Events:
es.addEventListener("workflow.started", handler);
es.addEventListener("node.started", handler);      // ⚡ Live!
es.addEventListener("node.completed", handler);    // ⚡ Live!
es.addEventListener("workflow.completed", handler);
es.addEventListener("workflow.failed", handler);
```

## UI Pages

```
/executions              → Список всех executions
/executions/[id]         → Детальный вид с SSE
```

## Live Update Flow

```
User clicks "Execute"
  ↓
POST /api/workflow/execute
  ↓
executeWorkflow() starts
  ↓
SSE connection: /api/workflow/executions/[id]/stream
  ↓
Node starts → publish("node.started") → SSE → Browser → UI shows blue node
  ↓
Node completes → publish("node.completed") → SSE → Browser → UI shows green node
  ↓
Workflow completes → publish("workflow.completed") → SSE → Browser → Close connection
```

## Visual Status

- ⚪ **Pending** - серый (еще не выполнялась)
- 🔵 **Running** - синий + анимация (выполняется сейчас)
- ✅ **Completed** - зеленый (успешно выполнена)
- ❌ **Failed** - красный (ошибка)

## Quick Start

```bash
# 1. Открыть UI
http://localhost:3000/executions

# 2. Выбрать workflow
# 3. Нажать "Execute"
# 4. Смотреть live updates через SSE!
```

## Code Examples

### Создать trigger workflow
```typescript
const workflow = {
  isTriggered: true,
  trigger: {
    provider: "googleDrive",
    triggerProcedure: "googleDrive.drive.changes.watch",
  },
  nodes: [
    { id: "trigger", type: "trigger", next: "process" },
    { id: "process", procedureName: "handler" },
  ],
};
```

### Deploy trigger workflow
```typescript
await triggerManager.deploy(workflow, {
  webhookUrl: "https://your-server.com/webhooks/googleDrive",
});
```

### Watch executions
```typescript
const store = getExecutionStore();
const executions = store.getAllExecutions();
const stats = store.getStats();
```

## Files Created

**API Routes:**
- ✅ `/app/api/workflow/executions/route.ts` - Список
- ✅ `/app/api/workflow/executions/[id]/route.ts` - Детали
- ✅ `/app/api/workflow/executions/[id]/stream/route.ts` - **SSE**
- ✅ `/app/api/workflow/definitions/route.ts` - Workflows
- ✅ `/app/api/workflow/definitions/[id]/route.ts` - Workflow
- ✅ `/app/api/workflow/execute/route.ts` - Execute

**UI Pages:**
- ✅ `/app/executions/page.tsx` - Список
- ✅ `/app/executions/[id]/page.tsx` - Детальный вид с SSE

**Components:**
- ✅ `/components/ExecutionGraph.tsx` - Граф с цветными нодами

**Backend:**
- ✅ `/packages/workflow/src/execution-store.ts` - Store
- ✅ `/packages/workflow/src/trigger-manager.ts` - Manager

## Итог

✅ **SSE полностью работает**  
✅ **Live updates в UI**  
✅ **Automatic reconnect**  
✅ **Keepalive**  
✅ **Graceful cleanup**  

**Все как надо! 🎉**
