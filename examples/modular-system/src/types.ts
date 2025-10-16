/**
 * Модульная система для изоляции процедур
 * 
 * Позволяет создавать модули с приватными и публичными процедурами
 * Сохраняет возможности трассировки и композиции
 */

import type { z } from "zod";
import type { Procedure, Contract, Handler, ExecutionContext } from "@tsdev/core";

/**
 * Уровни видимости процедур
 */
export type ProcedureVisibility = 
  | "public"    // Доступна как эндпоинт и воркфлоу нода
  | "workflow"  // Доступна только в воркфлоу
  | "internal"  // Только для внутреннего использования в модуле
  | "private";  // Полностью приватная (только для композиции)

/**
 * Метаданные процедуры с контролем видимости
 */
export interface ModularProcedure<TInput = unknown, TOutput = unknown> extends Procedure<TInput, TOutput> {
  visibility: ProcedureVisibility;
  module: string;
  dependencies?: string[]; // Зависимости от других процедур
  tags?: string[]; // Теги для группировки
}

/**
 * Конфигурация модуля
 */
export interface ModuleConfig {
  name: string;
  description?: string;
  version: string;
  namespace?: string; // Префикс для всех процедур модуля
  dependencies?: string[]; // Зависимости от других модулей
  policies?: string[]; // Политики по умолчанию для модуля
}

/**
 * Модуль - контейнер для связанных процедур
 */
export interface Module {
  config: ModuleConfig;
  procedures: Map<string, ModularProcedure>;
  privateProcedures: Map<string, ModularProcedure>; // Внутренние процедуры
}

/**
 * Реестр модулей
 */
export interface ModuleRegistry {
  modules: Map<string, Module>;
  publicProcedures: Map<string, ModularProcedure>; // Только публичные
  workflowProcedures: Map<string, ModularProcedure>; // Публичные + workflow
  allProcedures: Map<string, ModularProcedure>; // Все процедуры
}

/**
 * Контекст выполнения модуля
 */
export interface ModuleExecutionContext extends ExecutionContext {
  module: string;
  moduleVersion: string;
  dependencies: Map<string, ModularProcedure>; // Доступные зависимости
}

/**
 * Результат выполнения модуля
 */
export interface ModuleExecutionResult {
  module: string;
  procedure: string;
  result: unknown;
  executionTime: number;
  dependenciesUsed: string[];
}

/**
 * Конфигурация композиции процедур
 */
export interface CompositionConfig {
  name: string;
  description?: string;
  procedures: string[]; // Порядок выполнения
  inputMapping?: Record<string, string>; // Маппинг входных данных
  outputMapping?: Record<string, string>; // Маппинг выходных данных
  errorHandling?: "stop" | "continue" | "retry";
  retryConfig?: {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier: number;
  };
}

/**
 * Композиция процедур - способ объединения нескольких процедур
 */
export interface ProcedureComposition {
  config: CompositionConfig;
  execute: (input: unknown, context: ModuleExecutionContext) => Promise<unknown>;
}