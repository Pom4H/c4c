# 🌟 C4C Ecosystem Guide - Создание экосистемы приложений

## Обзор

C4C теперь поддерживает **автоматическую интеграцию** между приложениями через OpenAPI спецификации. Каждое c4c приложение может экспортировать свой API и интегрировать API других приложений.

## Быстрый старт

### 1. Создайте c4c приложение

```bash
mkdir my-app
cd my-app
pnpm init
pnpm add @c4c/core @c4c/adapters @c4c/workflow
```

### 2. Определите процедуры

```typescript
// procedures/users.ts
import { defineContract, defineProcedure } from '@c4c/core';
import { z } from 'zod';

export const createUser = defineProcedure({
  contract: {
    name: 'users.create',
    description: 'Create a new user',
    input: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      createdAt: z.string(),
    }),
    metadata: {
      exposure: 'external', // ← Важно для экспорта!
      roles: ['api-endpoint', 'workflow-node', 'sdk-client'],
    },
  },
  handler: async (input) => {
    // Логика создания пользователя
    return {
      id: crypto.randomUUID(),
      name: input.name,
      email: input.email,
      createdAt: new Date().toISOString(),
    };
  },
});
```

### 3. Определите триггеры (опционально)

```typescript
// procedures/webhooks.ts
export const userCreatedTrigger = defineProcedure({
  contract: {
    name: 'users.trigger.created',
    description: 'Webhook trigger when user is created',
    input: z.object({
      webhookUrl: z.string().url(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      createdAt: z.string(),
    }),
    metadata: {
      exposure: 'external',
      type: 'trigger', // ← Обязательно для триггеров!
      roles: ['trigger', 'workflow-node'],
      trigger: {
        type: 'webhook',
        eventTypes: ['user.created'],
      },
      provider: 'my-app',
    },
  },
  handler: async (input) => {
    // Регистрация webhook
    return { id: '', name: '', email: '', createdAt: '' };
  },
});
```

### 4. Запустите сервер через c4c serve

```json
// package.json
{
  "scripts": {
    "dev": "c4c serve --port 3000 --root .",
    "start": "c4c serve --port 3000 --root ."
  }
}
```

```bash
pnpm dev
# или
c4c serve --port 3000

# c4c serve автоматически:
# - Сканирует procedures/ и workflows/
# - Загружает все процедуры в registry
# - Запускает HTTP сервер
# - Раздает /openapi.json
```

**Вывод:**
```
🚀 c4c server started
   Port: 3000
   OpenAPI: http://localhost:3000/openapi.json
   
📦 Loaded 2 procedure(s):
   - users.create
   - users.trigger.created
```

> **Примечание:** В будущем будет команда `c4c prune` для генерации 
> оптимизированного `server.ts` с явными импортами для быстрого 
> холодного старта в production.

## Интеграция с другими приложениями

### Вариант 1: Автоматическая интеграция (через `/openapi.json`)

```bash
# Другое приложение интегрирует ваше
cd another-app
c4c integrate http://localhost:3000/openapi.json --name my-app

# Теперь доступны процедуры:
# - my-app.users.create
# - my-app.users.trigger.created
```

### Вариант 2: Экспорт спецификации в файл

```bash
# Экспортируйте OpenAPI спецификацию
c4c export-spec --output ./my-app-api.json

# Поделитесь файлом с другими
# Они могут интегрироваться:
c4c integrate ./my-app-api.json --name my-app
```

## Использование интегрированных процедур

### В workflows

```typescript
// workflows/user-notification.ts
export const userNotification: WorkflowDefinition = {
  trigger: {
    type: 'webhook',
    config: {
      procedure: 'users.trigger.created', // Ваш триггер
    },
  },
  steps: [
    {
      id: 'send-notification',
      procedure: 'notification-service.send', // ← Процедура из другого приложения!
      input: {
        message: 'Welcome {{ trigger.data.name }}!',
        email: '{{ trigger.data.email }}',
      },
    },
  ],
};
```

### В процедурах

```typescript
// procedures/composite.ts
export const createUserWithNotification = defineProcedure({
  contract: {
    name: 'users.create.with.notification',
    input: z.object({ name: z.string(), email: z.string() }),
    output: z.object({ user: z.any(), notification: z.any() }),
  },
  handler: async (input, context) => {
    // Вызов локальной процедуры
    const user = await context.registry.execute('users.create', input);
    
    // Вызов процедуры из другого приложения
    const notification = await context.registry.execute(
      'notification-service.send',
      {
        message: `Welcome ${user.name}!`,
        email: user.email,
      }
    );
    
    return { user, notification };
  },
});
```

## Best Practices

### 1. Всегда указывайте metadata для экспортируемых процедур

```typescript
metadata: {
  exposure: 'external',  // или 'internal'
  roles: ['api-endpoint', 'workflow-node', 'sdk-client'],
  tags: ['users', 'auth'],  // Для группировки в документации
}
```

### 2. Используйте описательные имена

```typescript
contract: {
  name: 'users.create',  // ✅ Хорошо: resource.action
  // name: 'createUser',  // ❌ Плохо: не подходит для REST mapping
}
```

### 3. Документируйте процедуры

```typescript
contract: {
  name: 'users.create',
  description: 'Create a new user account with email verification',
  // ...
}
```

### 4. Версионируйте API

```bash
c4c export-spec --version "2.0.0" --title "My App API v2"
```

### 5. Определяйте provider для триггеров

```typescript
metadata: {
  type: 'trigger',
  provider: 'my-app',  // ← Уникальный идентификатор вашего приложения
}
```

## Примеры архитектур

### Микросервисы

```
Auth Service (3001)
  ↓ экспортирует /openapi.json
  
User Service (3002)
  ↑ интегрирует Auth Service
  ↓ экспортирует /openapi.json
  
API Gateway (3000)
  ↑ интегрирует Auth + User Services
  ↓ экспортирует unified API
```

### Plugin System

```
Core App
  ├─ Plugin A (интегрирован)
  ├─ Plugin B (интегрирован)
  ├─ Plugin C (интегрирован)
  └─ экспортирует объединенный API
```

### Event-Driven Architecture

```
Service A
  └─ триггер: order.created
         ↓
Service B (интегрирован)
  └─ слушает: order.created
  └─ вызывает: payment.charge
         ↓
Service C (интегрирован)
  └─ слушает: payment.charged
  └─ вызывает: shipping.create
```

## CLI команды

### c4c integrate

Интегрирует внешний API в ваше приложение.

```bash
c4c integrate <url> [options]

Options:
  --name <name>      Integration name (auto-detected)
  --output <path>    Custom output directory
  --root <path>      Project root directory
```

**Примеры:**

```bash
# Из URL
c4c integrate http://localhost:3001/openapi.json

# Из файла
c4c integrate ./path/to/openapi.json

# С кастомным именем
c4c integrate http://api.example.com/openapi.json --name my-service
```

### c4c export-spec

Экспортирует OpenAPI спецификацию вашего приложения.

```bash
c4c export-spec [options]

Options:
  -o, --output <path>         Output file path (default: ./openapi.json)
  -f, --format <format>       Output format: json or yaml (default: json)
  --root <path>               Project root directory
  --title <title>             API title
  --version <version>         API version (default: 1.0.0)
  --description <description> API description
  --server-url <url>          Server URL
  --no-webhooks               Exclude webhooks from spec
  --no-triggers               Exclude trigger metadata from spec
```

**Примеры:**

```bash
# Базовый экспорт
c4c export-spec

# С опциями
c4c export-spec \
  --output ./dist/api.json \
  --title "My API" \
  --version "2.0.0" \
  --server-url "https://api.myapp.com"

# Без webhooks
c4c export-spec --no-webhooks --no-triggers
```

## Полный пример

См. `examples/cross-integration/` для полного рабочего примера:

```bash
cd examples/cross-integration

# Запустите оба приложения
cd app-a && pnpm dev  # Terminal 1
cd app-b && pnpm dev  # Terminal 2

# Интегрируйте их
./scripts/integrate-apps.sh  # Terminal 3

# Тестируйте
./scripts/test-integration.sh
```

## Troubleshooting

### Процедура не экспортируется

Убедитесь, что:
- `exposure: 'external'` в metadata
- Процедура зарегистрирована в registry
- Сервер запущен

### Интеграция не работает

Проверьте:
- OpenAPI спецификация доступна: `curl http://localhost:3000/openapi.json`
- Имя интеграции корректно
- Папка `generated/` создалась

### TypeScript ошибки после интеграции

```bash
# Пересоберите проект
pnpm build

# Проверьте сгенерированные типы
cat generated/<integration-name>/types.gen.ts
```

## Ресурсы

- **Примеры**: `examples/cross-integration/`
- **Документация**: `CROSS_INTEGRATION_COMPLETE.md`
- **Quick Start**: `examples/cross-integration/QUICKSTART.md`
- **OpenAPI генератор**: `packages/generators/src/openapi.ts`
- **CLI команды**: `apps/cli/src/commands/`

## Итог

C4C теперь поддерживает создание **экосистемы взаимодействующих приложений**:

✅ Автоматическая генерация OpenAPI  
✅ Интеграция одной командой  
✅ Полная типизация TypeScript  
✅ Поддержка webhooks и триггеров  
✅ Composable workflows  
✅ Масштабируемая архитектура  

**Welcome to the c4c ecosystem! 🌟**
