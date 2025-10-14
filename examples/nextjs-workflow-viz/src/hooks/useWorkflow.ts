/**
 * React hooks for workflow execution with SSE
 */

import { useState, useCallback } from "react";
import type { WorkflowExecutionResult, WorkflowDefinition } from "@/lib/workflow/types";

export interface UseWorkflowOptions {
  onStart?: (data: { workflowId: string; workflowName: string }) => void;
  onProgress?: (data: { nodeId: string }) => void;
  onComplete?: (result: WorkflowExecutionResult) => void;
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
 */
export function useWorkflow(options?: UseWorkflowOptions): UseWorkflowReturn {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<WorkflowExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (workflowId: string, input?: Record<string, unknown>) => {
      setIsExecuting(true);
      setResult(null);
      setError(null);

      try {
        const response = await fetch(`/api/workflows/${workflowId}/execute`, {
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

            if (eventMatch && dataMatch) {
              const eventType = eventMatch[1];
              const data = JSON.parse(dataMatch[1]);

              switch (eventType) {
                case "workflow-start":
                  if (options?.onStart) {
                    options.onStart({
                      workflowId: data.workflowId,
                      workflowName: data.workflowName,
                    });
                  }
                  break;

                case "workflow-progress":
                  if (options?.onProgress) {
                    options.onProgress({ nodeId: data.nodeId });
                  }
                  break;

                case "workflow-complete":
                  setResult(data.result);
                  if (options?.onComplete) {
                    options.onComplete(data.result);
                  }
                  break;

                case "workflow-error":
                  const errorMsg = data.error;
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
    [options, error]
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
 */
export function useWorkflows() {
  const [workflows, setWorkflows] = useState<
    Array<{
      id: string;
      name: string;
      description: string;
      nodeCount: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/workflows");
      if (!response.ok) {
        throw new Error(`Failed to fetch workflows: ${response.statusText}`);
      }
      const data = await response.json();
      setWorkflows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    workflows,
    loading,
    error,
    fetchWorkflows,
  };
}

/**
 * Hook for fetching single workflow definition
 */
export function useWorkflowDefinition(_workflowId: string | null) {
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflow = useCallback(
    async (id: string) => {
      try {
        setLoading(true);
        const response = await fetch(`/api/workflows/${id}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch workflow: ${response.statusText}`);
        }
        const data = await response.json();
        setWorkflow(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    workflow,
    loading,
    error,
    fetchWorkflow,
  };
}
