# 🚀 Quick Start - Использование сгенерированных триггеров

## За 5 минут от API до рабочего бота

### Шаг 1: Интеграция API (1 команда)

```bash
c4c integrate https://api.apis.guru/v2/specs/telegram.org/5.0.0/openapi.json
```

**Результат:**
- ✅ `generated/telegram/sdk.gen.ts` - 70+ API функций
- ✅ `generated/telegram/types.gen.ts` - TypeScript типы
- ✅ `generated/telegram/triggers.gen.ts` - 6 триггеров
- ✅ `procedures/integrations/telegram/procedures.gen.ts` - готовые процедуры

### Шаг 2: Импорт типов и процедур (3 строки)

```typescript
import type { Update, Message } from './generated/telegram/types.gen.js';
import { TelegramProcedures } from './procedures/integrations/telegram/procedures.gen.js';
import { getTriggersByKind } from './generated/telegram/triggers.gen.js';
```

**Что вы получаете:**
- ✅ `Update` - тип события от Telegram (полная структура!)
- ✅ `Message` - тип сообщения с всеми полями
- ✅ `TelegramProcedures` - все 70+ процедур готовы к использованию
- ✅ `getTriggersByKind()` - получить триггеры по типу

### Шаг 3: Создание обработчика (10 строк)

```typescript
import { defineProcedure, defineContract } from '@c4c/core';
import { z } from 'zod';
import type { Update } from './generated/telegram/types.gen.js';

export const handleMessage = defineProcedure({
  contract: defineContract({
    name: 'my.telegram.handler',
    input: z.object({ 
      update: z.custom<Update>() // ← Полная типизация!
    }),
    output: z.object({ 
      reply: z.string() 
    }),
  }),
  handler: async (input) => {
    const update: Update = input.update; // ← TypeScript знает все поля!
    
    // Автодополнение работает! ✨
    const text = update.message?.text || '';
    const userName = update.message?.from.first_name || 'Гость';
    
    return { 
      reply: `Привет, ${userName}! Вы написали: ${text}` 
    };
  },
});
```

### Шаг 4: Регистрация процедур (4 строки)

```typescript
import { createRegistry } from '@c4c/core';

const registry = createRegistry();

// Регистрируем ВСЕ сгенерированные процедуры одной строкой
TelegramProcedures.forEach(p => registry.register(p));
```

### Шаг 5: Запуск сервера (1 строка)

```bash
c4c serve
```

**Результат:**
```
🎯 Discovered 6 trigger procedure(s):
   - telegram.post.close (subscription, provider: telegram)
   - telegram.post.delete.webhook (subscription, provider: telegram)
   - telegram.post.get.updates (subscription, provider: telegram)
   - telegram.post.get.webhook.info (subscription, provider: telegram)
   - telegram.post.log.out (subscription, provider: telegram)
   - telegram.post.set.webhook (subscription, provider: telegram)

📡 Webhooks:
   Receive:      POST http://localhost:3000/webhooks/:provider
   Triggers:     GET  http://localhost:3000/webhooks/triggers
   Execute:      POST http://localhost:3000/webhooks/triggers/:name
```

---

## 🎯 Как получить схемы для вашего обработчика

### Способ 1: Смотрим в types.gen.ts

```bash
# Открываем файл
cat generated/telegram/types.gen.ts | grep "export type Update"
```

Находим:
```typescript
export type Update = {
  update_id: number;
  message?: Message;
  edited_message?: Message;
  channel_post?: Message;
  callback_query?: CallbackQuery;
  // ... и т.д.
};
```

### Способ 2: Используем IDE автодополнение

```typescript
import type { Update } from './generated/telegram/types.gen.js';

const handler = async (update: Update) => {
  update.  // ← VS Code покажет все поля! ✨
  //     ▼
  //     - update_id
  //     - message
  //     - callback_query
  //     - ...
};
```

### Способ 3: Проверяем OpenAPI документацию

```bash
# Открываем Swagger UI
open http://localhost:3000/docs

# Или смотрим JSON
curl http://localhost:3000/openapi.json | jq '.components.schemas'
```

---

## 🔥 Реальный пример: Telegram бот за 30 строк

```typescript
import { createRegistry } from '@c4c/core';
import { createHttpServer } from '@c4c/adapters';
import { defineProcedure, defineContract } from '@c4c/core';
import { z } from 'zod';
import type { Update } from './generated/telegram/types.gen.js';
import { TelegramProcedures } from './procedures/integrations/telegram/procedures.gen.js';

// 1. Обработчик
const handleBot = defineProcedure({
  contract: defineContract({
    name: 'bot.handle',
    input: z.object({ update: z.custom<Update>() }),
    output: z.object({ reply: z.string(), chatId: z.number() }),
  }),
  handler: async (input) => {
    const text = input.update.message?.text || '';
    const chatId = input.update.message?.chat.id || 0;
    
    let reply = 'Не понял 🤔';
    if (text === '/start') reply = 'Привет! 👋';
    if (text === '/help') reply = 'Команды: /start, /help';
    
    return { reply, chatId };
  },
});

// 2. Регистрация
const registry = createRegistry();
TelegramProcedures.forEach(p => registry.register(p));
registry.register(handleBot);

// 3. Сервер
createHttpServer(registry, 3000);

// Готово! Бот работает! 🎉
```

**Использование:**

```bash
# Настройка webhook
curl -X POST http://localhost:3000/webhooks/triggers/telegram.post.set.webhook \
  -d '{"url": "https://your-domain.com/webhooks/telegram"}'

# Telegram отправит сюда события →
# POST https://your-domain.com/webhooks/telegram
```

---

## 🎨 Обработка множества событий - Pattern Matching

```typescript
import type { Update } from './generated/telegram/types.gen.js';

// Pattern matching для событий
const handleUpdate = async (update: Update) => {
  // Используем match-подобный паттерн
  const handlers = {
    message: async (msg: Message) => {
      if (msg.text?.startsWith('/')) return handleCommand(msg);
      if (msg.photo) return handlePhoto(msg);
      if (msg.document) return handleDocument(msg);
      return handleText(msg);
    },
    
    callback_query: async (cb: CallbackQuery) => {
      return handleCallback(cb);
    },
    
    edited_message: async (msg: Message) => {
      return handleEdit(msg);
    },
  };
  
  // Выполняем соответствующий обработчик
  if (update.message) {
    return await handlers.message(update.message);
  }
  if (update.callback_query) {
    return await handlers.callback_query(update.callback_query);
  }
  if (update.edited_message) {
    return await handlers.edited_message(update.edited_message);
  }
  
  return { error: 'Unknown event type' };
};
```

---

## Итог

Теперь у вас есть:

✅ **Полная типизация** - TypeScript знает структуру событий  
✅ **Готовые процедуры** - просто вызывайте через registry  
✅ **Метаданные триггеров** - знаете, какие процедуры являются триггерами  
✅ **Паттерны обработки** - router, handler, strategy, composition  
✅ **Примеры кода** - можно копировать и адаптировать  
✅ **Тесты** - готовые примеры unit и интеграционных тестов  

**Всё готово для создания production-ready ботов и интеграций!** 🚀
