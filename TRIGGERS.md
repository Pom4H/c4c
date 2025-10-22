# Triggers в C4C Framework

Триггеры - это специальный тип процедур, которые подписываются на события из внешних систем (webhooks, file watchers, polling, etc.).

## Обзор

### Что такое триггер?

Триггер - это процедура, которая:
- Создает подписку на события (webhook, watch, poll)
- Может требовать управления каналом (subscribe/unsubscribe)
- Возвращает данные канала/подписки
- Может иметь связанную процедуру остановки

### Типы триггеров

```typescript
type TriggerType = "webhook" | "watch" | "poll" | "stream" | "subscription";
```

- **webhook**: HTTP callback endpoint
- **watch**: Active monitoring (e.g., Google Drive file watch)
- **poll**: Periodic checking for changes
- **stream**: Server-sent events / long-polling
- **subscription**: Event-based subscriptions

## Автоматическая детекция

Генератор интеграций автоматически определяет триггеры по:

### 1. Ключевым словам в названии
```typescript
driveChangesWatch    → trigger (type: "watch")
slackEventsSubscribe → trigger (type: "subscription")
githubWebhookCreate  → trigger (type: "webhook")
```

### 2. Ключевым словам в описании
```
"Subscribes to changes..."   → trigger
"Watch for updates..."       → trigger
"Creates a webhook..."       → trigger
```

### 3. Связанные stop-операции
```typescript
driveChannelsStop    → isStopOperation: true
slackUnsubscribe     → isStopOperation: true
```

## Пример: Google Drive Triggers

### Сгенерированная процедура

```typescript
export const GoogleDriveDriveChangesWatchContract: Contract = {
  name: "googleDrive.drive.changes.watch",
  description: "Subscribes to changes for a user.",
  input: zDriveChangesWatchData,
  output: zDriveChangesWatchResponse,
  metadata: {
    exposure: "internal",
    roles: ["workflow-node", "trigger"],  // ← Помечена как trigger
    type: "trigger",                       // ← Тип процедуры
    provider: "googleDrive",
    operation: "driveChangesWatch",
    tags: ["google", "drive"],
    trigger: {                             // ← Метаданные триггера
      type: "watch",
      // stopProcedure: "googleDrive.drive.channels.stop", // ← Если найдена
      // requiresChannelManagement: true,
    },
  },
};
```

### Обнаруженные триггеры в Google Drive

```typescript
import { findTriggers, describeTrigger } from "@c4c/core";

const triggers = findTriggers(registry);

// Результат:
// googleDrive.drive.changes.watch: Trigger (watch)
// googleDrive.drive.files.watch: Trigger (watch)
```

## Использование в коде

### 1. Поиск триггеров

```typescript
import { findTriggers, groupTriggersByProvider } from "@c4c/core";

// Найти все триггеры
const allTriggers = findTriggers(registry);

// Группировать по провайдеру
const grouped = groupTriggersByProvider(registry);
// Map {
//   "googleDrive" => Map { "googleDrive.drive.changes.watch" => Procedure, ... }
//   "slack" => Map { "slack.events.subscribe" => Procedure, ... }
// }
```

### 2. Проверка процедуры

```typescript
import { isTrigger, getTriggerMetadata } from "@c4c/core";

const procedure = registry.get("googleDrive.drive.changes.watch");

if (isTrigger(procedure)) {
  const meta = getTriggerMetadata(procedure);
  console.log(meta.type); // "watch"
  console.log(meta.stopProcedure); // "googleDrive.drive.channels.stop"
}
```

### 3. Валидация

```typescript
import { validateTrigger } from "@c4c/core";

const { valid, errors } = validateTrigger(procedure);

if (!valid) {
  console.error("Invalid trigger:", errors);
  // ["Trigger requires channel management but no stopProcedure is specified"]
}
```

### 4. Управление подписками

```typescript
import { TriggerSubscriptionManager } from "@c4c/core";

const manager = new TriggerSubscriptionManager();

// Регистрация подписки
manager.register({
  triggerId: "googleDrive.drive.changes.watch",
  subscriptionId: "sub_123",
  channelId: "channel_456",
  createdAt: new Date(),
  stopProcedure: "googleDrive.drive.channels.stop",
});

// Получение подписок для триггера
const subs = manager.getSubscriptionsForTrigger(
  "googleDrive.drive.changes.watch"
);

// Cleanup
manager.unregister("sub_123");
```

## Использование в Workflows

### Пример: Мониторинг изменений Google Drive

```typescript
export const watchDriveChanges = {
  id: "watch-drive-changes",
  name: "Monitor Google Drive Changes",
  startNode: "get-token",
  
  nodes: [
    {
      id: "get-token",
      type: "procedure",
      procedureName: "googleDrive.drive.changes.get.start.page.token",
      next: "subscribe",
    },
    {
      id: "subscribe",
      type: "procedure",
      procedureName: "googleDrive.drive.changes.watch", // ← Триггер
      config: {
        pageToken: "{{ outputs.get-token.startPageToken }}",
        requestBody: {
          id: "{{ workflowId }}",
          type: "web_hook",
          address: "{{ webhookUrl }}",
        },
      },
      next: "wait-for-events",
      onError: "cleanup",
    },
    {
      id: "wait-for-events",
      type: "procedure",
      procedureName: "workflow.pause",
      config: { resumeOn: "webhook-received" },
      next: "process-change",
    },
    {
      id: "process-change",
      type: "procedure",
      procedureName: "custom.handleFileChange",
      next: "wait-for-events", // Loop back
    },
    {
      id: "cleanup",
      type: "procedure",
      procedureName: "googleDrive.drive.channels.stop", // ← Stop триггера
      config: {
        channelId: "{{ outputs.subscribe.id }}",
      },
    },
  ],
};
```

## API Reference

### Types

```typescript
// Тип триггера
type TriggerType = "webhook" | "watch" | "poll" | "stream" | "subscription";

// Метаданные триггера
interface TriggerMetadata {
  type: TriggerType;
  stopProcedure?: string;
  requiresChannelManagement?: boolean;
  eventTypes?: string[];
  pollingInterval?: number;
  supportsFiltering?: boolean;
}

// Подписка на триггер
interface TriggerSubscription {
  triggerId: string;
  subscriptionId: string;
  channelId?: string;
  createdAt: Date;
  stopProcedure?: string;
}
```

### Functions

```typescript
// Проверка является ли процедура триггером
function isTrigger(procedure: Procedure): boolean

// Получить метаданные триггера
function getTriggerMetadata(procedure: Procedure): TriggerMetadata | undefined

// Найти все триггеры в registry
function findTriggers(registry: Registry): Map<string, Procedure>

// Найти stop-процедуру для триггера
function findStopProcedure(registry: Registry, trigger: Procedure): Procedure | undefined

// Группировать триггеры по провайдеру
function groupTriggersByProvider(registry: Registry): Map<string, Map<string, Procedure>>

// Валидировать триггер
function validateTrigger(procedure: Procedure): { valid: boolean; errors: string[] }

// Описать триггер
function describeTrigger(procedure: Procedure): string
```

### Classes

```typescript
class TriggerSubscriptionManager {
  register(subscription: TriggerSubscription): void
  unregister(subscriptionId: string): boolean
  getSubscription(subscriptionId: string): TriggerSubscription | undefined
  getSubscriptionsForTrigger(triggerId: string): TriggerSubscription[]
  getAllSubscriptions(): TriggerSubscription[]
  clear(): void
}
```

## Лучшие практики

### 1. Всегда cleanup при ошибках

```typescript
{
  id: "subscribe",
  type: "procedure",
  procedureName: "trigger.subscribe",
  onError: "cleanup", // ← Обязательно!
}
```

### 2. Храните данные канала

```typescript
// Сохраняйте channel/subscription ID для cleanup
const channelId = result.id;
const resourceId = result.resourceId;
```

### 3. Используйте workflow.pause для event-driven flows

```typescript
{
  id: "wait",
  type: "procedure",
  procedureName: "workflow.pause",
  config: {
    resumeOn: "webhook-received",
    timeout: 3600000, // 1 hour
  },
}
```

### 4. Валидируйте триггеры перед использованием

```typescript
const { valid, errors } = validateTrigger(procedure);
if (!valid) {
  throw new Error(`Invalid trigger: ${errors.join(", ")}`);
}
```

## Примеры использования

См. полные примеры в:
- `/examples/integrations/workflows/trigger-example.ts` - Полный пример использования
- `/examples/integrations/procedures/integrations/google/drive/procedures.gen.ts` - Сгенерированные триггеры

## Roadmap

- [ ] Автоматический lifecycle management триггеров
- [ ] Retry logic для failed webhooks
- [ ] Trigger versioning и migration
- [ ] Built-in polling triggers
- [ ] Declarative trigger configuration в workflows
- [ ] Trigger monitoring и analytics
