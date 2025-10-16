/**
 * Модуль управления пользователями
 * 
 * Демонстрирует различные уровни видимости процедур:
 * - public: доступны как эндпоинты и воркфлоу ноды
 * - workflow: доступны только в воркфлоу
 * - internal: только для внутреннего использования
 * - private: только для композиции
 */

import { z } from "zod";
import type { ModularProcedure } from "../types.js";

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

// Внутреннее хранилище для демо
const users = new Map<string, any>();
const emailValidationCache = new Map<string, boolean>();

/**
 * ПУБЛИЧНАЯ процедура: создание пользователя
 * Доступна как эндпоинт и воркфлоу нода
 */
export const createUser: ModularProcedure = {
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
    
    // Отправляем приветственное письмо (только в воркфлоу)
    if (context.transport === "workflow") {
      await sendWelcomeEmail.handler({
        userId: id,
        email: input.email,
        name: input.name,
      }, context);
    }
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  },
  visibility: "public",
  module: "user-management",
  dependencies: ["validateEmail", "hashPassword"],
  tags: ["users", "create"],
};

/**
 * ПУБЛИЧНАЯ процедура: получение пользователя
 * Доступна как эндпоинт и воркфлоу нода
 */
export const getUser: ModularProcedure = {
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
  visibility: "public",
  module: "user-management",
  tags: ["users", "read"],
};

/**
 * WORKFLOW процедура: отправка приветственного письма
 * Доступна только в воркфлоу, не как эндпоинт
 */
export const sendWelcomeEmail: ModularProcedure = {
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
  visibility: "workflow",
  module: "user-management",
  tags: ["email", "welcome"],
};

/**
 * ВНУТРЕННЯЯ процедура: валидация email
 * Доступна только внутри модуля
 */
export const validateEmail: ModularProcedure = {
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
  visibility: "internal",
  module: "user-management",
  tags: ["validation", "email"],
};

/**
 * ПРИВАТНАЯ процедура: хеширование пароля
 * Доступна только для композиции
 */
export const hashPassword: ModularProcedure = {
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
  visibility: "private",
  module: "user-management",
  tags: ["security", "password"],
};