# OpenAPI Generator

Автоматическая генерация контрактов и обработчиков tsdev из OpenAPI/Swagger спецификаций.

## Возможности

- 🔄 **Автоматическая генерация** контрактов и обработчиков из OpenAPI спецификаций
- 🎯 **Обнаружение webhook эндпоинтов** и генерация соответствующих обработчиков
- 🔐 **Поддержка OAuth callback** эндпоинтов
- 📝 **Генерация TypeScript типов** и Zod схем
- 🌐 **Веб-интерфейс** для загрузки и генерации
- 📦 **Готовые пакеты** с зависимостями

## Быстрый старт

### 1. Через веб-интерфейс

1. Запустите сервер разработки:
```bash
pnpm dev
```

2. Откройте http://localhost:3000 в браузере
3. Перейдите на вкладку "⚡ OpenAPI Generator"
4. Загрузите или вставьте OpenAPI спецификацию
5. Нажмите "Validate Spec" для проверки
6. Нажмите "Generate Code" для генерации
7. Скачайте сгенерированные файлы

### 2. Через API

```bash
# Валидация спецификации
curl -X POST http://localhost:3000/openapi/validate \
  -H "Content-Type: application/json" \
  -d '{"spec": {...}}'

# Генерация кода
curl -X POST http://localhost:3000/openapi/generate \
  -H "Content-Type: application/json" \
  -d '{"spec": {...}, "options": {...}}'
```

### 3. Программно

```typescript
import { OpenAPIGenerator } from "@tsdev/generators";

const generator = new OpenAPIGenerator(openApiSpec, {
  baseUrl: "https://api.example.com",
  generateTypes: true,
  generateWebhooks: true,
  generateOAuthCallbacks: true,
});

const files = await generator.generate();
```

## API Endpoints

### POST /openapi/validate

Валидирует OpenAPI спецификацию и возвращает статистику.

**Запрос:**
```json
{
  "spec": {
    "openapi": "3.0.0",
    "info": {
      "title": "My API",
      "version": "1.0.0"
    },
    "paths": {...}
  }
}
```

**Ответ:**
```json
{
  "valid": true,
  "stats": {
    "totalOperations": 5,
    "webhookOperations": 1,
    "oauthCallbackOperations": 1,
    "apiOperations": 3,
    "hasOAuth": true
  }
}
```

### POST /openapi/generate

Генерирует контракты и обработчики из OpenAPI спецификации.

**Запрос:**
```json
{
  "spec": {...},
  "options": {
    "baseUrl": "https://api.example.com",
    "timeout": 30000,
    "retries": 3,
    "generateTypes": true,
    "generateWebhooks": true,
    "generateOAuthCallbacks": true
  }
}
```

**Ответ:**
```json
{
  "success": true,
  "files": {
    "contracts": "...",
    "handlers": "...",
    "types": "...",
    "zodSchemas": "...",
    "webhooks": "...",
    "oauthCallbacks": "...",
    "index": "...",
    "packageJson": "..."
  },
  "stats": {...}
}
```

### GET /openapi/templates

Возвращает доступные шаблоны OpenAPI спецификаций.

## Генерируемые файлы

### contracts.ts
Содержит контракты tsdev, сгенерированные из OpenAPI операций:

```typescript
export const usersListContract: Contract = {
  name: "users.list",
  description: "List users",
  input: usersListInputSchema,
  output: usersListOutputSchema,
  metadata: {
    source: "openapi",
    operationId: "users.list",
    method: "GET",
    path: "/users",
    tags: ["users"],
  },
};
```

### handlers.ts
Содержит HTTP обработчики для выполнения запросов к API:

```typescript
export const usersListHandler = async (
  input: z.infer<typeof usersListInputSchema>,
  context: ExecutionContext
): Promise<z.infer<typeof usersListOutputSchema>> => {
  // HTTP запрос к API
  const response = await fetch(`${baseUrl}/users`, {
    method: "GET",
    headers: { ... },
  });
  return response.json();
};
```

### webhooks.ts
Содержит обработчики для webhook эндпоинтов:

```typescript
export const webhooksPaymentWebhookHandler = async (
  request: Request,
  context: ExecutionContext
): Promise<Response> => {
  try {
    const body = await request.json();
    // Обработка webhook
    return new Response(JSON.stringify({ status: 'success' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

### oauth-callbacks.ts
Содержит обработчики для OAuth callback эндпоинтов:

```typescript
export const oauthCallbackCallbackHandler = async (
  request: Request,
  context: ExecutionContext
): Promise<Response> => {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    // Обработка OAuth callback
    return new Response('Authorization successful', { status: 200 });
  } catch (error) {
    return new Response('Internal server error', { status: 500 });
  }
};
```

## Обнаружение webhook и OAuth эндпоинтов

Система автоматически обнаруживает:

### Webhook эндпоинты
- Пути содержащие: `webhook`, `callback`, `hook`, `notification`, `event`
- Описания содержащие ключевые слова webhook
- Операции POST с простыми ответами

### OAuth callback эндпоинты
- Пути содержащие: `oauth`, `callback`, `redirect`, `authorize`, `token`
- Описания содержащие OAuth ключевые слова
- Операции GET с параметрами `code` и `state`

## Конфигурация

### OpenAPIGeneratorOptions

```typescript
interface OpenAPIGeneratorOptions {
  baseUrl?: string;                    // Базовый URL API
  timeout?: number;                    // Таймаут запросов (мс)
  retries?: number;                    // Количество повторов
  headers?: Record<string, string>;    // Дополнительные заголовки
  authType?: "none" | "bearer" | "apiKey" | "oauth2";
  authConfig?: {
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    oauth2?: {
      clientId: string;
      clientSecret: string;
      tokenUrl: string;
      scopes?: string[];
    };
  };
  generateTypes?: boolean;             // Генерировать TypeScript типы
  generateWebhooks?: boolean;          // Генерировать webhook обработчики
  generateOAuthCallbacks?: boolean;    // Генерировать OAuth callback обработчики
  packageName?: string;                // Имя пакета
  packageVersion?: string;             // Версия пакета
}
```

## Примеры использования

### Базовый пример

```typescript
import { OpenAPIGenerator } from "@tsdev/generators";

const spec = {
  openapi: "3.0.0",
  info: { title: "My API", version: "1.0.0" },
  paths: {
    "/users": {
      get: {
        operationId: "users.list",
        responses: { "200": { description: "OK" } }
      }
    }
  }
};

const generator = new OpenAPIGenerator(spec);
const files = await generator.generate();
```

### С аутентификацией

```typescript
const generator = new OpenAPIGenerator(spec, {
  baseUrl: "https://api.example.com",
  authType: "bearer",
  authConfig: {
    token: "your-token-here"
  }
});
```

### Только API операции (без webhook/OAuth)

```typescript
const generator = new OpenAPIGenerator(spec, {
  generateWebhooks: false,
  generateOAuthCallbacks: false
});
```

## Интеграция с существующими проектами

1. Сгенерируйте файлы через веб-интерфейс или API
2. Скопируйте файлы в ваш проект
3. Установите зависимости: `npm install`
4. Импортируйте и используйте:

```typescript
import { usersListProcedure } from "./generated";

// Использование в workflow
const workflow = workflow("user-management")
  .step(usersListProcedure)
  .commit();
```

## Ограничения

- Поддерживается только OpenAPI 3.0+
- Сложные схемы могут быть упрощены при конвертации в Zod
- OAuth2 требует дополнительной настройки для полной функциональности
- Webhook обработчики требуют настройки маршрутизации

## Поддержка

Для вопросов и предложений создайте issue в репозитории проекта.