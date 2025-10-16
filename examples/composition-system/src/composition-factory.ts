/**
 * Фабрика композиций
 * 
 * Создает композиционные процедуры из простых
 * с различными стратегиями выполнения
 */

import type { 
  ComposedProcedure, 
  CompositionConfig, 
  CompositionType,
  CompositionExecutionContext,
  CompositionExecutionResult
} from "./types.js";
import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("tsdev.composition");

/**
 * Создает композиционную процедуру
 */
export function createComposedProcedure<TInput = unknown, TOutput = unknown>(
  config: CompositionConfig,
  procedures: Map<string, any>
): ComposedProcedure<TInput, TOutput> {
  const dependencies = new Map();
  
  // Загружаем зависимости
  for (const procName of config.procedures) {
    const procedure = procedures.get(procName);
    if (procedure) {
      dependencies.set(procName, procedure);
    }
  }

  return {
    contract: {
      name: config.name,
      description: config.description,
      input: config.inputSchema || ({} as any),
      output: config.outputSchema || ({} as any),
    },
    handler: async (input: TInput, context: CompositionExecutionContext) => {
      return tracer.startActiveSpan(
        `composition.execute.${config.type}`,
        {
          attributes: {
            "composition.name": config.name,
            "composition.type": config.type,
            "composition.visibility": config.visibility,
            "composition.steps": config.procedures.length,
          },
        },
        async (span) => {
          try {
            const result = await executeComposition(config, dependencies, input, context);
            
            span.setAttributes({
              "composition.status": "completed",
              "composition.steps_executed": result.stepsExecuted.length,
            });
            span.setStatus({ code: SpanStatusCode.OK });
            
            return result.result;
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
    config,
    dependencies,
    isComposed: true,
  };
}

/**
 * Выполняет композицию в зависимости от типа
 */
async function executeComposition(
  config: CompositionConfig,
  dependencies: Map<string, any>,
  input: unknown,
  context: CompositionExecutionContext
): Promise<CompositionExecutionResult> {
  const startTime = Date.now();
  const stepResults = new Map<string, unknown>();
  const stepsExecuted: string[] = [];
  const errors: Array<{ step: string; error: string; timestamp: number }> = [];

  try {
    let result: unknown;

    switch (config.type) {
      case "sequential":
        result = await executeSequential(config, dependencies, input, context, stepResults, stepsExecuted, errors);
        break;
      case "parallel":
        result = await executeParallel(config, dependencies, input, context, stepResults, stepsExecuted, errors);
        break;
      case "conditional":
        result = await executeConditional(config, dependencies, input, context, stepResults, stepsExecuted, errors);
        break;
      case "retry":
        result = await executeRetry(config, dependencies, input, context, stepResults, stepsExecuted, errors);
        break;
      case "fallback":
        result = await executeFallback(config, dependencies, input, context, stepResults, stepsExecuted, errors);
        break;
      default:
        throw new Error(`Unknown composition type: ${config.type}`);
    }

    return {
      composition: config.name,
      type: config.type,
      result,
      executionTime: Date.now() - startTime,
      stepsExecuted,
      stepResults: Object.fromEntries(stepResults),
      errors,
    };
  } catch (error) {
    return {
      composition: config.name,
      type: config.type,
      result: null,
      executionTime: Date.now() - startTime,
      stepsExecuted,
      stepResults: Object.fromEntries(stepResults),
      errors: [
        ...errors,
        {
          step: "composition",
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        },
      ],
    };
  }
}

/**
 * Последовательное выполнение процедур
 */
async function executeSequential(
  config: CompositionConfig,
  dependencies: Map<string, any>,
  input: unknown,
  context: CompositionExecutionContext,
  stepResults: Map<string, unknown>,
  stepsExecuted: string[],
  errors: Array<{ step: string; error: string; timestamp: number }>
): Promise<unknown> {
  let currentInput = input;
  let finalResult: unknown = null;

  for (let i = 0; i < config.procedures.length; i++) {
    const procName = config.procedures[i];
    const procedure = dependencies.get(procName);
    
    if (!procedure) {
      const error = `Procedure ${procName} not found`;
      errors.push({ step: procName, error, timestamp: Date.now() });
      throw new Error(error);
    }

    try {
      const result = await procedure.handler(currentInput, context);
      stepResults.set(procName, result);
      stepsExecuted.push(procName);
      
      // Обновляем входные данные для следующей процедуры
      if (config.inputMapping && config.inputMapping[procName]) {
        currentInput = result;
      } else {
        currentInput = result;
      }
      
      finalResult = result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ step: procName, error: errorMsg, timestamp: Date.now() });
      
      if (config.errorHandling === "continue") {
        console.warn(`[Composition] Error in step ${procName}, continuing:`, error);
        continue;
      } else {
        throw error;
      }
    }
  }

  return finalResult;
}

/**
 * Параллельное выполнение процедур
 */
async function executeParallel(
  config: CompositionConfig,
  dependencies: Map<string, any>,
  input: unknown,
  context: CompositionExecutionContext,
  stepResults: Map<string, unknown>,
  stepsExecuted: string[],
  errors: Array<{ step: string; error: string; timestamp: number }>
): Promise<unknown> {
  const parallelConfig = config.parallelConfig || { waitForAll: true };
  const maxConcurrency = parallelConfig.maxConcurrency || config.procedures.length;

  // Создаем промисы для всех процедур
  const promises = config.procedures.map(async (procName) => {
    const procedure = dependencies.get(procName);
    
    if (!procedure) {
      const error = `Procedure ${procName} not found`;
      errors.push({ step: procName, error, timestamp: Date.now() });
      throw new Error(error);
    }

    try {
      const result = await procedure.handler(input, context);
      stepResults.set(procName, result);
      stepsExecuted.push(procName);
      return { procName, result, success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ step: procName, error: errorMsg, timestamp: Date.now() });
      return { procName, error: errorMsg, success: false };
    }
  });

  // Выполняем с ограничением параллелизма
  const results = await executeWithConcurrencyLimit(promises, maxConcurrency);

  if (parallelConfig.waitForAll) {
    // Ждем завершения всех процедур
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    if (failedResults.length > 0 && config.errorHandling !== "continue") {
      throw new Error(`Parallel execution failed: ${failedResults.map(r => r.error).join(", ")}`);
    }
    
    return Object.fromEntries(successfulResults.map(r => [r.procName, r.result]));
  } else {
    // Возвращаем результат первой завершившейся процедуры
    const firstResult = results.find(r => r.success);
    if (!firstResult) {
      throw new Error("All parallel procedures failed");
    }
    return firstResult.result;
  }
}

/**
 * Условное выполнение процедур
 */
async function executeConditional(
  config: CompositionConfig,
  dependencies: Map<string, any>,
  input: unknown,
  context: CompositionExecutionContext,
  stepResults: Map<string, unknown>,
  stepsExecuted: string[],
  errors: Array<{ step: string; error: string; timestamp: number }>
): Promise<unknown> {
  if (!config.condition) {
    throw new Error("Conditional composition requires a condition expression");
  }

  // Вычисляем условие
  const conditionResult = evaluateCondition(config.condition, input, context);
  
  if (conditionResult && config.procedures.length > 0) {
    const procName = config.procedures[0];
    const procedure = dependencies.get(procName);
    
    if (!procedure) {
      throw new Error(`Procedure ${procName} not found`);
    }

    try {
      const result = await procedure.handler(input, context);
      stepResults.set(procName, result);
      stepsExecuted.push(procName);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ step: procName, error: errorMsg, timestamp: Date.now() });
      throw error;
    }
  }

  return null;
}

/**
 * Выполнение с повторными попытками
 */
async function executeRetry(
  config: CompositionConfig,
  dependencies: Map<string, any>,
  input: unknown,
  context: CompositionExecutionContext,
  stepResults: Map<string, unknown>,
  stepsExecuted: string[],
  errors: Array<{ step: string; error: string; timestamp: number }>
): Promise<unknown> {
  const retryConfig = config.retryConfig || { maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2 };
  let lastError: Error | undefined;
  let currentDelay = retryConfig.delayMs;

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      const result = await executeSequential(config, dependencies, input, context, stepResults, stepsExecuted, errors);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === retryConfig.maxAttempts) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= retryConfig.backoffMultiplier;
      
      console.warn(`[Composition] Retry ${attempt}/${retryConfig.maxAttempts} for ${config.name}:`, error);
    }
  }

  throw lastError;
}

/**
 * Выполнение с резервным вариантом
 */
async function executeFallback(
  config: CompositionConfig,
  dependencies: Map<string, any>,
  input: unknown,
  context: CompositionExecutionContext,
  stepResults: Map<string, unknown>,
  stepsExecuted: string[],
  errors: Array<{ step: string; error: string; timestamp: number }>
): Promise<unknown> {
  try {
    return await executeSequential(config, dependencies, input, context, stepResults, stepsExecuted, errors);
  } catch (error) {
    if (config.fallbackProcedure) {
      const fallbackProcedure = dependencies.get(config.fallbackProcedure);
      if (fallbackProcedure) {
        console.warn(`[Composition] Using fallback procedure ${config.fallbackProcedure} for ${config.name}`);
        try {
          const result = await fallbackProcedure.handler(input, context);
          stepResults.set(config.fallbackProcedure, result);
          stepsExecuted.push(config.fallbackProcedure);
          return result;
        } catch (fallbackError) {
          const errorMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          errors.push({ step: config.fallbackProcedure, error: errorMsg, timestamp: Date.now() });
          throw fallbackError;
        }
      }
    }
    throw error;
  }
}

/**
 * Выполняет промисы с ограничением параллелизма
 */
async function executeWithConcurrencyLimit<T>(
  promises: Promise<T>[],
  maxConcurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const promise of promises) {
    const p = promise.then(result => {
      results.push(result);
    });
    
    executing.push(p);
    
    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === p), 1);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Вычисляет условие для условного выполнения
 */
function evaluateCondition(
  condition: string,
  input: unknown,
  context: CompositionExecutionContext
): boolean {
  try {
    // Создаем функцию с доступом к входным данным и контексту
    const func = new Function("input", "context", `return ${condition}`);
    return func(input, context);
  } catch (error) {
    console.error(`Error evaluating condition: ${condition}`, error);
    return false;
  }
}