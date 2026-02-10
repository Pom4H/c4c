/**
 * Execution Store
 *
 * In-memory store for tracking workflow run history.
 * Subscribes to workflow events and maintains a record of all runs.
 */

import type { WorkflowEvent } from "./types.js";
import { subscribeToAll } from "./events.js";

/**
 * Record of a single workflow run
 */
export interface RunRecord {
	runId: string;
	status: "running" | "completed" | "failed" | "suspended";
	startTime: Date;
	endTime?: Date;
	executionTime?: number;
	result?: unknown;
	error?: string;
	steps: StepRecord[];
}

/**
 * Record of a single step execution within a run
 */
export interface StepRecord {
	stepName: string;
	attempt: number;
	status: "started" | "completed" | "failed" | "retrying";
	timestamp: Date;
	result?: unknown;
	error?: string;
}

/**
 * Execution Store for monitoring workflow runs
 */
export class ExecutionStore {
	private runs = new Map<string, RunRecord>();
	private maxRuns = 100;
	private unsubscribe?: () => void;

	constructor() {
		// Auto-subscribe to workflow events
		this.unsubscribe = subscribeToAll((event) => this.handleEvent(event));
	}

	private handleEvent(event: WorkflowEvent): void {
		switch (event.type) {
			case "workflow.started":
				this.runs.set(event.runId, {
					runId: event.runId,
					status: "running",
					startTime: new Date(event.timestamp),
					steps: [],
				});
				this.cleanup();
				break;

			case "workflow.completed":
				this.updateRun(event.runId, {
					status: "completed",
					endTime: new Date(event.timestamp),
					executionTime: event.executionTime,
					result: event.result,
				});
				break;

			case "workflow.failed":
				this.updateRun(event.runId, {
					status: "failed",
					endTime: new Date(event.timestamp),
					executionTime: event.executionTime,
					error: event.error,
				});
				break;

			case "workflow.suspended":
				this.updateRun(event.runId, {
					status: "suspended",
				});
				break;

			case "step.started":
			case "step.completed":
			case "step.failed":
			case "step.retrying": {
				const run = this.runs.get(event.runId);
				if (run) {
					run.steps.push({
						stepName: event.stepName,
						attempt: event.attempt,
						status: event.type === "step.started" ? "started" :
							event.type === "step.completed" ? "completed" :
								event.type === "step.failed" ? "failed" : "retrying",
						timestamp: new Date(event.timestamp),
						result: event.type === "step.completed" ? event.result : undefined,
						error: event.type === "step.failed" ? event.error : undefined,
					});
				}
				break;
			}
		}
	}

	private updateRun(runId: string, updates: Partial<RunRecord>): void {
		const run = this.runs.get(runId);
		if (run) {
			Object.assign(run, updates);
		}
	}

	/**
	 * Get a specific run
	 */
	getRun(runId: string): RunRecord | undefined {
		return this.runs.get(runId);
	}

	/**
	 * Get all runs, sorted by start time (newest first)
	 */
	getAllRuns(): RunRecord[] {
		return Array.from(this.runs.values()).sort(
			(a, b) => b.startTime.getTime() - a.startTime.getTime(),
		);
	}

	/**
	 * Get execution stats
	 */
	getStats() {
		const all = this.getAllRuns();
		return {
			total: all.length,
			running: all.filter((r) => r.status === "running").length,
			completed: all.filter((r) => r.status === "completed").length,
			failed: all.filter((r) => r.status === "failed").length,
			suspended: all.filter((r) => r.status === "suspended").length,
		};
	}

	/**
	 * Clean up old runs
	 */
	private cleanup(): void {
		const all = this.getAllRuns();
		if (all.length > this.maxRuns) {
			const toDelete = all.slice(this.maxRuns);
			for (const run of toDelete) {
				this.runs.delete(run.runId);
			}
		}
	}

	/**
	 * Clear all runs
	 */
	clear(): void {
		this.runs.clear();
	}

	/**
	 * Dispose of the store (stop listening to events)
	 */
	dispose(): void {
		this.unsubscribe?.();
	}
}

/**
 * Global execution store singleton
 */
let globalStore: ExecutionStore | null = null;

export function getExecutionStore(): ExecutionStore {
	if (!globalStore) {
		globalStore = new ExecutionStore();
	}
	return globalStore;
}

export function setExecutionStore(store: ExecutionStore): void {
	globalStore = store;
}
