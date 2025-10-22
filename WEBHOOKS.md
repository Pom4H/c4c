

# Webhook System в C4C Framework

Полное руководство по получению событий из внешних интеграций через webhooks.

## Обзор архитектуры

```
┌─────────────────┐
│  External API   │  (Google Drive, Slack, etc.)
│  (Integration)  │
└────────┬────────┘
         │ webhook POST
         ▼
┌─────────────────────────────────────┐
│     HTTP Server + Webhook Router    │
│  POST /webhooks/:provider           │
└────────┬────────────────────────────┘
         │ WebhookEvent
         ▼
┌─────────────────────────────────────┐
│       Webhook Registry              │
│  • Stores subscriptions             │
│  • Verifies webhooks                │
│  • Dispatches events to handlers    │
└────────┬────────────────────────────┘
         │ dispatch
         ▼
┌─────────────────────────────────────┐
│         Event Router                │
│  • Matches events to paused         │
│    workflow executions              │
│  • Resumes workflows with event data│
└────────┬────────────────────────────┘
         │ resume
         ▼
┌─────────────────────────────────────┐
│       Workflow Execution            │
│  • Processes webhook payload        │
│  • Can pause again (loop)           │
└─────────────────────────────────────┘
```

## Быстрый старт

### 1. Настройка HTTP сервера с webhook'ами

```typescript
import { collectRegistry } from "@c4c/core";
import { createHttpServer, WebhookRegistry } from "@c4c/adapters";
import { EventRouter } from "@c4c/workflow";

// Инициализация
const registry = await collectRegistry("./procedures");
const webhookRegistry = new WebhookRegistry();
const eventRouter = new EventRouter();

// Подключение webhook событий к event router
webhookRegistry.registerHandler("googleDrive", async (event) => {
  await eventRouter.routeEvent(event);
});

// Запуск сервера
const server = createHttpServer(registry, 3000, {
  enableWebhooks: true,
  webhookRegistry,
});
```

Webhook endpoints автоматически доступны:
- `POST /webhooks/:provider` - прием событий
- `POST /webhooks/:provider/subscribe` - регистрация подписки
- `DELETE /webhooks/:provider/subscribe/:id` - отмена подписки
- `GET /webhooks/:provider/subscriptions` - список подписок

### 2. Подписка на события (через trigger procedure)

```typescript
// Найти trigger процедуру
const trigger = registry.get("googleDrive.drive.changes.watch");

// Подписаться на изменения
const subscription = await trigger.handler({
  pageToken: "start-token",
  requestBody: {
    id: "unique-channel-id",
    type: "web_hook",
    address: "http://your-server.com/webhooks/googleDrive",
  },
}, context);

// Результат содержит channel info для cleanup
console.log(subscription.id);         // Channel ID
console.log(subscription.resourceId); // Resource ID
console.log(subscription.expiration); // When it expires
```

### 3. Создание workflow с триггером

```typescript
const workflow = {
  id: "google-drive-monitor",
  name: "Monitor Google Drive",
  startNode: "subscribe",
  nodes: [
    {
      id: "subscribe",
      type: "procedure",
      procedureName: "googleDrive.drive.changes.watch",
      config: {
        pageToken: "{{ startToken }}",
        requestBody: {
          id: "{{ channelId }}",
          type: "web_hook",
          address: "{{ webhookUrl }}",
        },
      },
      next: "wait-for-event",
    },
    {
      id: "wait-for-event",
      type: "pause", // Специальный тип для паузы
      config: {
        resumeOn: {
          provider: "googleDrive",
          eventType: "change",
        },
        timeout: 3600000, // 1 hour
      },
      next: "process-event",
    },
    {
      id: "process-event",
      type: "procedure",
      procedureName: "custom.handleDriveChange",
      config: {
        payload: "{{ webhook.payload }}",
      },
      next: "wait-for-event", // Loop!
    },
  ],
};
```

### 4. Запуск workflow

```typescript
import { executeWorkflow } from "@c4c/workflow";

// Регистрация resume handler
eventRouter.registerResumeHandler(workflow.id, async (state, event) => {
  console.log(`Resuming from ${state.currentNode} with event ${event.eventType}`);
  
  // Продолжить выполнение workflow
  return await executeWorkflow(workflow, registry, state.variables);
});

// Запуск
const result = await executeWorkflow(workflow, registry, {
  webhookUrl: "http://localhost:3000/webhooks/googleDrive",
  channelId: `channel_${Date.now()}`,
});

// Workflow will pause at "wait-for-event"
if (result.status === "paused") {
  // Регистрация в event router
  eventRouter.registerPausedExecution({
    workflowId: workflow.id,
    executionId: result.executionId,
    pausedAt: result.resumeState.currentNode,
    resumeOn: {
      provider: "googleDrive",
      eventType: "change",
    },
    state: result.resumeState,
    pausedTime: new Date(),
  });
}
```

## Webhook Event Structure

```typescript
interface WebhookEvent {
  // Уникальный ID события
  id: string;
  
  // Провайдер (googleDrive, slack, github, etc.)
  provider: string;
  
  // ID trigger процедуры
  triggerId?: string;
  
  // ID подписки/канала
  subscriptionId?: string;
  
  // Тип события
  eventType?: string;
  
  // Данные от интеграции
  payload: unknown;
  
  // HTTP заголовки
  headers: Record<string, string>;
  
  // Когда получено
  timestamp: Date;
}
```

## Provider-specific примеры

### Google Drive

```typescript
// Webhook event от Google Drive
{
  id: "evt_123",
  provider: "googleDrive",
  eventType: "change", // или "sync"
  subscriptionId: "channel_456",
  payload: {
    kind: "drive#change",
    changeType: "file",
    fileId: "abc123",
    file: {
      id: "abc123",
      name: "document.pdf",
      mimeType: "application/pdf",
    },
  },
  headers: {
    "x-goog-channel-id": "channel_456",
    "x-goog-resource-state": "change",
    "x-goog-resource-id": "resource_789",
  },
  timestamp: new Date(),
}
```

### Slack

```typescript
// Webhook event от Slack
{
  id: "evt_456",
  provider: "slack",
  eventType: "message",
  payload: {
    type: "event_callback",
    event: {
      type: "message",
      channel: "C123456",
      user: "U789012",
      text: "Hello world!",
      ts: "1234567890.123456",
    },
  },
  headers: {
    "x-slack-signature": "v0=abc123...",
    "x-slack-request-timestamp": "1234567890",
  },
  timestamp: new Date(),
}
```

## Webhook Verification

Для безопасности, webhook'и должны быть верифицированы:

```typescript
import { defaultVerifiers } from "@c4c/adapters";

// Использовать default verifiers
createWebhookRouter(registry, webhookRegistry, {
  verifiers: defaultVerifiers,
});

// Или создать custom verifier
const customVerifiers = {
  googleDrive: async (context) => {
    const channelId = context.req.header("X-Goog-Channel-ID");
    const token = context.req.header("X-Goog-Channel-Token");
    
    // Verify token matches expected value
    return token === process.env.GOOGLE_WEBHOOK_TOKEN;
  },
  
  slack: async (context) => {
    const signature = context.req.header("X-Slack-Signature");
    const timestamp = context.req.header("X-Slack-Request-Timestamp");
    const body = await context.req.text();
    
    // Verify HMAC signature
    const expectedSig = computeSlackSignature(timestamp, body);
    return signature === expectedSig;
  },
};

createWebhookRouter(registry, webhookRegistry, {
  verifiers: customVerifiers,
});
```

## Subscription Management

### Регистрация подписки

```typescript
// Автоматически через trigger procedure
const subscription = await triggerProcedure.handler({...}, context);

// Или вручную
webhookRegistry.registerSubscription({
  id: "sub_123",
  provider: "googleDrive",
  triggerId: "googleDrive.drive.changes.watch",
  workflowId: "my-workflow",
  executionId: "exec_456",
  channelId: "channel_789",
  webhookUrl: "http://localhost:3000/webhooks/googleDrive",
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 3600000), // 1 hour
});
```

### Cleanup подписки

```typescript
// Через stop procedure
const stopProcedure = registry.get("googleDrive.drive.channels.stop");
await stopProcedure.handler({
  requestBody: {
    id: subscription.id,
    resourceId: subscription.resourceId,
  },
}, context);

// Или вручную
webhookRegistry.unregisterSubscription("sub_123");
```

### Список подписок

```typescript
// Для конкретного провайдера
const subs = webhookRegistry.getSubscriptionsByProvider("googleDrive");

// Конкретная подписка
const sub = webhookRegistry.getSubscription("sub_123");
```

## Event Routing

### Фильтры событий

```typescript
eventRouter.registerPausedExecution({
  workflowId: "my-workflow",
  executionId: "exec_123",
  pausedAt: "wait-node",
  resumeOn: {
    // Фильтр по провайдеру
    provider: "googleDrive",
    
    // Фильтр по trigger ID
    triggerId: "googleDrive.drive.changes.watch",
    
    // Фильтр по subscription ID
    subscriptionId: "sub_456",
    
    // Фильтр по типу события
    eventType: "change",
    
    // Custom фильтр
    filter: (event) => {
      // Обрабатывать только PDF файлы
      return event.payload?.file?.mimeType === "application/pdf";
    },
  },
  state: resumeState,
  pausedTime: new Date(),
  timeout: 3600000,
});
```

### Маршрутизация событий

```typescript
// Событие поступает в webhook endpoint
webhookRegistry.registerHandler("googleDrive", async (event) => {
  // Event Router находит matching paused executions
  const results = await eventRouter.routeEvent(event);
  
  // Проверка результатов
  for (const result of results) {
    if (result.success) {
      console.log(`✓ Resumed ${result.executionId}`);
    } else {
      console.error(`✗ Failed ${result.executionId}:`, result.error);
    }
  }
});
```

## Testing Webhooks Locally

### Использование ngrok

```bash
# Установить ngrok
npm install -g ngrok

# Запустить tunnel
ngrok http 3000

# Использовать ngrok URL в webhook subscriptions
https://abc123.ngrok.io/webhooks/googleDrive
```

### Симуляция событий

```typescript
import type { WebhookEvent } from "@c4c/adapters";

function simulateWebhook(webhookRegistry: WebhookRegistry) {
  const mockEvent: WebhookEvent = {
    id: "evt_test",
    provider: "googleDrive",
    eventType: "change",
    payload: {
      kind: "drive#change",
      fileId: "test123",
      file: {
        id: "test123",
        name: "test.pdf",
      },
    },
    headers: {
      "x-goog-channel-id": "channel_test",
      "x-goog-resource-state": "change",
    },
    timestamp: new Date(),
  };
  
  // Dispatch напрямую
  await webhookRegistry.dispatch(mockEvent);
}
```

## Лучшие практики

### 1. Обязательно cleanup

```typescript
// Всегда добавляйте cleanup в workflow
{
  id: "cleanup",
  type: "procedure",
  procedureName: "googleDrive.drive.channels.stop",
  config: {
    requestBody: {
      id: "{{ subscription.id }}",
      resourceId: "{{ subscription.resourceId }}",
    },
  },
}

// И вызывайте при ошибках
{
  id: "subscribe",
  onError: "cleanup", // ← важно!
}
```

### 2. Используйте timeouts

```typescript
{
  id: "wait-for-event",
  type: "pause",
  config: {
    timeout: 3600000, // Не ждать вечно
  },
}
```

### 3. Валидируйте payload

```typescript
{
  id: "process-event",
  type: "procedure",
  procedureName: "custom.processEvent",
  config: {
    validate: true, // Валидировать через Zod
    payload: "{{ webhook.payload }}",
  },
}
```

### 4. Логируйте события

```typescript
webhookRegistry.registerHandler("googleDrive", async (event) => {
  console.log("[Webhook]", {
    id: event.id,
    provider: event.provider,
    type: event.eventType,
    timestamp: event.timestamp,
  });
  
  await eventRouter.routeEvent(event);
});
```

## Troubleshooting

### Webhook не приходят

1. Проверьте, что сервер доступен извне (используйте ngrok для локальной разработки)
2. Проверьте subscription в Google Drive / Slack dashboard
3. Проверьте expiration - многие webhook'и истекают через 1-24 часа
4. Проверьте logs webhook endpoint'а

### Event routing не работает

1. Убедитесь, что execution зарегистрирован в event router
2. Проверьте фильтры - может быть слишком строгие
3. Проверьте, что resume handler зарегистрирован
4. Проверьте timeout - execution мог истечь

### Webhook verification fails

1. Проверьте headers от провайдера
2. Реализуйте правильную HMAC проверку для провайдера
3. Используйте `enableLogging: true` для отладки

## API Reference

См. полную документацию типов:
- `@c4c/adapters/webhook` - Webhook system
- `@c4c/workflow/event-router` - Event routing

## Примеры

- `/examples/integrations/complete-webhook-example.ts` - Полный пример
- `/examples/integrations/workflows/trigger-example.ts` - Trigger workflow patterns

## Roadmap

- [ ] Автоматический retry для failed webhooks
- [ ] Webhook replay для debugging
- [ ] Dead letter queue для unmatched events
- [ ] Webhook analytics и мониторинг
- [ ] Support для WebSocket events
- [ ] Batching для high-volume webhooks
