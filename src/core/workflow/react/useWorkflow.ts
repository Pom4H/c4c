/**
 * React hook for workflow execution
 * 
 * This hook provides a clean interface for React components to execute workflows
 * All business logic and OTEL tracing happens server-side via API routes
 */

"use client";

import { useState, useCallback } from "react";
import type { WorkflowExecutionResult } from "../types.js";

export interface UseWorkflowOptions {
	/**
	 * Base URL for workflow API endpoints
	 * Defaults to '/api/workflow'
	 */
	apiBaseUrl?: string;

	/**
	 * Callback when workflow execution completes successfully
	 */
	onSuccess?: (result: WorkflowExecutionResult) => void;

	/**
	 * Callback when workflow execution fails
	 */
	onError?: (error: Error) => void;
}

export interface UseWorkflowReturn {
	/**
	 * Execute a workflow by ID
	 */
	execute: (workflowId: string, input?: Record<string, unknown>) => Promise<WorkflowExecutionResult>;

	/**
	 * Current execution result (null if not executed)
	 */
	result: WorkflowExecutionResult | null;

	/**
	 * Loading state
	 */
	isExecuting: boolean;

	/**
	 * Error state (null if no error)
	 */
	error: Error | null;

	/**
	 * Reset state
	 */
	reset: () => void;
}

/**
 * Hook for executing workflows via API
 * 
 * @example
 * ```tsx
 * const { execute, result, isExecuting, error } = useWorkflow({
 *   onSuccess: (result) => console.log('Done!', result),
 *   onError: (err) => console.error('Failed:', err)
 * });
 * 
 * // Execute workflow
 * await execute('my-workflow-id', { input: 'data' });
 * ```
 */
export function useWorkflow(options: UseWorkflowOptions = {}): UseWorkflowReturn {
	const { apiBaseUrl = "/api/workflow", onSuccess, onError } = options;

	const [result, setResult] = useState<WorkflowExecutionResult | null>(null);
	const [isExecuting, setIsExecuting] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	const execute = useCallback(
		async (workflowId: string, input?: Record<string, unknown>): Promise<WorkflowExecutionResult> => {
			setIsExecuting(true);
			setError(null);
			setResult(null);

			try {
				const response = await fetch(`${apiBaseUrl}/execute`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ workflowId, input }),
				});

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
					throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
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

/**
 * Hook for fetching available workflows
 */
export function useWorkflows(options: { apiBaseUrl?: string } = {}) {
	const { apiBaseUrl = "/api/workflow" } = options;
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
 * Hook for fetching workflow definition
 */
export function useWorkflowDefinition(
	workflowId: string | null,
	options: { apiBaseUrl?: string } = {}
) {
	const { apiBaseUrl = "/api/workflow" } = options;
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
			const response = await fetch(`${apiBaseUrl}/definition?id=${workflowId}`);

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
