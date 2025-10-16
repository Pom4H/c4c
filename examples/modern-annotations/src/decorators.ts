/**
 * Современные декораторы для TypeScript + BiomeJS
 * 
 * Использует современные возможности TypeScript 5.0+
 * и интегрирован с BiomeJS
 */

import type { 
  ModernAnnotatedProcedure, 
  ProcedureMetadata, 
  ProcedureVisibility, 
  ProcedureCategory,
  ExecutionPolicy,
  ModernAnnotatedRegistry
} from "./types.js";

// Глобальный реестр для хранения метаданных
const metadataRegistry = new Map<string, ProcedureMetadata>();
const biomeConfigRegistry = new Map<string, any>();

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
 * Декоратор для настройки конфигурации BiomeJS
 */
export function BiomeConfig(config: { rules?: string[]; ignore?: string[] }) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    biomeConfigRegistry.set(propertyKey, config);
    
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      biomeConfig: {
        rules: config.rules || [],
        ignore: config.ignore || [],
      },
    });
  };
}

/**
 * Композитный декоратор для API эндпоинтов
 */
export function APIEndpoint(description?: string, tags?: string[], policies?: ExecutionPolicy) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      visibility: "public",
      category: "api",
      description,
      tags: [...(existing.tags || []), ...(tags || [])],
      policies: policies || existing.policies,
    });
  };
}

/**
 * Композитный декоратор для воркфлоу нод
 */
export function WorkflowNode(description?: string, tags?: string[], policies?: ExecutionPolicy) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      visibility: "workflow",
      category: "workflow",
      description,
      tags: [...(existing.tags || []), ...(tags || [])],
      policies: policies || existing.policies,
    });
  };
}

/**
 * Композитный декоратор для утилитарных функций
 */
export function Utility(description?: string, tags?: string[], policies?: ExecutionPolicy) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      visibility: "internal",
      category: "utility",
      description,
      tags: [...(existing.tags || []), ...(tags || [])],
      policies: policies || existing.policies,
    });
  };
}

/**
 * Композитный декоратор для валидации
 */
export function Validation(description?: string, tags?: string[], policies?: ExecutionPolicy) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      visibility: "private",
      category: "validation",
      description,
      tags: [...(existing.tags || []), ...(tags || [])],
      policies: policies || existing.policies,
    });
  };
}

/**
 * Композитный декоратор для вычислений
 */
export function Computation(description?: string, tags?: string[], policies?: ExecutionPolicy) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      visibility: "private",
      category: "computation",
      description,
      tags: [...(existing.tags || []), ...(tags || [])],
      policies: policies || existing.policies,
    });
  };
}

/**
 * Композитный декоратор для аналитики
 */
export function Analytics(description?: string, tags?: string[], policies?: ExecutionPolicy) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      visibility: "workflow",
      category: "analytics",
      description,
      tags: [...(existing.tags || []), ...(tags || [])],
      policies: policies || existing.policies,
    });
  };
}

/**
 * Декоратор для настройки производительности
 */
export function Performance(config: { 
  maxExecutionTime?: number; 
  memoryLimit?: number; 
  cpuLimit?: number;
  enableProfiling?: boolean;
}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      policies: {
        ...existing.policies,
        timeout: config.maxExecutionTime,
        profiling: config.enableProfiling,
        memoryLimit: config.memoryLimit,
        cpuLimit: config.cpuLimit,
      },
    });
  };
}

/**
 * Декоратор для настройки безопасности
 */
export function Security(config: {
  requireAuth?: boolean;
  rateLimit?: { maxRequests: number; windowMs: number };
  inputValidation?: boolean;
  outputSanitization?: boolean;
}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      policies: {
        ...existing.policies,
        rateLimit: config.rateLimit,
        requireAuth: config.requireAuth,
        inputValidation: config.inputValidation,
        outputSanitization: config.outputSanitization,
      },
    });
  };
}

/**
 * Декоратор для настройки мониторинга
 */
export function Monitoring(config: {
  enableMetrics?: boolean;
  enableLogging?: boolean;
  enableTracing?: boolean;
  customMetrics?: string[];
}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const existing = metadataRegistry.get(propertyKey) || {};
    metadataRegistry.set(propertyKey, {
      ...existing,
      policies: {
        ...existing.policies,
        metrics: config.enableMetrics,
        logging: config.enableLogging,
        tracing: config.enableTracing,
        customMetrics: config.customMetrics,
      },
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
 * Получает конфигурацию BiomeJS для процедуры
 */
export function getBiomeConfig(procedureName: string): any {
  return biomeConfigRegistry.get(procedureName);
}

/**
 * Получает все метаданные
 */
export function getAllMetadata(): Map<string, ProcedureMetadata> {
  return new Map(metadataRegistry);
}

/**
 * Получает все конфигурации BiomeJS
 */
export function getAllBiomeConfigs(): Map<string, any> {
  return new Map(biomeConfigRegistry);
}

/**
 * Очищает реестры
 */
export function clearRegistries(): void {
  metadataRegistry.clear();
  biomeConfigRegistry.clear();
}

/**
 * Создает современную аннотированную процедуру
 */
export function createModernAnnotatedProcedure<TInput = unknown, TOutput = unknown>(
  procedure: any,
  procedureName: string
): ModernAnnotatedProcedure<TInput, TOutput> {
  const metadata = metadataRegistry.get(procedureName) || {
    visibility: "public",
    category: "api",
    tags: [],
  };

  const biomeConfig = biomeConfigRegistry.get(procedureName);

  return {
    ...procedure,
    metadata: {
      ...metadata,
      createdAt: metadata.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    biomeMetadata: biomeConfig ? {
      rules: biomeConfig.rules || [],
      ignore: biomeConfig.ignore || [],
    } : undefined,
  };
}