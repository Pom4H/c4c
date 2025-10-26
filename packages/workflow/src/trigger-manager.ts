/**
 * Trigger Workflow Manager
 * 
 * Manages lifecycle of trigger-based workflows:
 * - Subscribes to trigger events when workflow is deployed
 * - Executes workflow from trigger node when event arrives
 * - Cleans up subscriptions when workflow is stopped
 */

import type { Registry } from "@c4c/core";
import { createExecutionContext } from "@c4c/core";
import { executeWorkflow, resumeWorkflow } from "./runtime.js";
import type { 
	WorkflowDefinition, 
	WorkflowExecutionResult, 
	WorkflowPauseState,
	WhenFilterContext 
} from "./types.js";

/**
 * Webhook event structure
 */
export interface WebhookEvent {
	id: string;
	provider: string;
	triggerId?: string;
	subscriptionId?: string;
	eventType?: string;
	payload: unknown;
	headers: Record<string, string>;
	timestamp: Date;
}

/**
 * Trigger subscription information
 */
export interface TriggerSubscription {
	workflowId: string;
	subscriptionId: string;
	provider: string;
	triggerId: string;
	channelId?: string;
	resourceId?: string;
	createdAt: Date;
	expiresAt?: Date;
	metadata?: Record<string, unknown>;
}

/**
 * Options for deploying a trigger workflow
 */
export interface DeployTriggerWorkflowOptions {
	/** Webhook URL for receiving events */
	webhookUrl: string;
	/** Additional configuration for the trigger subscription */
	subscriptionConfig?: Record<string, unknown>;
}

/**
 * Manager for trigger-based workflows
 */
export class TriggerWorkflowManager {
	private subscriptions = new Map<string, TriggerSubscription>();
	private workflows = new Map<string, WorkflowDefinition>();
	private eventHandlers = new Map<string, (event: WebhookEvent) => Promise<void>>();
	// In-memory storage for paused workflow executions
	private pausedExecutions = new Map<string, {
		workflow: WorkflowDefinition;
		pauseState: WorkflowPauseState;
	}>();

	constructor(
		private registry: Registry,
		private webhookRegistry?: WebhookRegistryInterface
	) {}

	/**
	 * Deploy a trigger-based workflow
	 * Creates webhook subscription and starts listening for events
	 */
	async deploy(
		workflow: WorkflowDefinition,
		options: DeployTriggerWorkflowOptions
	): Promise<TriggerSubscription> {
		if (!workflow.trigger) {
			throw new Error(
				`Workflow ${workflow.id} is not a trigger-based workflow. Add trigger configuration.`
			);
		}

		console.log(`[TriggerManager] Deploying trigger workflow: ${workflow.id}`);

		// Get the trigger procedure
		const triggerProcedure = this.registry.get(workflow.trigger.triggerProcedure);
		if (!triggerProcedure) {
			throw new Error(
				`Trigger procedure ${workflow.trigger.triggerProcedure} not found in registry`
			);
		}

		// Prepare subscription config
		const subscriptionConfig = {
			...workflow.trigger.subscriptionConfig,
			...options.subscriptionConfig,
			webhookUrl: options.webhookUrl,
		};

		// Call trigger procedure to create subscription
		console.log(`[TriggerManager] Creating subscription via ${workflow.trigger.triggerProcedure}`);
		const subscriptionResult = await triggerProcedure.handler(
			subscriptionConfig,
			createExecutionContext({
				transport: "trigger-manager",
				registry: this.registry,
			})
		);

		// Extract subscription info from result
		const resultObj = subscriptionResult as Record<string, unknown>;
		const subscriptionId = (resultObj.id as string | undefined) || 
			`sub_${workflow.id}_${Date.now()}`;
		const channelId = resultObj.channelId as string | undefined;
		const resourceId = resultObj.resourceId as string | undefined;
		const expiration = resultObj.expiration as string | undefined;

		// Create subscription record
		const subscription: TriggerSubscription = {
			workflowId: workflow.id,
			subscriptionId,
			provider: workflow.trigger.provider,
			triggerId: workflow.trigger.triggerProcedure,
			channelId,
			resourceId,
			createdAt: new Date(),
			expiresAt: expiration ? new Date(expiration) : undefined,
			metadata: resultObj as Record<string, unknown>,
		};

		// Store subscription
		this.subscriptions.set(workflow.id, subscription);
		this.workflows.set(workflow.id, workflow);

		// Register event handler
		const handler = async (event: WebhookEvent) => {
			await this.handleTriggerEvent(workflow, event);
		};
		this.eventHandlers.set(workflow.id, handler);

		// Register with webhook registry if available
		if (this.webhookRegistry) {
			this.webhookRegistry.registerHandler(workflow.trigger.provider, handler);
		}

		console.log(`[TriggerManager] ✅ Deployed workflow ${workflow.id}`, {
			provider: workflow.trigger.provider,
			subscriptionId,
		});

		return subscription;
	}

	/**
	 * Stop a trigger-based workflow and clean up subscription
	 */
	async stop(workflowId: string): Promise<void> {
		const subscription = this.subscriptions.get(workflowId);
		const workflow = this.workflows.get(workflowId);

		if (!subscription || !workflow) {
			console.warn(`[TriggerManager] Workflow ${workflowId} not found or not deployed`);
			return;
		}

		console.log(`[TriggerManager] Stopping workflow: ${workflowId}`);

		// Unregister event handler
		const handler = this.eventHandlers.get(workflowId);
		if (handler && this.webhookRegistry) {
			this.webhookRegistry.unregisterHandler(subscription.provider, handler);
		}
		this.eventHandlers.delete(workflowId);

		// Call stop procedure if available
		if (workflow.trigger) {
			const stopProcedureName = this.findStopProcedure(workflow.trigger.triggerProcedure);
			if (stopProcedureName) {
				const stopProcedure = this.registry.get(stopProcedureName);
				if (stopProcedure) {
					try {
						await stopProcedure.handler(
							{
								channelId: subscription.channelId,
								resourceId: subscription.resourceId,
								id: subscription.subscriptionId,
								requestBody: {
									id: subscription.channelId || subscription.subscriptionId,
									resourceId: subscription.resourceId,
								},
							},
							createExecutionContext({
								transport: "trigger-manager",
								registry: this.registry,
							})
						);
						console.log(`[TriggerManager] ✅ Cleaned up subscription via ${stopProcedureName}`);
					} catch (error) {
						console.error(
							`[TriggerManager] Failed to cleanup subscription:`,
							error
						);
					}
				}
			}
		}

		// Remove from local storage
		this.subscriptions.delete(workflowId);
		this.workflows.delete(workflowId);

		console.log(`[TriggerManager] ✅ Stopped workflow: ${workflowId}`);
	}

	/**
	 * Handle incoming trigger event
	 * Checks for paused executions first, then starts new workflow if needed
	 */
	private async handleTriggerEvent(
		workflow: WorkflowDefinition,
		event: WebhookEvent
	): Promise<WorkflowExecutionResult> {
		console.log(`[TriggerManager] 🎯 Received event for workflow: ${workflow.id}`, {
			eventId: event.id,
			provider: event.provider,
			eventType: event.eventType,
			triggerId: event.triggerId,
		});

		// Check if this event should resume a paused execution
		const paused = this.findPausedExecution(event);
		
		if (paused) {
			console.log(`[TriggerManager] 🔄 Resuming paused execution: ${paused.pauseState.executionId}`);
			
			try {
				const result = await resumeWorkflow(
					paused.workflow,
					this.registry,
					paused.pauseState,
					event.payload
				);

				// Remove from paused executions
				this.pausedExecutions.delete(paused.pauseState.executionId);

				// If workflow paused again, save it
				if (result.status === 'paused' && result.resumeState) {
					const pauseState = result.resumeState as WorkflowPauseState;
					this.pausedExecutions.set(result.executionId, {
						workflow: paused.workflow,
						pauseState,
					});
					
					// Schedule timeout if configured
					if (pauseState.timeoutAt) {
						this.scheduleTimeout(result.executionId, pauseState.timeoutAt);
					}
				}

				console.log(`[TriggerManager] ✅ Resumed workflow ${result.status}:`, {
					executionId: result.executionId,
					executionTime: result.executionTime,
				});

				return result;
			} catch (error) {
				console.error(`[TriggerManager] ❌ Resume failed:`, error);
				// Remove from paused executions on error
				this.pausedExecutions.delete(paused.pauseState.executionId);
				throw error;
			}
		}

		// No paused execution found - start new workflow
		// Filter by event type if configured
		if (workflow.trigger?.eventType && event.eventType !== workflow.trigger.eventType) {
			console.log(
				`[TriggerManager] Event type ${event.eventType} doesn't match filter ${workflow.trigger.eventType}, skipping`
			);
			return {
				executionId: `skip_${Date.now()}`,
				status: "cancelled",
				outputs: {},
				executionTime: 0,
				nodesExecuted: [],
			};
		}

		// Prepare initial input with event data
		const initialInput = {
			...workflow.variables,
			// Inject event data into workflow context
			trigger: {
				event: event.eventType,
				payload: event.payload,
				headers: event.headers,
				timestamp: event.timestamp,
				provider: event.provider,
			},
			// Also add as 'webhook' for backward compatibility
			webhook: {
				event: event.eventType,
				payload: event.payload,
				headers: event.headers,
				timestamp: event.timestamp,
			},
		};

		// Execute workflow from the start
		try {
			const result = await executeWorkflow(
				workflow,
				this.registry,
				initialInput
			);

			// If workflow paused, save it for resume
			if (result.status === 'paused' && result.resumeState) {
				const pauseState = result.resumeState as WorkflowPauseState;
				this.pausedExecutions.set(result.executionId, {
					workflow,
					pauseState,
				});
				
				console.log(`[TriggerManager] 💾 Saved paused execution: ${result.executionId}`);
				console.log(`[TriggerManager] 📢 Waiting for: ${pauseState.waitingFor.procedures.join(', ')}`);
				
				// Schedule timeout if configured
				if (pauseState.timeoutAt) {
					this.scheduleTimeout(result.executionId, pauseState.timeoutAt);
				}
			}

			console.log(`[TriggerManager] ✅ Workflow execution ${result.status}:`, {
				workflowId: workflow.id,
				executionId: result.executionId,
				executionTime: result.executionTime,
				nodesExecuted: result.nodesExecuted.length,
			});

			return result;
		} catch (error) {
			console.error(
				`[TriggerManager] ❌ Workflow execution failed:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Find the stop procedure for a trigger
	 */
	private findStopProcedure(triggerProcedureName: string): string | undefined {
		// Try to find by metadata first
		const triggerProc = this.registry.get(triggerProcedureName);
		if (triggerProc?.contract.metadata?.trigger?.stopProcedure) {
			return triggerProc.contract.metadata.trigger.stopProcedure as string;
		}

		// Common patterns for stop procedures
		const patterns = [
			triggerProcedureName.replace(".watch", ".stop"),
			triggerProcedureName.replace(".subscribe", ".unsubscribe"),
			triggerProcedureName.replace("Watch", "Stop"),
			triggerProcedureName.replace("Subscribe", "Unsubscribe"),
		];

		for (const pattern of patterns) {
			if (this.registry.has(pattern)) {
				return pattern;
			}
		}

		// Check for channels.stop pattern (Google Drive)
		if (triggerProcedureName.includes(".changes.watch")) {
			const stopProc = triggerProcedureName.replace(".changes.watch", ".channels.stop");
			if (this.registry.has(stopProc)) {
				return stopProc;
			}
		}

		return undefined;
	}

	/**
	 * Find paused execution waiting for this event
	 */
	private findPausedExecution(event: WebhookEvent): {
		workflow: WorkflowDefinition;
		pauseState: WorkflowPauseState;
	} | null {
		for (const [execId, { workflow, pauseState }] of this.pausedExecutions) {
			// Check if event matches one of the waiting procedures
			const procedureMatch = pauseState.waitingFor.procedures.some(proc => {
				// Match by procedure name or triggerId
				return proc === event.triggerId || 
					   event.triggerId?.includes(proc) ||
					   proc.includes(event.triggerId || '');
			});

			if (!procedureMatch) {
				continue;
			}

			// Check filter if configured
			if (pauseState.waitingFor.filter) {
				try {
					const filterContext: WhenFilterContext = {
						variables: pauseState.variables,
						nodeOutputs: new Map(Object.entries(pauseState.nodeOutputs)),
						executionId: pauseState.executionId,
						workflowId: pauseState.workflowId,
					};

					const matches = pauseState.waitingFor.filter(event.payload, filterContext);
					if (!matches) {
						continue;
					}
				} catch (error) {
					console.error(
						`[TriggerManager] Filter evaluation failed for execution ${execId}:`,
						error
					);
					continue;
				}
			}

			// Found matching paused execution
			return { workflow, pauseState };
		}

		return null;
	}

	/**
	 * Schedule timeout for paused execution
	 */
	private scheduleTimeout(executionId: string, timeoutAt: Date): void {
		const delay = timeoutAt.getTime() - Date.now();
		
		if (delay <= 0) {
			// Already timed out
			this.handleTimeout(executionId);
			return;
		}

		setTimeout(() => {
			this.handleTimeout(executionId);
		}, delay);

		console.log(
			`[TriggerManager] ⏰ Scheduled timeout for execution ${executionId} in ${Math.round(delay / 1000)}s`
		);
	}

	/**
	 * Handle timeout for paused execution
	 */
	private async handleTimeout(executionId: string): Promise<void> {
		const paused = this.pausedExecutions.get(executionId);
		
		if (!paused) {
			// Already resumed or removed
			return;
		}

		console.log(`[TriggerManager] ⏰ Timeout reached for execution: ${executionId}`);
		console.log(`[TriggerManager] 🚫 Cancelling paused workflow`);

		// Remove from paused executions
		this.pausedExecutions.delete(executionId);

		// TODO: In production, should trigger onTimeout handler or mark as failed
		// For now, just log and remove
	}

	/**
	 * Get all paused executions
	 */
	getPausedExecutions(): Array<{
		executionId: string;
		workflowId: string;
		pausedAt: string;
		pausedTime: Date;
		waitingFor: string[];
		timeoutAt?: Date;
	}> {
		return Array.from(this.pausedExecutions.entries()).map(([execId, { workflow, pauseState }]) => ({
			executionId: execId,
			workflowId: workflow.id,
			pausedAt: pauseState.pausedAt,
			pausedTime: pauseState.pausedTime,
			waitingFor: pauseState.waitingFor.procedures,
			timeoutAt: pauseState.timeoutAt,
		}));
	}

	/**
	 * Get all active subscriptions
	 */
	getSubscriptions(): TriggerSubscription[] {
		return Array.from(this.subscriptions.values());
	}

	/**
	 * Get subscription for a workflow
	 */
	getSubscription(workflowId: string): TriggerSubscription | undefined {
		return this.subscriptions.get(workflowId);
	}

	/**
	 * Stop all workflows and clean up
	 */
	async stopAll(): Promise<void> {
		const workflowIds = Array.from(this.workflows.keys());
		
		console.log(`[TriggerManager] Stopping all ${workflowIds.length} workflows`);
		
		await Promise.all(
			workflowIds.map(id => this.stop(id))
		);
	}
}

/**
 * Minimal webhook registry interface
 */
interface WebhookRegistryInterface {
	registerHandler(provider: string, handler: (event: WebhookEvent) => Promise<void>): void;
	unregisterHandler(provider: string, handler: (event: WebhookEvent) => Promise<void>): void;
}

/**
 * Create a trigger workflow manager
 */
export function createTriggerWorkflowManager(
	registry: Registry,
	webhookRegistry?: WebhookRegistryInterface
): TriggerWorkflowManager {
	return new TriggerWorkflowManager(registry, webhookRegistry);
}
