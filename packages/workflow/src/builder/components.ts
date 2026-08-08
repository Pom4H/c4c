/**
 * Workflow Components
 * 
 * Provides functions to create individual workflow components (steps, conditions, etc.)
 */

import type { z } from "zod";
import type {
	WorkflowNode,
	ConditionConfig,
	ParallelConfig,
	ConditionPredicateContext,
} from "../types/index.js";

type AnyZod = z.ZodTypeAny;

type ProcedureInvocation = {
	type: "procedure";
	procedureName: string;
	config?: Record<string, unknown>;
};

interface StepEngine {
	run: (procedureName: string, config?: unknown) => ProcedureInvocation;
}

interface AuthoringContext<Input> {
	inputData: Input;
	variables: Record<string, unknown>;
	get: <T = unknown>(key: string) => T | undefined;
	engine: StepEngine;
}

type StepExecute<Input> = (ctx: AuthoringContext<Input>) => ProcedureInvocation | void | undefined;

type ConditionAuthoringContext<Input> = ConditionPredicateContext;

export interface WorkflowFragment {
	id: string;
	nodes: WorkflowNode[];
	entryId: string;
	exitIds: string[];
}

export interface WorkflowComponent<InputSchema extends AnyZod = AnyZod, OutputSchema extends AnyZod = AnyZod>
	extends WorkflowFragment {
	input: InputSchema;
	output: OutputSchema;
}

export type NormalizedComponent = WorkflowComponent<AnyZod, AnyZod>;

interface StepOptions<
	Id extends string,
	InputSchema extends AnyZod,
	OutputSchema extends AnyZod,
> {
	id: Id;
	input: InputSchema;
	output: OutputSchema;
	description?: string;
	metadata?: Record<string, unknown>;
	execute?: StepExecute<z.infer<InputSchema>>;
	procedure?: string;
	config?: Record<string, unknown>;
}

interface ParallelOptions<
	Id extends string,
	InputSchema extends AnyZod | undefined,
	OutputSchema extends AnyZod,
	Branches extends readonly NormalizedComponent[],
> {
	id: Id;
	branches: Branches;
	waitForAll?: boolean;
	input?: InputSchema;
	output: OutputSchema;
	metadata?: Record<string, unknown>;
}

interface ConditionOptions<
	Id extends string,
	InputSchema extends AnyZod,
	TrueBranch extends NormalizedComponent,
	FalseBranch extends NormalizedComponent,
	OutputSchema extends AnyZod | undefined,
> {
	id: Id;
	input: InputSchema;
	whenTrue: TrueBranch;
	whenFalse: FalseBranch;
	predicate?: (ctx: ConditionAuthoringContext<z.infer<InputSchema>>) => boolean;
	expression?: string;
	output?: OutputSchema;
	metadata?: Record<string, unknown>;
}

interface SequenceOptions<Id extends string> {
	id: Id;
	metadata?: Record<string, unknown>;
}

export function step<
	Id extends string,
	InputSchema extends AnyZod,
	OutputSchema extends AnyZod,
>(options: StepOptions<Id, InputSchema, OutputSchema>): WorkflowComponent<InputSchema, OutputSchema> {
	const invocation = resolveProcedureInvocation(options);

	const node: WorkflowNode = {
		id: options.id,
		type: "procedure",
		procedureName: invocation.procedureName,
		config: invocation.config,
	};

	return {
		id: options.id,
		nodes: [node],
		entryId: node.id,
		exitIds: [node.id],
		input: options.input,
		output: options.output,
	};
}

export function parallel<
	Id extends string,
	InputSchema extends AnyZod | undefined,
	OutputSchema extends AnyZod,
	const Branches extends readonly NormalizedComponent[],
>(options: ParallelOptions<Id, InputSchema, OutputSchema, Branches>): WorkflowComponent<
	InputSchema extends AnyZod ? InputSchema : AnyZod,
	OutputSchema
> {
	const branchIds = options.branches.map((branch) => branch.entryId);
	const node: WorkflowNode = {
		id: options.id,
		type: "parallel",
		config: {
			branches: branchIds,
			waitForAll: options.waitForAll ?? true,
		} satisfies ParallelConfig,
	};

	const nodes: WorkflowNode[] = [node];
	for (const branch of options.branches) {
		for (const branchNode of branch.nodes) {
			if (!nodes.includes(branchNode)) {
				nodes.push(branchNode);
			}
		}
	}

	return {
		id: options.id,
		nodes,
		entryId: node.id,
		exitIds: [node.id],
		input: (options.input ?? (undefined as unknown as AnyZod)) as InputSchema extends AnyZod
			? InputSchema
			: AnyZod,
		output: options.output,
	};
}

export function condition<
	Id extends string,
	InputSchema extends AnyZod,
	TrueBranch extends NormalizedComponent,
	FalseBranch extends NormalizedComponent,
	OutputSchema extends AnyZod | undefined,
>(options: ConditionOptions<Id, InputSchema, TrueBranch, FalseBranch, OutputSchema>): WorkflowComponent<
	InputSchema,
	OutputSchema extends AnyZod ? OutputSchema : AnyZod
> {
	const node: WorkflowNode = {
		id: options.id,
		type: "condition",
		config: {
			expression: options.expression ?? options.predicate?.toString(),
			predicateFn: options.predicate,
			trueBranch: options.whenTrue.entryId,
			falseBranch: options.whenFalse.entryId,
		} satisfies ConditionConfig,
	};

	const nodes: WorkflowNode[] = [node];
	for (const branch of [...options.whenTrue.nodes, ...options.whenFalse.nodes]) {
		if (!nodes.includes(branch)) {
			nodes.push(branch);
		}
	}

	const exitIds = [...options.whenTrue.exitIds, ...options.whenFalse.exitIds];

	return {
		id: options.id,
		nodes,
		entryId: node.id,
		exitIds,
		input: options.input,
		output: (options.output ??
			options.whenTrue.output ??
			(options.whenFalse.output as AnyZod)) as OutputSchema extends AnyZod ? OutputSchema : AnyZod,
	};
}

export function sequence<Id extends string>(
	options: SequenceOptions<Id>
): WorkflowComponent<AnyZod, AnyZod> {
	const node: WorkflowNode = {
		id: options.id,
		type: "sequential",
	};

	return {
		id: options.id,
		nodes: [node],
		entryId: node.id,
		exitIds: [node.id],
		input: undefined as unknown as AnyZod,
		output: undefined as unknown as AnyZod,
	};
}

function resolveProcedureInvocation<
	Id extends string,
	InputSchema extends AnyZod,
	OutputSchema extends AnyZod,
>(options: StepOptions<Id, InputSchema, OutputSchema>): ProcedureInvocation {
	if (options.execute) {
		const placeholder = Symbol("input");
		let recorded: ProcedureInvocation | undefined;

		const engine: StepEngine = {
			run: (procedureName, config) => {
				const normalizedConfig =
					typeof config === "object" && config !== null ? (config as Record<string, unknown>) : undefined;
				recorded = {
					type: "procedure",
					procedureName,
					config: normalizedConfig,
				};
				return recorded;
			},
		};

		const context: AuthoringContext<z.infer<InputSchema>> = {
			inputData: placeholder as unknown as z.infer<InputSchema>,
			variables: {},
			get: () => undefined,
			engine,
		};

		const result = options.execute(context);
		if (!recorded && result && result.type === "procedure") {
			recorded = result;
		}

		if (!recorded) {
			throw new Error(
				`[workflow-builder] Step '${options.id}' must call engine.run(...) within execute() or return the invocation.`
			);
		}

		return recorded;
	}

	if (options.procedure) {
		return {
			type: "procedure",
			procedureName: options.procedure,
			config: options.config,
		};
	}

	throw new Error(
		`[workflow-builder] Step '${options.id}' requires either an 'execute' function or a static 'procedure' name.`
	);
}

export type StepContext<Input> = AuthoringContext<Input>;
export type ConditionContext<Input> = ConditionAuthoringContext<Input>;