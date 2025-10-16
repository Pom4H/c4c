/**
 * Декораторы для аннотации процедур
 * 
 * Предоставляют декларативный способ настройки
 * поведения и видимости процедур
 */

import type { 
  AnnotatedProcedure, 
  ProcedureMetadata, 
  ProcedureVisibility, 
  ProcedureCategory,
  ExecutionPolicy,
  AnnotatedRegistry
} from "./types.js";

/**
 * Глобальный реестр для хранения метаданных
 */
const metadataRegistry = new Map<string, ProcedureMetadata>();

/**
 * Декоратор для настройки видимости процедуры
 */
export function Visibility(visibility: ProcedureVisibility) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      visibility,
    });
  };
}

/**
 * Декоратор для настройки категории процедуры
 */
export function Category(category: ProcedureCategory) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      category,
    });
  };
}

/**
 * Декоратор для добавления тегов
 */
export function Tags(...tags: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      tags: [...(existing.tags || []), ...tags],
    });
  };
}

/**
 * Декоратор для настройки политик выполнения
 */
export function Policies(policies: ExecutionPolicy) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      policies,
    });
  };
}

/**
 * Декоратор для настройки зависимостей
 */
export function DependsOn(...dependencies: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      dependencies: [...(existing.dependencies || []), ...dependencies],
    });
  };
}

/**
 * Декоратор для пометки процедуры как устаревшей
 */
export function Deprecated(reason?: string, migrationPath?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      deprecated: true,
      deprecationReason: reason,
      migrationPath,
    });
  };
}

/**
 * Декоратор для добавления примеров использования
 */
export function Examples(...examples: Array<{ input: unknown; output: unknown; description?: string }>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      examples: [...(existing.examples || []), ...examples],
    });
  };
}

/**
 * Декоратор для настройки версии процедуры
 */
export function Version(version: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      version,
    });
  };
}

/**
 * Декоратор для настройки автора процедуры
 */
export function Author(author: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      author,
    });
  };
}

/**
 * Декоратор для настройки описания процедуры
 */
export function Description(description: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      description,
    });
  };
}

/**
 * Композитный декоратор для API эндпоинтов
 */
export function APIEndpoint(description?: string, tags?: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      visibility: "public",
      category: "api",
      description,
      tags: [...(existing.tags || []), ...(tags || [])],
    });
  };
}

/**
 * Композитный декоратор для воркфлоу нод
 */
export function WorkflowNode(description?: string, tags?: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      visibility: "workflow",
      category: "workflow",
      description,
      tags: [...(existing.tags || []), ...(tags || [])],
    });
  };
}

/**
 * Композитный декоратор для утилитарных функций
 */
export function Utility(description?: string, tags?: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      visibility: "internal",
      category: "utility",
      description,
      tags: [...(existing.tags || []), ...(tags || [])],
    });
  };
}

/**
 * Композитный декоратор для валидации
 */
export function Validation(description?: string, tags?: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      visibility: "private",
      category: "validation",
      description,
      tags: [...(existing.tags || []), ...(tags || [])],
    });
  };
}

/**
 * Композитный декоратор для вычислений
 */
export function Computation(description?: string, tags?: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      visibility: "private",
      category: "computation",
      description,
      tags: [...(existing.tags || []), ...(tags || [])],
    });
  };
}

/**
 * Композитный декоратор для аналитики
 */
export function Analytics(description?: string, tags?: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      visibility: "workflow",
      category: "analytics",
      description,
      tags: [...(existing.tags || []), ...(tags || [])],
    });
  };
}

/**
 * Получает метаданные для процедуры
 */
export function getMetadata(procedureName: string): ProcedureMetadata | undefined {
  return metadataRegistry.get(procedureName);
}

/**
 * Получает все метаданные
 */
export function getAllMetadata(): Map<string, ProcedureMetadata> {
  return new Map(metadataRegistry);
}

/**
 * Очищает реестр метаданных
 */
export function clearMetadata(): void {
  metadataRegistry.clear();
}

/**
 * Создает аннотированную процедуру из обычной
 */
export function createAnnotatedProcedure<TInput = unknown, TOutput = unknown>(
  procedure: any,
  procedureName: string
): AnnotatedProcedure<TInput, TOutput> {
  const metadata = metadataRegistry.get(procedureName) || {
    visibility: "public",
    category: "api",
    tags: [],
  };

  return {
    ...procedure,
    metadata: {
      ...metadata,
      createdAt: metadata.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}