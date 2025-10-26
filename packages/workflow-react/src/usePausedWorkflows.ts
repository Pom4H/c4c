/**
 * React hook for managing paused workflows
 * Displays workflows waiting for external events (human approval, webhooks, etc.)
 */

"use client";

import { useState, useCallback, useEffect } from "react";

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
  autoRefresh?: boolean;
  refreshInterval?: number;
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
  const {
    apiBaseUrl = "/api/workflow",
    autoRefresh = true,
    refreshInterval = 5000,
  } = options;

  const [pausedWorkflows, setPausedWorkflows] = useState<PausedWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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

        // Refresh list after resume
        await refresh();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    [apiBaseUrl, refresh]
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

        // Refresh list after cancel
        await refresh();
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      }
    },
    [apiBaseUrl, refresh]
  );

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      refresh();
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, refresh]);

  return {
    pausedWorkflows,
    isLoading,
    error,
    refresh,
    resume,
    cancel,
  };
}
