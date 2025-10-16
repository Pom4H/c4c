/**
 * Реестр аннотированных процедур
 * 
 * Управляет процедурами с метаданными и обеспечивает
 * фильтрацию по категориям, видимости и тегам
 */

import type { 
  AnnotatedProcedure, 
  AnnotatedRegistry, 
  ProcedureVisibility, 
  ProcedureCategory,
  AnnotatedExecutionContext,
  AnnotatedExecutionResult
} from "./types.js";
import { createExecutionContext } from "@tsdev/core";
import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("tsdev.annotations");

/**
 * Создает новый реестр аннотированных процедур
 */
export function createAnnotatedRegistry(): AnnotatedRegistry {
  return {
    procedures: new Map(),
    byCategory: new Map(),
    byVisibility: new Map(),
    byTag: new Map(),
    publicProcedures: new Map(),
    workflowProcedures: new Map(),
    internalProcedures: new Map(),
    privateProcedures: new Map(),
  };
}

/**
 * Регистрирует аннотированную процедуру
 */
export function registerAnnotatedProcedure(
  registry: AnnotatedRegistry,
  procedure: AnnotatedProcedure
): void {
  const name = procedure.contract.name;
  const metadata = procedure.metadata;

  // Регистрируем в основном реестре
  registry.procedures.set(name, procedure);

  // Регистрируем по категориям
  if (!registry.byCategory.has(metadata.category)) {
    registry.byCategory.set(metadata.category, []);
  }
  registry.byCategory.get(metadata.category)!.push(procedure);

  // Регистрируем по видимости
  if (!registry.byVisibility.has(metadata.visibility)) {
    registry.byVisibility.set(metadata.visibility, []);
  }
  registry.byVisibility.get(metadata.visibility)!.push(procedure);

  // Регистрируем по тегам
  if (metadata.tags) {
    for (const tag of metadata.tags) {
      if (!registry.byTag.has(tag)) {
        registry.byTag.set(tag, []);
      }
      registry.byTag.get(tag)!.push(procedure);
    }
  }

  // Регистрируем в специализированных реестрах
  switch (metadata.visibility) {
    case "public":
      registry.publicProcedures.set(name, procedure);
      registry.workflowProcedures.set(name, procedure);
      break;
    case "workflow":
      registry.workflowProcedures.set(name, procedure);
      break;
    case "internal":
      registry.internalProcedures.set(name, procedure);
      break;
    case "private":
      registry.privateProcedures.set(name, procedure);
      break;
  }

  console.log(`[AnnotatedRegistry] Registered ${metadata.visibility} procedure: ${name} (${metadata.category})`);
}

/**
 * Получает процедуру по имени
 */
export function getAnnotatedProcedure(registry: AnnotatedRegistry, name: string): AnnotatedProcedure | undefined {
  return registry.procedures.get(name);
}

/**
 * Получает процедуры по категории
 */
export function getProceduresByCategory(registry: AnnotatedRegistry, category: ProcedureCategory): AnnotatedProcedure[] {
  return registry.byCategory.get(category) || [];
}

/**
 * Получает процедуры по видимости
 */
export function getProceduresByVisibility(registry: AnnotatedRegistry, visibility: ProcedureVisibility): AnnotatedProcedure[] {
  return registry.byVisibility.get(visibility) || [];
}

/**
 * Получает процедуры по тегу
 */
export function getProceduresByTag(registry: AnnotatedRegistry, tag: string): AnnotatedProcedure[] {
  return registry.byTag.get(tag) || [];
}

/**
 * Получает публичные процедуры (для API эндпоинтов)
 */
export function getPublicProcedures(registry: AnnotatedRegistry): Map<string, AnnotatedProcedure> {
  return registry.publicProcedures;
}

/**
 * Получает процедуры для воркфлоу
 */
export function getWorkflowProcedures(registry: AnnotatedRegistry): Map<string, AnnotatedProcedure> {
  return registry.workflowProcedures;
}

/**
 * Получает внутренние процедуры
 */
export function getInternalProcedures(registry: AnnotatedRegistry): Map<string, AnnotatedProcedure> {
  return registry.internalProcedures;
}

/**
 * Получает приватные процедуры
 */
export function getPrivateProcedures(registry: AnnotatedRegistry): Map<string, AnnotatedProcedure> {
  return registry.privateProcedures;
}

/**
 * Выполняет аннотированную процедуру
 */
export async function executeAnnotatedProcedure(
  registry: AnnotatedRegistry,
  procedureName: string,
  input: unknown,
  baseContext: Partial<AnnotatedExecutionContext> = {}
): Promise<AnnotatedExecutionResult> {
  const procedure = registry.procedures.get(procedureName);
  if (!procedure) {
    throw new Error(`Procedure ${procedureName} not found`);
  }

  const metadata = procedure.metadata;
  const startTime = Date.now();

  // Создаем контекст выполнения с метаданными
  const context: AnnotatedExecutionContext = {
    ...createExecutionContext({
      transport: "annotated",
      procedure: procedureName,
      category: metadata.category,
      visibility: metadata.visibility,
    }),
    procedureMetadata: metadata,
    executionPolicies: metadata.policies || {},
    category: metadata.category,
    tags: metadata.tags || [],
  };

  // Применяем политики выполнения
  const policiesApplied: string[] = [];

  if (metadata.policies?.retry) {
    policiesApplied.push("retry");
  }

  if (metadata.policies?.timeout) {
    policiesApplied.push("timeout");
  }

  if (metadata.policies?.rateLimit) {
    policiesApplied.push("rateLimit");
  }

  if (metadata.policies?.cache) {
    policiesApplied.push("cache");
  }

  if (metadata.policies?.logging) {
    policiesApplied.push("logging");
  }

  if (metadata.policies?.tracing) {
    policiesApplied.push("tracing");
  }

  // Выполняем процедуру с трассировкой
  return tracer.startActiveSpan(
    `procedure.execute.${metadata.category}`,
    {
      attributes: {
        "procedure.name": procedureName,
        "procedure.category": metadata.category,
        "procedure.visibility": metadata.visibility,
        "procedure.tags": metadata.tags?.join(",") || "",
        "procedure.policies": policiesApplied.join(","),
        "procedure.deprecated": metadata.deprecated || false,
      },
    },
    async (span) => {
      try {
        // Проверяем, не устарела ли процедура
        if (metadata.deprecated) {
          console.warn(`[AnnotatedRegistry] Using deprecated procedure: ${procedureName}`);
          if (metadata.deprecationReason) {
            console.warn(`[AnnotatedRegistry] Reason: ${metadata.deprecationReason}`);
          }
          if (metadata.migrationPath) {
            console.warn(`[AnnotatedRegistry] Migration path: ${metadata.migrationPath}`);
          }
        }

        // Выполняем процедуру
        const result = await procedure.handler(input, context);

        const executionTime = Date.now() - startTime;

        span.setAttributes({
          "procedure.status": "completed",
          "procedure.execution_time_ms": executionTime,
          "procedure.result_type": typeof result,
        });
        span.setStatus({ code: SpanStatusCode.OK });

        return {
          procedure: procedureName,
          category: metadata.category,
          visibility: metadata.visibility,
          result,
          executionTime,
          policiesApplied,
          metadata,
        };
      } catch (error) {
        const executionTime = Date.now() - startTime;

        span.recordException(error instanceof Error ? error : new Error(String(error)));
        span.setAttributes({
          "procedure.status": "failed",
          "procedure.execution_time_ms": executionTime,
          "procedure.error": error instanceof Error ? error.message : String(error),
        });
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });

        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Получает метаданные реестра
 */
export function getRegistryMetadata(registry: AnnotatedRegistry) {
  const categories = Array.from(registry.byCategory.keys());
  const visibilities = Array.from(registry.byVisibility.keys());
  const tags = Array.from(registry.byTag.keys());

  return {
    totalProcedures: registry.procedures.size,
    byCategory: categories.reduce((acc, category) => {
      acc[category] = registry.byCategory.get(category)!.length;
      return acc;
    }, {} as Record<string, number>),
    byVisibility: visibilities.reduce((acc, visibility) => {
      acc[visibility] = registry.byVisibility.get(visibility)!.length;
      return acc;
    }, {} as Record<string, number>),
    byTag: tags.reduce((acc, tag) => {
      acc[tag] = registry.byTag.get(tag)!.length;
      return acc;
    }, {} as Record<string, number>),
    deprecatedProcedures: Array.from(registry.procedures.values())
      .filter(p => p.metadata.deprecated)
      .map(p => ({
        name: p.contract.name,
        reason: p.metadata.deprecationReason,
        migrationPath: p.metadata.migrationPath,
      })),
  };
}

/**
 * Поиск процедур по критериям
 */
export function searchProcedures(
  registry: AnnotatedRegistry,
  criteria: {
    category?: ProcedureCategory;
    visibility?: ProcedureVisibility;
    tags?: string[];
    deprecated?: boolean;
    search?: string;
  }
): AnnotatedProcedure[] {
  let results = Array.from(registry.procedures.values());

  if (criteria.category) {
    results = results.filter(p => p.metadata.category === criteria.category);
  }

  if (criteria.visibility) {
    results = results.filter(p => p.metadata.visibility === criteria.visibility);
  }

  if (criteria.tags && criteria.tags.length > 0) {
    results = results.filter(p => 
      criteria.tags!.every(tag => p.metadata.tags?.includes(tag))
    );
  }

  if (criteria.deprecated !== undefined) {
    results = results.filter(p => p.metadata.deprecated === criteria.deprecated);
  }

  if (criteria.search) {
    const searchLower = criteria.search.toLowerCase();
    results = results.filter(p => 
      p.contract.name.toLowerCase().includes(searchLower) ||
      p.metadata.description?.toLowerCase().includes(searchLower) ||
      p.metadata.tags?.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }

  return results;
}

/**
 * Валидирует зависимости процедур
 */
export function validateDependencies(registry: AnnotatedRegistry): string[] {
  const errors: string[] = [];

  for (const [name, procedure] of registry.procedures) {
    if (procedure.metadata.dependencies) {
      for (const dep of procedure.metadata.dependencies) {
        if (!registry.procedures.has(dep)) {
          errors.push(`Procedure ${name} depends on missing procedure ${dep}`);
        }
      }
    }
  }

  return errors;
}