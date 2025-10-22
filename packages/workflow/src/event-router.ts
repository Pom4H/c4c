/**
 * Event Router for connecting webhook events to workflow executions
 * 
 * Manages the mapping between trigger events and paused workflow executions
 */

import type { WebhookEvent } from "@c4c/adapters/webhook";
import type { WorkflowDefinition, WorkflowExecutionResult } from "./types.js";

/**
 * Paused workflow execution waiting for an event
 */
export interface PausedExecution {
	workflowId: string;
	executionId: string;
	/** Node ID where the workflow is paused */
	pausedAt: string;
	/** Event filter criteria */
	resumeOn: EventFilter;
	/** Workflow state for resumption */
	state: WorkflowResumeState;
	/** When the execution was paused */
	pausedTime: Date;
	/** Timeout for resumption (in ms) */
	timeout?: number;
}

/**
 * Event filter for matching webhook events
 */
export interface EventFilter {
	/** Provider name (e.g., "googleDrive") */
	provider?: string;
	/** Trigger procedure name */
	triggerId?: string;
	/** Subscription ID */
	subscriptionId?: string;
	/** Event type */
	eventType?: string;
	/** Custom filter function */
	filter?: (event: WebhookEvent) => boolean;
}

/**
 * Workflow resume state
 */
export interface WorkflowResumeState {
	workflowId: string;
	executionId: string;
	currentNode: string;
	variables: Record<string, unknown>;
	nodeOutputs: Record<string, unknown>;
	nodesExecuted: string[];
}

/**
 * Resume handler function
 */
export type ResumeHandler = (
	state: WorkflowResumeState,
	event: WebhookEvent
) => Promise<WorkflowExecutionResult>;

/**
 * Event Router class
 */
export class EventRouter {
	private pausedExecutions = new Map<string, PausedExecution>();
	private resumeHandlers = new Map<string, ResumeHandler>();
	private timeouts = new Map<string, NodeJS.Timeout>();

	/**
	 * Register a paused execution waiting for an event
	 */
	registerPausedExecution(execution: PausedExecution): void {
		const key = execution.executionId;
		this.pausedExecutions.set(key, execution);

		// Set timeout if specified
		if (execution.timeout) {
			const timeoutId = setTimeout(() => {
				this.handleTimeout(execution);
			}, execution.timeout);
			
			this.timeouts.set(key, timeoutId);
		}

		console.log(`[EventRouter] Registered paused execution:`, {
			workflowId: execution.workflowId,
			executionId: execution.executionId,
			resumeOn: execution.resumeOn,
		});
	}

	/**
	 * Unregister a paused execution
	 */
	unregisterPausedExecution(executionId: string): void {
		this.pausedExecutions.delete(executionId);
		
		// Clear timeout
		const timeoutId = this.timeouts.get(executionId);
		if (timeoutId) {
			clearTimeout(timeoutId);
			this.timeouts.delete(executionId);
		}
	}

	/**
	 * Register a resume handler for a workflow
	 */
	registerResumeHandler(workflowId: string, handler: ResumeHandler): void {
		this.resumeHandlers.set(workflowId, handler);
	}

	/**
	 * Unregister a resume handler
	 */
	unregisterResumeHandler(workflowId: string): void {
		this.resumeHandlers.delete(workflowId);
	}

	/**
	 * Route an incoming webhook event to matching paused executions
	 */
	async routeEvent(event: WebhookEvent): Promise<RouteResult[]> {
		const results: RouteResult[] = [];

		// Find matching paused executions
		const matches = this.findMatchingExecutions(event);

		console.log(`[EventRouter] Event ${event.id} matched ${matches.length} executions`);

		// Resume each matching execution
		for (const execution of matches) {
			try {
				const result = await this.resumeExecution(execution, event);
				results.push({
					executionId: execution.executionId,
					success: true,
					result,
				});
			} catch (error) {
				console.error(
					`[EventRouter] Failed to resume execution ${execution.executionId}:`,
					error
				);
				results.push({
					executionId: execution.executionId,
					success: false,
					error: error instanceof Error ? error : new Error(String(error)),
				});
			}
		}

		return results;
	}

	/**
	 * Find paused executions that match the event
	 */
	private findMatchingExecutions(event: WebhookEvent): PausedExecution[] {
		const matches: PausedExecution[] = [];

		for (const execution of this.pausedExecutions.values()) {
			if (this.matchesFilter(event, execution.resumeOn)) {
				matches.push(execution);
			}
		}

		return matches;
	}

	/**
	 * Check if an event matches a filter
	 */
	private matchesFilter(event: WebhookEvent, filter: EventFilter): boolean {
		// Check provider
		if (filter.provider && event.provider !== filter.provider) {
			return false;
		}

		// Check trigger ID
		if (filter.triggerId && event.triggerId !== filter.triggerId) {
			return false;
		}

		// Check subscription ID
		if (filter.subscriptionId && event.subscriptionId !== filter.subscriptionId) {
			return false;
		}

		// Check event type
		if (filter.eventType && event.eventType !== filter.eventType) {
			return false;
		}

		// Check custom filter
		if (filter.filter && !filter.filter(event)) {
			return false;
		}

		return true;
	}

	/**
	 * Resume a paused execution with an event
	 */
	private async resumeExecution(
		execution: PausedExecution,
		event: WebhookEvent
	): Promise<WorkflowExecutionResult> {
		// Get resume handler
		const handler = this.resumeHandlers.get(execution.workflowId);
		if (!handler) {
			throw new Error(
				`No resume handler registered for workflow ${execution.workflowId}`
			);
		}

		// Inject event into workflow variables
		const stateWithEvent: WorkflowResumeState = {
			...execution.state,
			variables: {
				...execution.state.variables,
				webhook: {
					event: event.eventType,
					payload: event.payload,
					headers: event.headers,
					timestamp: event.timestamp,
				},
			},
		};

		// Unregister execution before resuming (to prevent double-processing)
		this.unregisterPausedExecution(execution.executionId);

		// Resume workflow
		const result = await handler(stateWithEvent, event);

		console.log(`[EventRouter] Resumed execution:`, {
			executionId: execution.executionId,
			status: result.status,
		});

		return result;
	}

	/**
	 * Handle execution timeout
	 */
	private handleTimeout(execution: PausedExecution): void {
		console.warn(
			`[EventRouter] Execution ${execution.executionId} timed out waiting for event`
		);

		this.unregisterPausedExecution(execution.executionId);

		// TODO: Call timeout handler or fail the workflow
	}

	/**
	 * Get all paused executions
	 */
	getPausedExecutions(): PausedExecution[] {
		return Array.from(this.pausedExecutions.values());
	}

	/**
	 * Get paused execution by ID
	 */
	getPausedExecution(executionId: string): PausedExecution | undefined {
		return this.pausedExecutions.get(executionId);
	}

	/**
	 * Clear all paused executions
	 */
	clear(): void {
		// Clear all timeouts
		for (const timeoutId of this.timeouts.values()) {
			clearTimeout(timeoutId);
		}

		this.pausedExecutions.clear();
		this.timeouts.clear();
	}
}

/**
 * Result of routing an event
 */
export interface RouteResult {
	executionId: string;
	success: boolean;
	result?: WorkflowExecutionResult;
	error?: Error;
}

/**
 * Create a default event router instance
 */
export function createEventRouter(): EventRouter {
	return new EventRouter();
}
