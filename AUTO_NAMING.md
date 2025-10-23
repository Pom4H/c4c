# Auto-Naming System

## Проблема

При явном указании имени процедуры в contract, IDE не может автоматически обновить строку при рефакторинге:

```typescript
// ❌ Hardcoded name - IDE не обновит при F2 rename
export const createUser: Procedure = {
  contract: {
    name: "users.create",  // Строка не обновится при рефакторинге
    input: z.object(...),
    output: z.object(...),
  },
  handler: async (input) => { ... }
};
```

## Решение: Optional Name

Теперь `contract.name` опциональное поле. Если не указано → используется **имя экспорта**.

---

## Auto-Naming

### Базовое использование

```typescript
// ✅ Auto-naming - IDE refactoring работает!
export const createUser: Procedure = {
  contract: {
    // name НЕ указан → автоматически "createUser"
    input: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
  handler: async (input) => {
    // Business logic
    return { id: generateId(), ...input };
  }
};
```

**Результат:**
```bash
# Доступно как:
c4c exec createUser --input '{"name":"Alice","email":"alice@example.com"}'

# В API:
POST /rpc/createUser

# В OpenAPI:
operationId: "createUser"
```

### IDE Refactoring

```typescript
// 1. F2 rename: createUser → createUserAccount
export const createUserAccount: Procedure = {
  contract: {
    input: ...,   // name автоматически обновится!
    output: ...,
  },
  handler: ...
};

// 2. Теперь доступно как:
c4c exec createUserAccount

// 3. Старое имя больше не работает:
c4c exec createUser  // ❌ Not found
```

**IDE автоматически обновляет:**
- ✅ Имя переменной
- ✅ Все ссылки на переменную
- ✅ Импорты
- ✅ Type references

**Не нужно вручную менять:**
- ❌ Строку в contract.name
- ❌ Документацию
- ❌ Тесты

---

## Explicit Naming

### Когда нужно явное имя

```typescript
// ✅ Explicit naming - красивые/читаемые имена API
export const createUser: Procedure = {
  contract: {
    name: "users.create",  // ← Явно указано
    input: z.object(...),
    output: z.object(...),
  },
  handler: ...
};
```

**Результат:**
```bash
# Доступно как:
c4c exec users.create

# В API:
POST /rpc/users.create

# В OpenAPI:
operationId: "users.create"
```

### Когда использовать explicit naming

**Используйте явное имя когда:**
1. **Public API** - нужны стабильные, красивые имена
2. **Versioning** - `users.v2.create`
3. **Namespacing** - `billing.charges.create`
4. **Documentation** - понятные имена в docs
5. **REST mapping** - `users.create` → `POST /users`

**Используйте auto-naming когда:**
1. **Internal procedures** - не public API
2. **Rapid development** - быстрое прототипирование
3. **Testing** - легко рефакторить
4. **Simple naming** - имя экспорта уже хорошее

---

## Комбинированный подход

### Модульная структура

```typescript
// modules/users/create.ts
export const create: Procedure = {
  contract: {
    name: "users.create",  // ← Public API имя
    input: ...,
    output: ...,
  },
  handler: ...
};

// modules/users/internal.ts
export const validateEmail: Procedure = {
  contract: {
    // Auto-naming: "validateEmail"
    // Internal use only
    input: ...,
    output: ...,
  },
  handler: ...
};
```

**Результат:**
```bash
# Public procedures
c4c exec users.create
c4c exec users.get
c4c exec users.update

# Internal procedures
c4c exec validateEmail
c4c exec generateToken
```

### Namespace pattern

```typescript
// modules/users/index.ts
export const usersCreate: Procedure = {
  contract: {
    // Auto-naming: "usersCreate" (можно улучшить naming convention)
    input: ...,
    output: ...,
  },
  handler: ...
};

export const usersGet: Procedure = {
  contract: {
    // Auto-naming: "usersGet"
    input: ...,
    output: ...,
  },
  handler: ...
};
```

---

## Генераторы API

### Client Generator

```typescript
// Auto-naming
export const createUser: Procedure = {
  contract: {
    input: z.object(...),
    output: z.object(...),
  },
  handler: ...
};

// Сгенерированный client:
const client = createc4cClient({ baseUrl: "http://localhost:3000" });

// ✅ Работает с auto-naming
await client.procedures.createUser({ 
  name: "Alice", 
  email: "alice@example.com" 
});
```

### OpenAPI Generator

```typescript
// Auto-naming
export const getUsers: Procedure = {
  contract: {
    input: z.object(...),
    output: z.array(z.object(...)),
  },
  handler: ...
};

// Сгенерированный OpenAPI:
{
  "paths": {
    "/rpc/getUsers": {
      "post": {
        "operationId": "getUsers",  // ← Использует auto-name
        "summary": "getUsers",
        "requestBody": { ... },
        "responses": { ... }
      }
    }
  }
}
```

---

## Migration Guide

### Существующий код

```typescript
// ✅ Работает как раньше
export const createUser: Procedure = {
  contract: {
    name: "users.create",  // Explicit name
    input: ...,
    output: ...,
  },
  handler: ...
};
```

**Никаких изменений не требуется!** Backward compatible.

### Новый код

```typescript
// ✅ Можно использовать auto-naming
export const createUser: Procedure = {
  contract: {
    // name не указан
    input: ...,
    output: ...,
  },
  handler: ...
};
```

### Постепенная миграция

Можно мигрировать процедуры постепенно:

```typescript
// Old style - keep as is
export const createUser: Procedure = {
  contract: { name: "users.create", ... },
  handler: ...
};

// New style - auto-naming
export const deleteUser: Procedure = {
  contract: { input: ..., output: ... },
  handler: ...
};
```

**Оба стиля работают одновременно!**

---

## Best Practices

### 1. Naming Conventions

**Auto-naming:**
- `createUser` ✅ (clear, concise)
- `handleUserCreation` ❌ (verbose)
- `usr_create` ❌ (unclear abbreviation)

**Explicit naming:**
- `users.create` ✅ (namespaced)
- `api.v1.users.create` ✅ (versioned)
- `create-user` ⚠️ (kebab-case - необычно)

### 2. Группировка

```typescript
// ✅ Good - grouped by domain
export const usersCreate: Procedure = { ... };
export const usersGet: Procedure = { ... };
export const usersUpdate: Procedure = { ... };

// ❌ Bad - random naming
export const createUser: Procedure = { ... };
export const getTheUser: Procedure = { ... };
export const updateUserData: Procedure = { ... };
```

### 3. Public vs Internal

```typescript
// Public API - explicit naming
export const create: Procedure = {
  contract: { 
    name: "users.create",  // ← API stable name
    input: ..., 
    output: ... 
  },
  handler: ...
};

// Internal helper - auto-naming
export const validateUserEmail: Procedure = {
  contract: { 
    input: ..., 
    output: ... 
  },
  handler: ...
};
```

### 4. Конфликты имен

**Избегайте:**
```typescript
// ❌ Bad - confusing
export const create: Procedure = { ... };  // What does it create?
export const get: Procedure = { ... };     // What does it get?

// ✅ Good - clear
export const createUser: Procedure = { ... };
export const getUser: Procedure = { ... };
```

---

## Validation & Debugging

### Duplicate Name Warning

```typescript
// File 1: modules/users/create.ts
export const createUser: Procedure = {
  contract: { name: "users.create", ... },
  handler: ...
};

// File 2: modules/admin/create-user.ts
export const createUserAsAdmin: Procedure = {
  contract: { name: "users.create", ... },  // ← Duplicate!
  handler: ...
};
```

**Warning:**
```
[Registry] Duplicate procedure name "users.create"
  Previous: modules/users/create.ts
  Current: modules/admin/create-user.ts
  Tip: Use explicit name in contract or rename export.
```

### Listing Names

```bash
# See all procedure names
c4c exec --help

# Or list via API
GET /procedures

# Output:
{
  "procedures": [
    { "name": "createUser", ... },
    { "name": "users.create", ... },
    { "name": "validateEmail", ... }
  ]
}
```

---

## TypeScript Support

### Type Inference

```typescript
import { Procedure } from '@c4c/core';

// ✅ Type-safe без явного name
export const createUser: Procedure = {
  contract: {
    input: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
  handler: async (input) => {
    // input is fully typed! ✅
    const userId = generateId();
    return { id: userId, ...input };
  }
};
```

### Contract Type

```typescript
interface Contract<TInput = unknown, TOutput = unknown> {
  name?: string;  // ← Optional!
  description?: string;
  input: z.ZodType<TInput>;
  output: z.ZodType<TOutput>;
  metadata?: ContractMetadata;
}
```

---

## Future: Naming Transformers

### Prune Command (будущее)

```bash
# Генерация с naming rules
c4c prune --out dist/entry.js --naming-style dot-notation

# Transforms:
# usersCreate → users.create
# getUserById → user.get-by-id
# products_list → products.list
```

**Config:**
```json
{
  "prune": {
    "namingStyle": "dot-notation",
    "rules": {
      "camelCase": "splitAndDot",     // usersCreate → users.create
      "snake_case": "replaceToDot",   // users_create → users.create
      "prefix": true                  // в modules/users/ → users.* prefix
    }
  }
}
```

---

## Summary

### ✅ Преимущества Auto-Naming

1. **IDE Refactoring** - F2 rename работает полностью
2. **Less Boilerplate** - не нужно дублировать имя
3. **DRY Principle** - single source of truth
4. **Flexibility** - можно выбирать: auto или explicit
5. **Backward Compatible** - существующий код работает

### 🎯 Когда что использовать

| Сценарий | Рекомендация |
|----------|-------------|
| Public API | Explicit naming (`users.create`) |
| Internal procedures | Auto-naming (`createUser`) |
| Versioned API | Explicit (`api.v2.users.create`) |
| Rapid prototyping | Auto-naming |
| REST endpoints | Explicit (для mapping) |
| Testing/helpers | Auto-naming |

### 💡 Golden Rule

**Start with auto-naming, add explicit names when needed.**

Начинайте с простого (auto-naming), добавляйте явные имена когда:
- Формируете public API
- Нужна версионность
- Требуется конкретный REST mapping
- Документация требует красивых имен
