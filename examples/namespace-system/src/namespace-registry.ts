/**
 * Реестр пространств имен
 * 
 * Управляет иерархией пространств имен и процедур
 * с контролем видимости и зависимостей
 */

import type { 
  Namespace, 
  NamespaceRegistry, 
  NamespacedProcedure, 
  NamespaceConfig,
  ProcedureConfig,
  ProcedureVisibility,
  ProcedureCategory,
  NamespaceExecutionContext,
  NamespaceExecutionResult,
  ProcedureSearchResult,
  SearchConfig
} from "./types.js";
import { createExecutionContext } from "@tsdev/core";
import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("tsdev.namespaces");

/**
 * Создает новый реестр пространств имен
 */
export function createNamespaceRegistry(): NamespaceRegistry {
  return {
    namespaces: new Map(),
    procedures: new Map(),
    publicProcedures: new Map(),
    workflowProcedures: new Map(),
    internalProcedures: new Map(),
    privateProcedures: new Map(),
    byCategory: new Map(),
    byTag: new Map(),
    hierarchy: new Map(),
  };
}

/**
 * Создает новое пространство имен
 */
export function createNamespace(config: NamespaceConfig): Namespace {
  return {
    name: config.name,
    description: config.description,
    version: config.version,
    parent: config.parent,
    children: [],
    procedures: new Map(),
    metadata: config.metadata || {},
    policies: config.policies || [],
    visibility: config.visibility || "internal",
  };
}

/**
 * Регистрирует пространство имен
 */
export function registerNamespace(namespace: Namespace, registry: NamespaceRegistry): void {
  registry.namespaces.set(namespace.name, namespace);
  
  // Обновляем иерархию
  if (namespace.parent) {
    const parent = registry.namespaces.get(namespace.parent);
    if (parent) {
      parent.children.push(namespace.name);
    }
    registry.hierarchy.set(namespace.name, [namespace.parent, ...getParentNamespaces(namespace.parent, registry)]);
  } else {
    registry.hierarchy.set(namespace.name, []);
  }
  
  console.log(`[NamespaceRegistry] Registered namespace: ${namespace.name}`);
}

/**
 * Регистрирует процедуру в пространстве имен
 */
export function registerProcedure(
  namespaceName: string,
  procedure: NamespacedProcedure,
  registry: NamespaceRegistry
): void {
  const namespace = registry.namespaces.get(namespaceName);
  if (!namespace) {
    throw new Error(`Namespace ${namespaceName} not found`);
  }

  // Создаем полное имя процедуры
  const fullName = `${namespaceName}.${procedure.contract.name}`;
  const namespacedProcedure: NamespacedProcedure = {
    ...procedure,
    namespace: namespaceName,
    fullName,
    contract: {
      ...procedure.contract,
      name: fullName,
    },
  };

  // Регистрируем в пространстве имен
  namespace.procedures.set(fullName, namespacedProcedure);

  // Регистрируем в глобальном реестре
  registry.procedures.set(fullName, namespacedProcedure);

  // Регистрируем в специализированных реестрах
  switch (namespacedProcedure.visibility) {
    case "public":
      registry.publicProcedures.set(fullName, namespacedProcedure);
      registry.workflowProcedures.set(fullName, namespacedProcedure);
      break;
    case "workflow":
      registry.workflowProcedures.set(fullName, namespacedProcedure);
      break;
    case "internal":
      registry.internalProcedures.set(fullName, namespacedProcedure);
      break;
    case "private":
      registry.privateProcedures.set(fullName, namespacedProcedure);
      break;
  }

  // Регистрируем по категориям
  if (!registry.byCategory.has(namespacedProcedure.category)) {
    registry.byCategory.set(namespacedProcedure.category, []);
  }
  registry.byCategory.get(namespacedProcedure.category)!.push(namespacedProcedure);

  // Регистрируем по тегам
  for (const tag of namespacedProcedure.tags) {
    if (!registry.byTag.has(tag)) {
      registry.byTag.set(tag, []);
    }
    registry.byTag.get(tag)!.push(namespacedProcedure);
  }

  console.log(`[NamespaceRegistry] Registered procedure: ${fullName} (${namespacedProcedure.visibility})`);
}

/**
 * Получает процедуру по полному имени
 */
export function getProcedure(registry: NamespaceRegistry, fullName: string): NamespacedProcedure | undefined {
  return registry.procedures.get(fullName);
}

/**
 * Получает процедуры по пространству имен
 */
export function getProceduresByNamespace(registry: NamespaceRegistry, namespaceName: string): NamespacedProcedure[] {
  const namespace = registry.namespaces.get(namespaceName);
  if (!namespace) {
    return [];
  }
  return Array.from(namespace.procedures.values());
}

/**
 * Получает процедуры по категории
 */
export function getProceduresByCategory(registry: NamespaceRegistry, category: ProcedureCategory): NamespacedProcedure[] {
  return registry.byCategory.get(category) || [];
}

/**
 * Получает процедуры по тегу
 */
export function getProceduresByTag(registry: NamespaceRegistry, tag: string): NamespacedProcedure[] {
  return registry.byTag.get(tag) || [];
}

/**
 * Получает публичные процедуры
 */
export function getPublicProcedures(registry: NamespaceRegistry): Map<string, NamespacedProcedure> {
  return registry.publicProcedures;
}

/**
 * Получает процедуры для воркфлоу
 */
export function getWorkflowProcedures(registry: NamespaceRegistry): Map<string, NamespacedProcedure> {
  return registry.workflowProcedures;
}

/**
 * Получает внутренние процедуры
 */
export function getInternalProcedures(registry: NamespaceRegistry): Map<string, NamespacedProcedure> {
  return registry.internalProcedures;
}

/**
 * Получает приватные процедуры
 */
export function getPrivateProcedures(registry: NamespaceRegistry): Map<string, NamespacedProcedure> {
  return registry.privateProcedures;
}

/**
 * Выполняет процедуру с контекстом пространства имен
 */
export async function executeProcedure(
  registry: NamespaceRegistry,
  fullName: string,
  input: unknown,
  baseContext: Partial<NamespaceExecutionContext> = {}
): Promise<NamespaceExecutionResult> {
  const procedure = registry.procedures.get(fullName);
  if (!procedure) {
    throw new Error(`Procedure ${fullName} not found`);
  }

  const namespace = registry.namespaces.get(procedure.namespace);
  if (!namespace) {
    throw new Error(`Namespace ${procedure.namespace} not found`);
  }

  const startTime = Date.now();

  // Создаем контекст выполнения с пространством имен
  const context: NamespaceExecutionContext = {
    ...createExecutionContext({
      transport: "namespace",
      namespace: procedure.namespace,
      category: procedure.category,
      visibility: procedure.visibility,
    }),
    namespace: procedure.namespace,
    namespaceVersion: namespace.version,
    category: procedure.category,
    tags: procedure.tags,
    parentNamespaces: registry.hierarchy.get(procedure.namespace) || [],
    availableProcedures: new Map(),
  };

  // Загружаем доступные процедуры из пространства имен и родительских
  for (const [name, proc] of registry.procedures) {
    if (proc.namespace === procedure.namespace || 
        context.parentNamespaces.includes(proc.namespace)) {
      context.availableProcedures.set(name, proc);
    }
  }

  // Загружаем зависимости
  const dependenciesUsed: string[] = [];
  if (procedure.dependencies) {
    for (const depName of procedure.dependencies) {
      const depProcedure = registry.procedures.get(depName);
      if (depProcedure) {
        context.availableProcedures.set(depName, depProcedure);
        dependenciesUsed.push(depName);
      }
    }
  }

  // Выполняем процедуру с трассировкой
  return tracer.startActiveSpan(
    `procedure.execute.${procedure.category}`,
    {
      attributes: {
        "procedure.name": procedure.contract.name,
        "procedure.namespace": procedure.namespace,
        "procedure.category": procedure.category,
        "procedure.visibility": procedure.visibility,
        "procedure.tags": procedure.tags.join(","),
        "procedure.dependencies": procedure.dependencies?.join(",") || "",
      },
    },
    async (span) => {
      try {
        const result = await procedure.handler(input, context);
        const executionTime = Date.now() - startTime;

        span.setAttributes({
          "procedure.status": "completed",
          "procedure.execution_time_ms": executionTime,
          "procedure.dependencies_used": dependenciesUsed.join(","),
        });
        span.setStatus({ code: SpanStatusCode.OK });

        return {
          procedure: fullName,
          namespace: procedure.namespace,
          category: procedure.category,
          visibility: procedure.visibility,
          result,
          executionTime,
          dependenciesUsed,
          metadata: procedure.metadata,
        };
      } catch (error) {
        const executionTime = Date.now() - startTime;

        span.recordException(error instanceof Error ? error : new Error(String(error)));
        span.setAttributes({
          "procedure.status": "failed",
          "procedure.execution_time_ms": executionTime,
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
 * Поиск процедур по критериям
 */
export function searchProcedures(registry: NamespaceRegistry, config: SearchConfig): ProcedureSearchResult {
  let results = Array.from(registry.procedures.values());

  // Фильтрация по пространству имен
  if (config.namespace) {
    results = results.filter(p => p.namespace === config.namespace);
  }

  // Фильтрация по категории
  if (config.category) {
    results = results.filter(p => p.category === config.category);
  }

  // Фильтрация по видимости
  if (config.visibility) {
    results = results.filter(p => p.visibility === config.visibility);
  }

  // Фильтрация по тегам
  if (config.tags && config.tags.length > 0) {
    results = results.filter(p => 
      config.tags!.every(tag => p.tags.includes(tag))
    );
  }

  // Фильтрация по тексту
  if (config.search) {
    const searchLower = config.search.toLowerCase();
    results = results.filter(p => 
      p.contract.name.toLowerCase().includes(searchLower) ||
      p.contract.description?.toLowerCase().includes(searchLower) ||
      p.tags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  }

  // Фильтрация по видимости (исключение приватных/внутренних)
  if (!config.includePrivate) {
    results = results.filter(p => p.visibility !== "private");
  }
  if (!config.includeInternal) {
    results = results.filter(p => p.visibility !== "internal");
  }

  // Пагинация
  const total = results.length;
  if (config.offset) {
    results = results.slice(config.offset);
  }
  if (config.limit) {
    results = results.slice(0, config.limit);
  }

  // Собираем метаданные
  const namespaces = [...new Set(results.map(p => p.namespace))];
  const categories = [...new Set(results.map(p => p.category))];
  const tags = [...new Set(results.flatMap(p => p.tags))];

  return {
    procedures: results,
    total,
    namespaces,
    categories,
    tags,
  };
}

/**
 * Получает иерархию пространств имен
 */
export function getNamespaceHierarchy(registry: NamespaceRegistry): Map<string, string[]> {
  return registry.hierarchy;
}

/**
 * Получает метаданные реестра
 */
export function getRegistryMetadata(registry: NamespaceRegistry) {
  const namespaces = Array.from(registry.namespaces.values());
  const categories = Array.from(registry.byCategory.keys());
  const tags = Array.from(registry.byTag.keys());

  return {
    totalNamespaces: namespaces.length,
    totalProcedures: registry.procedures.size,
    byVisibility: {
      public: registry.publicProcedures.size,
      workflow: registry.workflowProcedures.size,
      internal: registry.internalProcedures.size,
      private: registry.privateProcedures.size,
    },
    byCategory: categories.reduce((acc, category) => {
      acc[category] = registry.byCategory.get(category)!.length;
      return acc;
    }, {} as Record<string, number>),
    byTag: tags.reduce((acc, tag) => {
      acc[tag] = registry.byTag.get(tag)!.length;
      return acc;
    }, {} as Record<string, number>),
    namespaces: namespaces.map(ns => ({
      name: ns.name,
      description: ns.description,
      version: ns.version,
      parent: ns.parent,
      children: ns.children,
      procedureCount: ns.procedures.size,
      policies: ns.policies,
      visibility: ns.visibility,
    })),
  };
}

/**
 * Валидирует зависимости процедур
 */
export function validateDependencies(registry: NamespaceRegistry): string[] {
  const errors: string[] = [];

  for (const [fullName, procedure] of registry.procedures) {
    if (procedure.dependencies) {
      for (const dep of procedure.dependencies) {
        if (!registry.procedures.has(dep)) {
          errors.push(`Procedure ${fullName} depends on missing procedure ${dep}`);
        }
      }
    }
  }

  return errors;
}

/**
 * Получает родительские пространства имен
 */
function getParentNamespaces(namespaceName: string, registry: NamespaceRegistry): string[] {
  const namespace = registry.namespaces.get(namespaceName);
  if (!namespace || !namespace.parent) {
    return [];
  }
  return [namespace.parent, ...getParentNamespaces(namespace.parent, registry)];
}