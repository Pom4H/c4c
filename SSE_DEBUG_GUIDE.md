# SSE Debugging Guide - Workflow Завершение

## Проблема

Workflow выполняется но:
1. Не завершается (зависает на последней ноде)
2. Output нод не виден в real-time
3. SSE connection error в консоли

## Что добавлено для диагностики

### 1. Логирование на Frontend

**Файл:** `apps/workflow/src/app/executions/[id]/page.tsx`

```typescript
// При подключении SSE
eventSource.onopen = () => {
  console.log("[SSE] Connection opened");
};

// При старте ноды
console.log("[SSE] node.started:", data.nodeId);

// При завершении ноды - теперь с output
console.log("[SSE] node.completed:", data.nodeId, "output:", data.output);

// При завершении workflow
console.log("[SSE] workflow.completed:", data);
console.log("[SSE] Closing EventSource after workflow.completed");

// При ошибке SSE
eventSource.onerror = (error) => {
  console.error("SSE connection error:", error);
  console.log("EventSource readyState:", eventSource.readyState);
  console.log("EventSource url:", eventSource.url);
};
```

### 2. Логирование на Backend

**Файл:** `packages/adapters/src/workflow-http.ts`

```typescript
// При подключении клиента
console.log(`[SSE Backend] Stream connected for ${executionId}`);

// При отправке каждого события
console.log(`[SSE Backend] Sending event: ${event.type} for ${executionId}`);

// При закрытии стрима
console.log(`[SSE Backend] Closing stream for ${executionId} due to ${event.type}`);

// При обрыве соединения
console.log(`[SSE Backend] Stream aborted for ${executionId}`);
```

---

## Как дебажить

### Шаг 1: Запустите workflow

```bash
# Terminal 1: Backend
cd /workspace/examples/integrations
pnpm c4c serve all

# Terminal 2: Frontend
pnpm c4c serve ui --api-base http://localhost:3000
```

Запустите **Very Long Workflow**

### Шаг 2: Откройте две консоли

**Browser DevTools Console:**
- Следите за `[SSE]` логами
- Проверяйте что `output` присутствует в `node.completed`

**Backend Terminal:**
- Следите за `[SSE Backend]` логами
- Проверяйте что события публикуются
- Смотрите когда stream закрывается

### Шаг 3: Анализируйте логи

#### Нормальное выполнение (что должно быть):

**Frontend Console:**
```
[SSE] Connection opened
[SSE] node.started: start
[SSE] node.completed: start output: {logged: true, timestamp: "..."}
[SSE] node.started: stage-1
[SSE] node.completed: stage-1 output: {delayed: true, seconds: 20, ...}
...
[SSE] node.started: complete
[SSE] node.completed: complete output: {logged: true, timestamp: "..."}
[SSE] workflow.completed: {executionTime: 98234, nodesExecuted: [...]}
[SSE] Closing EventSource after workflow.completed
```

**Backend Terminal:**
```
[SSE Backend] Stream connected for wf_exec_...
[SSE Backend] Sending event: node.started for wf_exec_...
[SSE Backend] Sending event: node.completed for wf_exec_...
...
[SSE Backend] Sending event: workflow.completed for wf_exec_...
[SSE Backend] Closing stream for wf_exec_... due to workflow.completed
```

#### Проблема: workflow.completed не приходит

**Frontend Console:**
```
[SSE] node.completed: complete output: {...}
SSE connection error
EventSource readyState: 2  // ← 2 = CLOSED
```

**Backend Terminal:**
```
[SSE Backend] Sending event: node.completed for wf_exec_...
[Workflow] ✅ Completed: very-long-workflow (98234ms, 11 nodes)  // ← Workflow завершился
[SSE Backend] Sending event: workflow.completed for wf_exec_...  // ← Событие отправлено
[SSE Backend] Closing stream for wf_exec_... due to workflow.completed
```

**Диагноз:** Backend отправляет событие, но frontend не получает

**Возможные причины:**
1. SSE прокси закрывается преждевременно
2. Сетевая проблема
3. Timeout на прокси

#### Проблема: output нет в событиях

**Frontend Console:**
```
[SSE] node.completed: start output: undefined  // ← НЕТ OUTPUT!
```

**Диагноз:** Output не передается в событиях

**Проверка на backend:**
1. Убедитесь что процедура возвращает результат
2. Проверьте что `output` добавлен в `publish()`:
   ```typescript
   publish({
     type: "node.completed",
     nodeId: node.id,
     output: workflowContext.nodeOutputs.get(currentNodeId), // ← Должно быть!
   });
   ```

---

## Решения проблем

### Проблема 1: SSE connection error / workflow.completed не приходит

#### Попробуйте:

1. **Проверьте readyState:**
   ```javascript
   // В console
   eventSource.readyState
   // 0 = CONNECTING
   // 1 = OPEN
   // 2 = CLOSED
   ```

2. **Проверьте SSE прокси напрямую:**
   ```bash
   curl -N http://localhost:3000/workflow/executions/wf_exec_.../stream
   ```
   Должны видеть события в real-time

3. **Увеличьте timeout SSE (если нужно):**
   В `workflow-http.ts`:
   ```typescript
   while (open) {
     await stream.sleep(30000); // Увеличить с 15000 до 30000
     ...
   }
   ```

4. **Проверьте не блокирует ли frontend прокси:**
   В `apps/workflow/src/app/api/workflow/executions/[id]/stream/route.ts`
   добавьте логирование:
   ```typescript
   console.log(`[Proxy] Connecting to ${config.apiBase}/workflow/executions/${id}/stream`);
   // ... после fetch
   console.log(`[Proxy] Connected, streaming...`);
   ```

### Проблема 2: Output undefined

#### Проверьте:

1. **Output передается в runtime.ts:**
   ```bash
   grep -n "output.*nodeOutputs.get" packages/workflow/src/runtime.ts
   ```
   Должно быть минимум 2 места

2. **Output существует в nodeOutputs:**
   Добавьте лог перед publish:
   ```typescript
   const nodeOutput = workflowContext.nodeOutputs.get(currentNodeId);
   console.log(`[Runtime] Node ${currentNodeId} output:`, nodeOutput);
   publish({
     type: "node.completed",
     output: nodeOutput,
     ...
   });
   ```

3. **Процедура возвращает результат:**
   В `custom.ts`:
   ```typescript
   handler: async ({ seconds, message }) => {
     const startTime = new Date().toISOString();
     console.log(`[delay] ${message}`);
     await new Promise(resolve => setTimeout(resolve, seconds * 1000));
     const endTime = new Date().toISOString();
     
     const result = {
       delayed: true,
       seconds,
       startTime,
       endTime,
     };
     
     console.log(`[delay] Returning:`, result); // ← Добавить лог
     return result;
   }
   ```

---

## Чеклист для диагностики

### Frontend
- [ ] Console показывает `[SSE] Connection opened`
- [ ] Для каждой ноды приходит `node.started`
- [ ] Для каждой ноды приходит `node.completed`
- [ ] В `node.completed` есть `output` (не undefined)
- [ ] После последней ноды приходит `workflow.completed`
- [ ] После `workflow.completed` stream закрывается

### Backend
- [ ] Terminal показывает `[SSE Backend] Stream connected`
- [ ] Для каждого события показывает `[SSE Backend] Sending event`
- [ ] Показывает `[Workflow] ✅ Completed` в конце
- [ ] Показывает `[SSE Backend] Sending event: workflow.completed`
- [ ] Показывает `[SSE Backend] Closing stream`

### SSE Прокси
- [ ] `curl -N http://localhost:3000/workflow/executions/:id/stream` работает
- [ ] События приходят в real-time
- [ ] Stream не обрывается преждевременно

---

## Быстрые тесты

### Тест 1: SSE работает вообще

```bash
curl -N http://localhost:3000/workflow/executions-stream
```

Должно показать:
```
event: executions.initial
data: {"executions":[],...}

event: heartbeat
data: {"timestamp":...}
```

### Тест 2: Execution SSE работает

```bash
# Запустить workflow
curl -X POST http://localhost:3000/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{"workflowId": "simple-math-workflow"}'

# Получить executionId из ответа, затем:
curl -N http://localhost:3000/workflow/executions/wf_exec_.../stream
```

Должно показать все события до `workflow.completed`

### Тест 3: Output в событиях

```bash
# В событии node.completed должно быть:
data: {"type":"node.completed","nodeId":"...","output":{...}}
```

Не должно быть `"output":undefined` или отсутствия поля `output`

---

## Итоговое решение

Если проблема остается:

1. **Перезапустите backend:**
   ```bash
   # Ctrl+C в терминале backend
   pnpm c4c serve all
   ```

2. **Очистите кеш frontend:**
   ```bash
   # Ctrl+C в терминале frontend
   rm -rf apps/workflow/.next
   pnpm c4c serve ui --api-base http://localhost:3000
   ```

3. **Проверьте версии пакетов:**
   ```bash
   pnpm list @hono/node-server
   pnpm list hono
   ```

4. **Запустите простой workflow сначала:**
   - Попробуйте `simple-math-workflow` вместо `very-long-workflow`
   - Если работает - проблема специфична для длительных workflows
   - Может быть timeout

---

## Ожидаемые результаты после исправлений

✅ **Frontend Console:**
```
[SSE] Connection opened
[SSE] node.started: start
[SSE] node.completed: start output: {logged: true, timestamp: "2025-10-22T..."}
[SSE] node.completed: stage-1 output: {delayed: true, seconds: 20, ...}
[SSE] workflow.completed: {executionTime: 98234, nodesExecuted: Array(11)}
[SSE] Closing EventSource after workflow.completed
```

✅ **Node Details показывает Output:**
```json
{
  "delayed": true,
  "seconds": 20,
  "startTime": "2025-10-22T...",
  "endTime": "2025-10-22T..."
}
```

✅ **Workflow Status:**
- Status: completed
- Duration: 1.64m
- Nodes: 11/11

Всё работает! 🎉
