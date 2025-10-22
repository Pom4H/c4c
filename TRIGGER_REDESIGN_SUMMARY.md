# Trigger System Redesign - Summary

## Проблема

Старая система требовала от пользователей:
1. ❌ Создавать workflow node для вызова trigger procedure
2. ❌ Создавать pause node для ожидания событий
3. ❌ Вручную управлять EventRouter
4. ❌ Регистрировать resume handlers
5. ❌ Завязывать жизненный цикл webhook'а на логику workflow
6. ❌ Создавать loop обратно к pause node

**Это было слишком сложно и запутанно.**

## Решение

**Новая концепция:** Trigger node - это просто точка входа в workflow.

Когда приходит событие:
1. ✅ Workflow запускается от trigger node
2. ✅ Выполняет всю логику
3. ✅ Завершается

Никаких pause/resume, никакого ручного управления.

## Архитектура

### Новые компоненты

#### 1. Trigger Node Type

```typescript
interface WorkflowNode {
  type: "procedure" | "condition" | "parallel" | "sequential" | "trigger";
  // ...
}
```

Trigger node - это marker node, который:
- Отмечает точку входа в event-driven workflow
- Просто передает управление на next node
- Не выполняет никаких действий во время workflow run

#### 2. TriggerConfig

```typescript
interface WorkflowDefinition {
  isTriggered?: boolean;
  trigger?: TriggerConfig;
  // ...
}

interface TriggerConfig {
  provider: string;              // "googleDrive", "slack"
  triggerProcedure: string;      // Procedure для создания subscription
  eventType?: string;            // Фильтр по типу события
  subscriptionConfig?: Record;   // Доп. конфигурация
}
```

Конфигурация триггера на уровне workflow (не node).

#### 3. TriggerWorkflowManager

```typescript
class TriggerWorkflowManager {
  // Развернуть workflow - создаст subscription
  deploy(workflow, options): Promise<TriggerSubscription>
  
  // Остановить workflow - cleanup subscription
  stop(workflowId): Promise<void>
  
  // Получить subscriptions
  getSubscriptions(): TriggerSubscription[]
  
  // Остановить все
  stopAll(): Promise<void>
}
```

Управляет жизненным циклом trigger-based workflows:
- Создает webhook subscriptions через trigger procedures
- Регистрирует event handlers
- Запускает workflows при получении событий
- Автоматически cleanup при остановке

### Поток данных

```
┌──────────────────┐
│ User deploys     │
│ workflow         │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ TriggerWorkflowManager.deploy()     │
│ 1. Calls trigger procedure          │
│ 2. Creates webhook subscription     │
│ 3. Registers event handler          │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ External API (Google Drive)         │
│ Registers webhook ✓                 │
└─────────────────────────────────────┘

         ...waiting...

┌─────────────────────────────────────┐
│ Event occurs                        │
│ Google Drive → POST webhook         │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ HTTP Server receives webhook        │
│ WebhookRegistry.dispatch(event)     │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ TriggerWorkflowManager handler      │
│ 1. Receives event                   │
│ 2. Filters by eventType             │
│ 3. Injects event into variables     │
│ 4. Calls executeWorkflow()          │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Workflow execution                  │
│ 1. Starts from trigger node         │
│ 2. Trigger node → next node         │
│ 3. Executes all nodes               │
│ 4. Completes and exits              │
└─────────────────────────────────────┘
```

## Использование

### До (сложно)

```typescript
// Workflow с pause/resume
const workflow = {
  nodes: [
    { id: "subscribe", procedureName: "trigger.subscribe", next: "pause" },
    { id: "pause", procedureName: "workflow.pause", next: "process" },
    { id: "process", procedureName: "custom.handler", next: "pause" },
  ],
};

// Ручное управление
const result = await executeWorkflow(workflow, registry);
if (result.status === "paused") {
  eventRouter.registerPausedExecution({...});
}
eventRouter.registerResumeHandler(workflowId, async (state, event) => {
  return await resumeWorkflow(workflow, registry, state);
});
```

### После (просто)

```typescript
// Workflow с триггером
const workflow = {
  isTriggered: true,
  trigger: {
    provider: "googleDrive",
    triggerProcedure: "googleDrive.drive.changes.watch",
  },
  nodes: [
    { id: "on-change", type: "trigger", next: "process" },
    { id: "process", procedureName: "custom.handler" },
  ],
};

// Просто deploy
await triggerManager.deploy(workflow, { webhookUrl: "..." });
```

## Изменения в файлах

### Новые файлы
- ✅ `/workspace/packages/workflow/src/trigger-manager.ts` - TriggerWorkflowManager
- ✅ `/workspace/TRIGGER_REDESIGN_SUMMARY.md` - Этот документ
- ✅ `/workspace/examples/integrations/simple-trigger-example.ts` - Простой пример

### Измененные файлы
- ✅ `/workspace/packages/workflow/src/types.ts` - Добавлен "trigger" node type и TriggerConfig
- ✅ `/workspace/packages/workflow/src/runtime.ts` - Добавлен executeTriggerNode()
- ✅ `/workspace/packages/workflow/src/index.ts` - Экспорт TriggerWorkflowManager
- ✅ `/workspace/TRIGGER_INTEGRATION_GUIDE.md` - Переписан с новым подходом
- ✅ `/workspace/TRIGGERS.md` - Обновлен с примером нового подхода
- ✅ `/workspace/WEBHOOKS.md` - Добавлено предупреждение о новом подходе
- ✅ `/workspace/examples/integrations/workflows/trigger-example.ts` - Обновлен с новыми примерами

### Legacy (сохранены для обратной совместимости)
- ⚠️ `/workspace/packages/workflow/src/event-router.ts` - EventRouter (старый подход)
- ⚠️ PauseSignal в runtime.ts
- ⚠️ resumeWorkflow() в runtime.ts

## Обратная совместимость

Старый подход с pause/resume **сохранен** для обратной совместимости:
- EventRouter продолжает работать
- PauseSignal можно использовать
- resumeWorkflow() доступен

Но для новых проектов **рекомендуется** использовать TriggerWorkflowManager.

## Преимущества нового подхода

1. ✅ **Простота**: Пользователь просто объявляет trigger node
2. ✅ **Декларативность**: Конфигурация триггера в workflow definition
3. ✅ **Автоматизация**: Lifecycle management автоматический
4. ✅ **Понятность**: Workflow запускается → выполняется → завершается
5. ✅ **Меньше кода**: Не нужны pause nodes и resume handlers
6. ✅ **Меньше ошибок**: Нет ручного управления состоянием

## Миграция

### Старый код
```typescript
const workflow = {
  nodes: [
    { id: "subscribe", procedureName: "trigger.subscribe", next: "pause" },
    { id: "pause", procedureName: "workflow.pause", next: "process" },
    { id: "process", procedureName: "handler", next: "pause" },
  ],
};
```

### Новый код
```typescript
const workflow = {
  isTriggered: true,
  trigger: { provider: "...", triggerProcedure: "trigger.subscribe" },
  nodes: [
    { id: "on-event", type: "trigger", next: "process" },
    { id: "process", procedureName: "handler" },
  ],
};
```

Основные изменения:
1. Добавить `isTriggered: true`
2. Добавить `trigger` конфигурацию
3. Заменить subscribe + pause на один trigger node
4. Убрать loop обратно к pause
5. Использовать `triggerManager.deploy()` вместо `executeWorkflow()` + `EventRouter`

## Тестирование

Для тестирования нового подхода:

```bash
# Запустить пример
cd examples/integrations
node simple-trigger-example.ts
```

Или использовать в своем коде:

```typescript
import { createTriggerWorkflowManager } from "@c4c/workflow";

const triggerManager = createTriggerWorkflowManager(registry, webhookRegistry);
await triggerManager.deploy(workflow, { webhookUrl: "..." });
```

## Документация

Основная документация:
- **[TRIGGER_INTEGRATION_GUIDE.md](./TRIGGER_INTEGRATION_GUIDE.md)** - Полное руководство
- **[TRIGGERS.md](./TRIGGERS.md)** - Документация по trigger procedures
- **[examples/integrations/simple-trigger-example.ts](./examples/integrations/simple-trigger-example.ts)** - Рабочий пример

## Итог

Теперь пользователи могут:
```typescript
// 1. Объявить workflow с trigger node
const workflow = {
  isTriggered: true,
  trigger: { provider: "googleDrive", triggerProcedure: "..." },
  nodes: [
    { id: "trigger", type: "trigger", next: "handler" },
    { id: "handler", procedureName: "..." },
  ],
};

// 2. Развернуть
await triggerManager.deploy(workflow, { webhookUrl: "..." });

// 3. Готово! Workflow будет запускаться при событиях
```

**Просто. Понятно. Работает.**
