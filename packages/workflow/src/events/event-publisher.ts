/**
 * Event Publisher
 * 
 * Handles real-time workflow events for SSE/WebSocket integrations
 */

import type { WorkflowEvent } from "../types/index.js";

type Listener = (event: WorkflowEvent) => void;

const executionIdToListeners = new Map<string, Set<Listener>>();
const globalListeners = new Set<Listener>();

export function subscribeToExecution(
	executionId: string,
	listener: Listener
): () => void {
	let set = executionIdToListeners.get(executionId);
	if (!set) {
		set = new Set();
		executionIdToListeners.set(executionId, set);
	}
	set.add(listener);
	return () => {
		set?.delete(listener);
		if (set && set.size === 0) {
			executionIdToListeners.delete(executionId);
		}
	};
}

export function subscribeToAllExecutions(listener: Listener): () => void {
	globalListeners.add(listener);
	return () => {
		globalListeners.delete(listener);
	};
}

export function publish(event: WorkflowEvent): void {
	// Notify execution-specific listeners
	const listeners = executionIdToListeners.get(event.executionId);
	if (listeners) {
		for (const listener of Array.from(listeners)) {
			try {
				listener(event);
			} catch {
				// ignore listener errors
			}
		}
	}
	
	// Notify global listeners
	for (const listener of Array.from(globalListeners)) {
		try {
			listener(event);
		} catch {
			// ignore listener errors
		}
	}
	
	if (
		event.type === "workflow.completed" ||
		event.type === "workflow.failed" ||
		event.type === "workflow.paused"
	) {
		executionIdToListeners.delete(event.executionId);
	}
}