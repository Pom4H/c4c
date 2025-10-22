# Руководство по интеграции триггеров

Упрощенное руководство по работе с триггерами в C4C Framework.

## Концепция

**Триггер в workflow - это просто точка входа.** Когда приходит событие из внешней системы (Google Drive, Slack, и т.д.), workflow запускается от триггера, выполняет всю логику и завершается.

Никаких pause/resume, никакого ручного управления жизненным циклом webhook'ов в workflow логике.

## Быстрый старт

### 1. Создайте workflow с триггером

```typescript
import type { WorkflowDefinition } from "@c4c/workflow";

const workflow: WorkflowDefinition = {
  id: "drive-file-monitor",
  name: "Monitor Google Drive Files",
  version: "1.0.0",
  
  // Указываем что это trigger-based workflow
  isTriggered: true,
  
  // Конфигурация триггера
  trigger: {
    provider: "googleDrive",
    triggerProcedure: "googleDrive.drive.changes.watch",
    eventType: "change", // опционально - фильтр по типу события
  },
  
  // Workflow начинается с trigger ноды
  startNode: "on-file-change",
  
  nodes: [
    {
      id: "on-file-change",
      type: "trigger",
      procedureName: "googleDrive.drive.changes.watch",
      next: "process-change",
    },
    {
      id: "process-change",
      type: "procedure",
      procedureName: "custom.handleFileChange",
      config: {
        // Данные события доступны в trigger.payload
        fileId: "{{ trigger.payload.fileId }}",
        fileName: "{{ trigger.payload.file.name }}",
      },
      next: "send-notification",
    },
    {
      id: "send-notification",
      type: "procedure",
      procedureName: "custom.sendNotification",
      config: {
        message: "File {{ trigger.payload.file.name }} was changed",
      },
    },
  ],
};
```

### 2. Разверните workflow

```typescript
import { collectRegistry } from "@c4c/core";
import { createTriggerWorkflowManager } from "@c4c/workflow";
import { WebhookRegistry, createHttpServer } from "@c4c/adapters";

// Подготовка
const registry = await collectRegistry("./procedures");
const webhookRegistry = new WebhookRegistry();
const triggerManager = createTriggerWorkflowManager(registry, webhookRegistry);

// Запуск HTTP сервера для приема webhook'ов
const server = createHttpServer(registry, 3000, {
  enableWebhooks: true,
  webhookRegistry,
});

// Деплой workflow - автоматически создаст webhook subscription
const subscription = await triggerManager.deploy(workflow, {
  webhookUrl: "https://your-server.com/webhooks/googleDrive",
});

console.log("✅ Workflow deployed:", subscription.subscriptionId);
```

### 3. Готово!

Теперь когда файл изменится в Google Drive:
1. Google отправит webhook на ваш сервер
2. `TriggerWorkflowManager` автоматически запустит workflow
3. Workflow выполнится от trigger ноды до конца
4. Workflow завершится

## Структура события

Данные события доступны в workflow через переменную `trigger`:

```typescript
{
  id: "process-change",
  type: "procedure",
  procedureName: "custom.handler",
  config: {
    // Полная информация о событии
    event: "{{ trigger.event }}",          // "change"
    payload: "{{ trigger.payload }}",      // { fileId: "...", file: {...} }
    headers: "{{ trigger.headers }}",      // HTTP заголовки
    timestamp: "{{ trigger.timestamp }}", // Время получения
    provider: "{{ trigger.provider }}",    // "googleDrive"
  },
}
```

## Управление жизненным циклом

### Остановить workflow

```typescript
// TriggerWorkflowManager автоматически:
// 1. Вызовет stop procedure (если есть)
// 2. Удалит webhook subscription
// 3. Остановит обработку событий

await triggerManager.stop("drive-file-monitor");
```

### Просмотр активных подписок

```typescript
const subscriptions = triggerManager.getSubscriptions();

for (const sub of subscriptions) {
  console.log(sub.workflowId, sub.provider, sub.subscriptionId);
}
```

### Остановить все workflows

```typescript
await triggerManager.stopAll();
```

## Примеры

### Google Drive: мониторинг изменений

```typescript
const driveMonitor: WorkflowDefinition = {
  id: "drive-monitor",
  name: "Google Drive Monitor",
  version: "1.0.0",
  isTriggered: true,
  
  trigger: {
    provider: "googleDrive",
    triggerProcedure: "googleDrive.drive.changes.watch",
    // Дополнительная конфигурация подписки
    subscriptionConfig: {
      pageToken: "start-token", // можно получить динамически
    },
  },
  
  startNode: "trigger",
  nodes: [
    {
      id: "trigger",
      type: "trigger",
      procedureName: "googleDrive.drive.changes.watch",
      next: "check-file-type",
    },
    {
      id: "check-file-type",
      type: "condition",
      config: {
        expression: "trigger.payload.file.mimeType === 'application/pdf'",
        trueBranch: "process-pdf",
        falseBranch: "log-other",
      },
    },
    {
      id: "process-pdf",
      type: "procedure",
      procedureName: "custom.processPDF",
      config: {
        fileId: "{{ trigger.payload.fileId }}",
      },
    },
    {
      id: "log-other",
      type: "procedure",
      procedureName: "custom.logFile",
      config: {
        message: "Ignored non-PDF file: {{ trigger.payload.file.name }}",
      },
    },
  ],
};
```

### Slack: обработка сообщений

```typescript
const slackBot: WorkflowDefinition = {
  id: "slack-bot",
  name: "Slack Bot",
  version: "1.0.0",
  isTriggered: true,
  
  trigger: {
    provider: "slack",
    triggerProcedure: "slack.events.subscribe",
    eventType: "message",
  },
  
  startNode: "on-message",
  nodes: [
    {
      id: "on-message",
      type: "trigger",
      procedureName: "slack.events.subscribe",
      next: "parse-command",
    },
    {
      id: "parse-command",
      type: "procedure",
      procedureName: "custom.parseSlackCommand",
      config: {
        text: "{{ trigger.payload.event.text }}",
        user: "{{ trigger.payload.event.user }}",
      },
      next: "execute-command",
    },
    {
      id: "execute-command",
      type: "procedure",
      procedureName: "custom.executeCommand",
    },
  ],
};
```

## Как это работает под капотом

```
┌─────────────────────────────────────────────────────────────┐
│                    1. DEPLOYMENT                            │
└─────────────────────────────────────────────────────────────┘

Developer вызывает:
  triggerManager.deploy(workflow, { webhookUrl: "..." })

TriggerWorkflowManager:
  1. Находит trigger procedure (googleDrive.drive.changes.watch)
  2. Вызывает его для создания webhook subscription
  3. Получает subscription info (channel ID, expiration, etc.)
  4. Регистрирует обработчик событий в WebhookRegistry
  5. Сохраняет subscription для cleanup

Google Drive регистрирует webhook ✓


┌─────────────────────────────────────────────────────────────┐
│                    2. EVENT ARRIVES                         │
└─────────────────────────────────────────────────────────────┘

Google Drive отправляет:
  POST https://your-server.com/webhooks/googleDrive
  Headers: X-Goog-Channel-ID, X-Goog-Resource-State
  Body: { kind: "drive#change", fileId: "...", ... }

HTTP Server (createHttpServer):
  1. Принимает webhook POST
  2. Верифицирует signature/headers
  3. Создает WebhookEvent
  4. Вызывает webhookRegistry.dispatch(event)

WebhookRegistry:
  1. Находит handlers для provider "googleDrive"
  2. Вызывает TriggerWorkflowManager handler

TriggerWorkflowManager:
  1. Получает event
  2. Находит workflow для этого trigger
  3. Проверяет фильтр eventType (если есть)
  4. Добавляет event data в workflow variables как 'trigger'
  5. Вызывает executeWorkflow(workflow, registry, { trigger: {...} })

Workflow Engine:
  1. Начинает с startNode (trigger node)
  2. Trigger node просто передает управление на next
  3. Выполняет все остальные nodes
  4. Завершается

✓ Workflow execution complete


┌─────────────────────────────────────────────────────────────┐
│                    3. CLEANUP                               │
└─────────────────────────────────────────────────────────────┘

Developer вызывает:
  triggerManager.stop(workflowId)

TriggerWorkflowManager:
  1. Находит subscription info
  2. Находит stop procedure (googleDrive.drive.channels.stop)
  3. Вызывает stop procedure с channel ID
  4. Удаляет handler из WebhookRegistry
  5. Удаляет subscription из локального storage

Google Drive удаляет webhook ✓
```

## Сравнение: старый vs новый подход

### ❌ Старый подход (сложный)

```typescript
// Пользователь должен был:
const workflow = {
  nodes: [
    {
      id: "subscribe",
      type: "procedure",
      procedureName: "googleDrive.drive.changes.watch", // Создать subscription
      next: "pause",
    },
    {
      id: "pause",
      type: "procedure",
      procedureName: "workflow.pause", // Паузировать workflow
      next: "process",
    },
    {
      id: "process",
      type: "procedure",
      procedureName: "custom.handler",
      next: "pause", // Loop обратно к pause
    },
  ],
};

// И вручную управлять:
const result = await executeWorkflow(workflow, registry);
if (result.status === "paused") {
  eventRouter.registerPausedExecution({...});
}
eventRouter.registerResumeHandler(workflowId, async (state, event) => {
  return await resumeWorkflow(workflow, registry, state);
});
```

### ✅ Новый подход (простой)

```typescript
// Просто объявите trigger:
const workflow = {
  isTriggered: true,
  trigger: {
    provider: "googleDrive",
    triggerProcedure: "googleDrive.drive.changes.watch",
  },
  nodes: [
    {
      id: "on-change",
      type: "trigger", // Точка входа
      next: "process",
    },
    {
      id: "process",
      type: "procedure",
      procedureName: "custom.handler",
    },
  ],
};

// И просто задеплойте:
await triggerManager.deploy(workflow, { webhookUrl: "..." });
```

## Лучшие практики

### 1. Используйте фильтры событий

```typescript
trigger: {
  provider: "googleDrive",
  triggerProcedure: "googleDrive.drive.changes.watch",
  eventType: "change", // Обрабатывать только "change", не "sync"
}
```

### 2. Обрабатывайте ошибки

```typescript
{
  id: "process",
  type: "procedure",
  procedureName: "custom.handler",
  onError: "handle-error", // Обработать ошибку вместо падения
}
```

### 3. Логируйте события

```typescript
{
  id: "trigger",
  type: "trigger",
  next: "log",
},
{
  id: "log",
  type: "procedure",
  procedureName: "custom.logEvent",
  config: {
    event: "{{ trigger }}",
  },
  next: "process",
}
```

### 4. Используйте условия для фильтрации

```typescript
{
  id: "check-event",
  type: "condition",
  config: {
    expression: "trigger.payload.file.size > 1000000", // > 1MB
    trueBranch: "process-large",
    falseBranch: "process-small",
  },
}
```

## Troubleshooting

### Workflow не запускается при событии

1. Проверьте что workflow задеплоен: `triggerManager.getSubscription(workflowId)`
2. Проверьте фильтр eventType - возможно событие не проходит фильтр
3. Проверьте логи webhook endpoint'а - приходит ли событие вообще
4. Проверьте что HTTP сервер запущен и доступен

### Subscription не создается

1. Проверьте что trigger procedure существует в registry
2. Проверьте конфигурацию subscriptionConfig - возможно не хватает параметров
3. Проверьте права доступа к API (Google Drive, Slack, etc.)

### Ошибка при cleanup

1. Проверьте что stop procedure найден правильно
2. Проверьте что channel ID сохранился в subscription
3. Некоторые API требуют resourceId для остановки - убедитесь что он есть

## API Reference

### TriggerWorkflowManager

```typescript
class TriggerWorkflowManager {
  // Развернуть trigger workflow
  deploy(
    workflow: WorkflowDefinition,
    options: DeployTriggerWorkflowOptions
  ): Promise<TriggerSubscription>
  
  // Остановить workflow
  stop(workflowId: string): Promise<void>
  
  // Получить все subscriptions
  getSubscriptions(): TriggerSubscription[]
  
  // Получить subscription для workflow
  getSubscription(workflowId: string): TriggerSubscription | undefined
  
  // Остановить все workflows
  stopAll(): Promise<void>
}
```

### TriggerConfig

```typescript
interface TriggerConfig {
  provider: string;              // "googleDrive", "slack", etc.
  triggerProcedure: string;      // Procedure для создания subscription
  eventType?: string;            // Фильтр по типу события
  subscriptionConfig?: Record<string, unknown>; // Доп. конфигурация
}
```

### DeployTriggerWorkflowOptions

```typescript
interface DeployTriggerWorkflowOptions {
  webhookUrl: string;            // URL для приема webhook'ов
  subscriptionConfig?: Record<string, unknown>; // Доп. конфигурация
}
```

## См. также

- [TRIGGERS.md](./TRIGGERS.md) - Документация по trigger procedures
- [WEBHOOKS.md](./WEBHOOKS.md) - Детали webhook system
- [examples/integrations/workflows/](./examples/integrations/workflows/) - Примеры workflows
