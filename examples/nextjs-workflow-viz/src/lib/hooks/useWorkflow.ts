/**
 * React hooks for workflow execution
 * 
 * Re-exports framework hooks for convenience
 * This follows the framework philosophy of keeping UI layer thin
 */

"use client";

import { useState, useCallback } from "react";
import type { WorkflowExecutionResult } from "../workflow/types";

export interface UseWorkflowOptions {
	apiBaseUrl?: string;
	onSuccess?: (result: WorkflowExecutionResult) => void;
	onError?: (error: Error) => void;
}

export interface UseWorkflowReturn {
	execute: (workflowId: string, input?: Record<string, unknown>) => Promise<WorkflowExecutionResult>;
	result: WorkflowExecutionResult | null;
	isExecuting: boolean;
	error: Error | null;
	reset: () => void;
}

/**
 * Hook for executing workflows via API
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
