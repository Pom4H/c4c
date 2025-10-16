/**
 * Модуль аналитики
 * 
 * Демонстрирует композицию процедур и различные уровни видимости
 */

import { z } from "zod";
import type { ModularProcedure } from "../types.js";

// Контракты
const trackEventContract = {
  name: "trackEvent",
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

const processEventContract = {
  name: "processEvent",
  description: "Обрабатывает событие для аналитики",
  input: z.object({
    eventId: z.string(),
    userId: z.string(),
    event: z.string(),
    properties: z.record(z.unknown()).optional(),
  }),
  output: z.object({
    processed: z.boolean(),
    insights: z.array(z.string()).optional(),
  }),
};

const storeEventContract = {
  name: "storeEvent",
  description: "Сохраняет событие в хранилище",
  input: z.object({
    eventId: z.string(),
    data: z.record(z.unknown()),
  }),
  output: z.object({
    stored: z.boolean(),
    location: z.string(),
  }),
};

const generateInsightsContract = {
  name: "generateInsights",
  description: "Генерирует инсайты из события",
  input: z.object({
    event: z.string(),
    properties: z.record(z.unknown()).optional(),
  }),
  output: z.object({
    insights: z.array(z.string()),
    confidence: z.number(),
  }),
};

// Внутреннее хранилище для демо
const events = new Map<string, any>();
const insights = new Map<string, string[]>();

/**
 * ПУБЛИЧНАЯ процедура: отслеживание события
 * Доступна как эндпоинт и воркфлоу нода
 */
export const trackEvent: ModularProcedure = {
  contract: trackEventContract,
  handler: async (input, context) => {
    console.log(`[Analytics] Tracking event: ${input.event} for user ${input.userId}`);
    
    const eventId = `event_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const timestamp = new Date().toISOString();
    
    // Используем внутренние процедуры для обработки
    const processed = await processEvent.handler({
      eventId,
      userId: input.userId,
      event: input.event,
      properties: input.properties,
    }, context);
    
    if (processed.processed) {
      // Сохраняем событие
      await storeEvent.handler({
        eventId,
        data: {
          userId: input.userId,
          event: input.event,
          properties: input.properties,
          timestamp,
        },
      }, context);
    }
    
    return {
      eventId,
      timestamp,
    };
  },
  visibility: "public",
  module: "analytics",
  dependencies: ["processEvent", "storeEvent"],
  tags: ["analytics", "tracking"],
};

/**
 * WORKFLOW процедура: обработка события
 * Доступна только в воркфлоу
 */
export const processEvent: ModularProcedure = {
  contract: processEventContract,
  handler: async (input, context) => {
    console.log(`[Analytics] Processing event: ${input.eventId}`);
    
    // Генерируем инсайты
    const insightsResult = await generateInsights.handler({
      event: input.event,
      properties: input.properties,
    }, context);
    
    // Сохраняем инсайты
    if (insightsResult.insights.length > 0) {
      insights.set(input.eventId, insightsResult.insights);
    }
    
    return {
      processed: true,
      insights: insightsResult.insights,
    };
  },
  visibility: "workflow",
  module: "analytics",
  dependencies: ["generateInsights"],
  tags: ["analytics", "processing"],
};

/**
 * ВНУТРЕННЯЯ процедура: сохранение события
 * Доступна только внутри модуля
 */
export const storeEvent: ModularProcedure = {
  contract: storeEventContract,
  handler: async (input) => {
    console.log(`[Analytics] Storing event: ${input.eventId}`);
    
    events.set(input.eventId, input.data);
    
    return {
      stored: true,
      location: `memory://events/${input.eventId}`,
    };
  },
  visibility: "internal",
  module: "analytics",
  tags: ["storage", "events"],
};

/**
 * ПРИВАТНАЯ процедура: генерация инсайтов
 * Доступна только для композиции
 */
export const generateInsights: ModularProcedure = {
  contract: generateInsightsContract,
  handler: async (input) => {
    console.log(`[Analytics] Generating insights for event: ${input.event}`);
    
    // Простая генерация инсайтов для демо
    const insightsList: string[] = [];
    
    if (input.event === "user.signup") {
      insightsList.push("New user acquisition");
      insightsList.push("Potential growth opportunity");
    } else if (input.event === "user.login") {
      insightsList.push("User engagement");
      insightsList.push("Retention indicator");
    } else if (input.event === "purchase.completed") {
      insightsList.push("Revenue generation");
      insightsList.push("Customer conversion");
    }
    
    return {
      insights: insightsList,
      confidence: Math.random() * 0.5 + 0.5, // 0.5-1.0
    };
  },
  visibility: "private",
  module: "analytics",
  tags: ["insights", "ml"],
};