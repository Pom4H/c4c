/**
 * Функции-обертки для создания композиций
 * 
 * Предоставляют удобный API для создания сложных процедур
 * из простых с явным контролем видимости
 */

import { z } from "zod";
import type { 
  WrappedFunction, 
  WrapperConfig, 
  CompositionConfig,
  CompositionType,
  ProcedureVisibility
} from "./types.js";
import { createComposedProcedure } from "./composition-factory.js";

/**
 * Создает функцию-обертку для последовательного выполнения
 */
export function createSequentialWrapper<TInput = unknown, TOutput = unknown>(
  config: Omit<WrapperConfig, "composition"> & {
    procedures: string[];
    inputMapping?: Record<string, string>;
    outputMapping?: Record<string, string>;
    errorHandling?: "stop" | "continue";
  }
): WrappedFunction<TInput, TOutput> {
  const compositionConfig: CompositionConfig = {
    name: config.name,
    description: config.description,
    type: "sequential",
    visibility: config.visibility,
    procedures: config.procedures,
    inputMapping: config.inputMapping,
    outputMapping: config.outputMapping,
    errorHandling: config.errorHandling,
  };

  return {
    config: {
      ...config,
      composition: compositionConfig,
    },
    execute: async (input: TInput, context: any) => {
      const procedure = createComposedProcedure(compositionConfig, context.dependencies || new Map());
      return await procedure.handler(input, context);
    },
    dependencies: new Map(),
    isWrapper: true,
  };
}

/**
 * Создает функцию-обертку для параллельного выполнения
 */
export function createParallelWrapper<TInput = unknown, TOutput = unknown>(
  config: Omit<WrapperConfig, "composition"> & {
    procedures: string[];
    waitForAll?: boolean;
    maxConcurrency?: number;
    errorHandling?: "stop" | "continue";
  }
): WrappedFunction<TInput, TOutput> {
  const compositionConfig: CompositionConfig = {
    name: config.name,
    description: config.description,
    type: "parallel",
    visibility: config.visibility,
    procedures: config.procedures,
    parallelConfig: {
      waitForAll: config.waitForAll ?? true,
      maxConcurrency: config.maxConcurrency,
    },
    errorHandling: config.errorHandling,
  };

  return {
    config: {
      ...config,
      composition: compositionConfig,
    },
    execute: async (input: TInput, context: any) => {
      const procedure = createComposedProcedure(compositionConfig, context.dependencies || new Map());
      return await procedure.handler(input, context);
    },
    dependencies: new Map(),
    isWrapper: true,
  };
}

/**
 * Создает функцию-обертку для условного выполнения
 */
export function createConditionalWrapper<TInput = unknown, TOutput = unknown>(
  config: Omit<WrapperConfig, "composition"> & {
    procedures: string[];
    condition: string;
    errorHandling?: "stop" | "continue";
  }
): WrappedFunction<TInput, TOutput> {
  const compositionConfig: CompositionConfig = {
    name: config.name,
    description: config.description,
    type: "conditional",
    visibility: config.visibility,
    procedures: config.procedures,
    condition: config.condition,
    errorHandling: config.errorHandling,
  };

  return {
    config: {
      ...config,
      composition: compositionConfig,
    },
    execute: async (input: TInput, context: any) => {
      const procedure = createComposedProcedure(compositionConfig, context.dependencies || new Map());
      return await procedure.handler(input, context);
    },
    dependencies: new Map(),
    isWrapper: true,
  };
}

/**
 * Создает функцию-обертку с повторными попытками
 */
export function createRetryWrapper<TInput = unknown, TOutput = unknown>(
  config: Omit<WrapperConfig, "composition"> & {
    procedures: string[];
    maxAttempts?: number;
    delayMs?: number;
    backoffMultiplier?: number;
  }
): WrappedFunction<TInput, TOutput> {
  const compositionConfig: CompositionConfig = {
    name: config.name,
    description: config.description,
    type: "retry",
    visibility: config.visibility,
    procedures: config.procedures,
    retryConfig: {
      maxAttempts: config.maxAttempts ?? 3,
      delayMs: config.delayMs ?? 1000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
    },
  };

  return {
    config: {
      ...config,
      composition: compositionConfig,
    },
    execute: async (input: TInput, context: any) => {
      const procedure = createComposedProcedure(compositionConfig, context.dependencies || new Map());
      return await procedure.handler(input, context);
    },
    dependencies: new Map(),
    isWrapper: true,
  };
}

/**
 * Создает функцию-обертку с резервным вариантом
 */
export function createFallbackWrapper<TInput = unknown, TOutput = unknown>(
  config: Omit<WrapperConfig, "composition"> & {
    procedures: string[];
    fallbackProcedure: string;
    errorHandling?: "stop" | "continue";
  }
): WrappedFunction<TInput, TOutput> {
  const compositionConfig: CompositionConfig = {
    name: config.name,
    description: config.description,
    type: "fallback",
    visibility: config.visibility,
    procedures: config.procedures,
    fallbackProcedure: config.fallbackProcedure,
    errorHandling: config.errorHandling,
  };

  return {
    config: {
      ...config,
      composition: compositionConfig,
    },
    execute: async (input: TInput, context: any) => {
      const procedure = createComposedProcedure(compositionConfig, context.dependencies || new Map());
      return await procedure.handler(input, context);
    },
    dependencies: new Map(),
    isWrapper: true,
  };
}

/**
 * Создает API эндпоинт из композиции
 */
export function createAPIEndpoint<TInput = unknown, TOutput = unknown>(
  config: Omit<WrapperConfig, "visibility" | "composition"> & {
    procedures: string[];
    type?: CompositionType;
    inputMapping?: Record<string, string>;
    outputMapping?: Record<string, string>;
    errorHandling?: "stop" | "continue" | "retry" | "fallback";
    retryConfig?: {
      maxAttempts: number;
      delayMs: number;
      backoffMultiplier: number;
    };
    fallbackProcedure?: string;
  }
): WrappedFunction<TInput, TOutput> {
  const compositionConfig: CompositionConfig = {
    name: config.name,
    description: config.description,
    type: config.type || "sequential",
    visibility: "public",
    procedures: config.procedures,
    inputMapping: config.inputMapping,
    outputMapping: config.outputMapping,
    errorHandling: config.errorHandling,
    retryConfig: config.retryConfig,
    fallbackProcedure: config.fallbackProcedure,
  };

  return {
    config: {
      ...config,
      visibility: "public",
      composition: compositionConfig,
    },
    execute: async (input: TInput, context: any) => {
      const procedure = createComposedProcedure(compositionConfig, context.dependencies || new Map());
      return await procedure.handler(input, context);
    },
    dependencies: new Map(),
    isWrapper: true,
  };
}

/**
 * Создает воркфлоу ноду из композиции
 */
export function createWorkflowNode<TInput = unknown, TOutput = unknown>(
  config: Omit<WrapperConfig, "visibility" | "composition"> & {
    procedures: string[];
    type?: CompositionType;
    inputMapping?: Record<string, string>;
    outputMapping?: Record<string, string>;
    errorHandling?: "stop" | "continue" | "retry" | "fallback";
    retryConfig?: {
      maxAttempts: number;
      delayMs: number;
      backoffMultiplier: number;
    };
    fallbackProcedure?: string;
  }
): WrappedFunction<TInput, TOutput> {
  const compositionConfig: CompositionConfig = {
    name: config.name,
    description: config.description,
    type: config.type || "sequential",
    visibility: "workflow",
    procedures: config.procedures,
    inputMapping: config.inputMapping,
    outputMapping: config.outputMapping,
    errorHandling: config.errorHandling,
    retryConfig: config.retryConfig,
    fallbackProcedure: config.fallbackProcedure,
  };

  return {
    config: {
      ...config,
      visibility: "workflow",
      composition: compositionConfig,
    },
    execute: async (input: TInput, context: any) => {
      const procedure = createComposedProcedure(compositionConfig, context.dependencies || new Map());
      return await procedure.handler(input, context);
    },
    dependencies: new Map(),
    isWrapper: true,
  };
}

/**
 * Создает внутреннюю процедуру из композиции
 */
export function createInternalProcedure<TInput = unknown, TOutput = unknown>(
  config: Omit<WrapperConfig, "visibility" | "composition"> & {
    procedures: string[];
    type?: CompositionType;
    inputMapping?: Record<string, string>;
    outputMapping?: Record<string, string>;
    errorHandling?: "stop" | "continue" | "retry" | "fallback";
    retryConfig?: {
      maxAttempts: number;
      delayMs: number;
      backoffMultiplier: number;
    };
    fallbackProcedure?: string;
  }
): WrappedFunction<TInput, TOutput> {
  const compositionConfig: CompositionConfig = {
    name: config.name,
    description: config.description,
    type: config.type || "sequential",
    visibility: "internal",
    procedures: config.procedures,
    inputMapping: config.inputMapping,
    outputMapping: config.outputMapping,
    errorHandling: config.errorHandling,
    retryConfig: config.retryConfig,
    fallbackProcedure: config.fallbackProcedure,
  };

  return {
    config: {
      ...config,
      visibility: "internal",
      composition: compositionConfig,
    },
    execute: async (input: TInput, context: any) => {
      const procedure = createComposedProcedure(compositionConfig, context.dependencies || new Map());
      return await procedure.handler(input, context);
    },
    dependencies: new Map(),
    isWrapper: true,
  };
}

/**
 * Создает приватную процедуру из композиции
 */
export function createPrivateProcedure<TInput = unknown, TOutput = unknown>(
  config: Omit<WrapperConfig, "visibility" | "composition"> & {
    procedures: string[];
    type?: CompositionType;
    inputMapping?: Record<string, string>;
    outputMapping?: Record<string, string>;
    errorHandling?: "stop" | "continue" | "retry" | "fallback";
    retryConfig?: {
      maxAttempts: number;
      delayMs: number;
      backoffMultiplier: number;
    };
    fallbackProcedure?: string;
  }
): WrappedFunction<TInput, TOutput> {
  const compositionConfig: CompositionConfig = {
    name: config.name,
    description: config.description,
    type: config.type || "sequential",
    visibility: "private",
    procedures: config.procedures,
    inputMapping: config.inputMapping,
    outputMapping: config.outputMapping,
    errorHandling: config.errorHandling,
    retryConfig: config.retryConfig,
    fallbackProcedure: config.fallbackProcedure,
  };

  return {
    config: {
      ...config,
      visibility: "private",
      composition: compositionConfig,
    },
    execute: async (input: TInput, context: any) => {
      const procedure = createComposedProcedure(compositionConfig, context.dependencies || new Map());
      return await procedure.handler(input, context);
    },
    dependencies: new Map(),
    isWrapper: true,
  };
}