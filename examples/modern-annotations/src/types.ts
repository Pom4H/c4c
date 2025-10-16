/**
 * Современная система аннотаций для TypeScript + BiomeJS
 * 
 * Использует современные возможности TypeScript 5.0+
 * и оптимизирована для BiomeJS
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
 * Категории процедур
 */
export type ProcedureCategory = 
  | "api"           // API эндпоинты
  | "workflow"      // Воркфлоу ноды
  | "utility"       // Утилитарные функции
  | "validation"    // Валидация
  | "transformation" // Преобразование данных
  | "storage"       // Работа с хранилищем
  | "external"      // Внешние сервисы
  | "computation"   // Вычисления
  | "notification"  // Уведомления
  | "analytics";    // Аналитика

/**
 * Политики выполнения
 */
export interface ExecutionPolicy {
  retry?: {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier: number;
  };
  timeout?: number;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  cache?: {
    ttl: number;
    key?: string;
  };
  logging?: boolean;
  tracing?: boolean;
  metrics?: boolean;
}

/**
 * Метаданные процедуры
 */
export interface ProcedureMetadata {
  visibility: ProcedureVisibility;
  category: ProcedureCategory;
  tags: string[];
  description?: string;
  version?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  dependencies?: string[];
  policies?: ExecutionPolicy;
  examples?: Array<{
    input: unknown;
    output: unknown;
    description?: string;
  }>;
  deprecated?: boolean;
  deprecationReason?: string;
  migrationPath?: string;
  biomeConfig?: {
    rules?: string[];
    ignore?: string[];
  };
}

/**
 * Современная аннотированная процедура
 */
export interface ModernAnnotatedProcedure<TInput = unknown, TOutput = unknown> extends Procedure<TInput, TOutput> {
  metadata: ProcedureMetadata;
  biomeMetadata?: {
    rules: string[];
    ignore: string[];
  };
}

/**
 * Конфигурация аннотаций
 */
export interface AnnotationConfig {
  defaultVisibility: ProcedureVisibility;
  defaultCategory: ProcedureCategory;
  enableAutoDiscovery: boolean;
  requireMetadata: boolean;
  validateDependencies: boolean;
  biomeIntegration: boolean;
}

/**
 * Реестр аннотированных процедур
 */
export interface ModernAnnotatedRegistry {
  procedures: Map<string, ModernAnnotatedProcedure>;
  byCategory: Map<ProcedureCategory, ModernAnnotatedProcedure[]>;
  byVisibility: Map<ProcedureVisibility, ModernAnnotatedProcedure[]>;
  byTag: Map<string, ModernAnnotatedProcedure[]>;
  publicProcedures: Map<string, ModernAnnotatedProcedure>;
  workflowProcedures: Map<string, ModernAnnotatedProcedure>;
  internalProcedures: Map<string, ModernAnnotatedProcedure>;
  privateProcedures: Map<string, ModernAnnotatedProcedure>;
  biomeConfig: Map<string, any>; // Конфигурация BiomeJS для каждой процедуры
}

/**
 * Контекст выполнения с метаданными
 */
export interface ModernExecutionContext extends ExecutionContext {
  procedureMetadata: ProcedureMetadata;
  executionPolicies: ExecutionPolicy;
  category: ProcedureCategory;
  tags: string[];
  biomeConfig?: any;
}

/**
 * Результат выполнения аннотированной процедуры
 */
export interface ModernExecutionResult {
  procedure: string;
  category: ProcedureCategory;
  visibility: ProcedureVisibility;
  result: unknown;
  executionTime: number;
  policiesApplied: string[];
  metadata: ProcedureMetadata;
  biomeMetrics?: {
    lintTime?: number;
    formatTime?: number;
    rulesApplied?: string[];
  };
}