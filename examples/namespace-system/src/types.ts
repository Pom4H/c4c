/**
 * Система пространств имен и категоризации
 * 
 * Позволяет организовывать процедуры в иерархические
 * пространства имен с контролем видимости
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
 * Пространство имен
 */
export interface Namespace {
  name: string;
  description?: string;
  version: string;
  parent?: string; // Родительское пространство
  children: string[]; // Дочерние пространства
  procedures: Map<string, NamespacedProcedure>;
  metadata: Record<string, unknown>;
  policies: string[]; // Политики по умолчанию
  visibility: ProcedureVisibility; // Видимость по умолчанию
}

/**
 * Процедура с пространством имен
 */
export interface NamespacedProcedure<TInput = unknown, TOutput = unknown> extends Procedure<TInput, TOutput> {
  namespace: string;
  fullName: string; // Полное имя с пространством имен
  category: ProcedureCategory;
  visibility: ProcedureVisibility;
  tags: string[];
  metadata: Record<string, unknown>;
  dependencies: string[]; // Зависимости от других процедур
  isExported: boolean; // Экспортируется ли из пространства
}

/**
 * Реестр пространств имен
 */
export interface NamespaceRegistry {
  namespaces: Map<string, Namespace>;
  procedures: Map<string, NamespacedProcedure>; // Все процедуры по полному имени
  publicProcedures: Map<string, NamespacedProcedure>; // Публичные процедуры
  workflowProcedures: Map<string, NamespacedProcedure>; // Процедуры для воркфлоу
  internalProcedures: Map<string, NamespacedProcedure>; // Внутренние процедуры
  privateProcedures: Map<string, NamespacedProcedure>; // Приватные процедуры
  byCategory: Map<ProcedureCategory, NamespacedProcedure[]>; // По категориям
  byTag: Map<string, NamespacedProcedure[]>; // По тегам
  hierarchy: Map<string, string[]>; // Иерархия пространств имен
}

/**
 * Контекст выполнения с пространством имен
 */
export interface NamespaceExecutionContext extends ExecutionContext {
  namespace: string;
  namespaceVersion: string;
  category: ProcedureCategory;
  tags: string[];
  parentNamespaces: string[]; // Родительские пространства
  availableProcedures: Map<string, NamespacedProcedure>; // Доступные процедуры
}

/**
 * Результат выполнения процедуры с пространством имен
 */
export interface NamespaceExecutionResult {
  procedure: string;
  namespace: string;
  category: ProcedureCategory;
  visibility: ProcedureVisibility;
  result: unknown;
  executionTime: number;
  dependenciesUsed: string[];
  metadata: Record<string, unknown>;
}

/**
 * Конфигурация пространства имен
 */
export interface NamespaceConfig {
  name: string;
  description?: string;
  version: string;
  parent?: string;
  visibility?: ProcedureVisibility;
  policies?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Конфигурация процедуры в пространстве имен
 */
export interface ProcedureConfig {
  name: string;
  description?: string;
  category: ProcedureCategory;
  visibility?: ProcedureVisibility;
  tags?: string[];
  metadata?: Record<string, unknown>;
  dependencies?: string[];
  isExported?: boolean;
}

/**
 * Результат поиска процедур
 */
export interface ProcedureSearchResult {
  procedures: NamespacedProcedure[];
  total: number;
  namespaces: string[];
  categories: ProcedureCategory[];
  tags: string[];
}

/**
 * Конфигурация поиска
 */
export interface SearchConfig {
  namespace?: string;
  category?: ProcedureCategory;
  visibility?: ProcedureVisibility;
  tags?: string[];
  search?: string;
  includePrivate?: boolean;
  includeInternal?: boolean;
  limit?: number;
  offset?: number;
}