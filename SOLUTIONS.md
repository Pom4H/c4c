# Решения для изоляции процедур в tsdev

## Проблема

Не каждая процедура должна становиться эндпоинтом или воркфлоу нодой. Нужно придумать как их удобно изолировать не усложняя DX, а так же возможность компоновать не теряя возможностей трассировки.

## Решение 1: Модульная система с явной экспозицией

### Концепция
Создаем систему модулей, где процедуры могут быть приватными (только для внутреннего использования) или публичными (доступными как эндпоинты и воркфлоу ноды).

### Пользовательский путь разработчика

```typescript
// 1. Создаем модуль
const userModule = createModule({
  name: "user-management",
  description: "Модуль управления пользователями",
  version: "1.0.0",
  namespace: "users",
  policies: ["withLogging", "withSpan"],
});

// 2. Создаем процедуры с разными уровнями видимости
export const createUser: ModularProcedure = {
  contract: createUserContract,
  handler: async (input, context) => {
    // Используем внутренние процедуры
    const emailValidation = await validateEmail.handler({ email: input.email }, context);
    const passwordHash = await hashPassword.handler({ password: input.password }, context);
    
    // Создаем пользователя
    const user = { /* ... */ };
    return user;
  },
  visibility: "public", // Доступна как эндпоинт и воркфлоу нода
  module: "user-management",
  dependencies: ["validateEmail", "hashPassword"],
  tags: ["users", "create"],
};

export const validateEmail: ModularProcedure = {
  contract: validateEmailContract,
  handler: async (input) => {
    // Валидация email
    return { isValid: true, domain: "example.com" };
  },
  visibility: "internal", // Только для внутреннего использования
  module: "user-management",
  tags: ["validation", "email"],
};

export const hashPassword: ModularProcedure = {
  contract: hashPasswordContract,
  handler: async (input) => {
    // Хеширование пароля
    return { hash: "...", salt: "..." };
  },
  visibility: "private", // Полностью приватная
  module: "user-management",
  tags: ["security", "password"],
};

// 3. Регистрируем модуль
registerModule(userModule, registry);

// 4. Используем композицию
const userOnboardingComposition = createComposition({
  name: "userOnboarding",
  description: "Полный процесс регистрации пользователя",
  procedures: ["users.createUser", "analytics.trackEvent"],
  inputMapping: {
    "users.createUser": "input",
    "analytics.trackEvent": "users.createUser",
  },
  errorHandling: "retry",
  retryConfig: { maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2 },
}, registry);
```

### Преимущества
- ✅ Явный контроль видимости процедур
- ✅ Модульная организация кода
- ✅ Сохранение возможностей трассировки
- ✅ Простая композиция процедур
- ✅ Автоматическая валидация зависимостей

### Недостатки
- ❌ Требует явного создания модулей
- ❌ Больше boilerplate кода
- ❌ Сложнее для простых случаев

---

## Решение 2: Аннотации и метаданные для контроля видимости

### Концепция
Используем декораторы и метаданные для определения уровня доступа и поведения процедур.

### Пользовательский путь разработчика

```typescript
// 1. Создаем процедуры с декораторами
@APIEndpoint("Создает нового пользователя в системе", ["users", "create", "api"])
@Tags("authentication", "registration")
@Policies({
  retry: { maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2 },
  timeout: 30000,
  logging: true,
  tracing: true,
})
@DependsOn("validateEmail", "hashPassword")
@Examples({
  input: { name: "Иван Иванов", email: "ivan@example.com", password: "secure123" },
  output: { id: "user_123", name: "Иван Иванов", email: "ivan@example.com" },
})
@Version("1.0.0")
@Author("tsdev-team")
export const createUser: AnnotatedProcedure = {
  contract: createUserContract,
  handler: async (input, context) => {
    // Логика создания пользователя
  },
  metadata: {
    visibility: "public",
    category: "api",
    tags: ["users", "create", "api", "authentication", "registration"],
    // ... другие метаданные
  },
};

@WorkflowNode("Отправляет приветственное письмо", ["email", "welcome", "workflow"])
@Tags("email", "welcome", "workflow")
@Policies({
  retry: { maxAttempts: 5, delayMs: 2000, backoffMultiplier: 1.5 },
  timeout: 60000,
  logging: true,
  tracing: true,
})
export const sendWelcomeEmail: AnnotatedProcedure = {
  contract: sendWelcomeEmailContract,
  handler: async (input) => {
    // Логика отправки письма
  },
  metadata: {
    visibility: "workflow",
    category: "workflow",
    tags: ["email", "welcome", "workflow"],
  },
};

@Validation("Валидирует email адрес", ["validation", "email"])
@Tags("validation", "email")
@Policies({
  cache: { ttl: 3600000 }, // 1 час
})
export const validateEmail: AnnotatedProcedure = {
  contract: validateEmailContract,
  handler: async (input) => {
    // Логика валидации
  },
  metadata: {
    visibility: "private",
    category: "validation",
    tags: ["validation", "email"],
  },
};

@Deprecated("Используйте createUser вместо createUserLegacy", "migrate-to-createUser")
@APIEndpoint("Устаревший способ создания пользователя", ["users", "create", "legacy"])
export const createUserLegacy: AnnotatedProcedure = {
  // ... устаревшая реализация
};

// 2. Регистрируем процедуры
registerAnnotatedProcedure(registry, createUser);
registerAnnotatedProcedure(registry, sendWelcomeEmail);
registerAnnotatedProcedure(registry, validateEmail);

// 3. Используем поиск и фильтрацию
const apiProcedures = getProceduresByCategory(registry, "api");
const workflowProcedures = getProceduresByVisibility(registry, "workflow");
const userProcedures = getProceduresByTag(registry, "users");

// 4. Выполняем процедуры
const result = await executeAnnotatedProcedure(registry, "createUser", {
  name: "Алексей Петров",
  email: "alexey@example.com",
  password: "securepassword123",
});
```

### Преимущества
- ✅ Декларативный подход
- ✅ Богатые метаданные
- ✅ Автоматическая интроспекция
- ✅ Поддержка устаревших процедур
- ✅ Гибкая фильтрация и поиск

### Недостатки
- ❌ Требует поддержки декораторов
- ❌ Может быть избыточным для простых случаев
- ❌ Сложность в настройке

---

## Решение 3: Композиция через функции-обертки

### Концепция
Создаем сложные процедуры из простых с явным контролем видимости и зависимостей через функции-обертки.

### Пользовательский путь разработчика

```typescript
// 1. Создаем базовые процедуры
const createUserBase = {
  name: "createUserBase",
  description: "Базовая процедура создания пользователя",
  input: z.object({ name: z.string(), email: z.string(), password: z.string() }),
  output: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  handler: async (input) => {
    // Базовая логика создания пользователя
  },
};

const validateEmail = {
  name: "validateEmail",
  description: "Валидация email адреса",
  input: z.object({ email: z.string() }),
  output: z.object({ isValid: z.boolean(), domain: z.string() }),
  handler: async (input) => {
    // Логика валидации
  },
};

const hashPassword = {
  name: "hashPassword",
  description: "Хеширование пароля",
  input: z.object({ password: z.string() }),
  output: z.object({ hash: z.string(), salt: z.string() }),
  handler: async (input) => {
    // Логика хеширования
  },
};

// 2. Создаем композиции с разными стратегиями
export const createUser = createAPIEndpoint({
  name: "createUser",
  description: "Создание пользователя с валидацией и хешированием",
  inputSchema: z.object({ name: z.string(), email: z.string(), password: z.string() }),
  outputSchema: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  dependencies: ["validateEmail", "hashPassword", "createUserBase"],
  procedures: ["validateEmail", "hashPassword", "createUserBase"],
  inputMapping: {
    "validateEmail": "input",
    "hashPassword": "input",
    "createUserBase": "input",
  },
  errorHandling: "stop",
});

export const userRegistration = createWorkflowNode({
  name: "userRegistration",
  description: "Полный процесс регистрации пользователя",
  inputSchema: z.object({ name: z.string(), email: z.string(), password: z.string() }),
  outputSchema: z.object({
    user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
    email: z.object({ messageId: z.string(), status: z.string() }),
    event: z.object({ eventId: z.string(), timestamp: z.string() }),
  }),
  dependencies: ["createUser", "sendWelcomeEmail", "trackUserEvent"],
  procedures: ["createUser", "sendWelcomeEmail", "trackUserEvent"],
  inputMapping: {
    "createUser": "input",
    "sendWelcomeEmail": "createUser",
    "trackUserEvent": "createUser",
  },
  errorHandling: "retry",
  retryConfig: { maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2 },
});

export const sendMultiChannelNotification = createInternalProcedure({
  name: "sendMultiChannelNotification",
  description: "Отправка уведомлений по всем каналам",
  inputSchema: z.object({ userId: z.string(), email: z.string(), phone: z.string() }),
  outputSchema: z.object({
    email: z.object({ messageId: z.string(), status: z.string() }),
    sms: z.object({ smsId: z.string(), status: z.string() }),
    notification: z.object({ notificationId: z.string(), status: z.string() }),
  }),
  dependencies: ["sendWelcomeEmail", "sendSMS", "sendNotification"],
  procedures: ["sendWelcomeEmail", "sendSMS", "sendNotification"],
  type: "parallel",
  waitForAll: true,
  errorHandling: "continue",
});

export const createUserProfileConditional = createPrivateProcedure({
  name: "createUserProfileConditional",
  description: "Создание профиля пользователя с условием",
  inputSchema: z.object({ userId: z.string(), userType: z.string() }),
  outputSchema: z.object({ profileId: z.string(), status: z.string() }),
  dependencies: ["createUserProfile"],
  procedures: ["createUserProfile"],
  type: "conditional",
  condition: "input.userType === 'premium'",
  errorHandling: "continue",
});

export const createUserWithFallback = createAPIEndpoint({
  name: "createUserWithFallback",
  description: "Создание пользователя с резервным вариантом",
  inputSchema: z.object({ name: z.string(), email: z.string(), password: z.string() }),
  outputSchema: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  dependencies: ["createUser", "createUserBase"],
  procedures: ["createUser"],
  fallbackProcedure: "createUserBase",
  errorHandling: "fallback",
});

// 3. Регистрируем композиции
registerComposition(registry, createUser);
registerComposition(registry, userRegistration);
registerComposition(registry, sendMultiChannelNotification);

// 4. Выполняем композиции
const result = await executeComposition(registry, "createUser", {
  name: "Алексей Петров",
  email: "alexey@example.com",
  password: "securepassword123",
});
```

### Преимущества
- ✅ Гибкие стратегии композиции
- ✅ Явный контроль видимости
- ✅ Поддержка различных типов выполнения
- ✅ Обработка ошибок и fallback
- ✅ Сохранение трассировки

### Недостатки
- ❌ Сложность для простых случаев
- ❌ Много boilerplate кода
- ❌ Требует понимания различных типов композиции

---

## Решение 4: Пространства имен и категоризация

### Концепция
Организуем процедуры в иерархические пространства имен с контролем видимости и категоризацией.

### Пользовательский путь разработчика

```typescript
// 1. Создаем пространства имен
const userManagementNamespace = createNamespace({
  name: "user-management",
  description: "Управление пользователями",
  version: "1.0.0",
  visibility: "public",
  policies: ["withLogging", "withSpan", "withRetry"],
  metadata: { team: "backend", domain: "user-management" },
});

const analyticsNamespace = createNamespace({
  name: "user-management.analytics",
  description: "Аналитика пользователей",
  version: "1.0.0",
  parent: "user-management",
  visibility: "workflow",
  policies: ["withLogging", "withSpan"],
  metadata: { team: "analytics", domain: "user-management" },
});

// 2. Создаем процедуры с пространствами имен
export const createUser: NamespacedProcedure = {
  contract: createUserContract,
  handler: async (input, context) => {
    // Логика создания пользователя
  },
  namespace: "user-management",
  fullName: "user-management.createUser",
  category: "api",
  visibility: "public",
  tags: ["users", "create", "api"],
  metadata: { version: "1.0.0", author: "tsdev-team" },
  dependencies: ["user-management.validateEmail", "user-management.hashPassword"],
  isExported: true,
};

export const sendWelcomeEmail: NamespacedProcedure = {
  contract: sendWelcomeEmailContract,
  handler: async (input) => {
    // Логика отправки письма
  },
  namespace: "user-management",
  fullName: "user-management.sendWelcomeEmail",
  category: "workflow",
  visibility: "workflow",
  tags: ["email", "welcome", "workflow"],
  metadata: { version: "1.0.0", author: "tsdev-team" },
  dependencies: [],
  isExported: true,
};

export const validateEmail: NamespacedProcedure = {
  contract: validateEmailContract,
  handler: async (input) => {
    // Логика валидации
  },
  namespace: "user-management",
  fullName: "user-management.validateEmail",
  category: "validation",
  visibility: "internal",
  tags: ["validation", "email"],
  metadata: { version: "1.0.0", author: "tsdev-team" },
  dependencies: [],
  isExported: false,
};

export const generateUserId: NamespacedProcedure = {
  contract: {
    name: "generateUserId",
    description: "Генерирует уникальный ID пользователя",
    input: z.object({}),
    output: z.object({ id: z.string() }),
  },
  handler: async () => {
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return { id };
  },
  namespace: "user-management",
  fullName: "user-management.generateUserId",
  category: "utility",
  visibility: "private",
  tags: ["utility", "id-generation"],
  metadata: { version: "1.0.0", author: "tsdev-team" },
  dependencies: [],
  isExported: false,
};

// 3. Регистрируем пространства имен и процедуры
registerNamespace(userManagementNamespace, registry);
registerNamespace(analyticsNamespace, registry);

registerProcedure("user-management", createUser, registry);
registerProcedure("user-management", sendWelcomeEmail, registry);
registerProcedure("user-management", validateEmail, registry);
registerProcedure("user-management", generateUserId, registry);

// 4. Используем поиск и фильтрацию
const userProcedures = searchProcedures(registry, { namespace: "user-management" });
const apiProcedures = searchProcedures(registry, { category: "api" });
const publicProcedures = searchProcedures(registry, { visibility: "public" });
const userTagProcedures = searchProcedures(registry, { tags: ["users"] });

// 5. Выполняем процедуры
const result = await executeProcedure(registry, "user-management.createUser", {
  name: "Алексей Петров",
  email: "alexey@example.com",
  password: "securepassword123",
});
```

### Преимущества
- ✅ Иерархическая организация
- ✅ Гибкая категоризация
- ✅ Мощный поиск и фильтрация
- ✅ Автоматическая интроспекция
- ✅ Поддержка наследования

### Недостатки
- ❌ Сложность для простых случаев
- ❌ Требует понимания пространств имен
- ❌ Может быть избыточным

---

## Сравнение решений

| Критерий | Модули | Аннотации | Композиция | Пространства имен |
|----------|--------|-----------|------------|-------------------|
| **Простота использования** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| **Гибкость** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Производительность** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Трассировка** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Масштабируемость** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **DX** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

## Рекомендации

### Для простых проектов
**Рекомендуется: Аннотации**
- Минимальный boilerplate
- Декларативный подход
- Автоматическая интроспекция

### Для средних проектов
**Рекомендуется: Модули**
- Хорошая организация кода
- Явный контроль видимости
- Простая композиция

### Для сложных проектов
**Рекомендуется: Пространства имен**
- Иерархическая организация
- Мощный поиск и фильтрация
- Поддержка наследования

### Для высокопроизводительных систем
**Рекомендуется: Композиция**
- Гибкие стратегии выполнения
- Оптимизация производительности
- Продвинутая обработка ошибок

## Заключение

Все четыре решения решают основную проблему изоляции процедур с сохранением возможностей трассировки. Выбор зависит от сложности проекта, требований к производительности и предпочтений команды разработки.

**Ключевые принципы:**
1. **Явность** - четкое разделение публичных и приватных процедур
2. **Композиция** - возможность создания сложных процедур из простых
3. **Трассировка** - сохранение возможностей отладки и мониторинга
4. **DX** - удобство использования для разработчиков
5. **Масштабируемость** - возможность роста проекта