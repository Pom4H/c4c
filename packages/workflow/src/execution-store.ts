/**
 * Execution Store - хранилище истории выполнений workflows
 * Используется для UI мониторинга (как в n8n)
 */

import type { WorkflowExecutionResult, WorkflowDefinition } from "./types.js";

/**
 * Детальная информация об execution
 */
export interface ExecutionRecord {
	executionId: string;
	workflowId: string;
	workflowName: string;
	status: "completed" | "failed" | "cancelled" | "running";
	startTime: Date;
	endTime?: Date;
	executionTime?: number;
	error?: {
		message: string;
		name: string;
		stack?: string;
	};
	outputs: Record<string, unknown>;
	nodesExecuted: string[];
	// Детали для каждой ноды (internal Map)
	nodeDetails: Map<string, NodeExecutionDetail>;
	// Spans для отображения
	spans?: Array<{
		spanId: string;
		traceId: string;
		parentSpanId?: string;
		name: string;
		startTime: number;
		endTime: number;
		duration: number;
		status: { code: string; message?: string };
		attributes: Record<string, string | number | boolean>;
	}>;
}

/**
 * Детали выполнения одной ноды
 */
export interface NodeExecutionDetail {
	nodeId: string;
	status: "pending" | "running" | "completed" | "failed" | "skipped";
	startTime?: Date;
	endTime?: Date;
	duration?: number;
	input?: Record<string, unknown>;
	output?: unknown;
	error?: {
		message: string;
		name: string;
	};
}

/**
 * Execution Store
 */
export class ExecutionStore {
	private executions = new Map<string, ExecutionRecord>();
	private maxExecutions = 100; // Хранить последние 100 executions

	/**
	 * Начать tracking нового execution
	 */
	startExecution(
		executionId: string,
		workflowId: string,
		workflowName: string
	): void {
		const record: ExecutionRecord = {
			executionId,
			workflowId,
			workflowName,
			status: "running",
			startTime: new Date(),
			outputs: {},
			nodesExecuted: [],
			nodeDetails: new Map(),
		};

		this.executions.set(executionId, record);
		this.cleanup();
	}

	/**
	 * Обновить статус ноды
	 */
	updateNodeStatus(
		executionId: string,
		nodeId: string,
		status: NodeExecutionDetail["status"],
		details?: Partial<NodeExecutionDetail>
	): void {
		const record = this.executions.get(executionId);
		if (!record) return;

		const existing = record.nodeDetails.get(nodeId) || {
			nodeId,
			status: "pending",
		};

		record.nodeDetails.set(nodeId, {
			...existing,
			status,
			...details,
		});
	}

	/**
	 * Завершить execution
	 */
	completeExecution(
		executionId: string,
		result: WorkflowExecutionResult
	): void {
		const record = this.executions.get(executionId);
		if (!record) return;

		record.status = result.status === "paused" ? "completed" : result.status;
		record.endTime = new Date();
		record.executionTime = result.executionTime;
		record.outputs = result.outputs;
		record.nodesExecuted = result.nodesExecuted;
		record.spans = result.spans;

		if (result.error) {
			record.error = {
				message: result.error.message,
				name: result.error.name,
				stack: result.error.stack,
			};
		}

		// Обновить статусы всех выполненных нод
		for (const nodeId of result.nodesExecuted) {
			const detail = record.nodeDetails.get(nodeId);
			if (detail && detail.status === "running") {
				detail.status = "completed";
				if (!detail.endTime) {
					detail.endTime = new Date();
				}
			}
		}
	}

	/**
	 * Получить execution
	 */
	getExecution(executionId: string): ExecutionRecord | undefined {
		return this.executions.get(executionId);
	}

	/**
	 * Получить execution с сериализованными nodeDetails (для JSON)
	 */
	getExecutionJSON(executionId: string): any {
		const exec = this.executions.get(executionId);
		if (!exec) return undefined;
		
		return {
			...exec,
			nodeDetails: Object.fromEntries(exec.nodeDetails.entries()),
		};
	}

	/**
	 * Получить все executions
	 */
	getAllExecutions(): ExecutionRecord[] {
		return Array.from(this.executions.values()).sort(
			(a, b) => b.startTime.getTime() - a.startTime.getTime()
		);
	}

	/**
	 * Получить все executions с сериализованными nodeDetails (для JSON)
	 */
	getAllExecutionsJSON(): any[] {
		return this.getAllExecutions().map(exec => ({
			...exec,
			nodeDetails: Object.fromEntries(exec.nodeDetails.entries()),
		}));
	}

	/**
	 * Получить executions для конкретного workflow
	 */
	getExecutionsForWorkflow(workflowId: string): ExecutionRecord[] {
		return this.getAllExecutions().filter(
			(exec) => exec.workflowId === workflowId
		);
	}

	/**
	 * Получить статистику
	 */
	getStats() {
		const all = this.getAllExecutions();
		return {
			total: all.length,
			completed: all.filter((e) => e.status === "completed").length,
			failed: all.filter((e) => e.status === "failed").length,
			running: all.filter((e) => e.status === "running").length,
		};
	}

	/**
	 * Очистить старые executions
	 */
	private cleanup(): void {
		const all = this.getAllExecutions();
		if (all.length > this.maxExecutions) {
			const toDelete = all.slice(this.maxExecutions);
			for (const exec of toDelete) {
				this.executions.delete(exec.executionId);
			}
		}
	}

	/**
	 * Очистить все
	 */
	clear(): void {
		this.executions.clear();
	}
}

/**
 * Global execution store instance
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
