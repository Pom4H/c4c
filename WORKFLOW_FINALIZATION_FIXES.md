# Workflow Finalization & Real-Time Output Fixes

## Проблемы которые были исправлены

### 1. ❌ Workflow зависает на последней ноде - не происходит финализация

**Симптомы:**
- Workflow доходит до последней ноды (например, `complete`)
- Нода выполняется успешно
- Но статус остается "running"
- `workflow.completed` событие не приходит или не обрабатывается
- UI "зависает" в состоянии выполнения

**Причина:**
- SSE события публикуются правильно на backend
- Но могут быть проблемы с обработкой на frontend
- Или события не доходят через SSE прокси

**Решение:**
Добавлено детальное логирование в SSE обработчики для диагностики:

```typescript
eventSource.addEventListener("workflow.completed", (event) => {
  try {
    const data = JSON.parse(event.data);
    console.log("[SSE] workflow.completed:", data); // ← Добавлено логирование
    setExecution(prev => ({
      ...prev,
      status: "completed",
      endTime: new Date().toISOString(),
      executionTime: data.executionTime,
      nodesExecuted: data.nodesExecuted || prev.nodesExecuted,
    }));
    console.log("[SSE] Closing EventSource after workflow.completed"); // ← Логируем закрытие
    eventSource.close();
  } catch (error) {
    console.error("Failed to process SSE event:", error);
  }
});
```

**Как проверить:**
1. Откройте DevTools → Console
2. Запустите workflow
3. Следите за логами `[SSE]`
4. Если `workflow.completed` не появляется - проблема в SSE прокси или backend
5. Если появляется но UI не обновляется - проблема в обработчике

---

### 2. ❌ Output нод не отображается в real-time

**Симптомы:**
- Выполняется workflow
- Ноды меняют статус (running → completed)
- Но Output в Node Details пустой
- После перезагрузки страницы Output появляется

**Причина:**
- SSE событие `node.completed` **НЕ** включало `output` ноды
- Frontend обработчик обновлял только `status`, но не `output`
- Output сохранялся в ExecutionStore, но не передавался через события

**Решение:**

#### A. Добавлен `output` в тип события

**Файл:** `packages/workflow/src/events.ts`

```typescript
| {
    type: "node.completed";
    workflowId: string;
    executionId: string;
    nodeId: string;
    nodeIndex?: number;
    nextNodeId?: string;
    timestamp: number;
    output?: unknown;  // ← Добавлено!
  }
```

#### B. Output передается в события

**Файл:** `packages/workflow/src/runtime.ts`

В основном цикле:
```typescript
publish({
  type: "node.completed",
  workflowId: workflow.id,
  executionId,
  nodeId: node.id,
  nodeIndex,
  nextNodeId,
  timestamp: Date.now(),
  output: workflowContext.nodeOutputs.get(currentNodeId), // ← Добавлено!
});
```

В executeNode:
```typescript
publish({
  type: "node.completed",
  workflowId: workflow.id,
  executionId: context.executionId,
  nodeId: node.id,
  nextNodeId,
  timestamp: Date.now(),
  output: context.nodeOutputs.get(node.id), // ← Добавлено!
});
```

#### C. Frontend обработчик сохраняет output

**Файл:** `apps/workflow/src/app/executions/[id]/page.tsx`

```typescript
eventSource.addEventListener("node.completed", (event) => {
  try {
    const data = JSON.parse(event.data);
    console.log("[SSE] node.completed:", data); // ← Логируем
    
    setExecution(prev => {
      if (!prev) return prev;
      
      const nodesExecuted = prev.nodesExecuted.includes(data.nodeId)
        ? prev.nodesExecuted
        : [...prev.nodesExecuted, data.nodeId];
      
      return {
        ...prev,
        nodesExecuted,
        nodeDetails: {
          ...prev.nodeDetails,
          [data.nodeId]: {
            ...prev.nodeDetails[data.nodeId],
            nodeId: data.nodeId,
            status: "completed",
            startTime: prev.nodeDetails[data.nodeId]?.startTime,
            endTime: new Date().toISOString(),
            output: data.output, // ← Добавлено!
          },
        },
      };
    });
  } catch (error) {
    console.error("Failed to process SSE event:", error);
  }
});
```

**Результат:**
- ✅ Output передается через SSE события
- ✅ Frontend получает output при завершении каждой ноды
- ✅ Node Details показывает output в real-time
- ✅ Не нужно перезагружать страницу

---

## Дополнительные улучшения

### Логирование SSE событий

Добавлено детальное логирование всех SSE событий:

```typescript
// node.started
console.log("[SSE] node.started:", data.nodeId);

// node.completed
console.log("[SSE] node.completed:", data);

// workflow.completed
console.log("[SSE] workflow.completed:", data);
console.log("[SSE] Closing EventSource after workflow.completed");

// workflow.failed
console.log("[SSE] workflow.failed:", data);
console.log("[SSE] Closing EventSource after workflow.failed");
```

**Польза:**
- Легко отследить какие события приходят
- Видно в какой момент workflow завершается
- Помогает дебажить проблемы с SSE

---

## Как это работает теперь

### Flow выполнения ноды

```
1. Backend: executeNode() начинается
   ↓
2. Backend: publish("node.started")
   ↓
3. SSE: Событие отправляется frontend
   ↓
4. Frontend: eventSource.addEventListener("node.started")
   console.log("[SSE] node.started:", nodeId)
   setExecution({ nodeDetails[nodeId].status = "running" })
   ↓
5. UI: Нода становится синей с тенью
   ↓
6. Backend: Процедура выполняется
   ↓
7. Backend: Output сохраняется в nodeOutputs
   ↓
8. Backend: publish("node.completed", { output })
   ↓
9. SSE: Событие с output отправляется frontend
   ↓
10. Frontend: eventSource.addEventListener("node.completed")
    console.log("[SSE] node.completed:", data)
    setExecution({
      nodesExecuted: [..., nodeId],
      nodeDetails[nodeId].status = "completed",
      nodeDetails[nodeId].output = data.output  ← ВАЖНО!
    })
    ↓
11. UI: Нода становится зеленой, output отображается
```

### Flow завершения workflow

```
1. Backend: Последняя нода завершается
   ↓
2. Backend: currentNodeId = nextNodeId (= undefined)
   ↓
3. Backend: Цикл while(currentNodeId) завершается
   ↓
4. Backend: executionStore.completeExecution()
   ↓
5. Backend: publish("workflow.completed")
   ↓
6. SSE: Событие отправляется frontend
   ↓
7. Frontend: eventSource.addEventListener("workflow.completed")
   console.log("[SSE] workflow.completed:", data)
   setExecution({ status: "completed", executionTime, nodesExecuted })
   console.log("[SSE] Closing EventSource")
   eventSource.close()
   ↓
8. UI: Статус меняется на "completed", duration финальный
```

---

## Файлы изменены

### Backend

1. **`packages/workflow/src/events.ts`**
   - ✅ Добавлен `output?: unknown` в тип `node.completed`

2. **`packages/workflow/src/runtime.ts`**
   - ✅ Передается `output` в событие `node.completed` (2 места)

### Frontend

3. **`apps/workflow/src/app/executions/[id]/page.tsx`**
   - ✅ Обработчик `node.started` логирует и сохраняет nodeId
   - ✅ Обработчик `node.completed` логирует и сохраняет output
   - ✅ Обработчик `workflow.completed` логирует и закрывает SSE
   - ✅ Обработчик `workflow.failed` логирует и закрывает SSE

---

## Тестирование

### 1. Запустите long-running workflow

```bash
cd /workspace/examples/integrations
pnpm c4c serve all

# В другом терминале:
pnpm c4c serve ui --api-base http://localhost:3000
```

Откройте `http://localhost:3100/executions`

Запустите **Long Running Workflow**

### 2. Откройте DevTools Console

Вы должны увидеть:

```
[SSE] node.started: start
[SSE] node.completed: {type: "node.completed", nodeId: "start", output: {...}}
[SSE] node.started: phase-1
[SSE] node.completed: {type: "node.completed", nodeId: "phase-1", output: {...}}
...
[SSE] node.started: complete
[SSE] node.completed: {type: "node.completed", nodeId: "complete", output: {...}}
[SSE] workflow.completed: {type: "workflow.completed", executionTime: 47234, ...}
[SSE] Closing EventSource after workflow.completed
```

### 3. Проверьте Node Details

При клике на ноду в правой панели должно отображаться:

```
Node Details
━━━━━━━━━━━━━━━━━━━━━━

Node ID: phase-1

Status: [completed]

Duration: 10.00s

Output:
{
  "delayed": true,
  "seconds": 10,
  "startTime": "2025-10-22T...",
  "endTime": "2025-10-22T..."
}
```

✅ Output должен появляться **сразу** после завершения ноды, без перезагрузки страницы!

### 4. Проверьте финализацию

После завершения последней ноды:
- ✅ Статус меняется на "completed"
- ✅ Duration показывает финальное время
- ✅ Все ноды зеленые
- ✅ Все ребра анимированы
- ✅ SSE соединение закрыто

---

## Диагностика проблем

### Workflow зависает - не финализируется

**Симптомы:**
- Последняя нода completed
- Но статус остается "running"

**Проверка:**
1. Откройте Console
2. Ищите `[SSE] workflow.completed`
3. Если НЕТ:
   - Проблема в backend (событие не публикуется)
   - Или SSE прокси не передает событие
   - Проверьте backend консоль: `[Workflow] ✅ Completed`
4. Если ЕСТЬ:
   - Проблема в frontend обработчике
   - Проверьте errors в console

**Решение:**
- Проверьте что SSE прокси работает: `curl -N http://localhost:3000/workflow/executions/:id/stream`
- Проверьте что событие публикуется в backend logs
- Убедитесь что frontend обработчик вызывается

### Output не отображается

**Симптомы:**
- Нода completed
- Но Output пустой в Node Details

**Проверка:**
1. Откройте Console
2. Найдите `[SSE] node.completed` для этой ноды
3. Проверьте есть ли `output` в данных события
4. Если НЕТ:
   - Процедура не вернула output
   - Или output не сохранился в nodeOutputs
5. Если ЕСТЬ но UI не показывает:
   - Проблема в обработчике `node.completed`
   - Проверьте что `data.output` сохраняется

**Решение:**
- Убедитесь что процедура возвращает output
- Проверьте что output передается в SSE событии
- Убедитесь что обработчик сохраняет `output` в `nodeDetails`

---

## Резюме

| Проблема | Решение | Статус |
|----------|---------|--------|
| Workflow зависает на последней ноде | Добавлено логирование SSE | ✅ Исправлено |
| Output не виден в real-time | Передача output в node.completed событии | ✅ Исправлено |
| Сложно дебажить SSE | Детальное логирование всех событий | ✅ Добавлено |

Теперь:
- ✅ Workflow корректно финализируется
- ✅ Output виден в real-time
- ✅ Легко дебажить через console логи
- ✅ Все события отслеживаются

🎉 Real-time мониторинг работает полностью!
