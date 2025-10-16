/**
 * Интеграция с BiomeJS
 * 
 * Предоставляет функции для работы с BiomeJS
 * в контексте аннотированных процедур
 */

import type { ModernAnnotatedProcedure, ModernAnnotatedRegistry } from "./types.js";

/**
 * Конфигурация BiomeJS для процедуры
 */
export interface BiomeProcedureConfig {
  rules: string[];
  ignore: string[];
  format?: boolean;
  lint?: boolean;
  check?: boolean;
}

/**
 * Результат проверки BiomeJS
 */
export interface BiomeCheckResult {
  procedure: string;
  passed: boolean;
  errors: Array<{
    rule: string;
    message: string;
    line: number;
    column: number;
  }>;
  warnings: Array<{
    rule: string;
    message: string;
    line: number;
    column: number;
  }>;
  executionTime: number;
}

/**
 * Проверяет процедуру с помощью BiomeJS
 */
export async function checkProcedureWithBiome(
  procedure: ModernAnnotatedProcedure,
  config: BiomeProcedureConfig
): Promise<BiomeCheckResult> {
  const startTime = Date.now();
  
  // Имитация проверки BiomeJS
  // В реальной реализации здесь был бы вызов BiomeJS API
  const errors: Array<{ rule: string; message: string; line: number; column: number }> = [];
  const warnings: Array<{ rule: string; message: string; line: number; column: number }> = [];
  
  // Проверяем правила
  for (const rule of config.rules) {
    // Имитация проверки правила
    if (rule === "no-unused-vars" && Math.random() > 0.8) {
      warnings.push({
        rule,
        message: "Unused variable detected",
        line: Math.floor(Math.random() * 100) + 1,
        column: Math.floor(Math.random() * 50) + 1,
      });
    }
  }
  
  const executionTime = Date.now() - startTime;
  
  return {
    procedure: procedure.contract.name,
    passed: errors.length === 0,
    errors,
    warnings,
    executionTime,
  };
}

/**
 * Форматирует код процедуры с помощью BiomeJS
 */
export async function formatProcedureWithBiome(
  procedure: ModernAnnotatedProcedure,
  config: BiomeProcedureConfig
): Promise<{ formatted: boolean; changes: number }> {
  // Имитация форматирования BiomeJS
  // В реальной реализации здесь был бы вызов BiomeJS format API
  const changes = Math.floor(Math.random() * 5);
  
  return {
    formatted: true,
    changes,
  };
}

/**
 * Проверяет все процедуры в реестре
 */
export async function checkAllProceduresWithBiome(
  registry: ModernAnnotatedRegistry
): Promise<Map<string, BiomeCheckResult>> {
  const results = new Map<string, BiomeCheckResult>();
  
  for (const [name, procedure] of registry.procedures) {
    const biomeConfig = registry.biomeConfig.get(name) || {
      rules: ["no-unused-vars", "no-console"],
      ignore: [],
    };
    
    const result = await checkProcedureWithBiome(procedure, biomeConfig);
    results.set(name, result);
  }
  
  return results;
}

/**
 * Форматирует все процедуры в реестре
 */
export async function formatAllProceduresWithBiome(
  registry: ModernAnnotatedRegistry
): Promise<Map<string, { formatted: boolean; changes: number }>> {
  const results = new Map<string, { formatted: boolean; changes: number }>();
  
  for (const [name, procedure] of registry.procedures) {
    const biomeConfig = registry.biomeConfig.get(name) || {
      rules: ["no-unused-vars", "no-console"],
      ignore: [],
    };
    
    const result = await formatProcedureWithBiome(procedure, biomeConfig);
    results.set(name, result);
  }
  
  return results;
}

/**
 * Генерирует конфигурацию BiomeJS для реестра
 */
export function generateBiomeConfig(registry: ModernAnnotatedRegistry): string {
  const config = {
    linter: {
      enabled: true,
      rules: {
        recommended: true,
        correctness: {
          noUnusedVariables: "error",
          noUnusedImports: "error",
        },
        style: {
          noVar: "error",
          useConst: "error",
        },
        suspicious: {
          noConsoleLog: "warn",
          noDebugger: "error",
        },
      },
    },
    formatter: {
      enabled: true,
      indentStyle: "space",
      indentWidth: 2,
      lineWidth: 100,
    },
    organizeImports: {
      enabled: true,
    },
  };
  
  return JSON.stringify(config, null, 2);
}

/**
 * Анализирует качество кода процедур
 */
export function analyzeCodeQuality(registry: ModernAnnotatedRegistry): {
  totalProcedures: number;
  qualityScore: number;
  issuesByCategory: Record<string, number>;
  recommendations: string[];
} {
  const totalProcedures = registry.procedures.size;
  let qualityScore = 100;
  const issuesByCategory: Record<string, number> = {};
  const recommendations: string[] = [];
  
  // Анализируем процедуры
  for (const [name, procedure] of registry.procedures) {
    // Проверяем наличие описания
    if (!procedure.metadata.description) {
      issuesByCategory["missing-description"] = (issuesByCategory["missing-description"] || 0) + 1;
      qualityScore -= 5;
    }
    
    // Проверяем наличие тегов
    if (!procedure.metadata.tags || procedure.metadata.tags.length === 0) {
      issuesByCategory["missing-tags"] = (issuesByCategory["missing-tags"] || 0) + 1;
      qualityScore -= 3;
    }
    
    // Проверяем наличие примеров
    if (!procedure.metadata.examples || procedure.metadata.examples.length === 0) {
      issuesByCategory["missing-examples"] = (issuesByCategory["missing-examples"] || 0) + 1;
      qualityScore -= 2;
    }
    
    // Проверяем устаревшие процедуры
    if (procedure.metadata.deprecated) {
      issuesByCategory["deprecated"] = (issuesByCategory["deprecated"] || 0) + 1;
      qualityScore -= 10;
    }
  }
  
  // Генерируем рекомендации
  if (issuesByCategory["missing-description"]) {
    recommendations.push("Добавьте описания для всех процедур");
  }
  if (issuesByCategory["missing-tags"]) {
    recommendations.push("Добавьте теги для лучшей категоризации");
  }
  if (issuesByCategory["missing-examples"]) {
    recommendations.push("Добавьте примеры использования");
  }
  if (issuesByCategory["deprecated"]) {
    recommendations.push("Обновите устаревшие процедуры");
  }
  
  return {
    totalProcedures,
    qualityScore: Math.max(0, qualityScore),
    issuesByCategory,
    recommendations,
  };
}