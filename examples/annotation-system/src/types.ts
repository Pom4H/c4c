/**
 * Система аннотаций для контроля видимости процедур
 * 
 * Использует декораторы и метаданные для определения
 * уровня доступа и поведения процедур
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
 * Категории процедур для группировки
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
}

/**
 * Метаданные процедуры
 */
export interface ProcedureMetadata {
  visibility: ProcedureVisibility;
  category: ProcedureCategory;
  tags?: string[];
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
}

/**
 * Аннотированная процедура
 */
export interface AnnotatedProcedure<TInput = unknown, TOutput = unknown> extends Procedure<TInput, TOutput> {
  metadata: ProcedureMetadata;
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
}

/**
 * Реестр аннотированных процедур
 */
export interface AnnotatedRegistry {
  procedures: Map<string, AnnotatedProcedure>;
  byCategory: Map<ProcedureCategory, AnnotatedProcedure[]>;
  byVisibility: Map<ProcedureVisibility, AnnotatedProcedure[]>;
  byTag: Map<string, AnnotatedProcedure[]>;
  publicProcedures: Map<string, AnnotatedProcedure>;
  workflowProcedures: Map<string, AnnotatedProcedure>;
  internalProcedures: Map<string, AnnotatedProcedure>;
  privateProcedures: Map<string, AnnotatedProcedure>;
}

/**
 * Контекст выполнения с метаданными
 */
export interface AnnotatedExecutionContext extends ExecutionContext {
  procedureMetadata: ProcedureMetadata;
  executionPolicies: ExecutionPolicy;
  category: ProcedureCategory;
  tags: string[];
}

/**
 * Результат выполнения аннотированной процедуры
 */
export interface AnnotatedExecutionResult {
  procedure: string;
  category: ProcedureCategory;
  visibility: ProcedureVisibility;
  result: unknown;
  executionTime: number;
  policiesApplied: string[];
  metadata: ProcedureMetadata;
}