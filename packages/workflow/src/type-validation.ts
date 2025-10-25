/**
 * Compile-time workflow type validation utilities
 */

import type { z } from "zod";
import type { WorkflowComponent, WorkflowDefinition, WorkflowNode } from "./types.js";

/**
 * Extract input type from Zod schema
 */
export type InferSchemaInput<T> = T extends z.ZodType<infer I> ? I : never;

/**
 * Extract output type from Zod schema
 */
export type InferSchemaOutput<T> = T extends z.ZodType<infer O> ? O : never;

/**
 * Check if two types are compatible (output of A can be input to B)
 */
export type IsCompatible<A, B> = A extends B ? true : false;

/**
 * Validate that output of Step1 is compatible with input of Step2
 */
export type ValidateStepChain<
	Step1 extends { output: z.ZodTypeAny },
	Step2 extends { input: z.ZodTypeAny },
> = InferSchemaOutput<Step1["output"]> extends InferSchemaInput<Step2["input"]>
	? { valid: true; step1: Step1; step2: Step2 }
	: {
			valid: false;
			error: "Type mismatch: Step1 output is not compatible with Step2 input";
			step1Output: InferSchemaOutput<Step1["output"]>;
			step2Input: InferSchemaInput<Step2["input"]>;
		};

/**
 * Validate a sequence of steps
 */
export type ValidateSequence<
	Steps extends readonly { input: z.ZodTypeAny; output: z.ZodTypeAny }[],
> = Steps extends readonly [
	infer First extends { input: z.ZodTypeAny; output: z.ZodTypeAny },
	infer Second extends { input: z.ZodTypeAny; output: z.ZodTypeAny },
	...infer Rest extends readonly { input: z.ZodTypeAny; output: z.ZodTypeAny }[],
]
	? ValidateStepChain<First, Second> extends { valid: true }
		? Rest extends readonly []
			? { valid: true }
			: ValidateSequence<[Second, ...Rest]>
		: ValidateStepChain<First, Second>
	: { valid: true };

/**
 * Helper type to create type-safe step references
 */
export type StepRef<TInput = unknown, TOutput = unknown, TId extends string = string> = {
	id: TId;
	input: z.ZodType<TInput>;
	output: z.ZodType<TOutput>;
};

/**
 * Type-safe workflow builder that validates step chains
 */
export interface TypeSafeWorkflowBuilder<
	TSteps extends Record<string, StepRef> = Record<string, never>,
> {
	/**
	 * Add a step to the workflow
	 */
	addStep<
		TId extends string,
		TInput,
		TOutput,
		TInputSchema extends z.ZodType<TInput>,
		TOutputSchema extends z.ZodType<TOutput>,
	>(
		id: TId,
		input: TInputSchema,
		output: TOutputSchema
	): TypeSafeWorkflowBuilder<TSteps & { [K in TId]: StepRef<TInput, TOutput, TId> }>;

	/**
	 * Connect two steps with compile-time validation
	 */
	connect<TFrom extends keyof TSteps, TTo extends keyof TSteps>(
		from: TFrom,
		to: TTo
	): ValidateStepChain<TSteps[TFrom], TSteps[TTo]> extends { valid: true }
		? this
		: ValidateStepChain<TSteps[TFrom], TSteps[TTo]>;

	/**
	 * Build the workflow
	 */
	build(): WorkflowDefinition;
}

/**
 * Utility to validate workflow node connections at runtime
 */
export function validateNodeConnection(
	fromNode: WorkflowNode,
	toNode: WorkflowNode,
	procedureRegistry?: Map<string, { contract: { input: z.ZodTypeAny; output: z.ZodTypeAny } }>
): { valid: boolean; error?: string } {
	// If no registry, we can't validate
	if (!procedureRegistry) {
		return { valid: true };
	}

	// Get procedures
	const fromProcedure = fromNode.procedureName
		? procedureRegistry.get(fromNode.procedureName)
		: null;
	const toProcedure = toNode.procedureName ? procedureRegistry.get(toNode.procedureName) : null;

	if (!fromProcedure || !toProcedure) {
		return { valid: true }; // Can't validate without both procedures
	}

	// Check if output schema of from matches input schema of to
	try {
		// Create a sample value from the output schema
		const sampleOutput = fromProcedure.contract.output.parse({});
		// Try to validate it against input schema
		toProcedure.contract.input.parse(sampleOutput);
		return { valid: true };
	} catch {
		return {
			valid: false,
			error: `Type mismatch: ${fromNode.id} output is not compatible with ${toNode.id} input`,
		};
	}
}

/**
 * Validate entire workflow for type consistency
 */
export function validateWorkflowTypes(
	workflow: WorkflowDefinition,
	procedureRegistry?: Map<string, { contract: { input: z.ZodTypeAny; output: z.ZodTypeAny } }>
): { valid: boolean; errors: Array<{ nodeId: string; error: string }> } {
	const errors: Array<{ nodeId: string; error: string }> = [];

	if (!procedureRegistry) {
		return { valid: true, errors };
	}

	// Build node map
	const nodeMap = new Map<string, WorkflowNode>();
	for (const node of workflow.nodes) {
		nodeMap.set(node.id, node);
	}

	// Validate each connection
	for (const node of workflow.nodes) {
		const nextIds = Array.isArray(node.next) ? node.next : node.next ? [node.next] : [];

		for (const nextId of nextIds) {
			const nextNode = nodeMap.get(nextId);
			if (!nextNode) {
				errors.push({
					nodeId: node.id,
					error: `Next node '${nextId}' not found`,
				});
				continue;
			}

			const validation = validateNodeConnection(node, nextNode, procedureRegistry);
			if (!validation.valid && validation.error) {
				errors.push({
					nodeId: node.id,
					error: validation.error,
				});
			}
		}
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Type-level utility to ensure all nodes in a workflow have unique IDs
 */
export type EnsureUniqueIds<T extends readonly { id: string }[]> = T extends readonly [
	infer First extends { id: string },
	...infer Rest extends readonly { id: string }[],
]
	? First["id"] extends Rest[number]["id"]
		? { error: "Duplicate node ID detected"; id: First["id"] }
		: EnsureUniqueIds<Rest>
	: { valid: true };

/**
 * Helper to create strongly-typed workflow components
 */
export function createTypedComponent<
	TInput,
	TOutput,
	TInputSchema extends z.ZodType<TInput>,
	TOutputSchema extends z.ZodType<TOutput>,
>(config: {
	id: string;
	nodes: WorkflowNode[];
	entryId: string;
	exitIds: string[];
	input: TInputSchema;
	output: TOutputSchema;
}): WorkflowComponent<TInputSchema, TOutputSchema> & {
	__inputType: TInput;
	__outputType: TOutput;
} {
	return config as WorkflowComponent<TInputSchema, TOutputSchema> & {
		__inputType: TInput;
		__outputType: TOutput;
	};
}
