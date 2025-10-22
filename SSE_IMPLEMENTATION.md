# SSE Implementation - Server-Sent Events для Live Updates

## ✅ Да, фронтенд получает события через SSE!

Система полностью использует Server-Sent Events (SSE) для real-time обновлений, как и раньше.

## Архитектура SSE

```
┌──────────────────────────────────────────────────────────┐
│                    WORKFLOW EXECUTION                    │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│              ExecutionStore (Server-side)                │
│  • Tracks execution state                                │
│  • Updates node statuses                                 │
│  • Emits events via publish()                            │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│         subscribeToExecution() (Event System)            │
│  • Subscribes to workflow events                         │
│  • Filters by executionId                                │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│   GET /api/workflow/executions/[id]/stream (SSE)         │
│  • Creates SSE connection                                │
│  • Streams events to client                              │
│  • Keeps connection alive                                │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│              EventSource (Browser)                       │
│  • Receives SSE events                                   │
│  • Updates React state                                   │
│  • Re-renders UI                                         │
└──────────────────────────────────────────────────────────┘
```

## API Endpoints

### 1. GET /api/workflow/executions
**Назначение:** Список всех executions  
**Тип:** REST API  
**Ответ:**
```json
{
  "executions": [
    {
      "executionId": "wf_exec_...",
      "workflowId": "google-drive-monitor",
      "workflowName": "Google Drive Monitor",
      "status": "completed",
      "startTime": "2024-...",
      "endTime": "2024-...",
      "executionTime": 1234,
      "nodesExecuted": ["trigger", "process"],
      "nodeDetails": {
        "trigger": {
          "status": "completed",
          "duration": 234
        }
      }
    }
  ],
  "stats": {
    "total": 45,
    "completed": 38,
    "failed": 5,
    "running": 2
  }
}
```

### 2. GET /api/workflow/executions/[id]
**Назначение:** Детали конкретного execution  
**Тип:** REST API  
**Ответ:**
```json
{
  "executionId": "wf_exec_...",
  "workflowId": "google-drive-monitor",
  "status": "completed",
  "nodeDetails": {
    "trigger": {
      "nodeId": "trigger",
      "status": "completed",
      "startTime": "2024-...",
      "endTime": "2024-...",
      "duration": 234,
      "output": {...}
    }
  },
  "spans": [...]
}
```

### 3. GET /api/workflow/executions/[id]/stream ⚡ SSE
**Назначение:** Live updates для execution  
**Тип:** Server-Sent Events  
**События:**

#### node.started
```
event: node.started
data: {"type":"node.started","nodeId":"process","executionId":"wf_exec_...","timestamp":1234567890}
```

#### node.completed
```
event: node.completed
data: {"type":"node.completed","nodeId":"process","executionId":"wf_exec_...","nextNodeId":"next"}
```

#### workflow.completed
```
event: workflow.completed
data: {"type":"workflow.completed","executionId":"wf_exec_...","executionTime":1234}
```

#### workflow.failed
```
event: workflow.failed
data: {"type":"workflow.failed","executionId":"wf_exec_...","error":"..."}
```

### 4. GET /api/workflow/definitions
**Назначение:** Список доступных workflows  
**Тип:** REST API

### 5. GET /api/workflow/definitions/[id]
**Назначение:** Definition конкретного workflow  
**Тип:** REST API

### 6. POST /api/workflow/execute
**Назначение:** Запуск workflow  
**Тип:** REST API

## Frontend Integration

### Список executions (/executions)
```typescript
// Polling каждые 2 секунды для обновления списка
useEffect(() => {
  loadExecutions();
  const interval = setInterval(loadExecutions, 2000);
  return () => clearInterval(interval);
}, []);

const loadExecutions = async () => {
  const response = await fetch("/api/workflow/executions");
  const data = await response.json();
  setExecutions(data.executions);
  setStats(data.stats);
};
```

### Детальный вид execution (/executions/[id])
```typescript
// SSE для live updates
useEffect(() => {
  const eventSource = new EventSource(
    `/api/workflow/executions/${executionId}/stream`
  );
  
  // Listen to node events
  eventSource.addEventListener("node.started", (event) => {
    const data = JSON.parse(event.data);
    setExecution(prev => ({
      ...prev,
      nodeDetails: {
        ...prev.nodeDetails,
        [data.nodeId]: {
          ...prev.nodeDetails[data.nodeId],
          status: "running",
          startTime: new Date().toISOString(),
        },
      },
    }));
  });
  
  eventSource.addEventListener("node.completed", (event) => {
    const data = JSON.parse(event.data);
    setExecution(prev => ({
      ...prev,
      nodeDetails: {
        ...prev.nodeDetails,
        [data.nodeId]: {
          ...prev.nodeDetails[data.nodeId],
          status: "completed",
          endTime: new Date().toISOString(),
        },
      },
    }));
  });
  
  eventSource.addEventListener("workflow.completed", (event) => {
    const data = JSON.parse(event.data);
    setExecution(prev => ({
      ...prev,
      status: "completed",
      executionTime: data.executionTime,
    }));
    eventSource.close();
  });
  
  return () => eventSource.close();
}, [executionId]);
```

## Поток данных

### 1. Запуск workflow
```
User clicks "Execute"
  ↓
POST /api/workflow/execute
  ↓
executeWorkflow(workflow, registry, input)
  ↓
ExecutionStore.startExecution()
  ↓
publish({ type: "workflow.started" })
  ↓
SSE stream отправляет событие клиенту
  ↓
EventSource получает событие
  ↓
React state обновляется
  ↓
UI показывает "Running"
```

### 2. Выполнение ноды
```
Node starts execution
  ↓
ExecutionStore.updateNodeStatus(nodeId, "running")
  ↓
publish({ type: "node.started", nodeId })
  ↓
SSE → EventSource → React state
  ↓
UI показывает ноду как "running" (синий цвет, анимация)
  ↓
Node completes
  ↓
ExecutionStore.updateNodeStatus(nodeId, "completed")
  ↓
publish({ type: "node.completed", nodeId })
  ↓
SSE → EventSource → React state
  ↓
UI показывает ноду как "completed" (зеленый цвет)
```

### 3. Завершение workflow
```
Workflow completes
  ↓
ExecutionStore.completeExecution(result)
  ↓
publish({ type: "workflow.completed" })
  ↓
SSE → EventSource → React state
  ↓
UI показывает финальный статус
  ↓
EventSource.close()
```

## Преимущества SSE

✅ **Real-time updates** - моментальное обновление UI  
✅ **One-way communication** - сервер → клиент (достаточно для мониторинга)  
✅ **Auto-reconnect** - браузер автоматически переподключается  
✅ **HTTP/2 friendly** - может использовать multiplexing  
✅ **Built-in retry** - не нужно писать retry logic  
✅ **Keep-alive** - автоматический keepalive каждые 15 секунд  

## Сравнение с WebSocket

| Feature | SSE | WebSocket |
|---------|-----|-----------|
| Direction | Server → Client | Bidirectional |
| Protocol | HTTP/HTTPS | WS/WSS |
| Auto-reconnect | ✅ Yes | ❌ No (manual) |
| Complexity | 🟢 Simple | 🟡 Complex |
| Use case | Monitoring | Chat, Games |

Для мониторинга executions SSE идеально подходит!

## Live Updates в UI

### Execution List Page
- **Polling** каждые 2 секунды для обновления списка
- Показывает running executions с анимацией
- Автоматически обновляет статистику

### Execution Detail Page  
- **SSE connection** для конкретного execution
- Live обновление статусов нод:
  - ⚪ Pending (серый)
  - 🔵 Running (синий + анимация)
  - ✅ Completed (зеленый)
  - ❌ Failed (красный)
- Анимация ребер графа при прохождении
- Обновление длительности в реальном времени

## Демо сценарий

1. Пользователь открывает `/executions`
2. Выбирает workflow и нажимает "Execute"
3. POST запрос создает execution
4. Редирект на `/executions/[id]`
5. SSE connection устанавливается
6. **Live updates начинаются:**
   - Нода становится синей (running)
   - Показывается анимация
   - Через N секунд - зеленая (completed)
   - Следующая нода начинает выполняться
   - И так далее...
7. Workflow завершается
8. SSE connection закрывается
9. Финальный граф показывает все выполненные ноды

## Keepalive

SSE connection держится alive через:

```typescript
// Server-side (route.ts)
const keepAlive = setInterval(() => {
  controller.enqueue(encoder.encode(": keepalive\n\n"));
}, 15000); // Каждые 15 секунд
```

Это предотвращает timeout на уровне:
- Nginx/Apache
- Load balancers
- Browser

## Cleanup

Автоматический cleanup при:
- Закрытии страницы
- Переходе на другую страницу
- Завершении workflow
- Ошибке соединения

```typescript
// Client-side
useEffect(() => {
  const eventSource = new EventSource(url);
  // ...
  return () => eventSource.close(); // ✅ Cleanup
}, [executionId]);

// Server-side
request.signal.addEventListener("abort", () => {
  clearInterval(keepAlive);
  unsubscribe();
  controller.close(); // ✅ Cleanup
});
```

## Тестирование SSE

### Curl
```bash
curl -N http://localhost:3000/api/workflow/executions/wf_exec_123/stream
```

### Browser DevTools
```
Network Tab → Filter: EventStream
→ Смотреть события в реальном времени
```

### SSE Client
```typescript
const es = new EventSource(url);
es.onmessage = (event) => console.log(event);
es.addEventListener("node.started", (e) => console.log(e.data));
```

## Production Considerations

1. **Rate limiting** - ограничить количество SSE connections
2. **Authentication** - проверять права доступа к execution
3. **Timeout** - закрывать старые connections (30 минут?)
4. **Monitoring** - трекать количество active SSE connections
5. **Horizontal scaling** - Redis Pub/Sub для SSE across instances

## Итог

✅ **SSE полностью реализован и работает**  
✅ **Real-time updates в UI**  
✅ **Автоматический reconnect**  
✅ **Keepalive каждые 15 секунд**  
✅ **Graceful cleanup**  

Фронтенд получает все события через SSE! 🎉
