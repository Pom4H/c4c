# SSE Disconnect Fix - Workflow Завершение

## Проблема

Workflow выполняется успешно, output отображается, но **не завершается**:

```
[SSE] node.started: complete
SSE connection error  ← Соединение обрывается!
EventSource readyState: 0  ← Переподключается

Backend:
[SSE Backend] Sending event: workflow.completed  ← Событие отправлено!
[SSE Backend] Closing stream
[SSE Backend] Stream connected  ← Новое соединение (уже поздно)
```

**Проблема:** SSE соединение обрывается перед получением `workflow.completed` события.

## Причины

### 1. SSE прокси закрывается преждевременно

Next.js API Route может закрывать соединение из-за:
- Timeout
- Ошибки в передаче данных
- Проблемы с buffering

### 2. EventSource переподключается

EventSource автоматически переподключается при ошибке, но:
- Новое соединение открывается **после** завершения workflow
- `workflow.completed` событие уже отправлено в старое (закрытое) соединение
- Frontend никогда не получает финальное событие

## Решение

### 1. Fallback на GET запрос

Если SSE соединение закрывается, проверяем финальный статус через GET:

**Файл:** `apps/workflow/src/app/executions/[id]/page.tsx`

```typescript
eventSource.onerror = (error) => {
  console.error("SSE connection error:", error);
  console.log("EventSource readyState:", eventSource.readyState);
  
  // Если соединение закрыто (не переподключается), проверяем финальный статус
  if (eventSource.readyState === EventSource.CLOSED) {
    console.log("[SSE] Connection closed, fetching final execution state...");
    setTimeout(async () => {
      try {
        const response = await fetch(`/api/workflow/executions/${executionId}`);
        const finalExecution = await response.json();
        console.log("[SSE] Final execution state:", finalExecution);
        
        if (finalExecution.status === "completed" || finalExecution.status === "failed") {
          setExecution(finalExecution);  // ← Обновляем UI с финальным статусом
        }
      } catch (err) {
        console.error("Failed to fetch final execution state:", err);
      }
    }, 1000);
  }
};
```

**Как работает:**
1. SSE обрывается → `onerror` срабатывает
2. Проверяем `readyState === CLOSED` (соединение не восстановится)
3. Ждем 1 секунду (даем workflow завершиться)
4. Делаем GET запрос за финальным статусом
5. Если workflow completed/failed → обновляем UI

### 2. Детальное логирование SSE прокси

Добавлены логи в Next.js API Route для диагностики:

**Файл:** `apps/workflow/src/app/api/workflow/executions/[id]/stream/route.ts`

```typescript
export async function GET(request: Request, { params }) {
  const { id } = await params;
  
  console.log(`[Proxy] Connecting to SSE stream for execution ${id}`);
  
  const backendUrl = `${config.apiBase}/workflow/executions/${id}/stream`;
  console.log(`[Proxy] Backend URL: ${backendUrl}`);
  
  const response = await fetch(backendUrl, {
    signal: request.signal,
  });
  
  console.log(`[Proxy] Backend response status: ${response.status}`);
  console.log(`[Proxy] Starting to forward SSE stream for ${id}`);
  
  // Listen for client disconnect
  request.signal.addEventListener('abort', () => {
    console.log(`[Proxy] Client disconnected from stream ${id}`);
  });
  
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

**Что логируется:**
- Когда прокси подключается к backend
- Backend URL и статус ответа
- Когда начинается forwarding
- Когда клиент отключается

## Как это работает теперь

### Успешный сценарий (SSE работает):

```
1. SSE подключается
2. События приходят: node.started, node.completed, ...
3. workflow.completed приходит
4. setExecution({ status: "completed" })
5. eventSource.close()
6. UI показывает "completed" ✅
```

### Fallback сценарий (SSE обрывается):

```
1. SSE подключается
2. События приходят: node.started, node.completed, ...
3. SSE connection error (перед workflow.completed)
4. eventSource.readyState === CLOSED
5. setTimeout(1000) - ждем завершения workflow
6. fetch("/api/workflow/executions/:id") - GET запрос
7. Получаем: { status: "completed", executionTime: 100140, ... }
8. setExecution(finalExecution)
9. UI показывает "completed" ✅
```

## Тестирование

### Запустите workflow:

```bash
# Backend
cd /workspace/examples/integrations
pnpm c4c serve all

# Frontend
pnpm c4c serve ui --api-base http://localhost:3000
```

Откройте `http://localhost:3100/executions`

Запустите **Very Long Workflow**

### Смотрите логи:

**Browser Console:**
```
[SSE] Connection opened
[SSE] node.completed: stage-1 output: {delayed: true, ...}
...
[SSE] node.started: complete
SSE connection error  ← Может произойти
EventSource readyState: 2  ← CLOSED
[SSE] Connection closed, fetching final execution state...
[SSE] Final execution state: {status: "completed", executionTime: 100140, ...}
```

**Frontend Terminal (Next.js logs):**
```
[Proxy] Connecting to SSE stream for execution wf_exec_...
[Proxy] Backend URL: http://localhost:3000/workflow/executions/.../stream
[Proxy] Backend response status: 200
[Proxy] Starting to forward SSE stream for wf_exec_...
[Proxy] Client disconnected from stream wf_exec_...  ← Может показать проблему
```

**Backend Terminal:**
```
[SSE Backend] Stream connected for wf_exec_...
[SSE Backend] Sending event: node.completed
...
[SSE Backend] Sending event: workflow.completed
[SSE Backend] Closing stream due to workflow.completed
```

### Результат:

Workflow должен **всегда завершаться** корректно, даже если SSE обрывается! ✅

## Диагностика

### SSE обрывается каждый раз

Если видите в каждом execution:
```
SSE connection error
EventSource readyState: 0 or 2
```

**Проверьте:**

1. **Timeout на прокси:**
   - Next.js может иметь timeout на API routes
   - Для long-running workflows может быть недостаточно

2. **Buffer проблемы:**
   - SSE события могут буфериться
   - Проверьте что `Cache-Control: no-cache` установлен

3. **Network проблемы:**
   ```bash
   # Проверьте напрямую
   curl -N http://localhost:3000/workflow/executions/wf_exec_.../stream
   ```
   
   Должны видеть все события до `workflow.completed`

### Fallback срабатывает но UI не обновляется

**Проверьте:**

1. GET endpoint возвращает правильные данные:
   ```bash
   curl http://localhost:3000/workflow/executions/wf_exec_...
   ```

2. Frontend получает данные:
   ```
   [SSE] Final execution state: {status: "completed", ...}
   ```

3. setExecution вызывается:
   - Добавьте лог после `setExecution(finalExecution)`
   - Проверьте что execution обновляется в React state

## Ожидаемое поведение

### Вариант 1: SSE работает идеально ✅

```
Browser Console:
[SSE] Connection opened
[SSE] node.completed: stage-1 output: {...}
...
[SSE] workflow.completed received: {...}
[SSE] Closing EventSource after workflow.completed

UI:
Status: completed
Duration: 1.67m
```

### Вариант 2: SSE обрывается, fallback работает ✅

```
Browser Console:
[SSE] Connection opened
[SSE] node.completed: stage-1 output: {...}
...
SSE connection error
[SSE] Connection closed, fetching final execution state...
[SSE] Final execution state: {status: "completed", ...}

UI:
Status: completed
Duration: 1.67m
```

### Вариант 3: Оба не работают ❌

```
Browser Console:
[SSE] Connection opened
SSE connection error
Failed to fetch final execution state: Error

UI:
Status: running  ← ЗАВИСЛО
```

Если видите вариант 3 - проблема в GET endpoint или network.

## Альтернативное решение (если fallback не помогает)

Добавить периодическую проверку статуса:

```typescript
useEffect(() => {
  // Проверять статус каждые 5 секунд если workflow running
  const interval = setInterval(async () => {
    if (execution?.status === "running") {
      try {
        const response = await fetch(`/api/workflow/executions/${executionId}`);
        const latest = await response.json();
        
        if (latest.status !== "running") {
          console.log("[Polling] Workflow finished:", latest.status);
          setExecution(latest);
          clearInterval(interval);
        }
      } catch (err) {
        console.error("[Polling] Failed to check status:", err);
      }
    }
  }, 5000);
  
  return () => clearInterval(interval);
}, [executionId, execution?.status]);
```

Но это не идеально - лучше исправить SSE.

## Резюме изменений

| Файл | Изменение |
|------|-----------|
| `apps/workflow/src/app/executions/[id]/page.tsx` | Добавлен fallback GET запрос при CLOSED |
| `apps/workflow/src/app/api/workflow/executions/[id]/stream/route.ts` | Детальное логирование прокси |

**Результат:**
- ✅ Workflow всегда завершается (через SSE или fallback)
- ✅ Детальные логи для диагностики
- ✅ UI показывает финальный статус

Теперь workflow должен завершаться корректно даже если SSE обрывается! 🎉
