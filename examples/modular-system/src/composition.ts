/**
 * Система композиции процедур
 * 
 * Позволяет создавать сложные процедуры из простых
 * с сохранением трассировки и возможностей отладки
 */

import type { 
  ModularProcedure, 
  ModuleRegistry, 
  ModuleExecutionContext,
  CompositionConfig,
  ProcedureComposition
} from "./types.js";
import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("tsdev.composition");

/**
 * Создает композицию процедур
 */
export function createComposition(
  config: CompositionConfig,
  registry: ModuleRegistry
): ProcedureComposition {
  return {
    config,
    execute: async (input: unknown, context: ModuleExecutionContext) => {
      return tracer.startActiveSpan(
        `composition.execute.${config.name}`,
        {
          attributes: {
            "composition.name": config.name,
            "composition.procedure_count": config.procedures.length,
            "composition.input": JSON.stringify(input),
          },
        },
        async (span) => {
          try {
            const results: Record<string, unknown> = {};
            let currentInput = input;
            const dependenciesUsed: string[] = [];

            // Выполняем процедуры последовательно
            for (let i = 0; i < config.procedures.length; i++) {
              const procedureName = config.procedures[i];
              const procedure = registry.allProcedures.get(procedureName);
              
              if (!procedure) {
                throw new Error(`Procedure ${procedureName} not found in composition ${config.name}`);
              }

              // Создаем контекст для процедуры
              const procContext: ModuleExecutionContext = {
                ...context,
                dependencies: new Map(),
              };

              // Загружаем зависимости процедуры
              if (procedure.dependencies) {
                for (const depName of procedure.dependencies) {
                  const depProcedure = registry.allProcedures.get(depName);
                  if (depProcedure) {
                    procContext.dependencies.set(depName, depProcedure);
                    dependenciesUsed.push(depName);
                  }
                }
              }

              // Выполняем процедуру
              const result = await procedure.handler(currentInput, procContext);
              results[procedureName] = result;

              // Обновляем входные данные для следующей процедуры
              if (config.inputMapping && config.inputMapping[procedureName]) {
                currentInput = result;
              } else {
                // По умолчанию передаем результат как входные данные
                currentInput = result;
              }

              span.setAttributes({
                [`composition.procedure.${i}.name`]: procedureName,
                [`composition.procedure.${i}.result`]: JSON.stringify(result),
              });
            }

            // Применяем маппинг выходных данных
            let finalResult = results;
            if (config.outputMapping) {
              finalResult = {};
              for (const [outputKey, procedureName] of Object.entries(config.outputMapping)) {
                if (results[procedureName] !== undefined) {
                  finalResult[outputKey] = results[procedureName];
                }
              }
            }

            span.setAttributes({
              "composition.status": "completed",
              "composition.dependencies_used": dependenciesUsed.join(","),
              "composition.output": JSON.stringify(finalResult),
            });
            span.setStatus({ code: SpanStatusCode.OK });

            return finalResult;
          } catch (error) {
            span.recordException(error instanceof Error ? error : new Error(String(error)));
            span.setStatus({ 
              code: SpanStatusCode.ERROR, 
              message: error instanceof Error ? error.message : String(error) 
            });
            throw error;
          } finally {
            span.end();
          }
        }
      );
    },
  };
}

/**
 * Создает композицию с обработкой ошибок
 */
export function createCompositionWithErrorHandling(
  config: CompositionConfig,
  registry: ModuleRegistry,
  errorHandler?: (error: Error, procedureName: string, context: ModuleExecutionContext) => Promise<unknown>
): ProcedureComposition {
  const baseComposition = createComposition(config, registry);

  return {
    ...baseComposition,
    execute: async (input: unknown, context: ModuleExecutionContext) => {
      try {
        return await baseComposition.execute(input, context);
      } catch (error) {
        if (errorHandler) {
          // Находим процедуру, которая вызвала ошибку
          const errorProcedure = config.procedures.find(procName => {
            const procedure = registry.allProcedures.get(procName);
            return procedure && procedure.dependencies?.includes(procName);
          });

          if (errorProcedure) {
            return await errorHandler(
              error instanceof Error ? error : new Error(String(error)),
              errorProcedure,
              context
            );
          }
        }

        // Применяем стратегию обработки ошибок
        switch (config.errorHandling) {
          case "continue":
            console.warn(`[Composition] Error in ${config.name}, continuing:`, error);
            return {};
          case "retry":
            if (config.retryConfig) {
              return await retryComposition(config, registry, input, context, error);
            }
            break;
          case "stop":
          default:
            throw error;
        }
      }
    },
  };
}

/**
 * Повторная попытка выполнения композиции
 */
async function retryComposition(
  config: CompositionConfig,
  registry: ModuleRegistry,
  input: unknown,
  context: ModuleExecutionContext,
  originalError: unknown
): Promise<unknown> {
  if (!config.retryConfig) {
    throw originalError;
  }

  const { maxAttempts, delayMs, backoffMultiplier } = config.retryConfig;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      
      const composition = createComposition(config, registry);
      return await composition.execute(input, context);
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      
      currentDelay *= backoffMultiplier;
      console.warn(`[Composition] Retry ${attempt}/${maxAttempts} for ${config.name}:`, error);
    }
  }

  throw originalError;
}

/**
 * Создает композицию с параллельным выполнением
 */
export function createParallelComposition(
  config: CompositionConfig,
  registry: ModuleRegistry
): ProcedureComposition {
  return {
    ...config,
    execute: async (input: unknown, context: ModuleExecutionContext) => {
      return tracer.startActiveSpan(
        `composition.parallel.${config.name}`,
        {
          attributes: {
            "composition.name": config.name,
            "composition.type": "parallel",
            "composition.procedure_count": config.procedures.length,
          },
        },
        async (span) => {
          try {
            // Выполняем все процедуры параллельно
            const promises = config.procedures.map(async (procedureName) => {
              const procedure = registry.allProcedures.get(procedureName);
              if (!procedure) {
                throw new Error(`Procedure ${procedureName} not found`);
              }

              const procContext: ModuleExecutionContext = {
                ...context,
                dependencies: new Map(),
              };

              // Загружаем зависимости
              if (procedure.dependencies) {
                for (const depName of procedure.dependencies) {
                  const depProcedure = registry.allProcedures.get(depName);
                  if (depProcedure) {
                    procContext.dependencies.set(depName, depProcedure);
                  }
                }
              }

              return {
                procedureName,
                result: await procedure.handler(input, procContext),
              };
            });

            const results = await Promise.all(promises);
            
            // Преобразуем в объект
            const resultMap: Record<string, unknown> = {};
            for (const { procedureName, result } of results) {
              resultMap[procedureName] = result;
            }

            span.setAttributes({
              "composition.status": "completed",
              "composition.output": JSON.stringify(resultMap),
            });
            span.setStatus({ code: SpanStatusCode.OK });

            return resultMap;
          } catch (error) {
            span.recordException(error instanceof Error ? error : new Error(String(error)));
            span.setStatus({ 
              code: SpanStatusCode.ERROR, 
              message: error instanceof Error ? error.message : String(error) 
            });
            throw error;
          } finally {
            span.end();
          }
        }
      );
    },
  };
}