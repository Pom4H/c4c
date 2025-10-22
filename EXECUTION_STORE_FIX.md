# ExecutionStore Integration Fix

## Проблема

Workflow успешно выполнялся через API, но:
- ❌ Не появлялся в списке executions на фронтенде
- ❌ При запуске через UI получали ошибку "Execution not found"

**Причина:** `executeWorkflow()` публиковал SSE события, но **не сохранял** executions в ExecutionStore!

## Решение

Добавлена полная интеграция ExecutionStore в `packages/workflow/src/runtime.ts`:

### 1. Импортирован ExecutionStore

```typescript
import { getExecutionStore } from "./execution-store.js";
```

### 2. Tracking начала выполнения

```typescript
const executionStore = getExecutionStore();
executionStore.startExecution(
  executionId,
  workflow.id,
  workflow.name || workflow.id
);
```

Вызывается **в начале** `executeWorkflow()`, создает запись в store со статусом "running".

### 3. Tracking статуса каждой ноды

```typescript
// При старте ноды
executionStore.updateNodeStatus(executionId, currentNodeId, "running", {
  startTime: new Date(),
});

// После выполнения ноды
executionStore.updateNodeStatus(executionId, currentNodeId, "completed", {
  endTime: new Date(),
  output: workflowContext.nodeOutputs.get(currentNodeId),
});
```

### 4. Сохранение результата выполнения

**При успехе:**
```typescript
executionStore.completeExecution(executionId, workflowResult);
```

**При ошибке:**
```typescript
executionStore.completeExecution(executionId, failureResult);
```

### 5. Обновление spans после сбора

```typescript
// После сбора spans
const execution = executionStore.getExecution(result.executionId);
if (execution) {
  execution.spans = result.spans;
}
```

Spans собираются через OpenTelemetry collector после завершения workflow, поэтому нужно обновить execution в store.

---

## Что теперь работает

### ✅ API Executions

```bash
curl -X POST http://localhost:3000/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{"workflowId": "simple-math-workflow"}'
```

**Результат:**
- Workflow выполняется
- Сохраняется в ExecutionStore
- Отправляются SSE события
- Появляется в списке executions

### ✅ GET /workflow/executions

```bash
curl http://localhost:3000/workflow/executions
```

**Результат:**
```json
{
  "executions": [
    {
      "executionId": "wf_exec_1761129764968_c8gfl0tqo",
      "workflowId": "simple-math-workflow",
      "workflowName": "Simple Math Workflow",
      "status": "completed",
      "startTime": "2025-10-22T...",
      "endTime": "2025-10-22T...",
      "executionTime": 3,
      "nodesExecuted": ["add", "multiply", "subtract"],
      "nodeDetails": {...},
      "outputs": {...},
      "spans": [...]
    }
  ],
  "stats": {
    "total": 1,
    "completed": 1,
    "failed": 0,
    "running": 0
  }
}
```

### ✅ GET /workflow/executions/:id

```bash
curl http://localhost:3000/workflow/executions/wf_exec_1761129764968_c8gfl0tqo
```

**Результат:**
```json
{
  "execution": {
    "executionId": "wf_exec_1761129764968_c8gfl0tqo",
    "workflowId": "simple-math-workflow",
    "workflowName": "Simple Math Workflow",
    "status": "completed",
    ...
  }
}
```

### ✅ SSE Stream для списка executions

```bash
curl -N http://localhost:3000/workflow/executions-stream
```

**События:**
```
event: executions.initial
data: {"executions":[...],"stats":{...}}

event: workflow.started
data: {"type":"workflow.started","workflowId":"simple-math-workflow",...}

event: executions.update
data: {"executions":[...],"stats":{...}}

event: node.started
data: {"type":"node.started","nodeId":"add",...}

event: executions.update
data: {"executions":[...],"stats":{...}}
```

### ✅ Frontend UI

При открытии `http://localhost:3100/executions`:

1. ✅ Список executions загружается
2. ✅ SSE подключается к `/api/workflow/executions-stream`
3. ✅ При запуске workflow через UI:
   - Execution появляется мгновенно
   - Статус обновляется в real-time
   - Статистика обновляется автоматически
4. ✅ Клик на execution открывает детальную страницу с:
   - Графом workflow
   - Статусами нод
   - Timeline spans
   - Trace viewer

---

## Flow выполнения

```
1. POST /workflow/execute
   ↓
2. executeWorkflow() вызывается
   ↓
3. executionStore.startExecution()
   - Создает запись со статусом "running"
   - Сохраняет workflowId, workflowName, startTime
   ↓
4. publish("workflow.started")
   - SSE событие отправляется всем подписчикам
   ↓
5. Для каждой ноды:
   a. executionStore.updateNodeStatus("running")
   b. publish("node.started")
   c. executeNode()
   d. executionStore.updateNodeStatus("completed")
   e. publish("node.completed")
   f. publish("executions.update") - обновление списка
   ↓
6. executionStore.completeExecution(result)
   - Сохраняет результат, outputs, executionTime
   - Обновляет статус на "completed" или "failed"
   ↓
7. Spans собираются через OpenTelemetry
   execution.spans = collector.getSpans()
   ↓
8. publish("workflow.completed")
   ↓
9. publish("executions.update")
   - Финальное обновление списка
```

---

## Тестирование

### 1. Запустить backend

```bash
cd /workspace/examples/integrations
pnpm c4c serve all
```

### 2. Запустить workflow через API

```bash
curl -X POST http://localhost:3000/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{"workflowId": "simple-math-workflow"}'
```

### 3. Проверить что execution сохранен

```bash
curl http://localhost:3000/workflow/executions
```

Должен вернуть список с выполненным workflow.

### 4. Запустить UI

```bash
pnpm c4c serve ui --api-base http://localhost:3000
```

### 5. Открыть браузер

```
http://localhost:3100/executions
```

Должен показать список executions с real-time обновлениями.

### 6. Запустить workflow через UI

Нажать кнопку "Execute" и выбрать workflow. Execution должен:
- Появиться в списке мгновенно
- Показывать статус "running"
- Обновиться на "completed" после завершения
- Статистика должна обновиться автоматически

---

## Изменения в коде

### Файлы изменены:

1. ✅ `packages/workflow/src/runtime.ts` - Добавлена интеграция ExecutionStore

### Новый imports:
```typescript
import { getExecutionStore } from "./execution-store.js";
```

### Новые вызовы в executeWorkflow():
- `executionStore.startExecution()` - в начале
- `executionStore.updateNodeStatus()` - для каждой ноды
- `executionStore.completeExecution()` - при успехе/ошибке
- `execution.spans = result.spans` - после сбора spans

---

## Совместимость

### ✅ Обратная совместимость

Все существующие функции работают:
- `executeWorkflow()` возвращает тот же результат
- SSE события публикуются как и раньше
- Spans собираются через OpenTelemetry

### ✅ Новая функциональность

- Все executions автоматически сохраняются в store
- Доступны через GET endpoints
- Отображаются в UI
- Real-time обновления через SSE

---

## Что дальше

Теперь можно:

1. ✅ Запускать workflows через API
2. ✅ Запускать workflows через UI
3. ✅ Просматривать историю executions
4. ✅ Видеть real-time обновления
5. ✅ Просматривать детали каждого execution
6. ✅ Видеть spans и traces

Все работает end-to-end! 🎉
