/**
 * React hooks for workflow execution with SSE
 * Part of tsdev framework
 */

import { useState, useCallback } from "react";

/**
 * Workflow execution result from framework
 */
export interface WorkflowExecutionResult {
  executionId: string;
  status: "completed" | "failed" | "cancelled";
  outputs: Record<string, unknown>;
  error?: string;
  executionTime: number;
  nodesExecuted: string[];
  spans?: unknown[];
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  nodes: unknown[];
  startNode: string;
  variables?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UseWorkflowOptions {
  /**
   * Base URL for API endpoints (default: /api/workflows)
   */
  baseUrl?: string;
  
  /**
   * Called when workflow execution starts
   */
  onStart?: (data: { workflowId: string; workflowName: string }) => void;
  
  /**
   * Called on each node execution
   */
  onProgress?: (data: { nodeId: string }) => void;
  
  /**
   * Called when workflow completes successfully
   */
  onComplete?: (result: WorkflowExecutionResult) => void;
  
  /**
   * Called on workflow execution error
   */
  onError?: (error: string) => void;
}

export interface UseWorkflowReturn {
  execute: (workflowId: string, input?: Record<string, unknown>) => Promise<void>;
  isExecuting: boolean;
  result: WorkflowExecutionResult | null;
  error: string | null;
  reset: () => void;
}

/**
 * Hook for executing workflows with SSE streaming
 * 
 * @example
 * ```tsx
 * const { execute, isExecuting, result } = useWorkflow({
 *   onStart: (data) => console.log("Started:", data.workflowName),
 *   onProgress: (data) => console.log("Node:", data.nodeId),
 *   onComplete: (result) => console.log("Done:", result),
 * });
 * 
 * await execute("math-calculation", { a: 10, b: 5 });
 * ```
 */
export function useWorkflow(options?: UseWorkflowOptions): UseWorkflowReturn {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<WorkflowExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = options?.baseUrl || "/api/workflows";

  const execute = useCallback(
    async (workflowId: string, input?: Record<string, unknown>) => {
      setIsExecuting(true);
      setResult(null);
      setError(null);

      try {
        const response = await fetch(`${baseUrl}/${workflowId}/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            const eventMatch = line.match(/^event: (.+)$/m);
            const dataMatch = line.match(/^data: (.+)$/m);

            if (eventMatch?.[1] && dataMatch?.[1]) {
              const eventType = eventMatch[1];
              const data = JSON.parse(dataMatch[1]) as {
                workflowId?: string;
                workflowName?: string;
                nodeId?: string;
                result?: WorkflowExecutionResult;
                error?: string;
              };

              switch (eventType) {
                case "workflow-start":
                  if (options?.onStart && data.workflowId && data.workflowName) {
                    options.onStart({
                      workflowId: data.workflowId,
                      workflowName: data.workflowName,
                    });
                  }
                  break;

                case "workflow-progress":
                  if (options?.onProgress && data.nodeId) {
                    options.onProgress({ nodeId: data.nodeId });
                  }
                  break;

                case "workflow-complete":
                  if (data.result) {
                    setResult(data.result);
                    if (options?.onComplete) {
                      options.onComplete(data.result);
                    }
                  }
                  break;

                case "workflow-error":
                  const errorMsg = data.error || "Unknown error";
                  setError(errorMsg);
                  if (options?.onError) {
                    options.onError(errorMsg);
                  }
                  throw new Error(errorMsg);
              }
            }
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        if (options?.onError && !error) {
          options.onError(errorMsg);
        }
      } finally {
        setIsExecuting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseUrl]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    execute,
    isExecuting,
    result,
    error,
    reset,
  };
}

/**
 * Hook for fetching workflows list
 * 
 * @example
 * ```tsx
 * const { workflows, fetchWorkflows } = useWorkflows();
 * 
 * useEffect(() => {
 *   fetchWorkflows();
 * }, []);
 * ```
 */
export function useWorkflows(baseUrl = "/api/workflows") {
  const [workflows, setWorkflows] = useState<
    Array<{
      id: string;
      name: string;
      description?: string;
      nodeCount?: number;
      [key: string]: unknown;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(baseUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch workflows: ${response.statusText}`);
      }
      const data = (await response.json()) as Array<{
        id: string;
        name: string;
        description?: string;
        nodeCount?: number;
        [key: string]: unknown;
      }>;
      setWorkflows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  return {
    workflows,
    loading,
    error,
    fetchWorkflows,
  };
}

/**
 * Hook for fetching single workflow definition
 * 
 * @example
 * ```tsx
 * const { workflow, fetchWorkflow } = useWorkflowDefinition();
 * 
 * useEffect(() => {
 *   fetchWorkflow("math-calculation");
 * }, []);
 * ```
 */
export function useWorkflowDefinition(baseUrl = "/api/workflows") {
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflow = useCallback(
    async (id: string) => {
      try {
        setLoading(true);
        const response = await fetch(`${baseUrl}/${id}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch workflow: ${response.statusText}`);
        }
        const data = (await response.json()) as WorkflowDefinition;
        setWorkflow(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [baseUrl]
  );

  return {
    workflow,
    loading,
    error,
    fetchWorkflow,
  };
}
