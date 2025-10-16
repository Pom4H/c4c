/**
 * Система композиции через функции-обертки
 * 
 * Позволяет создавать сложные процедуры из простых
 * с явным контролем видимости и зависимостей
 */

import type { z } from "zod";
import type { Procedure, Contract, Handler, ExecutionContext } from "@tsdev/core";

/**
 * Уровни видимости процедур
 */
export type ProcedureVisibility = 
  | "public"    // Доступна как эндпоинт и воркфлоу нода
  | "workflow"  // Доступна только в воркфлоу
  | "internal"  // Только для внутреннего использования
  | "private";  // Полностью приватная

/**
 * Тип композиции процедур
 */
export type CompositionType = 
  | "sequential"  // Последовательное выполнение
  | "parallel"    // Параллельное выполнение
  | "conditional" // Условное выполнение
  | "retry"       // С повторными попытками
  | "fallback";   // С резервным вариантом

/**
 * Конфигурация композиции
 */
export interface CompositionConfig {
  name: string;
  description?: string;
  type: CompositionType;
  visibility: ProcedureVisibility;
  procedures: string[]; // Имена процедур для композиции
  inputMapping?: Record<string, string>; // Маппинг входных данных
  outputMapping?: Record<string, string>; // Маппинг выходных данных
  errorHandling?: "stop" | "continue" | "retry" | "fallback";
  retryConfig?: {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier: number;
  };
  fallbackProcedure?: string; // Процедура для fallback
  condition?: string; // JavaScript выражение для условного выполнения
  parallelConfig?: {
    waitForAll: boolean;
    maxConcurrency?: number;
  };
}

/**
 * Композиционная процедура
 */
export interface ComposedProcedure<TInput = unknown, TOutput = unknown> extends Procedure<TInput, TOutput> {
  config: CompositionConfig;
  dependencies: Map<string, Procedure>; // Зависимости
  isComposed: true;
}

/**
 * Функция-обертка для создания композиций
 */
export type CompositionWrapper = <TInput, TOutput>(
  config: CompositionConfig,
  procedures: Map<string, Procedure>
) => ComposedProcedure<TInput, TOutput>;

/**
 * Реестр композиций
 */
export interface CompositionRegistry {
  procedures: Map<string, Procedure>;
  composedProcedures: Map<string, ComposedProcedure>;
  publicProcedures: Map<string, Procedure>;
  workflowProcedures: Map<string, Procedure>;
  internalProcedures: Map<string, Procedure>;
  privateProcedures: Map<string, Procedure>;
  compositions: Map<string, CompositionConfig>;
}

/**
 * Контекст выполнения композиции
 */
export interface CompositionExecutionContext extends ExecutionContext {
  composition: string;
  compositionType: CompositionType;
  currentStep: number;
  totalSteps: number;
  stepResults: Map<string, unknown>;
  dependencies: Map<string, Procedure>;
}

/**
 * Результат выполнения композиции
 */
export interface CompositionExecutionResult {
  composition: string;
  type: CompositionType;
  result: unknown;
  executionTime: number;
  stepsExecuted: string[];
  stepResults: Record<string, unknown>;
  errors: Array<{
    step: string;
    error: string;
    timestamp: number;
  }>;
}

/**
 * Конфигурация функции-обертки
 */
export interface WrapperConfig {
  name: string;
  description?: string;
  visibility: ProcedureVisibility;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  dependencies: string[];
  composition: CompositionConfig;
}

/**
 * Функция-обертка с метаданными
 */
export interface WrappedFunction<TInput = unknown, TOutput = unknown> {
  config: WrapperConfig;
  execute: (input: TInput, context: CompositionExecutionContext) => Promise<TOutput>;
  dependencies: Map<string, Procedure>;
  isWrapper: true;
}

/**
 * Реестр функций-оберток
 */
export interface WrapperRegistry {
  wrappers: Map<string, WrappedFunction>;
  procedures: Map<string, Procedure>;
  publicProcedures: Map<string, Procedure>;
  workflowProcedures: Map<string, Procedure>;
  internalProcedures: Map<string, Procedure>;
  privateProcedures: Map<string, Procedure>;
}