/**
 * React hooks for workflow execution
 *
 * Thin UI layer for apps/examples
 */

"use client";

import { useState, useCallback } from "react";
import type { WorkflowExecutionResult } from "@tsdev/workflow";

export interface UseWorkflowOptions {
  apiBaseUrl?: string;
  onSuccess?: (result: WorkflowExecutionResult) => void;
  onError?: (error: Error) => void;
}

export interface UseWorkflowReturn {
  execute: (
    workflowId: string,
    input?: Record<string, unknown>,
    options?: { executionId?: string }
  ) => Promise<WorkflowExecutionResult>;
  result: WorkflowExecutionResult | null;
  isExecuting: boolean;
  error: Error | null;
  reset: () => void;
}

export function useWorkflow(options: UseWorkflowOptions = {}): UseWorkflowReturn {
  const { apiBaseUrl = "/api/workflow", onSuccess, onError } = options;

  const [result, setResult] = useState<WorkflowExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (
      workflowId: string,
      input?: Record<string, unknown>,
      executeOptions?: { executionId?: string }
    ): Promise<WorkflowExecutionResult> => {
      setIsExecuting(true);
      setError(null);
      setResult(null);

      try {
        const response = await fetch(`${apiBaseUrl}/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ workflowId, input, executionId: executeOptions?.executionId }),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
          );
        }

        const executionResult = await response.json();
        setResult(executionResult);

        if (onSuccess) {
          onSuccess(executionResult);
        }

        return executionResult;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);

        if (onError) {
          onError(error);
        }

        throw error;
      } finally {
        setIsExecuting(false);
      }
    },
    [apiBaseUrl, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsExecuting(false);
  }, []);

  return {
    execute,
    result,
    isExecuting,
    error,
    reset,
  };
}

export function useWorkflows(
  options: {
    apiBaseUrl?: string;
    listPath?: string;
  } = {}
) {
  const { apiBaseUrl = "/api/workflow", listPath = "/list" } = options;
  const [workflows, setWorkflows] = useState<
    Array<{
      id: string;
      name: string;
      description?: string;
      version: string;
      nodeCount: number;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkflows = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(resolveEndpoint(apiBaseUrl, listPath));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setWorkflows(data.workflows || []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  return {
    workflows,
    isLoading,
    error,
    fetchWorkflows,
  };
}

export function useWorkflowDefinition(
  workflowId: string | null,
  options: {
    apiBaseUrl?: string;
    definitionPath?: ((workflowId: string) => string) | string;
  } = {}
) {
  const {
    apiBaseUrl = "/api/workflow",
    definitionPath = (id: string) => `/definition?id=${encodeURIComponent(id)}`,
  } = options;
  const [definition, setDefinition] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDefinition = useCallback(async () => {
    if (!workflowId) {
      setDefinition(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const path =
        typeof definitionPath === "function"
          ? definitionPath(workflowId)
          : definitionPath.replace("{id}", encodeURIComponent(workflowId));

      const response = await fetch(resolveEndpoint(apiBaseUrl, path));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setDefinition(data.definition);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, [workflowId, apiBaseUrl]);

  return {
    definition,
    isLoading,
    error,
    fetchDefinition,
  };
}

function resolveEndpoint(baseUrl: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
