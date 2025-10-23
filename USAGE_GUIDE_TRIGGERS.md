# 📖 Руководство по использованию триггеров и схем данных

## Обзор

После генерации процедур через `c4c integrate` у вас есть:

1. **Сгенерированные процедуры** - готовые к использованию API calls
2. **Схемы данных** - JSON Schema для валидации и типизации
3. **TypeScript типы** - полная типизация из OpenAPI

## 🎯 Получение схем данных триггеров

### Из сгенерированных файлов

```typescript
// generated/telegram/
├── sdk.gen.ts       // API client функции
├── types.gen.ts     // TypeScript типы
├── schemas.gen.ts   // JSON схемы
└── triggers.gen.ts  // Метаданные триггеров

// procedures/integrations/telegram/
└── procedures.gen.ts // c4c Procedures
```

### Импорт типов

```typescript
// 1. Импортируем типы из types.gen.ts
import type { 
  PostGetUpdatesResponse,
  PostSendMessageData,
  Update, // Telegram Update объект
  Message,
  CallbackQuery,
} from '../../generated/telegram/types.gen.js';

// 2. Импортируем схемы (для валидации)
import * as TelegramSchemas from '../../generated/telegram/schemas.gen.js';

// 3. Импортируем процедуры
import { TelegramProcedures } from '../../procedures/integrations/telegram/procedures.gen.js';
```

## 📝 Создание обработчиков с типизацией

### Вариант 1: Используя сгенерированные типы

```typescript
import { defineContract, defineProcedure } from '@c4c/core';
import { z } from 'zod';
import type { Update, Message } from '../../generated/telegram/types.gen.js';

// Создаем Zod схему на основе TypeScript типа
const TelegramUpdateSchema = z.custom<Update>((val) => {
  return typeof val === 'object' && val !== null && 'update_id' in val;
});

export const handleTelegramMessage = defineProcedure({
  contract: defineContract({
    name: 'telegram.handle.message',
    input: z.object({
      update: TelegramUpdateSchema, // ✅ Типизированная схема
    }),
    output: z.object({
      reply: z.string(),
      shouldReply: z.boolean(),
    }),
  }),
  handler: async (input, context) => {
    const update: Update = input.update; // ✅ Полная типизация!
    
    if (update.message?.text) {
      const text = update.message.text;
      const from = update.message.from;
      
      // TypeScript знает все поля!
      console.log(`Message from ${from.first_name}: ${text}`);
      
      return {
        reply: `Получил: ${text}`,
        shouldReply: true,
      };
    }
    
    return { reply: '', shouldReply: false };
  },
});
```

### Вариант 2: Создание детальных Zod схем

```typescript
import { z } from 'zod';

// Создаем детальные схемы для валидации
const TelegramUserSchema = z.object({
  id: z.number(),
  is_bot: z.boolean().optional(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
});

const TelegramChatSchema = z.object({
  id: z.number(),
  type: z.enum(['private', 'group', 'supergroup', 'channel']),
  title: z.string().optional(),
  username: z.string().optional(),
  first_name: z.string().optional(),
});

const TelegramMessageSchema = z.object({
  message_id: z.number(),
  from: TelegramUserSchema,
  chat: TelegramChatSchema,
  date: z.number(),
  text: z.string().optional(),
  entities: z.array(z.object({
    type: z.string(),
    offset: z.number(),
    length: z.number(),
  })).optional(),
});

const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: TelegramMessageSchema.optional(),
  edited_message: TelegramMessageSchema.optional(),
  callback_query: z.object({
    id: z.string(),
    from: TelegramUserSchema,
    message: TelegramMessageSchema.optional(),
    data: z.string().optional(),
  }).optional(),
});

// TypeScript типы
type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;
type TelegramMessage = z.infer<typeof TelegramMessageSchema>;
```

## 🔄 Workflow с обработкой разных событий

### Пример: Telegram Bot с множественными обработчиками

```typescript
import type { WorkflowDefinition } from '@c4c/workflow';

export const telegramBotWorkflow: WorkflowDefinition = {
  id: 'telegram-bot',
  name: 'Telegram Bot',
  
  trigger: {
    type: 'webhook',
    config: {
      procedure: 'telegram.post.get.updates',
      provider: 'telegram',
    },
  },
  
  steps: [
    // ШАГ 1: Роутинг - определяем тип события
    {
      id: 'route',
      procedure: 'telegram.route.event',
      input: {
        update: '{{ trigger.data }}',
      },
    },
    
    // ШАГ 2A: Обработка текстового сообщения
    {
      id: 'handle-text',
      procedure: 'telegram.handle.message',
      condition: "{{ steps.route.output.eventType === 'message' }}",
      input: {
        update: '{{ trigger.data }}',
      },
    },
    
    // ШАГ 2B: Обработка callback query
    {
      id: 'handle-callback',
      procedure: 'telegram.handle.callback',
      condition: "{{ steps.route.output.eventType === 'callback_query' }}",
      input: {
        update: '{{ trigger.data }}',
      },
    },
    
    // ШАГ 2C: Обработка фото
    {
      id: 'handle-photo',
      procedure: 'telegram.handle.photo',
      condition: "{{ steps.route.output.eventType === 'photo' }}",
      input: {
        update: '{{ trigger.data }}',
      },
    },
    
    // ШАГ 3: Ответ пользователю (для текстовых сообщений)
    {
      id: 'reply-text',
      procedure: 'telegram.post.send.message',
      condition: "{{ steps['handle-text']?.output?.shouldReply === true }}",
      input: {
        chat_id: '{{ trigger.data.message.chat.id }}',
        text: "{{ steps['handle-text'].output.reply }}",
      },
    },
    
    // ШАГ 4: Ответ на callback query
    {
      id: 'reply-callback',
      procedure: 'telegram.post.answer.callback.query',
      condition: "{{ steps['handle-callback'] !== undefined }}",
      input: {
        callback_query_id: '{{ trigger.data.callback_query.id }}',
        text: "{{ steps['handle-callback'].output.answer }}",
      },
    },
  ],
};
```

## 🎨 Обработка разных типов событий

### Создание диспетчера событий

```typescript
import { z } from 'zod';
import type { Update } from '../../generated/telegram/types.gen.js';

// Enum для типов событий
const EventTypeSchema = z.enum([
  'text_message',
  'photo_message',
  'document_message',
  'voice_message',
  'video_message',
  'sticker_message',
  'callback_query',
  'inline_query',
  'edited_message',
  'channel_post',
  'unknown',
]);

type EventType = z.infer<typeof EventTypeSchema>;

// Маппинг событий к обработчикам
const EVENT_HANDLERS: Record<EventType, string> = {
  text_message: 'telegram.handle.text',
  photo_message: 'telegram.handle.photo',
  document_message: 'telegram.handle.document',
  voice_message: 'telegram.handle.voice',
  video_message: 'telegram.handle.video',
  sticker_message: 'telegram.handle.sticker',
  callback_query: 'telegram.handle.callback',
  inline_query: 'telegram.handle.inline',
  edited_message: 'telegram.handle.edited',
  channel_post: 'telegram.handle.channel',
  unknown: 'telegram.handle.unknown',
};

// Процедура-диспетчер
export const dispatchTelegramEvent = defineProcedure({
  contract: defineContract({
    name: 'telegram.dispatch.event',
    input: z.object({ update: z.any() }),
    output: z.object({
      eventType: EventTypeSchema,
      handlerProcedure: z.string(),
      metadata: z.record(z.unknown()),
    }),
  }),
  handler: async (input) => {
    const update: Update = input.update;
    
    // Определяем тип события
    let eventType: EventType = 'unknown';
    const metadata: Record<string, unknown> = {};
    
    if (update.message) {
      metadata.chatId = update.message.chat.id;
      metadata.userId = update.message.from.id;
      
      if (update.message.text) eventType = 'text_message';
      else if (update.message.photo) eventType = 'photo_message';
      else if (update.message.document) eventType = 'document_message';
      else if (update.message.voice) eventType = 'voice_message';
      else if (update.message.video) eventType = 'video_message';
      else if (update.message.sticker) eventType = 'sticker_message';
    }
    else if (update.callback_query) {
      eventType = 'callback_query';
      metadata.callbackData = update.callback_query.data;
    }
    else if (update.edited_message) {
      eventType = 'edited_message';
    }
    else if (update.channel_post) {
      eventType = 'channel_post';
    }
    
    return {
      eventType,
      handlerProcedure: EVENT_HANDLERS[eventType],
      metadata,
    };
  },
});
```

### Использование в workflow

```typescript
export const smartTelegramBot: WorkflowDefinition = {
  id: 'smart-telegram-bot',
  name: 'Smart Telegram Bot with Event Routing',
  
  trigger: {
    type: 'webhook',
    config: {
      procedure: 'telegram.post.get.updates',
      provider: 'telegram',
    },
  },
  
  steps: [
    // 1. Диспетчеризация
    {
      id: 'dispatch',
      procedure: 'telegram.dispatch.event',
      input: {
        update: '{{ trigger.data }}',
      },
    },
    
    // 2. Вызов соответствующего обработчика
    {
      id: 'handle-event',
      procedure: "{{ steps.dispatch.output.handlerProcedure }}", // Динамический выбор!
      input: {
        update: '{{ trigger.data }}',
        metadata: "{{ steps.dispatch.output.metadata }}",
      },
    },
    
    // 3. Логирование
    {
      id: 'log',
      procedure: 'system.log',
      input: {
        level: 'info',
        message: 'Event processed',
        data: {
          eventType: "{{ steps.dispatch.output.eventType }}",
          handler: "{{ steps.dispatch.output.handlerProcedure }}",
        },
      },
    },
  ],
};
```

## 🧪 Тестирование обработчиков

### Unit тесты с реальными схемами

```typescript
import { describe, it, expect } from 'vitest';
import { handleTelegramMessage } from './handlers/telegram-handler.js';

describe('Telegram Message Handler', () => {
  it('should handle /start command', async () => {
    const input = {
      update: {
        update_id: 123,
        message: {
          message_id: 1,
          from: {
            id: 123456789,
            first_name: 'Test User',
            is_bot: false,
          },
          chat: {
            id: 123456789,
            type: 'private' as const,
            first_name: 'Test User',
          },
          date: 1234567890,
          text: '/start',
        },
      },
    };
    
    const result = await handleTelegramMessage.handler(input, {
      requestId: 'test-1',
      timestamp: new Date(),
      metadata: {},
    });
    
    expect(result.shouldReply).toBe(true);
    expect(result.reply).toContain('Привет');
  });
  
  it('should handle /help command', async () => {
    const input = {
      update: {
        update_id: 124,
        message: {
          message_id: 2,
          from: { id: 123456789, first_name: 'Test', is_bot: false },
          chat: { id: 123456789, type: 'private' as const },
          date: 1234567890,
          text: '/help',
        },
      },
    };
    
    const result = await handleTelegramMessage.handler(input, {
      requestId: 'test-2',
      timestamp: new Date(),
      metadata: {},
    });
    
    expect(result.shouldReply).toBe(true);
    expect(result.reply).toContain('команды');
  });
});
```

### Интеграционные тесты

```typescript
import { createRegistry } from '@c4c/core';
import { TelegramProcedures } from '../../procedures/integrations/telegram/procedures.gen.js';
import { TelegramHandlers } from './handlers/telegram-handler.js';

describe('Telegram Integration', () => {
  it('should register all procedures', () => {
    const registry = createRegistry();
    
    // Регистрируем сгенерированные процедуры
    for (const proc of TelegramProcedures) {
      registry.register(proc);
    }
    
    // Регистрируем обработчики
    for (const proc of TelegramHandlers) {
      registry.register(proc);
    }
    
    // Проверяем наличие триггеров
    const triggers = Array.from(registry.entries())
      .filter(([_, proc]) => proc.contract.metadata.roles?.includes('trigger'));
    
    expect(triggers.length).toBeGreaterThan(0);
  });
  
  it('should execute full workflow', async () => {
    const registry = createRegistry();
    
    // ... register procedures ...
    
    // Симулируем webhook event
    const update = {
      update_id: 123,
      message: {
        message_id: 1,
        from: { id: 123, first_name: 'Test', is_bot: false },
        chat: { id: 123, type: 'private' },
        date: Date.now() / 1000,
        text: '/start',
      },
    };
    
    // 1. Route event
    const routeResult = await registry.execute('telegram.route.event', { update });
    expect(routeResult.eventType).toBe('message');
    
    // 2. Handle message
    const handleResult = await registry.execute('telegram.handle.message', { update });
    expect(handleResult.shouldReply).toBe(true);
    
    console.log('Reply:', handleResult.reply);
  });
});
```

## 🏗️ Паттерны использования

### Паттерн 1: Event Router + Handlers

```typescript
// 1. Роутер определяет тип события
const router = defineProcedure({
  contract: {
    name: 'event.router',
    input: z.object({ event: z.any() }),
    output: z.object({ type: z.string(), handler: z.string() }),
  },
  handler: async (input) => {
    // Логика роутинга
    if (input.event.message) return { type: 'message', handler: 'handle.message' };
    if (input.event.callback_query) return { type: 'callback', handler: 'handle.callback' };
    return { type: 'unknown', handler: 'handle.default' };
  },
});

// 2. Обработчики для каждого типа
const messageHandler = defineProcedure({...});
const callbackHandler = defineProcedure({...});
const defaultHandler = defineProcedure({...});

// 3. Workflow связывает все вместе
const workflow = {
  steps: [
    { id: 'route', procedure: 'event.router' },
    { id: 'handle', procedure: "{{ steps.route.output.handler }}" }, // Динамический!
  ],
};
```

### Паттерн 2: Strategy Pattern для разных событий

```typescript
// Базовый интерфейс обработчика
interface EventHandler<TInput, TOutput> {
  canHandle(event: unknown): boolean;
  handle(event: TInput, context: ExecutionContext): Promise<TOutput>;
}

// Обработчик текстовых сообщений
class TextMessageHandler implements EventHandler<Update, MessageResponse> {
  canHandle(event: unknown): boolean {
    return !!(event as Update).message?.text;
  }
  
  async handle(event: Update, context) {
    const text = event.message!.text!;
    
    if (text.startsWith('/')) {
      return this.handleCommand(text, event);
    }
    
    return this.handleTextMessage(text, event);
  }
  
  private async handleCommand(command: string, event: Update) {
    // ...
  }
  
  private async handleTextMessage(text: string, event: Update) {
    // ...
  }
}

// Обработчик фото
class PhotoMessageHandler implements EventHandler<Update, PhotoResponse> {
  canHandle(event: unknown): boolean {
    return !!(event as Update).message?.photo;
  }
  
  async handle(event: Update, context) {
    const photos = event.message!.photo!;
    const largestPhoto = photos[photos.length - 1];
    
    return {
      fileId: largestPhoto.file_id,
      action: 'process_image',
    };
  }
}

// Менеджер обработчиков
class EventHandlerManager {
  private handlers: EventHandler<any, any>[] = [
    new TextMessageHandler(),
    new PhotoMessageHandler(),
    // ... другие обработчики
  ];
  
  async handleEvent(event: Update, context: ExecutionContext) {
    for (const handler of this.handlers) {
      if (handler.canHandle(event)) {
        return await handler.handle(event, context);
      }
    }
    
    throw new Error('No handler found for event');
  }
}

// Используем в процедуре
export const handleAnyTelegramEvent = defineProcedure({
  contract: {...},
  handler: async (input, context) => {
    const manager = new EventHandlerManager();
    return await manager.handleEvent(input.update, context);
  },
});
```

### Паттерн 3: Композиция процедур

```typescript
// Маленькие переиспользуемые процедуры
const extractUserInfo = defineProcedure({
  contract: {
    name: 'telegram.extract.user.info',
    input: z.object({ update: z.any() }),
    output: z.object({
      userId: z.number(),
      username: z.string().optional(),
      firstName: z.string(),
      chatId: z.number(),
    }),
  },
  handler: async (input) => {
    const msg = input.update.message || input.update.callback_query?.message;
    const from = input.update.message?.from || input.update.callback_query?.from;
    
    return {
      userId: from.id,
      username: from.username,
      firstName: from.first_name,
      chatId: msg.chat.id,
    };
  },
});

const checkUserPermissions = defineProcedure({
  contract: {
    name: 'telegram.check.permissions',
    input: z.object({ userId: z.number() }),
    output: z.object({
      isAdmin: z.boolean(),
      canExecute: z.boolean(),
      roles: z.array(z.string()),
    }),
  },
  handler: async (input) => {
    // Проверка в БД или конфиге
    const adminIds = [123456789];
    const isAdmin = adminIds.includes(input.userId);
    
    return {
      isAdmin,
      canExecute: isAdmin,
      roles: isAdmin ? ['admin', 'user'] : ['user'],
    };
  },
});

// Композиция в workflow
const workflow = {
  steps: [
    { id: 'extract-user', procedure: 'telegram.extract.user.info' },
    { id: 'check-perms', procedure: 'telegram.check.permissions', 
      input: { userId: '{{ steps.extract-user.output.userId }}' } },
    { id: 'handle', procedure: 'telegram.handle.message',
      condition: '{{ steps.check-perms.output.canExecute === true }}' },
  ],
};
```

## 📊 Получение метаданных триггеров в runtime

### Использование triggers.gen.ts

```typescript
import { 
  getTriggerMetadata, 
  getTriggersByKind,
  triggerMetadata 
} from '../../generated/telegram/triggers.gen.js';

// Получить все subscription триггеры
const subscriptionTriggers = getTriggersByKind('subscription');
console.log('Subscription triggers:', subscriptionTriggers);
// ["postgetupdates", "postsetwebhook", ...]

// Проверить, является ли процедура триггером
const metadata = getTriggerMetadata('postSetWebhook');
if (metadata && metadata.kind === 'subscription') {
  console.log('This is a subscription trigger!');
}

// Получить все триггеры
const allTriggers = Object.entries(triggerMetadata)
  .filter(([_, meta]) => meta.kind !== 'operation')
  .map(([name, meta]) => ({ name, ...meta }));

console.log(`Found ${allTriggers.length} triggers`);
```

### Динамическая регистрация webhook на основе метаданных

```typescript
import { createRegistry } from '@c4c/core';
import { WebhookRegistry } from '@c4c/adapters';
import { getTriggersByKind } from '../../generated/telegram/triggers.gen.js';
import { TelegramProcedures } from '../../procedures/integrations/telegram/procedures.gen.js';

async function setupWebhooks() {
  const registry = createRegistry();
  const webhookRegistry = new WebhookRegistry();
  
  // Регистрируем все процедуры
  for (const proc of TelegramProcedures) {
    registry.register(proc);
  }
  
  // Находим все subscription триггеры
  const subscriptionTriggers = getTriggersByKind('subscription');
  
  console.log(`Setting up ${subscriptionTriggers.length} webhook subscriptions...`);
  
  for (const triggerName of subscriptionTriggers) {
    // Нормализуем имя для поиска процедуры
    const procedure = Array.from(registry.entries())
      .find(([name]) => name.toLowerCase().replace(/\W/g, '') === triggerName);
    
    if (procedure) {
      const [procName, proc] = procedure;
      console.log(`  ✓ ${procName}`);
      
      // Можно автоматически вызвать setWebhook если это Telegram
      if (procName === 'telegram.post.set.webhook') {
        // await proc.handler({ url: 'https://...' }, context);
      }
    }
  }
}
```

## 💡 Best Practices

### 1. Создавайте типобезопасные обертки

```typescript
import type { Update, Message } from '../../generated/telegram/types.gen.js';

// Утилиты для работы с типами
export const isTelegramMessage = (update: Update): update is Update & { message: Message } => {
  return !!update.message;
};

export const isTelegramCallback = (update: Update): update is Update & { callback_query: NonNullable<Update['callback_query']> } => {
  return !!update.callback_query;
};

// Использование
const handler = async (input: { update: Update }) => {
  if (isTelegramMessage(input.update)) {
    // TypeScript знает, что message существует!
    const text = input.update.message.text;
  }
};
```

### 2. Переиспользуйте схемы

```typescript
// Создайте библиотеку общих схем
export const CommonSchemas = {
  TelegramUpdate: TelegramUpdateSchema,
  TelegramMessage: TelegramMessageSchema,
  GoogleCalendarEvent: GoogleCalendarEventSchema,
  // ...
};

// Используйте в разных процедурах
const proc1 = defineContract({
  input: z.object({ update: CommonSchemas.TelegramUpdate }),
  // ...
});

const proc2 = defineContract({
  input: z.object({ update: CommonSchemas.TelegramUpdate }),
  // ...
});
```

### 3. Документируйте схемы событий

```typescript
/**
 * Telegram Update Event
 * 
 * @see https://core.telegram.org/bots/api#update
 * 
 * Возможные типы:
 * - message: Новое сообщение
 * - edited_message: Отредактированное сообщение
 * - callback_query: Нажатие кнопки inline keyboard
 * - inline_query: Inline запрос
 * - ...
 */
const TelegramUpdateSchema = z.object({...});
```

## 🎓 Полный пример использования

См. файлы в `examples/triggers/`:

- `src/handlers/telegram-handler.ts` - Обработчики для Telegram (6 типов событий)
- `src/handlers/google-calendar-handler.ts` - Обработчики для Google Calendar (4 типа событий)
- `src/workflows/telegram-bot-workflow.ts` - Полный workflow для Telegram бота
- `src/workflows/google-calendar-workflow.ts` - Полный workflow для Calendar sync
- `src/server.ts` - Настройка и запуск сервера

### Запуск примера:

```bash
cd examples/triggers
pnpm install
pnpm start
```

## Резюме

✅ **Схемы данных** доступны в `generated/{integration}/types.gen.ts`  
✅ **JSON схемы** для валидации в `generated/{integration}/schemas.gen.ts`  
✅ **Метаданные триггеров** в `generated/{integration}/triggers.gen.ts`  
✅ **Полная типизация** TypeScript из OpenAPI спецификации  
✅ **Готовые процедуры** в `procedures/integrations/{integration}/procedures.gen.ts`  
✅ **Паттерны использования** для создания обработчиков событий  
✅ **Примеры workflows** для разных сценариев  

Теперь у вас есть полная типизация для всех событий! 🎉
