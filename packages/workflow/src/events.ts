/**
 * Workflow event system
 *
 * Provides pub/sub for workflow execution events.
 * Used for real-time monitoring, SSE streaming, and logging.
 */

import type { WorkflowEvent } from "./types.js";

type EventListener = (event: WorkflowEvent) => void;

/** Listeners keyed by runId */
const runListeners = new Map<string, Set<EventListener>>();

/** Global listeners that receive all events */
const globalListeners = new Set<EventListener>();

/**
 * Subscribe to events from a specific workflow run
 */
export function subscribeToRun(
	runId: string,
	listener: EventListener,
): () => void {
	let set = runListeners.get(runId);
	if (!set) {
		set = new Set();
		runListeners.set(runId, set);
	}
	set.add(listener);

	return () => {
		set?.delete(listener);
		if (set && set.size === 0) {
			runListeners.delete(runId);
		}
	};
}

/**
 * Subscribe to events from all workflow runs
 */
export function subscribeToAll(listener: EventListener): () => void {
	globalListeners.add(listener);
	return () => {
		globalListeners.delete(listener);
	};
}

/**
 * Publish a workflow event
 */
export function publishEvent(event: WorkflowEvent): void {
	// Notify run-specific listeners
	const runId = event.runId;
	const listeners = runListeners.get(runId);
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

	// Clean up run listeners when workflow completes or fails
	if (
		event.type === "workflow.completed" ||
		event.type === "workflow.failed"
	) {
		runListeners.delete(runId);
	}
}
