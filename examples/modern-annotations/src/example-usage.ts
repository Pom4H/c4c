/**
 * Пример использования современной системы аннотаций
 * 
 * Демонстрирует интеграцию с TypeScript 5.0+ и BiomeJS
 */

import { z } from "zod";
import {
  APIEndpoint,
  WorkflowNode,
  Utility,
  Validation,
  Computation,
  Analytics,
  Visibility,
  Category,
  Tags,
  Policies,
  DependsOn,
  Deprecated,
  Examples,
  Version,
  Author,
  Description,
  BiomeConfig,
  Performance,
  Security,
  Monitoring,
  createModernAnnotatedProcedure,
} from "./decorators.js";
import { checkAllProceduresWithBiome, analyzeCodeQuality } from "./biome-integration.js";

// Контракты
const createUserContract = {
  name: "createUser",
  description: "Создает нового пользователя",
  input: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: z.string(),
  }),
};

const getUserContract = {
  name: "getUser",
  description: "Получает пользователя по ID",
  input: z.object({
    id: z.string(),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: z.string(),
  }),
};

const validateEmailContract = {
  name: "validateEmail",
  description: "Валидирует email адрес",
  input: z.object({
    email: z.string(),
  }),
  output: z.object({
    isValid: z.boolean(),
    domain: z.string().optional(),
  }),
};

const hashPasswordContract = {
  name: "hashPassword",
  description: "Хеширует пароль",
  input: z.object({
    password: z.string(),
  }),
  output: z.object({
    hash: z.string(),
    salt: z.string(),
  }),
};

const sendWelcomeEmailContract = {
  name: "sendWelcomeEmail",
  description: "Отправляет приветственное письмо",
  input: z.object({
    userId: z.string(),
    email: z.string(),
    name: z.string(),
  }),
  output: z.object({
    messageId: z.string(),
    status: z.string(),
  }),
};

const trackUserEventContract = {
  name: "trackUserEvent",
  description: "Отслеживает событие пользователя",
  input: z.object({
    userId: z.string(),
    event: z.string(),
    properties: z.record(z.unknown()).optional(),
  }),
  output: z.object({
    eventId: z.string(),
    timestamp: z.string(),
  }),
};

// Внутреннее хранилище для демо
const users = new Map<string, any>();
const emailValidationCache = new Map<string, boolean>();

/**
 * ПУБЛИЧНЫЙ API эндпоинт: создание пользователя
 * Демонстрирует современные декораторы TypeScript 5.0+
 */
@APIEndpoint("Создает нового пользователя в системе", ["users", "create", "api"])
@Tags("authentication", "registration", "users")
@Policies({
  retry: { maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2 },
  timeout: 30000,
  logging: true,
  tracing: true,
  metrics: true,
})
@DependsOn("validateEmail", "hashPassword")
@Examples({
  input: { name: "Иван Иванов", email: "ivan@example.com", password: "secure123" },
  output: { id: "user_123", name: "Иван Иванов", email: "ivan@example.com", createdAt: "2024-01-01T00:00:00Z" },
  description: "Успешное создание пользователя"
})
@Version("1.0.0")
@Author("tsdev-team")
@Description("Создает нового пользователя с валидацией и хешированием пароля")
@BiomeConfig({
  rules: ["no-unused-vars", "no-console", "use-const"],
  ignore: ["no-explicit-any"],
})
@Performance({
  maxExecutionTime: 5000,
  memoryLimit: 100 * 1024 * 1024, // 100MB
  enableProfiling: true,
})
@Security({
  requireAuth: true,
  rateLimit: { maxRequests: 100, windowMs: 60000 },
  inputValidation: true,
  outputSanitization: true,
})
@Monitoring({
  enableMetrics: true,
  enableLogging: true,
  enableTracing: true,
  customMetrics: ["user_creation_time", "user_creation_success_rate"],
})
export const createUser: ModernAnnotatedProcedure = {
  contract: createUserContract,
  handler: async (input, context) => {
    console.log(`[UserService] Creating user: ${input.email}`);
    
    // Используем внутренние процедуры
    const emailValidation = await validateEmail.handler({ email: input.email }, context);
    if (!emailValidation.isValid) {
      throw new Error("Invalid email address");
    }

    const passwordHash = await hashPassword.handler({ password: input.password }, context);
    
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const user = {
      id,
      name: input.name,
      email: input.email,
      passwordHash: passwordHash.hash,
      salt: passwordHash.salt,
      createdAt: new Date().toISOString(),
    };
    
    users.set(id, user);
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  },
  metadata: {
    visibility: "public",
    category: "api",
    tags: ["users", "create", "api", "authentication", "registration"],
    description: "Создает нового пользователя с валидацией и хешированием пароля",
    version: "1.0.0",
    author: "tsdev-team",
    dependencies: ["validateEmail", "hashPassword"],
    policies: {
      retry: { maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2 },
      timeout: 30000,
      logging: true,
      tracing: true,
      metrics: true,
    },
    examples: [{
      input: { name: "Иван Иванов", email: "ivan@example.com", password: "secure123" },
      output: { id: "user_123", name: "Иван Иванов", email: "ivan@example.com", createdAt: "2024-01-01T00:00:00Z" },
      description: "Успешное создание пользователя"
    }],
    biomeConfig: {
      rules: ["no-unused-vars", "no-console", "use-const"],
      ignore: ["no-explicit-any"],
    },
  },
};

/**
 * ПУБЛИЧНЫЙ API эндпоинт: получение пользователя
 * Демонстрирует кеширование и производительность
 */
@APIEndpoint("Получает информацию о пользователе", ["users", "read", "api"])
@Tags("users", "read", "api")
@Policies({
  cache: { ttl: 300000 }, // 5 минут
  logging: true,
  tracing: true,
})
@Version("1.0.0")
@Author("tsdev-team")
@BiomeConfig({
  rules: ["no-unused-vars", "use-const"],
  ignore: [],
})
@Performance({
  maxExecutionTime: 1000,
  memoryLimit: 50 * 1024 * 1024, // 50MB
  enableProfiling: false,
})
export const getUser: ModernAnnotatedProcedure = {
  contract: getUserContract,
  handler: async (input) => {
    const user = users.get(input.id);
    if (!user) {
      throw new Error(`User with id ${input.id} not found`);
    }
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  },
  metadata: {
    visibility: "public",
    category: "api",
    tags: ["users", "read", "api"],
    description: "Получает информацию о пользователе",
    version: "1.0.0",
    author: "tsdev-team",
    policies: {
      cache: { ttl: 300000 },
      logging: true,
      tracing: true,
    },
    biomeConfig: {
      rules: ["no-unused-vars", "use-const"],
      ignore: [],
    },
  },
};

/**
 * WORKFLOW нода: отправка приветственного письма
 * Демонстрирует воркфлоу-специфичные настройки
 */
@WorkflowNode("Отправляет приветственное письмо новому пользователю", ["email", "welcome", "workflow"])
@Tags("email", "welcome", "workflow")
@Policies({
  retry: { maxAttempts: 5, delayMs: 2000, backoffMultiplier: 1.5 },
  timeout: 60000,
  logging: true,
  tracing: true,
})
@Version("1.0.0")
@Author("tsdev-team")
@BiomeConfig({
  rules: ["no-unused-vars", "no-console"],
  ignore: ["no-explicit-any"],
})
@Performance({
  maxExecutionTime: 10000,
  memoryLimit: 200 * 1024 * 1024, // 200MB
  enableProfiling: true,
})
export const sendWelcomeEmail: ModernAnnotatedProcedure = {
  contract: sendWelcomeEmailContract,
  handler: async (input) => {
    console.log(`[UserService] Sending welcome email to ${input.email}`);
    
    // Имитация отправки письма
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      messageId: `msg_${Date.now()}`,
      status: "sent",
    };
  },
  metadata: {
    visibility: "workflow",
    category: "workflow",
    tags: ["email", "welcome", "workflow"],
    description: "Отправляет приветственное письмо новому пользователю",
    version: "1.0.0",
    author: "tsdev-team",
    policies: {
      retry: { maxAttempts: 5, delayMs: 2000, backoffMultiplier: 1.5 },
      timeout: 60000,
      logging: true,
      tracing: true,
    },
    biomeConfig: {
      rules: ["no-unused-vars", "no-console"],
      ignore: ["no-explicit-any"],
    },
  },
};

/**
 * АНАЛИТИКА: отслеживание событий пользователя
 * Демонстрирует аналитические настройки
 */
@Analytics("Отслеживает события пользователя для аналитики", ["analytics", "tracking", "events"])
@Tags("analytics", "tracking", "events")
@Policies({
  logging: true,
  tracing: true,
  metrics: true,
})
@Version("1.0.0")
@Author("analytics-team")
@BiomeConfig({
  rules: ["no-unused-vars", "use-const"],
  ignore: ["no-explicit-any"],
})
@Performance({
  maxExecutionTime: 2000,
  memoryLimit: 100 * 1024 * 1024, // 100MB
  enableProfiling: false,
})
@Monitoring({
  enableMetrics: true,
  enableLogging: true,
  enableTracing: true,
  customMetrics: ["event_tracking_time", "event_tracking_success_rate"],
})
export const trackUserEvent: ModernAnnotatedProcedure = {
  contract: trackUserEventContract,
  handler: async (input) => {
    console.log(`[UserService] Tracking event: ${input.event} for user ${input.userId}`);
    
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const timestamp = new Date().toISOString();
    
    // Имитация сохранения события
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      eventId,
      timestamp,
    };
  },
  metadata: {
    visibility: "workflow",
    category: "analytics",
    tags: ["analytics", "tracking", "events"],
    description: "Отслеживает события пользователя для аналитики",
    version: "1.0.0",
    author: "analytics-team",
    policies: {
      logging: true,
      tracing: true,
      metrics: true,
    },
    biomeConfig: {
      rules: ["no-unused-vars", "use-const"],
      ignore: ["no-explicit-any"],
    },
  },
};

/**
 * ВАЛИДАЦИЯ: проверка email адреса
 * Демонстрирует приватные процедуры с кешированием
 */
@Validation("Валидирует email адрес", ["validation", "email"])
@Tags("validation", "email")
@Policies({
  cache: { ttl: 3600000 }, // 1 час
  logging: false, // Не логируем валидацию
  tracing: true,
})
@Version("1.0.0")
@Author("tsdev-team")
@BiomeConfig({
  rules: ["no-unused-vars", "use-const"],
  ignore: [],
})
@Performance({
  maxExecutionTime: 500,
  memoryLimit: 10 * 1024 * 1024, // 10MB
  enableProfiling: false,
})
export const validateEmail: ModernAnnotatedProcedure = {
  contract: validateEmailContract,
  handler: async (input) => {
    // Проверяем кеш
    if (emailValidationCache.has(input.email)) {
      return {
        isValid: emailValidationCache.get(input.email)!,
        domain: input.email.split("@")[1],
      };
    }
    
    // Простая валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(input.email);
    
    // Кешируем результат
    emailValidationCache.set(input.email, isValid);
    
    return {
      isValid,
      domain: isValid ? input.email.split("@")[1] : undefined,
    };
  },
  metadata: {
    visibility: "private",
    category: "validation",
    tags: ["validation", "email"],
    description: "Валидирует email адрес",
    version: "1.0.0",
    author: "tsdev-team",
    policies: {
      cache: { ttl: 3600000 },
      logging: false,
      tracing: true,
    },
    biomeConfig: {
      rules: ["no-unused-vars", "use-const"],
      ignore: [],
    },
  },
};

/**
 * ВЫЧИСЛЕНИЯ: хеширование пароля
 * Демонстрирует приватные процедуры с безопасностью
 */
@Computation("Хеширует пароль с солью", ["security", "password", "hash"])
@Tags("security", "password", "hash")
@Policies({
  logging: false, // Не логируем пароли
  tracing: true,
})
@Version("1.0.0")
@Author("security-team")
@BiomeConfig({
  rules: ["no-unused-vars", "use-const"],
  ignore: [],
})
@Performance({
  maxExecutionTime: 1000,
  memoryLimit: 50 * 1024 * 1024, // 50MB
  enableProfiling: false,
})
@Security({
  requireAuth: false,
  inputValidation: true,
  outputSanitization: false,
})
export const hashPassword: ModernAnnotatedProcedure = {
  contract: hashPasswordContract,
  handler: async (input) => {
    // Простое хеширование для демо
    const salt = Math.random().toString(36).substring(7);
    const hash = Buffer.from(input.password + salt).toString("base64");
    
    return {
      hash,
      salt,
    };
  },
  metadata: {
    visibility: "private",
    category: "computation",
    tags: ["security", "password", "hash"],
    description: "Хеширует пароль с солью",
    version: "1.0.0",
    author: "security-team",
    policies: {
      logging: false,
      tracing: true,
    },
    biomeConfig: {
      rules: ["no-unused-vars", "use-const"],
      ignore: [],
    },
  },
};

/**
 * УСТАРЕВШАЯ процедура: старый способ создания пользователя
 * Демонстрирует поддержку устаревших процедур
 */
@Deprecated("Используйте createUser вместо createUserLegacy", "migrate-to-createUser")
@APIEndpoint("Устаревший способ создания пользователя", ["users", "create", "legacy"])
@Tags("users", "create", "legacy", "deprecated")
@Version("0.9.0")
@Author("legacy-team")
@BiomeConfig({
  rules: ["no-unused-vars", "no-console"],
  ignore: ["no-explicit-any", "no-var"],
})
export const createUserLegacy: ModernAnnotatedProcedure = {
  contract: createUserContract,
  handler: async (input) => {
    console.warn("[UserService] Using deprecated createUserLegacy procedure");
    
    // Простая реализация без валидации
    const id = `user_legacy_${Date.now()}`;
    const user = {
      id,
      name: input.name,
      email: input.email,
      createdAt: new Date().toISOString(),
    };
    
    users.set(id, user);
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  },
  metadata: {
    visibility: "public",
    category: "api",
    tags: ["users", "create", "legacy", "deprecated"],
    description: "Устаревший способ создания пользователя",
    version: "0.9.0",
    author: "legacy-team",
    deprecated: true,
    deprecationReason: "Используйте createUser вместо createUserLegacy",
    migrationPath: "migrate-to-createUser",
    biomeConfig: {
      rules: ["no-unused-vars", "no-console"],
      ignore: ["no-explicit-any", "no-var"],
    },
  },
};

/**
 * Демонстрация использования
 */
async function demonstrateModernAnnotations() {
  console.log("🚀 Демонстрация современной системы аннотаций TypeScript + BiomeJS\n");

  // 1. Создаем реестр
  const registry = new Map();
  
  // 2. Регистрируем процедуры
  const procedures = [
    createUser,
    getUser,
    sendWelcomeEmail,
    trackUserEvent,
    validateEmail,
    hashPassword,
    createUserLegacy,
  ];

  for (const procedure of procedures) {
    registry.set(procedure.contract.name, procedure);
  }

  // 3. Демонстрируем метаданные
  console.log("📊 Метаданные процедур:");
  for (const [name, procedure] of registry) {
    console.log(`\n📝 ${name}:`);
    console.log(`  Видимость: ${procedure.metadata.visibility}`);
    console.log(`  Категория: ${procedure.metadata.category}`);
    console.log(`  Теги: ${procedure.metadata.tags.join(", ")}`);
    console.log(`  Версия: ${procedure.metadata.version}`);
    console.log(`  Автор: ${procedure.metadata.author}`);
    if (procedure.metadata.deprecated) {
      console.log(`  ⚠️  Устарела: ${procedure.metadata.deprecationReason}`);
    }
    if (procedure.biomeMetadata) {
      console.log(`  BiomeJS правила: ${procedure.biomeMetadata.rules.join(", ")}`);
    }
  }

  // 4. Демонстрируем проверку BiomeJS
  console.log("\n🔍 Проверка BiomeJS:");
  const biomeResults = await checkAllProceduresWithBiome(registry as any);
  for (const [name, result] of biomeResults) {
    console.log(`\n📋 ${name}:`);
    console.log(`  Прошла проверку: ${result.passed ? "✅" : "❌"}`);
    console.log(`  Ошибки: ${result.errors.length}`);
    console.log(`  Предупреждения: ${result.warnings.length}`);
    console.log(`  Время выполнения: ${result.executionTime}ms`);
  }

  // 5. Демонстрируем анализ качества кода
  console.log("\n📈 Анализ качества кода:");
  const qualityAnalysis = analyzeCodeQuality(registry as any);
  console.log(`  Всего процедур: ${qualityAnalysis.totalProcedures}`);
  console.log(`  Оценка качества: ${qualityAnalysis.qualityScore}/100`);
  console.log(`  Проблемы по категориям:`, qualityAnalysis.issuesByCategory);
  console.log(`  Рекомендации:`);
  qualityAnalysis.recommendations.forEach(rec => console.log(`    - ${rec}`));

  console.log("\n🎉 Демонстрация завершена!");
}

// Запускаем демонстрацию
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateModernAnnotations().catch(console.error);
}

export { demonstrateModernAnnotations };