# Руководство по интеграции триггеров

Полное руководство по работе с триггерами и webhook'ами в C4C Framework.

## Как триггеры получают запросы из интеграций

### Полный цикл работы

```
┌──────────────────────────────────────────────────────────────────┐
│                           1. SETUP PHASE                         │
└──────────────────────────────────────────────────────────────────┘

Developer создает систему:

┌─────────────┐
│ Developer   │
│  creates:   │
│             │
│ • Registry  │──────┐
│ • Webhook   │      │
│   Registry  │      │
│ • Event     │      │
│   Router    │      │
│ • HTTP      │      │
│   Server    │      │
└─────────────┘      │
                     ▼
           ┌──────────────────┐
           │  HTTP Server     │
           │  :3000           │
           │                  │
           │ Endpoints:       │
           │ • /webhooks/*    │
           │ • /rpc/*         │
           │ • /workflow/*    │
           └──────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│                      2. SUBSCRIPTION PHASE                       │
└──────────────────────────────────────────────────────────────────┘

Workflow запускается и создает подписку:

Workflow Node                     Trigger Procedure
┌─────────────────┐              ┌──────────────────┐
│ id: "subscribe" │              │ googleDrive.     │
│ procedureName:  │─────────────▶│ drive.changes.   │
│ "googleDrive.   │              │ watch            │
│  drive.changes. │              │                  │
│  watch"         │              │ Handler:         │
│                 │              │ 1. Call Google   │
│ config:         │              │    Drive API     │
│ • pageToken     │              │ 2. Create channel│
│ • webhookUrl    │              │ 3. Return        │
│ • channelId     │              │    subscription  │
└─────────────────┘              │    info          │
                                 └────────┬─────────┘
                                          │
                                          │ HTTP POST
                                          │
                                          ▼
                              ┌────────────────────┐
                              │  Google Drive API  │
                              │                    │
                              │  POST /changes/    │
                              │       watch        │
                              │                    │
                              │  Body:             │
                              │  {                 │
                              │    id: "channel_1" │
                              │    type: "web_hook"│
                              │    address:        │
                              │    "http://..."    │
                              │  }                 │
                              └────────┬───────────┘
                                       │
                                       │ Returns:
                                       │
                                       ▼
                              ┌────────────────────┐
                              │  Channel Info      │
                              │                    │
                              │  {                 │
                              │    id: "channel_1" │
                              │    resourceId:     │
                              │      "resource_2"  │
                              │    expiration:     │
                              │      "2024-..."    │
                              │  }                 │
                              └────────────────────┘

Google Drive регистрирует webhook и будет отправлять события!


┌──────────────────────────────────────────────────────────────────┐
│                       3. PAUSE & WAIT PHASE                      │
└──────────────────────────────────────────────────────────────────┘

Workflow паузится и ждет событий:

Workflow Execution                Event Router
┌─────────────────┐              ┌──────────────────┐
│ Current Node:   │              │ Paused           │
│ "wait-for-      │              │ Executions:      │
│  event"         │              │                  │
│                 │              │ exec_123:        │
│ Status:         │─────────────▶│ • workflowId     │
│ "paused"        │   Register   │ • pausedAt       │
│                 │              │ • resumeOn:      │
│ ResumeState:    │              │   - provider:    │
│ • variables     │              │     "googleDrive"│
│ • nodeOutputs   │              │   - eventType:   │
│ • currentNode   │              │     "change"     │
└─────────────────┘              └──────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│                      4. EVENT DELIVERY PHASE                     │
└──────────────────────────────────────────────────────────────────┘

Google Drive отправляет webhook когда файл изменяется:

Google Drive                     Your HTTP Server
┌─────────────────┐              ┌──────────────────┐
│ File changed!   │              │ POST /webhooks/  │
│                 │              │      googleDrive │
│ Sends webhook:  │─────────────▶│                  │
│                 │   HTTP POST  │ Headers:         │
│ Headers:        │              │ X-Goog-Channel-  │
│ • X-Goog-       │              │   ID: "chan_1"   │
│   Channel-ID    │              │ X-Goog-Resource- │
│ • X-Goog-       │              │   State: "change"│
│   Resource-     │              │                  │
│   State         │              │ Body:            │
│                 │              │ { ... change ... }│
│ Body:           │              └────────┬─────────┘
│ {               │                       │
│   kind: "..."   │                       │ 1. Parse request
│   fileId: "..." │                       │ 2. Verify signature
│   changeType:   │                       │ 3. Create WebhookEvent
│   ...           │                       │
│ }               │                       ▼
└─────────────────┘              ┌──────────────────┐
                                 │ WebhookEvent     │
                                 │                  │
                                 │ {                │
                                 │   id: "evt_456"  │
                                 │   provider:      │
                                 │     "googleDrive"│
                                 │   eventType:     │
                                 │     "change"     │
                                 │   payload: {...} │
                                 │   headers: {...} │
                                 │ }                │
                                 └────────┬─────────┘
                                          │
                                          ▼
                                 ┌──────────────────┐
                                 │ Webhook Registry │
                                 │                  │
                                 │ Dispatches to    │
                                 │ registered       │
                                 │ handlers         │
                                 └────────┬─────────┘
                                          │
                                          ▼
                                 ┌──────────────────┐
                                 │ Event Router     │
                                 │                  │
                                 │ 1. Find paused   │
                                 │    executions    │
                                 │ 2. Match filters │
                                 │ 3. Resume        │
                                 │    workflows     │
                                 └────────┬─────────┘
                                          │
                                          ▼
                                 ┌──────────────────┐
                                 │ Resume Workflow  │
                                 │                  │
                                 │ • Inject event   │
                                 │   into variables │
                                 │ • Continue from  │
                                 │   paused node    │
                                 │ • Process change │
                                 └──────────────────┘


┌──────────────────────────────────────────────────────────────────┐
│                      5. PROCESSING PHASE                         │
└──────────────────────────────────────────────────────────────────┘

Workflow обрабатывает событие:

Workflow Node                    Variables
┌─────────────────┐              ┌──────────────────┐
│ id: "process"   │              │ webhook: {       │
│                 │◀─────────────│   event:         │
│ config:         │   Injected   │     "change"     │
│   payload:      │              │   payload: {     │
│   "{{ webhook.  │              │     fileId: "..."│
│      payload }}"│              │     file: {...}  │
│                 │              │   }              │
│ procedureName:  │              │   headers: {...} │
│ "custom.process"│              │ }                │
└─────────────────┘              └──────────────────┘
         │
         │ Execute procedure
         ▼
┌─────────────────┐
│ Custom Handler  │
│                 │
│ Processes:      │
│ • File change   │
│ • Updates DB    │
│ • Sends notif   │
│ • etc.          │
└─────────────────┘
         │
         │ Complete
         ▼
┌─────────────────┐
│ Next Node:      │
│ "wait-for-      │
│  event"         │
│                 │
│ Loop back!      │◀──┐
│ Wait for next   │   │
│ event...        │   │
└─────────────────┘   │
         │            │
         └────────────┘
         (Workflow pauses again)
```

## Ключевые компоненты

### 1. Webhook Registry

```typescript
class WebhookRegistry {
  // Хранит подписки
  private subscriptions = Map<id, WebhookSubscription>;
  
  // Хранит handlers для каждого провайдера
  private handlers = Map<provider, WebhookHandler[]>;
  
  // Принимает event и вызывает handlers
  async dispatch(event: WebhookEvent): Promise<void>
}
```

**Ответственность:**
- Регистрация webhook subscriptions
- Верификация incoming webhooks
- Dispatch событий к handlers

### 2. Event Router

```typescript
class EventRouter {
  // Хранит paused workflow executions
  private pausedExecutions = Map<executionId, PausedExecution>;
  
  // Хранит resume handlers для workflows
  private resumeHandlers = Map<workflowId, ResumeHandler>;
  
  // Маршрутизирует события к workflows
  async routeEvent(event: WebhookEvent): Promise<RouteResult[]>
}
```

**Ответственность:**
- Tracking paused workflow executions
- Matching events to executions (по filters)
- Resuming workflows с event data

### 3. Webhook Router (HTTP)

```typescript
function createWebhookRouter(
  registry: Registry,
  webhookRegistry: WebhookRegistry
): Hono {
  // POST /webhooks/:provider
  // - Принимает webhook POST от интеграций
  // - Верифицирует signature
  // - Создает WebhookEvent
  // - Dispatches через WebhookRegistry
}
```

**Ответственность:**
- HTTP endpoint для webhooks
- Request parsing
- Webhook verification
- Event creation

## Пример: Google Drive Integration

### Шаг 1: Setup

```typescript
import { collectRegistry } from "@c4c/core";
import { createHttpServer, WebhookRegistry } from "@c4c/adapters";
import { EventRouter } from "@c4c/workflow";

const registry = await collectRegistry("./procedures");
const webhookRegistry = new WebhookRegistry();
const eventRouter = new EventRouter();

// Connect webhook events to event router
webhookRegistry.registerHandler("googleDrive", async (event) => {
  await eventRouter.routeEvent(event);
});

const server = createHttpServer(registry, 3000, {
  enableWebhooks: true,
  webhookRegistry,
});

// ✅ Server running on :3000
// 📡 Webhook endpoint: POST /webhooks/googleDrive
```

### Шаг 2: Subscribe

```typescript
const trigger = registry.get("googleDrive.drive.changes.watch");

// Call trigger procedure
const subscription = await trigger.handler({
  pageToken: "start-token",
  requestBody: {
    id: "channel_unique_id",
    type: "web_hook",
    address: "http://your-server.com/webhooks/googleDrive",
  },
}, context);

// ✅ Google Drive теперь будет отправлять webhook'и!
```

### Шаг 3: Create Workflow

```typescript
const workflow = {
  id: "drive-monitor",
  startNode: "subscribe",
  nodes: [
    {
      id: "subscribe",
      type: "procedure",
      procedureName: "googleDrive.drive.changes.watch",
      config: { ... },
      next: "wait",
    },
    {
      id: "wait",
      type: "pause",
      config: {
        resumeOn: { provider: "googleDrive" },
      },
      next: "process",
    },
    {
      id: "process",
      type: "procedure",
      procedureName: "custom.handleChange",
      config: {
        change: "{{ webhook.payload }}",
      },
      next: "wait", // Loop!
    },
  ],
};
```

### Шаг 4: Execute

```typescript
// Register resume handler
eventRouter.registerResumeHandler(workflow.id, async (state, event) => {
  return await executeWorkflow(workflow, registry, state.variables);
});

// Start workflow
const result = await executeWorkflow(workflow, registry, {
  webhookUrl: "http://localhost:3000/webhooks/googleDrive",
});

// Workflow pauses
if (result.status === "paused") {
  eventRouter.registerPausedExecution({
    workflowId: workflow.id,
    executionId: result.executionId,
    pausedAt: result.resumeState.currentNode,
    resumeOn: { provider: "googleDrive" },
    state: result.resumeState,
    pausedTime: new Date(),
  });
}

// ✅ Workflow waiting for events!
```

### Шаг 5: Receive & Process

Когда файл изменяется в Google Drive:

1. **Google Drive отправляет POST**:
   ```
   POST http://your-server.com/webhooks/googleDrive
   Headers:
     X-Goog-Channel-ID: channel_unique_id
     X-Goog-Resource-State: change
   Body:
     { kind: "drive#change", fileId: "...", ... }
   ```

2. **Webhook Router обрабатывает**:
   - Парсит request
   - Верифицирует headers
   - Создает WebhookEvent

3. **Webhook Registry dispatches**:
   - Вызывает registered handlers
   - Handler вызывает `eventRouter.routeEvent()`

4. **Event Router маршрутизирует**:
   - Находит paused execution
   - Проверяет filters
   - Вызывает resume handler

5. **Workflow возобновляется**:
   - Event data добавляется в `variables.webhook`
   - Execution продолжается с текущего node
   - Processing node обрабатывает изменение
   - Workflow паузится снова (loop)

## Debugging

### Включить логирование

```typescript
createWebhookRouter(registry, webhookRegistry, {
  enableLogging: true, // ← Все события в console
});
```

### Посмотреть paused executions

```typescript
const paused = eventRouter.getPausedExecutions();
console.log(paused);
// [{ workflowId: "...", executionId: "...", ... }]
```

### Посмотреть subscriptions

```typescript
const subs = webhookRegistry.getSubscriptionsByProvider("googleDrive");
console.log(subs);
// [{ id: "...", channelId: "...", ... }]
```

### Simulate webhook

```typescript
const mockEvent: WebhookEvent = {
  id: "evt_test",
  provider: "googleDrive",
  eventType: "change",
  payload: { fileId: "test" },
  headers: {},
  timestamp: new Date(),
};

await webhookRegistry.dispatch(mockEvent);
```

## См. также

- [WEBHOOKS.md](./WEBHOOKS.md) - Детальная документация
- [TRIGGERS.md](./TRIGGERS.md) - Документация по триггерам
- [complete-webhook-example.ts](./examples/integrations/complete-webhook-example.ts) - Полный пример

## FAQ

**Q: Нужен ли публичный URL для webhooks?**  
A: Да, для production. Для локальной разработки используйте ngrok.

**Q: Как обрабатывать множество событий одновременно?**  
A: Event Router обрабатывает их параллельно. Каждый event может resumed multiple workflows.

**Q: Что если workflow execution истекла (timeout)?**  
A: Event Router автоматически удалит expired executions. Настройте timeout в PausedExecution.

**Q: Можно ли обрабатывать events без workflows?**  
A: Да! Зарегистрируйте custom handler в WebhookRegistry.

**Q: Как cleanup webhook subscriptions?**  
A: Вызовите stop procedure или используйте webhookRegistry.unregisterSubscription().
