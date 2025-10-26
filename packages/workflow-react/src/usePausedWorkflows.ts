/**
 * React hook for managing paused workflows
 * Uses Server-Sent Events (SSE) for real-time updates
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface PausedWorkflow {
  executionId: string;
  workflowId: string;
  workflowName?: string;
  pausedAt: string;
  pausedTime: Date | string;
  waitingFor: string[];
  timeoutAt?: Date | string;
  variables?: Record<string, unknown>;
}

export interface UsePausedWorkflowsOptions {
  apiBaseUrl?: string;
}

export interface UsePausedWorkflowsReturn {
  pausedWorkflows: PausedWorkflow[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  resume: (executionId: string, data: unknown) => Promise<void>;
  cancel: (executionId: string) => Promise<void>;
}

export function usePausedWorkflows(
  options: UsePausedWorkflowsOptions = {}
): UsePausedWorkflowsReturn {
  const { apiBaseUrl = "/api/workflow" } = options;

  const [pausedWorkflows, setPausedWorkflows] = useState<PausedWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/paused`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setPausedWorkflows(data.pausedWorkflows || []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error("[usePausedWorkflows] Failed to fetch:", error);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  const resume = useCallback(
    async (executionId: string, data: unknown) => {
      try {
        const response = await fetch(`${apiBaseUrl}/resume`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ executionId, data }),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        // Note: SSE will automatically update the list when workflow resumes
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    [apiBaseUrl]
  );

  const cancel = useCallback(
    async (executionId: string) => {
      try {
        const response = await fetch(`${apiBaseUrl}/cancel`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ executionId }),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        // Note: SSE will automatically update the list when workflow is cancelled
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    [apiBaseUrl]
  );

  // Setup SSE for real-time updates
  useEffect(() => {
    // Initial fetch
    refresh();

    // Setup SSE connection
    const eventSource = new EventSource(`${apiBaseUrl}/paused-stream`);

    eventSourceRef.current = eventSource;

    // Initial list of paused workflows
    eventSource.addEventListener("paused.initial", (event) => {
      try {
        const data = JSON.parse(event.data);
        setPausedWorkflows(data.pausedWorkflows || []);
        setIsLoading(false);
      } catch (error) {
        console.error("[usePausedWorkflows] Failed to process SSE initial event:", error);
      }
    });

    // Workflow paused event
    eventSource.addEventListener("workflow.paused", (event) => {
      try {
        const workflow = JSON.parse(event.data);
        setPausedWorkflows((prev) => {
          // Add if not already in list
          if (prev.some((w) => w.executionId === workflow.executionId)) {
            return prev;
          }
          return [...prev, workflow];
        });
      } catch (error) {
        console.error("[usePausedWorkflows] Failed to process paused event:", error);
      }
    });

    // Workflow resumed event
    eventSource.addEventListener("workflow.resumed", (event) => {
      try {
        const { executionId } = JSON.parse(event.data);
        setPausedWorkflows((prev) => prev.filter((w) => w.executionId !== executionId));
      } catch (error) {
        console.error("[usePausedWorkflows] Failed to process resumed event:", error);
      }
    });

    // Workflow cancelled event
    eventSource.addEventListener("workflow.cancelled", (event) => {
      try {
        const { executionId } = JSON.parse(event.data);
        setPausedWorkflows((prev) => prev.filter((w) => w.executionId !== executionId));
      } catch (error) {
        console.error("[usePausedWorkflows] Failed to process cancelled event:", error);
      }
    });

    eventSource.onerror = () => {
      console.warn("[usePausedWorkflows] SSE connection error, will auto-reconnect");
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [apiBaseUrl, refresh]);

  return {
    pausedWorkflows,
    isLoading,
    error,
    refresh,
    resume,
    cancel,
  };
}
