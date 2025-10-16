/**
 * Пример сервиса пользователей с композицией
 * 
 * Демонстрирует создание сложных процедур из простых
 * с различными стратегиями выполнения
 */

import { z } from "zod";
import {
  createAPIEndpoint,
  createWorkflowNode,
  createInternalProcedure,
  createPrivateProcedure,
  createSequentialWrapper,
  createParallelWrapper,
  createConditionalWrapper,
  createRetryWrapper,
  createFallbackWrapper,
} from "../wrapper-functions.js";

// Базовые процедуры
const createUserBase = {
  name: "createUserBase",
  description: "Базовая процедура создания пользователя",
  input: z.object({
    name: z.string(),
    email: z.string(),
    password: z.string(),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: z.string(),
  }),
  handler: async (input: any) => {
    console.log(`[UserService] Creating user: ${input.email}`);
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    return {
      id,
      name: input.name,
      email: input.email,
      createdAt: new Date().toISOString(),
    };
  },
};

const validateEmail = {
  name: "validateEmail",
  description: "Валидация email адреса",
  input: z.object({
    email: z.string(),
  }),
  output: z.object({
    isValid: z.boolean(),
    domain: z.string().optional(),
  }),
  handler: async (input: any) => {
    console.log(`[UserService] Validating email: ${input.email}`);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(input.email);
    return {
      isValid,
      domain: isValid ? input.email.split("@")[1] : undefined,
    };
  },
};

const hashPassword = {
  name: "hashPassword",
  description: "Хеширование пароля",
  input: z.object({
    password: z.string(),
  }),
  output: z.object({
    hash: z.string(),
    salt: z.string(),
  }),
  handler: async (input: any) => {
    console.log(`[UserService] Hashing password`);
    const salt = Math.random().toString(36).substring(7);
    const hash = Buffer.from(input.password + salt).toString("base64");
    return { hash, salt };
  },
};

const sendWelcomeEmail = {
  name: "sendWelcomeEmail",
  description: "Отправка приветственного письма",
  input: z.object({
    userId: z.string(),
    email: z.string(),
    name: z.string(),
  }),
  output: z.object({
    messageId: z.string(),
    status: z.string(),
  }),
  handler: async (input: any) => {
    console.log(`[UserService] Sending welcome email to ${input.email}`);
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      messageId: `msg_${Date.now()}`,
      status: "sent",
    };
  },
};

const trackUserEvent = {
  name: "trackUserEvent",
  description: "Отслеживание события пользователя",
  input: z.object({
    userId: z.string(),
    event: z.string(),
    properties: z.record(z.unknown()).optional(),
  }),
  output: z.object({
    eventId: z.string(),
    timestamp: z.string(),
  }),
  handler: async (input: any) => {
    console.log(`[UserService] Tracking event: ${input.event}`);
    return {
      eventId: `event_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  },
};

const sendNotification = {
  name: "sendNotification",
  description: "Отправка уведомления",
  input: z.object({
    userId: z.string(),
    type: z.string(),
    message: z.string(),
  }),
  output: z.object({
    notificationId: z.string(),
    status: z.string(),
  }),
  handler: async (input: any) => {
    console.log(`[UserService] Sending notification: ${input.type}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    return {
      notificationId: `notif_${Date.now()}`,
      status: "sent",
    };
  },
};

const createUserProfile = {
  name: "createUserProfile",
  description: "Создание профиля пользователя",
  input: z.object({
    userId: z.string(),
    preferences: z.record(z.unknown()).optional(),
  }),
  output: z.object({
    profileId: z.string(),
    status: z.string(),
  }),
  handler: async (input: any) => {
    console.log(`[UserService] Creating profile for user: ${input.userId}`);
    return {
      profileId: `profile_${input.userId}`,
      status: "created",
    };
  },
};

const sendSMS = {
  name: "sendSMS",
  description: "Отправка SMS",
  input: z.object({
    phone: z.string(),
    message: z.string(),
  }),
  output: z.object({
    smsId: z.string(),
    status: z.string(),
  }),
  handler: async (input: any) => {
    console.log(`[UserService] Sending SMS to ${input.phone}`);
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      smsId: `sms_${Date.now()}`,
      status: "sent",
    };
  },
};

// Композиции

/**
 * ПУБЛИЧНЫЙ API эндпоинт: создание пользователя
 * Последовательное выполнение: валидация → хеширование → создание
 */
export const createUser = createAPIEndpoint({
  name: "createUser",
  description: "Создание пользователя с валидацией и хешированием",
  inputSchema: z.object({
    name: z.string(),
    email: z.string(),
    password: z.string(),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: z.string(),
  }),
  dependencies: ["validateEmail", "hashPassword", "createUserBase"],
  procedures: ["validateEmail", "hashPassword", "createUserBase"],
  inputMapping: {
    "validateEmail": "input",
    "hashPassword": "input",
    "createUserBase": "input",
  },
  errorHandling: "stop",
});

/**
 * WORKFLOW нода: полный процесс регистрации
 * Последовательное выполнение с обработкой ошибок
 */
export const userRegistration = createWorkflowNode({
  name: "userRegistration",
  description: "Полный процесс регистрации пользователя",
  inputSchema: z.object({
    name: z.string(),
    email: z.string(),
    password: z.string(),
  }),
  outputSchema: z.object({
    user: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      createdAt: z.string(),
    }),
    email: z.object({
      messageId: z.string(),
      status: z.string(),
    }),
    event: z.object({
      eventId: z.string(),
      timestamp: z.string(),
    }),
  }),
  dependencies: ["createUser", "sendWelcomeEmail", "trackUserEvent"],
  procedures: ["createUser", "sendWelcomeEmail", "trackUserEvent"],
  inputMapping: {
    "createUser": "input",
    "sendWelcomeEmail": "createUser",
    "trackUserEvent": "createUser",
  },
  errorHandling: "retry",
  retryConfig: {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
  },
});

/**
 * ВНУТРЕННЯЯ процедура: параллельная отправка уведомлений
 * Параллельное выполнение: email + SMS + push
 */
export const sendMultiChannelNotification = createInternalProcedure({
  name: "sendMultiChannelNotification",
  description: "Отправка уведомлений по всем каналам",
  inputSchema: z.object({
    userId: z.string(),
    email: z.string(),
    phone: z.string(),
    message: z.string(),
  }),
  outputSchema: z.object({
    email: z.object({
      messageId: z.string(),
      status: z.string(),
    }),
    sms: z.object({
      smsId: z.string(),
      status: z.string(),
    }),
    notification: z.object({
      notificationId: z.string(),
      status: z.string(),
    }),
  }),
  dependencies: ["sendWelcomeEmail", "sendSMS", "sendNotification"],
  procedures: ["sendWelcomeEmail", "sendSMS", "sendNotification"],
  type: "parallel",
  waitForAll: true,
  errorHandling: "continue",
});

/**
 * ПРИВАТНАЯ процедура: условное создание профиля
 * Условное выполнение на основе типа пользователя
 */
export const createUserProfileConditional = createPrivateProcedure({
  name: "createUserProfileConditional",
  description: "Создание профиля пользователя с условием",
  inputSchema: z.object({
    userId: z.string(),
    userType: z.string(),
    preferences: z.record(z.unknown()).optional(),
  }),
  outputSchema: z.object({
    profileId: z.string(),
    status: z.string(),
  }),
  dependencies: ["createUserProfile"],
  procedures: ["createUserProfile"],
  type: "conditional",
  condition: "input.userType === 'premium'",
  errorHandling: "continue",
});

/**
 * ПУБЛИЧНЫЙ API эндпоинт: регистрация с резервным вариантом
 * Fallback на упрощенную регистрацию при ошибке
 */
export const createUserWithFallback = createAPIEndpoint({
  name: "createUserWithFallback",
  description: "Создание пользователя с резервным вариантом",
  inputSchema: z.object({
    name: z.string(),
    email: z.string(),
    password: z.string(),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: z.string(),
  }),
  dependencies: ["createUser", "createUserBase"],
  procedures: ["createUser"],
  fallbackProcedure: "createUserBase",
  errorHandling: "fallback",
});

/**
 * WORKFLOW нода: комплексная регистрация
 * Последовательное выполнение с параллельными этапами
 */
export const comprehensiveUserRegistration = createWorkflowNode({
  name: "comprehensiveUserRegistration",
  description: "Комплексная регистрация пользователя",
  inputSchema: z.object({
    name: z.string(),
    email: z.string(),
    password: z.string(),
    phone: z.string().optional(),
  }),
  outputSchema: z.object({
    user: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      createdAt: z.string(),
    }),
    communications: z.object({
      email: z.object({
        messageId: z.string(),
        status: z.string(),
      }),
      sms: z.object({
        smsId: z.string(),
        status: z.string(),
      }),
      notification: z.object({
        notificationId: z.string(),
        status: z.string(),
      }),
    }),
    analytics: z.object({
      eventId: z.string(),
      timestamp: z.string(),
    }),
  }),
  dependencies: ["createUser", "sendMultiChannelNotification", "trackUserEvent"],
  procedures: ["createUser", "sendMultiChannelNotification", "trackUserEvent"],
  inputMapping: {
    "createUser": "input",
    "sendMultiChannelNotification": "createUser",
    "trackUserEvent": "createUser",
  },
  errorHandling: "retry",
  retryConfig: {
    maxAttempts: 2,
    delayMs: 500,
    backoffMultiplier: 1.5,
  },
});

/**
 * ВНУТРЕННЯЯ процедура: валидация с повторными попытками
 * Retry при временных ошибках валидации
 */
export const validateEmailWithRetry = createInternalProcedure({
  name: "validateEmailWithRetry",
  description: "Валидация email с повторными попытками",
  inputSchema: z.object({
    email: z.string(),
  }),
  outputSchema: z.object({
    isValid: z.boolean(),
    domain: z.string().optional(),
  }),
  dependencies: ["validateEmail"],
  procedures: ["validateEmail"],
  type: "retry",
  retryConfig: {
    maxAttempts: 3,
    delayMs: 500,
    backoffMultiplier: 2,
  },
});

/**
 * ПРИВАТНАЯ процедура: последовательная обработка данных
 * Последовательное выполнение с маппингом данных
 */
export const processUserData = createPrivateProcedure({
  name: "processUserData",
  description: "Обработка данных пользователя",
  inputSchema: z.object({
    rawData: z.record(z.unknown()),
  }),
  outputSchema: z.object({
    processedData: z.record(z.unknown()),
    validationResults: z.object({
      isValid: z.boolean(),
      domain: z.string().optional(),
    }),
    hash: z.object({
      hash: z.string(),
      salt: z.string(),
    }),
  }),
  dependencies: ["validateEmail", "hashPassword"],
  procedures: ["validateEmail", "hashPassword"],
  inputMapping: {
    "validateEmail": "input.rawData",
    "hashPassword": "input.rawData",
  },
  outputMapping: {
    "processedData": "input.rawData",
    "validationResults": "validateEmail",
    "hash": "hashPassword",
  },
  errorHandling: "stop",
});

// Экспортируем базовые процедуры для использования в композициях
export const baseProcedures = {
  createUserBase,
  validateEmail,
  hashPassword,
  sendWelcomeEmail,
  trackUserEvent,
  sendNotification,
  createUserProfile,
  sendSMS,
};