/**
 * Пример пространства имен для управления пользователями
 * 
 * Демонстрирует иерархическую организацию процедур
 * с различными уровнями видимости
 */

import { z } from "zod";
import type { NamespacedProcedure, ProcedureConfig } from "../types.js";

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

const updateUserContract = {
  name: "updateUser",
  description: "Обновляет данные пользователя",
  input: z.object({
    id: z.string(),
    name: z.string().optional(),
    email: z.string().email().optional(),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    updatedAt: z.string(),
  }),
};

const deleteUserContract = {
  name: "deleteUser",
  description: "Удаляет пользователя",
  input: z.object({
    id: z.string(),
  }),
  output: z.object({
    id: z.string(),
    deleted: z.boolean(),
    deletedAt: z.string(),
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
 * ПУБЛИЧНЫЕ процедуры: API эндпоинты
 */
export const createUser: NamespacedProcedure = {
  contract: createUserContract,
  handler: async (input, context) => {
    console.log(`[UserManagement] Creating user: ${input.email}`);
    
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
  namespace: "user-management",
  fullName: "user-management.createUser",
  category: "api",
  visibility: "public",
  tags: ["users", "create", "api"],
  metadata: {
    version: "1.0.0",
    author: "tsdev-team",
    lastModified: new Date().toISOString(),
  },
  dependencies: ["user-management.validateEmail", "user-management.hashPassword"],
  isExported: true,
};

export const getUser: NamespacedProcedure = {
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
  namespace: "user-management",
  fullName: "user-management.getUser",
  category: "api",
  visibility: "public",
  tags: ["users", "read", "api"],
  metadata: {
    version: "1.0.0",
    author: "tsdev-team",
    lastModified: new Date().toISOString(),
  },
  dependencies: [],
  isExported: true,
};

export const updateUser: NamespacedProcedure = {
  contract: updateUserContract,
  handler: async (input) => {
    const user = users.get(input.id);
    if (!user) {
      throw new Error(`User with id ${input.id} not found`);
    }
    
    if (input.name) user.name = input.name;
    if (input.email) user.email = input.email;
    user.updatedAt = new Date().toISOString();
    
    users.set(input.id, user);
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      updatedAt: user.updatedAt,
    };
  },
  namespace: "user-management",
  fullName: "user-management.updateUser",
  category: "api",
  visibility: "public",
  tags: ["users", "update", "api"],
  metadata: {
    version: "1.0.0",
    author: "tsdev-team",
    lastModified: new Date().toISOString(),
  },
  dependencies: [],
  isExported: true,
};

export const deleteUser: NamespacedProcedure = {
  contract: deleteUserContract,
  handler: async (input) => {
    const user = users.get(input.id);
    if (!user) {
      throw new Error(`User with id ${input.id} not found`);
    }
    
    users.delete(input.id);
    
    return {
      id: input.id,
      deleted: true,
      deletedAt: new Date().toISOString(),
    };
  },
  namespace: "user-management",
  fullName: "user-management.deleteUser",
  category: "api",
  visibility: "public",
  tags: ["users", "delete", "api"],
  metadata: {
    version: "1.0.0",
    author: "tsdev-team",
    lastModified: new Date().toISOString(),
  },
  dependencies: [],
  isExported: true,
};

/**
 * WORKFLOW процедуры: доступны только в воркфлоу
 */
export const sendWelcomeEmail: NamespacedProcedure = {
  contract: sendWelcomeEmailContract,
  handler: async (input) => {
    console.log(`[UserManagement] Sending welcome email to ${input.email}`);
    
    // Имитация отправки письма
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      messageId: `msg_${Date.now()}`,
      status: "sent",
    };
  },
  namespace: "user-management",
  fullName: "user-management.sendWelcomeEmail",
  category: "workflow",
  visibility: "workflow",
  tags: ["email", "welcome", "workflow"],
  metadata: {
    version: "1.0.0",
    author: "tsdev-team",
    lastModified: new Date().toISOString(),
  },
  dependencies: [],
  isExported: true,
};

export const trackUserEvent: NamespacedProcedure = {
  contract: trackUserEventContract,
  handler: async (input) => {
    console.log(`[UserManagement] Tracking event: ${input.event} for user ${input.userId}`);
    
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const timestamp = new Date().toISOString();
    
    // Имитация сохранения события
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return {
      eventId,
      timestamp,
    };
  },
  namespace: "user-management",
  fullName: "user-management.trackUserEvent",
  category: "analytics",
  visibility: "workflow",
  tags: ["analytics", "tracking", "events"],
  metadata: {
    version: "1.0.0",
    author: "analytics-team",
    lastModified: new Date().toISOString(),
  },
  dependencies: [],
  isExported: true,
};

/**
 * ВНУТРЕННИЕ процедуры: только для внутреннего использования
 */
export const validateEmail: NamespacedProcedure = {
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
  namespace: "user-management",
  fullName: "user-management.validateEmail",
  category: "validation",
  visibility: "internal",
  tags: ["validation", "email"],
  metadata: {
    version: "1.0.0",
    author: "tsdev-team",
    lastModified: new Date().toISOString(),
  },
  dependencies: [],
  isExported: false,
};

export const hashPassword: NamespacedProcedure = {
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
  namespace: "user-management",
  fullName: "user-management.hashPassword",
  category: "computation",
  visibility: "internal",
  tags: ["security", "password", "hash"],
  metadata: {
    version: "1.0.0",
    author: "security-team",
    lastModified: new Date().toISOString(),
  },
  dependencies: [],
  isExported: false,
};

/**
 * ПРИВАТНЫЕ процедуры: только для композиции
 */
export const generateUserId: NamespacedProcedure = {
  contract: {
    name: "generateUserId",
    description: "Генерирует уникальный ID пользователя",
    input: z.object({}),
    output: z.object({
      id: z.string(),
    }),
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
  metadata: {
    version: "1.0.0",
    author: "tsdev-team",
    lastModified: new Date().toISOString(),
  },
  dependencies: [],
  isExported: false,
};

export const sanitizeUserData: NamespacedProcedure = {
  contract: {
    name: "sanitizeUserData",
    description: "Очищает данные пользователя",
    input: z.object({
      name: z.string(),
      email: z.string(),
    }),
    output: z.object({
      name: z.string(),
      email: z.string(),
    }),
  },
  handler: async (input) => {
    return {
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
    };
  },
  namespace: "user-management",
  fullName: "user-management.sanitizeUserData",
  category: "transformation",
  visibility: "private",
  tags: ["transformation", "sanitization"],
  metadata: {
    version: "1.0.0",
    author: "tsdev-team",
    lastModified: new Date().toISOString(),
  },
  dependencies: [],
  isExported: false,
};