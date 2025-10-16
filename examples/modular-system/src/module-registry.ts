/**
 * Реестр модулей для управления видимостью процедур
 */

import type { 
  Module, 
  ModuleRegistry, 
  ModularProcedure, 
  ModuleConfig, 
  ProcedureVisibility,
  ModuleExecutionContext,
  ModuleExecutionResult
} from "./types.js";
import { createExecutionContext } from "@tsdev/core";

/**
 * Создает новый реестр модулей
 */
export function createModuleRegistry(): ModuleRegistry {
  return {
    modules: new Map(),
    publicProcedures: new Map(),
    workflowProcedures: new Map(),
    allProcedures: new Map(),
  };
}

/**
 * Создает новый модуль
 */
export function createModule(config: ModuleConfig): Module {
  return {
    config,
    procedures: new Map(),
    privateProcedures: new Map(),
  };
}

/**
 * Регистрирует процедуру в модуле
 */
export function registerProcedure(
  module: Module,
  procedure: ModularProcedure,
  registry: ModuleRegistry
): void {
  // Добавляем namespace к имени процедуры
  const fullName = module.config.namespace 
    ? `${module.config.namespace}.${procedure.contract.name}`
    : procedure.contract.name;

  // Обновляем имя в контракте
  const modularProcedure: ModularProcedure = {
    ...procedure,
    contract: {
      ...procedure.contract,
      name: fullName,
    },
    module: module.config.name,
  };

  // Регистрируем в модуле
  if (procedure.visibility === "internal" || procedure.visibility === "private") {
    module.privateProcedures.set(fullName, modularProcedure);
  } else {
    module.procedures.set(fullName, modularProcedure);
  }

  // Регистрируем в глобальном реестре
  registry.allProcedures.set(fullName, modularProcedure);

  // Регистрируем в соответствующих категориях
  if (procedure.visibility === "public") {
    registry.publicProcedures.set(fullName, modularProcedure);
    registry.workflowProcedures.set(fullName, modularProcedure);
  } else if (procedure.visibility === "workflow") {
    registry.workflowProcedures.set(fullName, modularProcedure);
  }

  console.log(`[ModuleRegistry] Registered ${procedure.visibility} procedure: ${fullName} in module ${module.config.name}`);
}

/**
 * Регистрирует модуль в реестре
 */
export function registerModule(module: Module, registry: ModuleRegistry): void {
  registry.modules.set(module.config.name, module);
  console.log(`[ModuleRegistry] Registered module: ${module.config.name}`);
}

/**
 * Получает процедуру по имени
 */
export function getProcedure(registry: ModuleRegistry, name: string): ModularProcedure | undefined {
  return registry.allProcedures.get(name);
}

/**
 * Получает публичные процедуры (для эндпоинтов)
 */
export function getPublicProcedures(registry: ModuleRegistry): Map<string, ModularProcedure> {
  return registry.publicProcedures;
}

/**
 * Получает процедуры для воркфлоу
 */
export function getWorkflowProcedures(registry: ModuleRegistry): Map<string, ModularProcedure> {
  return registry.workflowProcedures;
}

/**
 * Получает процедуры модуля
 */
export function getModuleProcedures(registry: ModuleRegistry, moduleName: string): Map<string, ModularProcedure> {
  const module = registry.modules.get(moduleName);
  if (!module) {
    throw new Error(`Module ${moduleName} not found`);
  }
  return module.procedures;
}

/**
 * Получает приватные процедуры модуля
 */
export function getModulePrivateProcedures(registry: ModuleRegistry, moduleName: string): Map<string, ModularProcedure> {
  const module = registry.modules.get(moduleName);
  if (!module) {
    throw new Error(`Module ${moduleName} not found`);
  }
  return module.privateProcedures;
}

/**
 * Выполняет процедуру с контекстом модуля
 */
export async function executeModuleProcedure(
  registry: ModuleRegistry,
  procedureName: string,
  input: unknown,
  baseContext: Partial<ModuleExecutionContext> = {}
): Promise<ModuleExecutionResult> {
  const procedure = registry.allProcedures.get(procedureName);
  if (!procedure) {
    throw new Error(`Procedure ${procedureName} not found`);
  }

  const module = registry.modules.get(procedure.module);
  if (!module) {
    throw new Error(`Module ${procedure.module} not found`);
  }

  const startTime = Date.now();

  // Создаем контекст выполнения модуля
  const context: ModuleExecutionContext = {
    ...createExecutionContext({
      transport: "module",
      module: procedure.module,
      moduleVersion: module.config.version,
    }),
    module: procedure.module,
    moduleVersion: module.config.version,
    dependencies: new Map(),
  };

  // Загружаем зависимости
  if (procedure.dependencies) {
    for (const depName of procedure.dependencies) {
      const depProcedure = registry.allProcedures.get(depName);
      if (depProcedure) {
        context.dependencies.set(depName, depProcedure);
      }
    }
  }

  // Выполняем процедуру
  const result = await procedure.handler(input, context);

  const executionTime = Date.now() - startTime;

  return {
    module: procedure.module,
    procedure: procedureName,
    result,
    executionTime,
    dependenciesUsed: procedure.dependencies || [],
  };
}

/**
 * Получает метаданные для интроспекции
 */
export function getRegistryMetadata(registry: ModuleRegistry) {
  return {
    modules: Array.from(registry.modules.values()).map(module => ({
      name: module.config.name,
      description: module.config.description,
      version: module.config.version,
      namespace: module.config.namespace,
      procedureCount: module.procedures.size,
      privateProcedureCount: module.privateProcedures.size,
    })),
    publicProcedures: Array.from(registry.publicProcedures.keys()),
    workflowProcedures: Array.from(registry.workflowProcedures.keys()),
    totalProcedures: registry.allProcedures.size,
  };
}

/**
 * Валидирует зависимости модулей
 */
export function validateModuleDependencies(registry: ModuleRegistry): string[] {
  const errors: string[] = [];

  for (const [moduleName, module] of registry.modules.entries()) {
    // Проверяем зависимости модуля
    if (module.config.dependencies) {
      for (const dep of module.config.dependencies) {
        if (!registry.modules.has(dep)) {
          errors.push(`Module ${moduleName} depends on missing module ${dep}`);
        }
      }
    }

    // Проверяем зависимости процедур
    for (const [procName, procedure] of module.procedures.entries()) {
      if (procedure.dependencies) {
        for (const dep of procedure.dependencies) {
          if (!registry.allProcedures.has(dep)) {
            errors.push(`Procedure ${procName} depends on missing procedure ${dep}`);
          }
        }
      }
    }
  }

  return errors;
}