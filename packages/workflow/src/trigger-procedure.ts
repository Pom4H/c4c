/**
 * Trigger Procedure Utilities
 * 
 * Unified mechanism for internal and external events.
 * Both use the same trigger procedures, so workflows don't change
 * when moving from monolith to microservices!
 */

import type { Registry, Procedure } from "@c4c/core";
import { executeProcedure, createExecutionContext } from "@c4c/core";
import type { WorkflowDefinition } from "./types.js";
import { executeWorkflow } from "./runtime.js";

/**
 * Trigger procedure handler registry
 * Maps trigger procedure names to workflows that should be executed
 */
const triggerHandlers = new Map<string, Set<TriggerHandler>>();

interface TriggerHandler {
	workflow: WorkflowDefinition;
	registry: Registry;
}

/**
 * Register a workflow to be executed when a trigger procedure is called
 */
export function registerTriggerHandler(
	triggerProcedureName: string,
	workflow: WorkflowDefinition,
	registry: Registry
): () => void {
	let handlers = triggerHandlers.get(triggerProcedureName);
	if (!handlers) {
		handlers = new Set();
		triggerHandlers.set(triggerProcedureName, handlers);
	}

	const handler: TriggerHandler = { workflow, registry };
	handlers.add(handler);

	console.log(
		`[TriggerProcedure] Registered workflow '${workflow.id}' for trigger '${triggerProcedureName}'`
	);

	// Return unsubscribe function
	return () => {
		handlers?.delete(handler);
		if (handlers && handlers.size === 0) {
			triggerHandlers.delete(triggerProcedureName);
		}
	};
}

/**
 * Execute all workflows registered for a trigger procedure
 */
export async function executeTriggerHandlers(
	triggerProcedureName: string,
	eventData: unknown
): Promise<void> {
	const handlers = triggerHandlers.get(triggerProcedureName);
	if (!handlers || handlers.size === 0) {
		console.log(
			`[TriggerProcedure] No workflows registered for trigger '${triggerProcedureName}'`
		);
		return;
	}

	console.log(
		`[TriggerProcedure] Executing ${handlers.size} workflow(s) for trigger '${triggerProcedureName}'`
	);

	// Execute all registered workflows in parallel
	const promises = Array.from(handlers).map(async ({ workflow, registry }) => {
		try {
			const result = await executeWorkflow(workflow, registry, {
				trigger: {
					procedure: triggerProcedureName,
					data: eventData,
					timestamp: new Date(),
				},
				...(typeof eventData === "object" && eventData !== null ? eventData : {}),
			});

			console.log(
				`[TriggerProcedure] ✅ Workflow '${workflow.id}' completed (${result.executionTime}ms)`
			);
		} catch (error) {
			console.error(
				`[TriggerProcedure] ❌ Workflow '${workflow.id}' failed:`,
				error
			);
		}
	});

	await Promise.all(promises);
}

/**
 * Get count of workflows registered for a trigger
 */
export function getTriggerHandlerCount(triggerProcedureName: string): number {
	return triggerHandlers.get(triggerProcedureName)?.size || 0;
}

/**
 * Clear all trigger handlers (useful for testing)
 */
export function clearTriggerHandlers(): void {
	triggerHandlers.clear();
}

/**
 * Create a trigger procedure that automatically executes registered workflows
 * 
 * @param name - Trigger procedure name (e.g., 'tasks.trigger.created')
 * @param inputSchema - Zod schema for event data
 * @param options - Additional options
 */
export function createTriggerProcedure(
	name: string,
	inputSchema: any,
	options?: {
		description?: string;
		provider?: string;
		eventTypes?: string[];
		exposure?: "internal" | "external";
	}
): Procedure {
	return {
		contract: {
			name,
			description: options?.description || `Trigger: ${name}`,
			input: inputSchema,
			output: inputSchema, // Trigger procedures pass through the data
			metadata: {
				type: "trigger",
				exposure: options?.exposure || "internal",
				roles: ["trigger"],
				trigger: {
					type: "webhook",
					eventTypes: options?.eventTypes || [],
				},
				provider: options?.provider,
				tags: ["trigger", "event"],
			},
		},
		handler: async (input, context) => {
			console.log(`[TriggerProcedure] 🎯 Trigger '${name}' invoked`);
			
			// Execute all registered workflows
			await executeTriggerHandlers(name, input);
			
			// Return the input data unchanged
			return input;
		},
	};
}

/**
 * Emit an event by calling a trigger procedure
 * 
 * This works for both internal and external events:
 * - Internal: emitTriggerEvent() → trigger procedure → workflows
 * - External: webhook → trigger procedure → workflows
 * 
 * When moving from monolith to microservices, workflows don't change!
 */
export async function emitTriggerEvent(
	triggerProcedureName: string,
	eventData: unknown,
	registry: Registry
): Promise<void> {
	const procedure = registry.get(triggerProcedureName);
	
	if (!procedure) {
		console.warn(
			`[TriggerProcedure] Trigger procedure '${triggerProcedureName}' not found in registry`
		);
		return;
	}

	// Check if it's actually a trigger procedure
	const isTrigger = procedure.contract.metadata?.type === "trigger";
	if (!isTrigger) {
		console.warn(
			`[TriggerProcedure] Procedure '${triggerProcedureName}' is not a trigger procedure`
		);
		return;
	}

	console.log(`[TriggerProcedure] Emitting event to trigger '${triggerProcedureName}'`);

	// Execute the trigger procedure
	// This will automatically execute all registered workflows
	await executeProcedure(
		procedure,
		eventData,
		createExecutionContext({
			transport: "trigger-event",
			registry,
		})
	);
}
