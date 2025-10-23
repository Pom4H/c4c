# Примеры использования триггеров

Этот пример демонстрирует, как использовать сгенерированные процедуры/триггеры для обработки событий в workflow.

## Структура

```
src/
├── handlers/
│   ├── telegram-handler.ts        # Обработчики событий Telegram
│   └── google-calendar-handler.ts # Обработчики событий Google Calendar
├── workflows/
│   ├── telegram-bot-workflow.ts   # Workflow для Telegram бота
│   └── google-calendar-workflow.ts # Workflow для Google Calendar
└── server.ts                       # Настройка и запуск сервера
```

## Ключевые концепции

### 1. Импорт схем из сгенерированных файлов

```typescript
// Импортируем JSON схемы из generated/telegram/schemas.gen.ts
import * as TelegramSchemas from '../../generated/telegram/schemas.gen.js';

// Используем для создания Zod схем
const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: z.object({...}),
  // ...
});

// Получаем TypeScript типы
type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;
```

### 2. Создание обработчиков событий

```typescript
// Обработчик принимает событие и возвращает результат
export const handleTelegramMessage = defineProcedure({
  contract: handleTelegramMessageContract,
  handler: async (input, context) => {
    const { update } = input;
    
    // Обработка разных типов сообщений
    if (update.message?.text.startsWith('/start')) {
      return {
        reply: 'Привет! 👋',
        shouldReply: true,
      };
    }
    
    // ...
  },
});
```

### 3. Роутер событий

```typescript
// Определяет тип события для дальнейшей обработки
export const routeTelegramEvent = defineProcedure({
  contract: routeTelegramEventContract,
  handler: async (input, context) => {
    if (input.update.message) {
      return { eventType: 'message', shouldProcess: true };
    }
    if (input.update.callback_query) {
      return { eventType: 'callback_query', shouldProcess: true };
    }
    // ...
  },
});
```

### 4. Workflow с триггером

```typescript
export const telegramBotWorkflow: WorkflowDefinition = {
  trigger: {
    type: 'webhook',
    config: {
      procedure: 'telegram.post.get.updates', // Сгенерированный триггер
      provider: 'telegram',
    },
  },
  steps: [
    {
      id: 'route-event',
      procedure: 'telegram.route.event', // Наш роутер
      input: {
        update: '{{ trigger.data }}', // Данные от триггера
      },
    },
    {
      id: 'handle-message',
      procedure: 'telegram.handle.message', // Наш обработчик
      condition: "{{ steps['route-event'].output.eventType === 'message' }}",
      input: {
        update: '{{ trigger.data }}',
      },
    },
    {
      id: 'send-reply',
      procedure: 'telegram.post.send.message', // Сгенерированная процедура
      condition: "{{ steps['handle-message'].output.shouldReply === true }}",
      input: {
        chat_id: '{{ trigger.data.message.chat.id }}',
        text: "{{ steps['handle-message'].output.reply }}",
      },
    },
  ],
};
```

## Запуск

### 1. Установка зависимостей

```bash
pnpm install
```

### 2. Сгенерируйте процедуры для API

```bash
# Telegram
c4c integrate https://api.apis.guru/v2/specs/telegram.org/5.0.0/openapi.json --name telegram

# Google Calendar
c4c integrate https://raw.githubusercontent.com/Pom4H/openapi-ts/main/examples/openapi-ts-trigger/google-calendar-api.json --name google-calendar
```

### 3. Настройте переменные окружения

```bash
export TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
export GOOGLE_CALENDAR_TOKEN="your_google_token"
export TELEGRAM_ADMIN_CHAT_ID="your_chat_id"
```

### 4. Запустите сервер

```bash
pnpm start
# или для разработки с hot reload
pnpm dev
```

## Тестирование

### Получить список триггеров

```bash
curl http://localhost:3000/webhooks/triggers | jq
```

### Вызвать триггер напрямую (для тестирования)

```bash
# Отправить тестовое сообщение в Telegram бот
curl -X POST http://localhost:3000/webhooks/triggers/telegram.post.send.message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TELEGRAM_BOT_TOKEN" \
  -d '{
    "chat_id": 123456789,
    "text": "Тестовое сообщение от c4c!"
  }'
```

### Симуляция webhook от Telegram

```bash
curl -X POST http://localhost:3000/webhooks/telegram \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123456789,
    "message": {
      "message_id": 1,
      "from": {
        "id": 123456789,
        "is_bot": false,
        "first_name": "Test",
        "username": "testuser"
      },
      "chat": {
        "id": 123456789,
        "type": "private",
        "first_name": "Test"
      },
      "date": 1234567890,
      "text": "/start"
    }
  }'
```

### Симуляция webhook от Google Calendar

```bash
curl -X POST http://localhost:3000/webhooks/google-calendar \
  -H "Content-Type: application/json" \
  -H "X-Goog-Channel-ID: channel-123" \
  -H "X-Goog-Resource-State: update" \
  -d '{
    "kind": "api#channel",
    "id": "channel-123",
    "resourceId": "resource-456",
    "resourceUri": "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    "channelId": "channel-123",
    "resourceState": "update"
  }'
```

## Архитектура

```
┌─────────────────────────────────────────────────┐
│           External API (Telegram, Google)       │
│                  ↓ webhook event                │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│         POST /webhooks/:provider                │
│         (WebhookRegistry dispatcher)            │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│              Workflow Engine                    │
│  ┌──────────────────────────────────────────┐  │
│  │  1. Route Event (определить тип)        │  │
│  │  2. Handle Event (обработать)           │  │
│  │  3. Execute Action (выполнить действие) │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│    Generated Procedures (Telegram API calls)    │
│         - telegram.post.send.message            │
│         - telegram.post.answer.callback.query   │
└─────────────────────────────────────────────────┘
```

## Преимущества подхода

1. **Полная типизация** - TypeScript типы из схем
2. **Переиспользуемость** - обработчики можно использовать в разных workflows
3. **Тестируемость** - каждый обработчик можно тестировать отдельно
4. **Расширяемость** - легко добавить новые типы событий
5. **Композиция** - комбинировать разные API в одном workflow

## Примеры сценариев

### Telegram → Google Calendar

```typescript
// Создание события в календаре из Telegram команды
steps: [
  {
    id: 'parse-command',
    procedure: 'telegram.parse.create.event',
    input: { message: '{{ trigger.data.message.text }}' },
  },
  {
    id: 'create-event',
    procedure: 'google-calendar.calendar.events.insert',
    input: {
      calendarId: 'primary',
      summary: '{{ steps.parse-command.output.title }}',
      start: { dateTime: '{{ steps.parse-command.output.startTime }}' },
      end: { dateTime: '{{ steps.parse-command.output.endTime }}' },
    },
  },
  {
    id: 'confirm',
    procedure: 'telegram.post.send.message',
    input: {
      chat_id: '{{ trigger.data.message.chat.id }}',
      text: 'Событие создано! ✅',
    },
  },
]
```

### Google Calendar → Telegram Notification

```typescript
// Уведомление в Telegram о новом событии
steps: [
  {
    id: 'fetch-event',
    procedure: 'google-calendar.calendar.events.get',
    input: { /* ... */ },
  },
  {
    id: 'notify',
    procedure: 'telegram.post.send.message',
    input: {
      chat_id: '{{ env.ADMIN_CHAT_ID }}',
      text: 'Новое событие: {{ steps.fetch-event.output.summary }}',
    },
  },
]
```
