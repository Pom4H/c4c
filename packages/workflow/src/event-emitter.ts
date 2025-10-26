/**
 * Internal Event Emitter
 * 
 * Provides event bus for internal application events that can trigger workflows
 */

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

interface EventSubscription {
	eventName: string;
	handler: EventHandler;
	once?: boolean;
}

/**
 * Internal event emitter for workflow triggers
 */
export class WorkflowEventEmitter {
	private handlers = new Map<string, Set<EventSubscription>>();
	private wildcardHandlers = new Set<EventSubscription>();

	/**
	 * Subscribe to an event
	 */
	on<T = unknown>(eventName: string, handler: EventHandler<T>): () => void {
		const subscription: EventSubscription = {
			eventName,
			handler: handler as EventHandler,
			once: false,
		};

		// Support wildcard patterns (e.g., "user.*")
		if (eventName.includes("*")) {
			this.wildcardHandlers.add(subscription);
			return () => {
				this.wildcardHandlers.delete(subscription);
			};
		}

		let set = this.handlers.get(eventName);
		if (!set) {
			set = new Set();
			this.handlers.set(eventName, set);
		}
		set.add(subscription);

		return () => {
			set?.delete(subscription);
			if (set && set.size === 0) {
				this.handlers.delete(eventName);
			}
		};
	}

	/**
	 * Subscribe to an event once
	 */
	once<T = unknown>(eventName: string, handler: EventHandler<T>): () => void {
		const subscription: EventSubscription = {
			eventName,
			handler: handler as EventHandler,
			once: true,
		};

		if (eventName.includes("*")) {
			this.wildcardHandlers.add(subscription);
			return () => {
				this.wildcardHandlers.delete(subscription);
			};
		}

		let set = this.handlers.get(eventName);
		if (!set) {
			set = new Set();
			this.handlers.set(eventName, set);
		}
		set.add(subscription);

		return () => {
			set?.delete(subscription);
			if (set && set.size === 0) {
				this.handlers.delete(eventName);
			}
		};
	}

	/**
	 * Emit an event
	 */
	async emit<T = unknown>(eventName: string, payload: T): Promise<void> {
		const promises: Promise<void>[] = [];

		// Execute direct handlers
		const directHandlers = this.handlers.get(eventName);
		if (directHandlers) {
			const toRemove: EventSubscription[] = [];
			for (const subscription of Array.from(directHandlers)) {
				try {
					const result = subscription.handler(payload);
					if (result instanceof Promise) {
						promises.push(result);
					}
					if (subscription.once) {
						toRemove.push(subscription);
					}
				} catch (error) {
					console.error(`[WorkflowEventEmitter] Error in handler for ${eventName}:`, error);
				}
			}
			// Remove one-time handlers
			for (const sub of toRemove) {
				directHandlers.delete(sub);
			}
		}

		// Execute wildcard handlers
		const toRemoveWildcard: EventSubscription[] = [];
		for (const subscription of Array.from(this.wildcardHandlers)) {
			if (this.matchesPattern(eventName, subscription.eventName)) {
				try {
					const result = subscription.handler(payload);
					if (result instanceof Promise) {
						promises.push(result);
					}
					if (subscription.once) {
						toRemoveWildcard.push(subscription);
					}
				} catch (error) {
					console.error(
						`[WorkflowEventEmitter] Error in wildcard handler for ${subscription.eventName}:`,
						error
					);
				}
			}
		}
		// Remove one-time wildcard handlers
		for (const sub of toRemoveWildcard) {
			this.wildcardHandlers.delete(sub);
		}

		// Wait for all async handlers
		await Promise.all(promises);
	}

	/**
	 * Remove all handlers for an event
	 */
	off(eventName: string): void {
		this.handlers.delete(eventName);
	}

	/**
	 * Remove all handlers
	 */
	clear(): void {
		this.handlers.clear();
		this.wildcardHandlers.clear();
	}

	/**
	 * Get count of handlers for an event
	 */
	listenerCount(eventName: string): number {
		const direct = this.handlers.get(eventName)?.size || 0;
		let wildcard = 0;
		for (const sub of this.wildcardHandlers) {
			if (this.matchesPattern(eventName, sub.eventName)) {
				wildcard++;
			}
		}
		return direct + wildcard;
	}

	/**
	 * Get all registered event names
	 */
	eventNames(): string[] {
		return Array.from(this.handlers.keys());
	}

	/**
	 * Match event name against pattern with wildcards
	 */
	private matchesPattern(eventName: string, pattern: string): boolean {
		if (pattern === "*") {
			return true;
		}

		// Convert pattern to regex
		const regexPattern = pattern
			.replace(/\./g, "\\.")
			.replace(/\*/g, ".*")
			.replace(/\?/g, ".");

		const regex = new RegExp(`^${regexPattern}$`);
		return regex.test(eventName);
	}
}

// Global event emitter instance
let globalEmitter: WorkflowEventEmitter | undefined;

/**
 * Get the global workflow event emitter
 */
export function getWorkflowEventEmitter(): WorkflowEventEmitter {
	if (!globalEmitter) {
		globalEmitter = new WorkflowEventEmitter();
	}
	return globalEmitter;
}

/**
 * Set a custom workflow event emitter
 */
export function setWorkflowEventEmitter(emitter: WorkflowEventEmitter): void {
	globalEmitter = emitter;
}

/**
 * Emit an internal event that can trigger workflows
 */
export async function emitWorkflowEvent<T = unknown>(
	eventName: string,
	payload: T
): Promise<void> {
	const emitter = getWorkflowEventEmitter();
	await emitter.emit(eventName, payload);
}

/**
 * Subscribe to internal workflow events
 */
export function onWorkflowEvent<T = unknown>(
	eventName: string,
	handler: EventHandler<T>
): () => void {
	const emitter = getWorkflowEventEmitter();
	return emitter.on(eventName, handler);
}
