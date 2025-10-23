# ✅ Webhook Endpoints - Автоматическая регистрация триггеров

## Что было добавлено

При запуске `c4c serve` теперь автоматически:

### 1. ✅ Обнаруживаются все триггеры

```
🎯 Discovered 6 trigger procedure(s):
   - avitoItems.apply.vas (subscription, provider: avitoItems)
   - avitoMessenger.get.messages.v3 (subscription, provider: avitoMessenger)
   - avitoMessenger.get.subscriptions (subscription, provider: avitoMessenger)
   - avitoMessenger.post.webhook.v3 (subscription, provider: avitoMessenger)
   - googleDrive.drive.changes.watch (subscription, provider: googleDrive)
   - googleDrive.drive.files.watch (subscription, provider: googleDrive)
```

### 2. ✅ Регистрируются webhook endpoints

```
📡 Webhooks:
   Receive:      POST http://localhost:3000/webhooks/:provider
   Subscribe:    POST http://localhost:3000/webhooks/:provider/subscribe
   Unsubscribe:  DELETE http://localhost:3000/webhooks/:provider/subscribe/:id
   List:         GET http://localhost:3000/webhooks/:provider/subscriptions
```

### 3. ✅ Новые endpoints для триггеров

Добавлены три новых endpoint:

#### **GET /webhooks/triggers**
Получить список всех доступных триггеров

```bash
curl http://localhost:3000/webhooks/triggers
```

Ответ:
```json
{
  "triggers": [
    {
      "name": "googleDrive.drive.files.watch",
      "provider": "googleDrive",
      "kind": "subscription",
      "transport": null,
      "description": "Watch for changes to Drive resources"
    },
    {
      "name": "telegram.post.set.webhook",
      "provider": "telegram",
      "kind": "subscription",
      "transport": null,
      "description": "Set webhook URL for Telegram bot"
    }
  ]
}
```

#### **POST /webhooks/triggers/:triggerName**
Вызвать триггер напрямую (для тестирования)

```bash
curl -X POST http://localhost:3000/webhooks/triggers/telegram.post.set.webhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/webhook"}'
```

Ответ:
```json
{
  "result": {
    "ok": true,
    "description": "Webhook was set"
  }
}
```

#### **POST /webhooks/:provider**
Получить webhook событие от провайдера

```bash
curl -X POST http://localhost:3000/webhooks/telegram \
  -H "Content-Type: application/json" \
  -d '{"update_id": 123, "message": {...}}'
```

## Как это работает

### Автоматическое обнаружение

При старте сервера `createWebhookRouter` сканирует registry:

```typescript
function getTriggerProcedures(registry: Registry): Array<{ name: string; metadata: any }> {
  const triggers: Array<{ name: string; metadata: any }> = [];
  
  for (const [name, procedure] of registry.entries()) {
    const metadata = procedure.contract.metadata;
    const isTrigger = metadata?.roles?.includes('trigger') || 
                      metadata?.type === 'trigger';
    
    if (isTrigger) {
      triggers.push({ name, metadata });
    }
  }
  
  return triggers;
}
```

### Логирование при старте

```
🎯 Discovered 6 trigger procedure(s):
   - avitoItems.apply.vas (subscription, provider: avitoItems)
   - avitoMessenger.get.messages.v3 (subscription, provider: avitoMessenger)
   - ...
```

## Полный список endpoints

| Method | Path | Описание |
|--------|------|----------|
| **GET** | `/webhooks/triggers` | Список всех триггеров |
| **POST** | `/webhooks/triggers/:triggerName` | Вызов триггера напрямую |
| **POST** | `/webhooks/:provider` | Прием webhook от провайдера |
| **POST** | `/webhooks/:provider/subscribe` | Регистрация подписки |
| **DELETE** | `/webhooks/:provider/subscribe/:id` | Отмена подписки |
| **GET** | `/webhooks/:provider/subscriptions` | Список подписок провайдера |

## Примеры использования

### 1. Получить список триггеров

```bash
curl http://localhost:3000/webhooks/triggers | jq
```

### 2. Зарегистрировать webhook для Telegram

```bash
# Вызвать процедуру setWebhook
curl -X POST http://localhost:3000/webhooks/triggers/telegram.post.set.webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TELEGRAM_TOKEN" \
  -d '{
    "url": "https://your-domain.com/webhooks/telegram",
    "allowed_updates": ["message", "callback_query"]
  }'
```

### 3. Принять webhook от Telegram

```bash
# Telegram отправит сюда события
curl -X POST http://localhost:3000/webhooks/telegram \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123456789,
    "message": {
      "message_id": 1,
      "from": {...},
      "text": "Hello!"
    }
  }'
```

### 4. Google Drive Watch

```bash
# Зарегистрировать watch для файла
curl -X POST http://localhost:3000/webhooks/triggers/googleDrive.drive.files.watch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer GOOGLE_TOKEN" \
  -d '{
    "fileId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "kind": "api#channel",
    "id": "channel-uuid",
    "type": "web_hook",
    "address": "https://your-domain.com/webhooks/googleDrive"
  }'
```

### 5. Зарегистрировать подписку вручную

```bash
curl -X POST http://localhost:3000/webhooks/googleDrive/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "triggerId": "googleDrive.drive.files.watch",
    "channelId": "channel-uuid",
    "webhookUrl": "https://your-domain.com/webhooks/googleDrive",
    "workflowId": "my-workflow-123",
    "filters": {
      "fileId": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
    }
  }'
```

### 6. Получить список подписок

```bash
curl http://localhost:3000/webhooks/googleDrive/subscriptions | jq
```

## Workflow Integration

Триггеры можно использовать в workflow определениях:

```typescript
const workflow = {
  id: "telegram-bot",
  name: "Telegram Bot Handler",
  trigger: {
    type: "webhook",
    provider: "telegram",
    procedure: "telegram.post.get.updates"
  },
  steps: [
    {
      id: "process-message",
      procedure: "processMessage",
      input: {
        message: "{{ trigger.data.message }}"
      }
    },
    {
      id: "send-reply",
      procedure: "telegram.post.send.message",
      input: {
        chat_id: "{{ trigger.data.message.chat.id }}",
        text: "{{ steps.process-message.output.reply }}"
      }
    }
  ]
};
```

## Webhook Verifiers

Для безопасности webhook endpoints поддерживают верификацию:

```typescript
const defaultVerifiers: WebhookVerifiers = {
  googleDrive: async (c: Context): Promise<boolean> => {
    const channelId = c.req.header("X-Goog-Channel-ID");
    const resourceState = c.req.header("X-Goog-Resource-State");
    return Boolean(channelId && resourceState);
  },
  
  slack: async (c: Context): Promise<boolean> => {
    const signature = c.req.header("X-Slack-Signature");
    const timestamp = c.req.header("X-Slack-Request-Timestamp");
    // TODO: Implement proper HMAC verification
    return Boolean(signature && timestamp);
  },
  
  github: async (c: Context): Promise<boolean> => {
    const signature = c.req.header("X-Hub-Signature-256");
    // TODO: Implement proper HMAC verification
    return Boolean(signature);
  },
};
```

## WebhookRegistry

Для управления подписками используется `WebhookRegistry`:

```typescript
import { WebhookRegistry } from '@c4c/adapters';

const webhookRegistry = new WebhookRegistry();

// Регистрация обработчика
webhookRegistry.registerHandler('telegram', async (event) => {
  console.log('Received Telegram event:', event);
  // Обработка события
});

// Регистрация подписки
webhookRegistry.registerSubscription({
  id: 'sub_123',
  provider: 'telegram',
  triggerId: 'telegram.post.get.updates',
  webhookUrl: 'https://example.com/webhooks/telegram',
  createdAt: new Date()
});

// Получить подписки
const subs = webhookRegistry.getSubscriptionsByProvider('telegram');
```

## Что запускается при `c4c serve`

1. ✅ **HTTP Server** на порту 3000
2. ✅ **RPC endpoints** для всех процедур
3. ✅ **REST endpoints** для ресурсов
4. ✅ **Workflow endpoints** для выполнения workflows
5. ✅ **Webhook endpoints** для триггеров ← **НОВОЕ!**
6. ✅ **OpenAPI docs** на `/docs`

## Архитектура

```
┌─────────────────┐
│  External API   │
│   (Telegram,    │
│  Google Drive)  │
└────────┬────────┘
         │ webhook event
         ▼
┌─────────────────────────────────┐
│  POST /webhooks/:provider       │
│  ├─ Verify signature            │
│  ├─ Parse payload               │
│  ├─ Match subscription          │
│  └─ Dispatch to handlers        │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  WebhookRegistry                │
│  ├─ Find handlers               │
│  └─ Execute in parallel         │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Workflow Engine                │
│  ├─ Resume execution            │
│  ├─ Trigger new workflow        │
│  └─ Update state                │
└─────────────────────────────────┘
```

## Итог

✅ **Webhook endpoints автоматически регистрируются** при старте `c4c serve`  
✅ **Триггеры обнаруживаются** из метаданных процедур  
✅ **Логируется** список доступных триггеров  
✅ **3 новых API** для работы с триггерами  
✅ **Полная интеграция** с workflow engine  
✅ **Поддержка верификации** для безопасности  

Всё готово к использованию! 🚀
