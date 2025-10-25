/**
 * Trigger utilities for managing webhook/subscription-based procedures
 */

import type { Contract, Procedure, Registry, TriggerMetadata } from "./types.js";

/**
 * Check if a procedure is a trigger
 */
export function isTrigger(procedure: Procedure): boolean {
	return procedure.contract.metadata?.type === "trigger";
}

/**
 * Check if a procedure is a trigger stop/cleanup operation
 */
export function isTriggerStopOperation(procedure: Procedure): boolean {
	const operation = procedure.contract.metadata?.operation;
	if (!operation || typeof operation !== "string") return false;

	const stopKeywords = ["stop", "unsubscribe", "cancel", "close"];
	const operationLower = operation.toLowerCase();

	return stopKeywords.some((keyword) => operationLower.includes(keyword));
}

/**
 * Get trigger metadata from a procedure
 */
export function getTriggerMetadata(procedure: Procedure): TriggerMetadata | undefined {
	return procedure.contract.metadata?.trigger;
}

/**
 * Find all triggers in a registry
 */
export function findTriggers(registry: Registry): Map<string, Procedure> {
	const triggers = new Map<string, Procedure>();

	for (const [name, procedure] of registry.entries()) {
		if (isTrigger(procedure)) {
			triggers.set(name, procedure);
		}
	}

	return triggers;
}

/**
 * Find the stop procedure for a trigger
 */
export function findStopProcedure(registry: Registry, trigger: Procedure): Procedure | undefined {
	const triggerMetadata = getTriggerMetadata(trigger);

	if (!triggerMetadata?.stopProcedure) {
		return undefined;
	}

	return registry.get(triggerMetadata.stopProcedure);
}

/**
 * Group triggers by provider
 */
export function groupTriggersByProvider(registry: Registry): Map<string, Map<string, Procedure>> {
	const triggers = findTriggers(registry);
	const grouped = new Map<string, Map<string, Procedure>>();

	for (const [name, procedure] of triggers.entries()) {
		const provider = procedure.contract.metadata?.provider;
		if (!provider || typeof provider !== "string") continue;

		if (!grouped.has(provider)) {
			grouped.set(provider, new Map());
		}

		grouped.get(provider)!.set(name, procedure);
	}

	return grouped;
}

/**
 * Validate that a trigger has proper configuration
 */
export function validateTrigger(procedure: Procedure): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	if (!isTrigger(procedure)) {
		errors.push("Procedure is not marked as a trigger");
		return { valid: false, errors };
	}

	const triggerMetadata = getTriggerMetadata(procedure);

	if (!triggerMetadata) {
		errors.push("Missing trigger metadata");
		return { valid: false, errors };
	}

	if (!triggerMetadata.type) {
		errors.push("Missing trigger type");
	}

	if (triggerMetadata.requiresChannelManagement && !triggerMetadata.stopProcedure) {
		errors.push("Trigger requires channel management but no stopProcedure is specified");
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Get a user-friendly description of a trigger
 */
export function describeTrigger(procedure: Procedure): string {
	if (!isTrigger(procedure)) {
		return "Not a trigger";
	}

	const metadata = getTriggerMetadata(procedure);
	if (!metadata) {
		return "Trigger (no metadata)";
	}

	const parts = [`Trigger (${metadata.type})`];

	if (metadata.requiresChannelManagement) {
		parts.push("requires channel management");
	}

	if (metadata.stopProcedure) {
		parts.push(`stop: ${metadata.stopProcedure}`);
	}

	if (metadata.eventTypes?.length) {
		parts.push(`events: ${metadata.eventTypes.join(", ")}`);
	}

	return parts.join(" | ");
}

/**
 * Create a trigger subscription manager
 */
export interface TriggerSubscription {
	triggerId: string;
	subscriptionId: string;
	channelId?: string;
	createdAt: Date;
	stopProcedure?: string;
}

export class TriggerSubscriptionManager {
	private subscriptions = new Map<string, TriggerSubscription>();

	/**
	 * Register a new trigger subscription
	 */
	register(subscription: TriggerSubscription): void {
		this.subscriptions.set(subscription.subscriptionId, subscription);
	}

	/**
	 * Unregister a trigger subscription
	 */
	unregister(subscriptionId: string): boolean {
		return this.subscriptions.delete(subscriptionId);
	}

	/**
	 * Get subscription by ID
	 */
	getSubscription(subscriptionId: string): TriggerSubscription | undefined {
		return this.subscriptions.get(subscriptionId);
	}

	/**
	 * Get all subscriptions for a trigger
	 */
	getSubscriptionsForTrigger(triggerId: string): TriggerSubscription[] {
		return Array.from(this.subscriptions.values()).filter((sub) => sub.triggerId === triggerId);
	}

	/**
	 * Get all active subscriptions
	 */
	getAllSubscriptions(): TriggerSubscription[] {
		return Array.from(this.subscriptions.values());
	}

	/**
	 * Clear all subscriptions
	 */
	clear(): void {
		this.subscriptions.clear();
	}
}
