# Trigger Quick Start

Быстрый старт с триггерами в C4C Framework.

## За 3 шага

### 1. Создайте workflow

```typescript
import type { WorkflowDefinition } from "@c4c/workflow";

const workflow: WorkflowDefinition = {
  id: "my-trigger-workflow",
  name: "My Trigger Workflow",
  version: "1.0.0",
  
  isTriggered: true,
  trigger: {
    provider: "googleDrive",
    triggerProcedure: "googleDrive.drive.changes.watch",
  },
  
  startNode: "on-event",
  nodes: [
    {
      id: "on-event",
      type: "trigger",
      next: "process",
    },
    {
      id: "process",
      type: "procedure",
      procedureName: "custom.handler",
      config: {
        data: "{{ trigger.payload }}",
      },
    },
  ],
};
```

### 2. Развертните workflow

```typescript
import { collectRegistry } from "@c4c/core";
import { createTriggerWorkflowManager } from "@c4c/workflow";
import { WebhookRegistry, createHttpServer } from "@c4c/adapters";

const registry = await collectRegistry("./procedures");
const webhookRegistry = new WebhookRegistry();
const triggerManager = createTriggerWorkflowManager(registry, webhookRegistry);

// Запустить HTTP сервер
createHttpServer(registry, 3000, {
  enableWebhooks: true,
  webhookRegistry,
});

// Развернуть workflow
await triggerManager.deploy(workflow, {
  webhookUrl: "http://localhost:3000/webhooks/googleDrive",
});
```

### 3. Готово!

Workflow теперь автоматически запускается при событиях.

## Доступ к данным события

В любой node после trigger node доступна переменная `trigger`:

```typescript
{
  id: "handler",
  type: "procedure",
  procedureName: "custom.process",
  config: {
    // Данные события
    eventType: "{{ trigger.event }}",
    payload: "{{ trigger.payload }}",
    headers: "{{ trigger.headers }}",
    timestamp: "{{ trigger.timestamp }}",
    provider: "{{ trigger.provider }}",
  },
}
```

## Примеры

### Google Drive: мониторинг файлов

```typescript
{
  isTriggered: true,
  trigger: {
    provider: "googleDrive",
    triggerProcedure: "googleDrive.drive.changes.watch",
    eventType: "change",
  },
  nodes: [
    { id: "trigger", type: "trigger", next: "process" },
    {
      id: "process",
      type: "procedure",
      procedureName: "custom.handleFileChange",
      config: {
        fileId: "{{ trigger.payload.fileId }}",
        fileName: "{{ trigger.payload.file.name }}",
      },
    },
  ],
}
```

### Slack: обработка сообщений

```typescript
{
  isTriggered: true,
  trigger: {
    provider: "slack",
    triggerProcedure: "slack.events.subscribe",
    eventType: "message",
  },
  nodes: [
    { id: "trigger", type: "trigger", next: "process" },
    {
      id: "process",
      type: "procedure",
      procedureName: "custom.handleMessage",
      config: {
        text: "{{ trigger.payload.event.text }}",
        user: "{{ trigger.payload.event.user }}",
      },
    },
  ],
}
```

### С условиями

```typescript
{
  nodes: [
    { id: "trigger", type: "trigger", next: "check" },
    {
      id: "check",
      type: "condition",
      config: {
        expression: "trigger.payload.file.size > 1000000",
        trueBranch: "process-large",
        falseBranch: "process-small",
      },
    },
    {
      id: "process-large",
      type: "procedure",
      procedureName: "custom.handleLargeFile",
    },
    {
      id: "process-small",
      type: "procedure",
      procedureName: "custom.handleSmallFile",
    },
  ],
}
```

### С параллельной обработкой

```typescript
{
  nodes: [
    { id: "trigger", type: "trigger", next: "parallel" },
    {
      id: "parallel",
      type: "parallel",
      config: {
        branches: ["download", "log"],
        waitForAll: true,
      },
      next: "done",
    },
    {
      id: "download",
      type: "procedure",
      procedureName: "custom.downloadFile",
    },
    {
      id: "log",
      type: "procedure",
      procedureName: "custom.logEvent",
    },
    {
      id: "done",
      type: "procedure",
      procedureName: "custom.finalize",
    },
  ],
}
```

## Управление

### Остановить workflow

```typescript
await triggerManager.stop("my-trigger-workflow");
```

### Просмотреть подписки

```typescript
const subscriptions = triggerManager.getSubscriptions();
console.log(subscriptions);
```

### Остановить все

```typescript
await triggerManager.stopAll();
```

## Что дальше?

- 📖 [TRIGGER_INTEGRATION_GUIDE.md](./TRIGGER_INTEGRATION_GUIDE.md) - Полное руководство
- 📖 [TRIGGERS.md](./TRIGGERS.md) - Документация по trigger procedures
- 💻 [examples/integrations/simple-trigger-example.ts](./examples/integrations/simple-trigger-example.ts) - Рабочий пример
- 💻 [examples/integrations/workflows/trigger-example.ts](./examples/integrations/workflows/trigger-example.ts) - Больше примеров
