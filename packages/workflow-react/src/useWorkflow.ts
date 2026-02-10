/**
 * React hooks for the Workflow DevKit
 *
 * Provides React hooks for starting, monitoring, and interacting
 * with workflow runs from the browser.
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Workflow run result from the API
 */
export interface WorkflowRunResult {
	runId: string;
	status: "running" | "completed" | "failed" | "suspended";
	result?: unknown;
	error?: string;
	executionTime?: number;
}

export interface UseWorkflowOptions {
	/** Base URL for the workflow API (default: "/api/workflow") */
	apiBaseUrl?: string;
	/** Called when a workflow completes successfully */
	onSuccess?: (result: WorkflowRunResult) => void;
	/** Called when a workflow fails */
	onError?: (error: Error) => void;
}

export interface UseWorkflowReturn {
	/** Start a workflow by name with optional arguments */
	start: (
		workflowName: string,
		args?: unknown[],
		options?: { runId?: string },
	) => Promise<WorkflowRunResult>;
	/** Current run result */
	result: WorkflowRunResult | null;
	/** Whether a workflow is currently executing */
	isRunning: boolean;
	/** Error if the workflow failed */
	error: Error | null;
	/** Reset the state */
	reset: () => void;
}

/**
 * Hook for starting and monitoring workflow runs
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { start, result, isRunning, error } = useWorkflow();
 *
 *   return (
 *     <div>
 *       <button onClick={() => start("mathWorkflow", [5, 10])}>
 *         Run Workflow
 *       </button>
 *       {isRunning && <p>Running...</p>}
 *       {result && <p>Result: {JSON.stringify(result.result)}</p>}
 *       {error && <p>Error: {error.message}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWorkflow(options: UseWorkflowOptions = {}): UseWorkflowReturn {
	const { apiBaseUrl = "/api/workflow", onSuccess, onError } = options;

	const [result, setResult] = useState<WorkflowRunResult | null>(null);
	const [isRunning, setIsRunning] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const startWorkflow = useCallback(
		async (
			workflowName: string,
			args?: unknown[],
			startOptions?: { runId?: string },
		): Promise<WorkflowRunResult> => {
			setIsRunning(true);
			setError(null);
			setResult(null);

			try {
				const response = await fetch(`${apiBaseUrl}/start`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						workflow: workflowName,
						args: args ?? [],
						runId: startOptions?.runId,
					}),
				});

				if (!response.ok) {
					const errorData = await response
						.json()
						.catch(() => ({ error: "Unknown error" }));
					throw new Error(
						errorData.error || `HTTP ${response.status}: ${response.statusText}`,
					);
				}

				const runResult = await response.json();
				setResult(runResult);

				if (onSuccess) {
					onSuccess(runResult);
				}

				return runResult;
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));
				setError(error);

				if (onError) {
					onError(error);
				}

				throw error;
			} finally {
				setIsRunning(false);
			}
		},
		[apiBaseUrl, onSuccess, onError],
	);

	const reset = useCallback(() => {
		setResult(null);
		setError(null);
		setIsRunning(false);
	}, []);

	return {
		start: startWorkflow,
		result,
		isRunning,
		error,
		reset,
	};
}

/**
 * Hook for streaming workflow events via SSE
 *
 * @example
 * ```tsx
 * function WorkflowMonitor({ runId }: { runId: string }) {
 *   const { events, isConnected } = useWorkflowStream(runId);
 *
 *   return (
 *     <div>
 *       <p>Connected: {isConnected ? "Yes" : "No"}</p>
 *       {events.map((event, i) => (
 *         <div key={i}>{event.type}: {JSON.stringify(event)}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWorkflowStream(
	runId: string | null,
	options: { apiBaseUrl?: string } = {},
) {
	const { apiBaseUrl = "/api/workflow" } = options;
	const [events, setEvents] = useState<unknown[]>([]);
	const [isConnected, setIsConnected] = useState(false);
	const eventSourceRef = useRef<EventSource | null>(null);

	useEffect(() => {
		if (!runId) {
			return;
		}

		const es = new EventSource(
			`${apiBaseUrl}/runs/${encodeURIComponent(runId)}/stream`,
		);
		eventSourceRef.current = es;

		es.onopen = () => {
			setIsConnected(true);
		};

		es.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				setEvents((prev) => [...prev, data]);
			} catch {
				// ignore parse errors
			}
		};

		es.onerror = () => {
			setIsConnected(false);
		};

		return () => {
			es.close();
			eventSourceRef.current = null;
			setIsConnected(false);
		};
	}, [runId, apiBaseUrl]);

	return {
		events,
		isConnected,
		clear: () => setEvents([]),
	};
}

/**
 * Hook for listing available workflows
 */
export function useWorkflowList(
	options: { apiBaseUrl?: string } = {},
) {
	const { apiBaseUrl = "/api/workflow" } = options;
	const [workflows, setWorkflows] = useState<
		Array<{ name: string; description?: string }>
	>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const fetchWorkflows = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(`${apiBaseUrl}/list`);

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

/**
 * Hook for listing workflow run history
 */
export function useWorkflowRuns(
	options: { apiBaseUrl?: string; autoRefresh?: boolean } = {},
) {
	const { apiBaseUrl = "/api/workflow", autoRefresh = false } = options;
	const [runs, setRuns] = useState<WorkflowRunResult[]>([]);
	const [stats, setStats] = useState<Record<string, number>>({});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const fetchRuns = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch(`${apiBaseUrl}/runs`);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			setRuns(data.runs || []);
			setStats(data.stats || {});
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			setError(error);
		} finally {
			setIsLoading(false);
		}
	}, [apiBaseUrl]);

	useEffect(() => {
		if (autoRefresh) {
			fetchRuns();
			const interval = setInterval(fetchRuns, 5000);
			return () => clearInterval(interval);
		}
	}, [autoRefresh, fetchRuns]);

	return {
		runs,
		stats,
		isLoading,
		error,
		fetchRuns,
	};
}
