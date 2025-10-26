/**
 * Workflow Builder API
 * 
 * Provides a fluent API for constructing workflows step by step
 */

import type { z } from "zod";
import type {
	WorkflowDefinition,
	WorkflowNode,
	WorkflowComponent,
	NormalizedComponent,
} from "../types/index.js";

type AnyZod = z.ZodTypeAny;

export class WorkflowBuilder {
	private readonly id: string;
	private nameValue: string | undefined;
	private descriptionValue: string | undefined;
	private versionValue: string | undefined;
	private variablesValue: Record<string, unknown> | undefined;
	private metadataValue: Record<string, unknown> | undefined;
	private inputSchema: AnyZod | undefined;
	private nodes: WorkflowNode[] = [];
	private nodeById = new Map<string, WorkflowNode>();
	private startNode: string | undefined;
	private pendingExitIds: string[] = [];

	constructor(id: string) {
		this.id = id;
	}

	input<Schema extends AnyZod>(schema: Schema): this {
		this.inputSchema = schema;
		return this;
	}

	name(value: string): this {
		this.nameValue = value;
		return this;
	}

	description(value: string): this {
		this.descriptionValue = value;
		return this;
	}

	version(value: string): this {
		this.versionValue = value;
		return this;
	}

	variables(value: Record<string, unknown>): this {
		this.variablesValue = value;
		return this;
	}

	metadata(value: Record<string, unknown>): this {
		this.metadataValue = value;
		return this;
	}

	step<InputSchema extends AnyZod, OutputSchema extends AnyZod>(
		component: WorkflowComponent<InputSchema, OutputSchema>
	): this {
		this.addComponent(component);
		return this;
	}

	commit(): WorkflowDefinition {
		if (!this.startNode) {
			throw new Error(`[workflow-builder] Workflow '${this.id}' has no steps defined.`);
		}

		const nodes = this.nodes.map((node) => ({
			...node,
			config: node.config ? { ...(node.config as Record<string, unknown>) } : undefined,
			next: Array.isArray(node.next)
				? [...node.next]
				: node.next !== undefined
					? node.next
					: undefined,
		}));

		const definition: WorkflowDefinition = {
			id: this.id,
			name: this.nameValue ?? this.id,
			description: this.descriptionValue,
			version: this.versionValue ?? "1.0.0",
			startNode: this.startNode,
			nodes,
		};

		if (this.variablesValue) {
			definition.variables = { ...this.variablesValue };
		}

		if (this.metadataValue || this.inputSchema) {
			definition.metadata = {
				...(this.metadataValue ?? {}),
				inputSchema: this.inputSchema,
			};
		}

		return definition;
	}

	private addComponent(component: NormalizedComponent): void {
		for (const node of component.nodes) {
			const existing = this.nodeById.get(node.id);
			if (existing && existing !== node) {
				throw new Error(
					`[workflow-builder] Duplicate node id '${node.id}' encountered within workflow '${this.id}'.`
				);
			}
			if (!existing) {
				this.nodes.push(node);
				this.nodeById.set(node.id, node);
			}
		}

		if (!this.startNode) {
			this.startNode = component.entryId;
		}

		if (this.pendingExitIds.length > 0) {
			for (const exitId of this.pendingExitIds) {
				const node = this.nodeById.get(exitId);
				if (!node) {
					throw new Error(
						`[workflow-builder] Unable to connect node '${exitId}' to '${component.entryId}' (node not found).`
					);
				}

				if (node.next === undefined) {
					node.next = component.entryId;
				} else if (Array.isArray(node.next)) {
					if (!node.next.includes(component.entryId)) {
						node.next = [...node.next, component.entryId];
					}
				} else if (node.next !== component.entryId) {
					node.next = [node.next, component.entryId];
				}
			}
		}

		this.pendingExitIds = [...component.exitIds];
	}
}

export function workflow(id: string): WorkflowBuilder {
	return new WorkflowBuilder(id);
}

// Re-export component types and functions
export type { WorkflowComponent, NormalizedComponent } from "./components.js";
export { step, parallel, condition, sequence } from "./components.js";
export type { StepContext, ConditionContext } from "./components.js";