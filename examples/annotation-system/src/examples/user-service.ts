/**
 * Пример сервиса пользователей с аннотациями
 * 
 * Демонстрирует различные декораторы для настройки
 * поведения и видимости процедур
 */

import { z } from "zod";
import type { AnnotatedProcedure } from "../types.js";
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
  Description
} from "../decorators.js";

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

const calculateUserScoreContract = {
  name: "calculateUserScore",
  description: "Вычисляет рейтинг пользователя",
  input: z.object({
    userId: z.string(),
    activities: z.array(z.object({
      type: z.string(),
      value: z.number(),
      timestamp: z.string(),
    })),
  }),
  output: z.object({
    score: z.number(),
    level: z.string(),
    nextLevelThreshold: z.number(),
  }),
};

// Внутреннее хранилище для демо
const users = new Map<string, any>();
const emailValidationCache = new Map<string, boolean>();

/**
 * ПУБЛИЧНЫЙ API эндпоинт: создание пользователя
 * Доступен как HTTP эндпоинт и воркфлоу нода
 */
@APIEndpoint("Создает нового пользователя в системе", ["users", "create", "api"])
@Tags("authentication", "registration")
@Policies({
  retry: { maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2 },
  timeout: 30000,
  logging: true,
  tracing: true,
})
@DependsOn("validateEmail", "hashPassword")
@Examples(
  {
    input: { name: "Иван Иванов", email: "ivan@example.com", password: "secure123" },
    output: { id: "user_123", name: "Иван Иванов", email: "ivan@example.com", createdAt: "2024-01-01T00:00:00Z" },
    description: "Успешное создание пользователя"
  }
)
@Version("1.0.0")
@Author("tsdev-team")
export const createUser: AnnotatedProcedure = {
  contract: createUserContract,
  handler: async (input, context) => {
    console.log(`[UserService] Creating user: ${input.email}`);
    
    // Используем внутренние процедуры для валидации и хеширования
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
    description: "Создает нового пользователя в системе",
    version: "1.0.0",
    author: "tsdev-team",
    dependencies: ["validateEmail", "hashPassword"],
    policies: {
      retry: { maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2 },
      timeout: 30000,
      logging: true,
      tracing: true,
    },
    examples: [
      {
        input: { name: "Иван Иванов", email: "ivan@example.com", password: "secure123" },
        output: { id: "user_123", name: "Иван Иванов", email: "ivan@example.com", createdAt: "2024-01-01T00:00:00Z" },
        description: "Успешное создание пользователя"
      }
    ],
  },
};

/**
 * ПУБЛИЧНЫЙ API эндпоинт: получение пользователя
 * Доступен как HTTP эндпоинт и воркфлоу нода
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
export const getUser: AnnotatedProcedure = {
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
  },
};

/**
 * WORKFLOW нода: отправка приветственного письма
 * Доступна только в воркфлоу, не как HTTP эндпоинт
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
export const sendWelcomeEmail: AnnotatedProcedure = {
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
  },
};

/**
 * АНАЛИТИКА: отслеживание событий пользователя
 * Доступна только в воркфлоу
 */
@Analytics("Отслеживает события пользователя для аналитики", ["analytics", "tracking", "events"])
@Tags("analytics", "tracking", "events")
@Policies({
  logging: true,
  tracing: true,
})
@Version("1.0.0")
@Author("analytics-team")
export const trackUserEvent: AnnotatedProcedure = {
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
    },
  },
};

/**
 * ВАЛИДАЦИЯ: проверка email адреса
 * Приватная процедура для внутреннего использования
 */
@Validation("Валидирует email адрес", ["validation", "email"])
@Tags("validation", "email")
@Policies({
  cache: { ttl: 3600000 }, // 1 час
})
@Version("1.0.0")
@Author("tsdev-team")
export const validateEmail: AnnotatedProcedure = {
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
    },
  },
};

/**
 * ВЫЧИСЛЕНИЯ: хеширование пароля
 * Приватная процедура для внутреннего использования
 */
@Computation("Хеширует пароль с солью", ["security", "password", "hash"])
@Tags("security", "password", "hash")
@Policies({
  logging: false, // Не логируем пароли
  tracing: true,
})
@Version("1.0.0")
@Author("security-team")
export const hashPassword: AnnotatedProcedure = {
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
  },
};

/**
 * ВЫЧИСЛЕНИЯ: расчет рейтинга пользователя
 * Приватная процедура для внутреннего использования
 */
@Computation("Вычисляет рейтинг пользователя на основе активности", ["computation", "scoring", "analytics"])
@Tags("computation", "scoring", "analytics")
@Policies({
  logging: true,
  tracing: true,
})
@Version("1.0.0")
@Author("analytics-team")
export const calculateUserScore: AnnotatedProcedure = {
  contract: calculateUserScoreContract,
  handler: async (input) => {
    console.log(`[UserService] Calculating score for user ${input.userId}`);
    
    // Простой алгоритм расчета рейтинга
    let totalScore = 0;
    for (const activity of input.activities) {
      switch (activity.type) {
        case "login":
          totalScore += 1;
          break;
        case "purchase":
          totalScore += activity.value * 0.1;
          break;
        case "review":
          totalScore += 2;
          break;
        case "referral":
          totalScore += 5;
          break;
      }
    }
    
    // Определяем уровень
    let level = "bronze";
    let nextLevelThreshold = 100;
    
    if (totalScore >= 1000) {
      level = "platinum";
      nextLevelThreshold = 2000;
    } else if (totalScore >= 500) {
      level = "gold";
      nextLevelThreshold = 1000;
    } else if (totalScore >= 100) {
      level = "silver";
      nextLevelThreshold = 500;
    }
    
    return {
      score: Math.round(totalScore),
      level,
      nextLevelThreshold,
    };
  },
  metadata: {
    visibility: "private",
    category: "computation",
    tags: ["computation", "scoring", "analytics"],
    description: "Вычисляет рейтинг пользователя на основе активности",
    version: "1.0.0",
    author: "analytics-team",
    policies: {
      logging: true,
      tracing: true,
    },
  },
};

/**
 * УСТАРЕВШАЯ процедура: старый способ создания пользователя
 * Помечена как устаревшая с указанием пути миграции
 */
@Deprecated("Используйте createUser вместо createUserLegacy", "migrate-to-createUser")
@APIEndpoint("Устаревший способ создания пользователя", ["users", "create", "legacy"])
@Tags("users", "create", "legacy", "deprecated")
@Version("0.9.0")
@Author("legacy-team")
export const createUserLegacy: AnnotatedProcedure = {
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
  },
};