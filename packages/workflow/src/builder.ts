import type { z } from "zod";
import type {
	WorkflowDefinition,
	WorkflowNode,
	ConditionConfig,
	ParallelConfig,
	ConditionPredicateContext,
	WhenFilterContext,
} from "./types.js";

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

interface WorkflowFragment {
	id: string;
	nodes: WorkflowNode[];
	entryId: string;
	exitIds: string[];
}

interface WorkflowComponent<InputSchema extends AnyZod = AnyZod, OutputSchema extends AnyZod = AnyZod>
	extends WorkflowFragment {
	input: InputSchema;
	output: OutputSchema;
}

type NormalizedComponent = WorkflowComponent<AnyZod, AnyZod>;

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

// Binary condition (true/false)
interface BinaryConditionOptions<
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

// Switch-case condition
interface SwitchConditionOptions<
	Id extends string,
	InputSchema extends AnyZod,
	Cases extends Record<string | number, NormalizedComponent>,
	OutputSchema extends AnyZod | undefined,
> {
	id: Id;
	input: InputSchema;
	switch: (ctx: ConditionAuthoringContext<z.infer<InputSchema>>) => string | number;
	cases: Cases;
	default?: NormalizedComponent;
	output?: OutputSchema;
	metadata?: Record<string, unknown>;
}

// Legacy type alias for backward compatibility
type ConditionOptions<
	Id extends string,
	InputSchema extends AnyZod,
	TrueBranch extends NormalizedComponent,
	FalseBranch extends NormalizedComponent,
	OutputSchema extends AnyZod | undefined,
> = BinaryConditionOptions<Id, InputSchema, TrueBranch, FalseBranch, OutputSchema>;

interface WhenOptions<
	Id extends string,
	OutputSchema extends AnyZod,
> {
	id: Id;
	on: string | string[];
	mode?: 'before' | 'after' | 'instead';
	filter?: (event: unknown, context: WhenFilterContext) => boolean;
	timeout?: {
		duration: number;
		onTimeout?: string;
	};
	output: OutputSchema;
	metadata?: Record<string, unknown>;
}

interface SequenceOptions<Id extends string> {
	id: Id;
	metadata?: Record<string, unknown>;
}

class WorkflowBuilder {
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

// Binary condition (true/false)
export function condition<
	Id extends string,
	InputSchema extends AnyZod,
	TrueBranch extends NormalizedComponent,
	FalseBranch extends NormalizedComponent,
	OutputSchema extends AnyZod | undefined,
>(options: BinaryConditionOptions<Id, InputSchema, TrueBranch, FalseBranch, OutputSchema>): WorkflowComponent<
	InputSchema,
	OutputSchema extends AnyZod ? OutputSchema : AnyZod
>;

// Switch-case condition
export function condition<
	Id extends string,
	InputSchema extends AnyZod,
	Cases extends Record<string | number, NormalizedComponent>,
	OutputSchema extends AnyZod | undefined,
>(options: SwitchConditionOptions<Id, InputSchema, Cases, OutputSchema>): WorkflowComponent<
	InputSchema,
	OutputSchema extends AnyZod ? OutputSchema : AnyZod
>;

// Implementation
export function condition<
	Id extends string,
	InputSchema extends AnyZod,
	TrueBranch extends NormalizedComponent,
	FalseBranch extends NormalizedComponent,
	Cases extends Record<string | number, NormalizedComponent>,
	OutputSchema extends AnyZod | undefined,
>(
	options:
		| BinaryConditionOptions<Id, InputSchema, TrueBranch, FalseBranch, OutputSchema>
		| SwitchConditionOptions<Id, InputSchema, Cases, OutputSchema>
): WorkflowComponent<InputSchema, OutputSchema extends AnyZod ? OutputSchema : AnyZod> {
	// Check if it's switch-case mode
	if ('switch' in options && 'cases' in options) {
		// Switch-case mode
		const switchOptions = options as SwitchConditionOptions<Id, InputSchema, Cases, OutputSchema>;
		const caseEntries = Object.entries(switchOptions.cases);
		const caseBranches: Record<string | number, string> = {};
		
		for (const [key, component] of caseEntries) {
			caseBranches[key] = component.entryId;
		}
		
		const node: WorkflowNode = {
			id: switchOptions.id,
			type: "condition",
			config: {
				switchFn: switchOptions.switch,
				cases: caseBranches,
				defaultBranch: switchOptions.default?.entryId,
			} satisfies ConditionConfig,
		};

		const nodes: WorkflowNode[] = [node];
		const allBranches = [...Object.values(switchOptions.cases), ...(switchOptions.default ? [switchOptions.default] : [])];
		
		for (const branch of allBranches) {
			for (const branchNode of branch.nodes) {
				if (!nodes.includes(branchNode)) {
					nodes.push(branchNode);
				}
			}
		}

		const exitIds = allBranches.flatMap(b => b.exitIds);

		return {
			id: switchOptions.id,
			nodes,
			entryId: node.id,
			exitIds,
			input: switchOptions.input,
			output: (switchOptions.output ?? Object.values(switchOptions.cases)[0]?.output) as OutputSchema extends AnyZod ? OutputSchema : AnyZod,
		};
	} else {
		// Binary mode (existing logic)
		const binaryOptions = options as BinaryConditionOptions<Id, InputSchema, TrueBranch, FalseBranch, OutputSchema>;
		
		const node: WorkflowNode = {
			id: binaryOptions.id,
			type: "condition",
			config: {
				expression: binaryOptions.expression ?? binaryOptions.predicate?.toString(),
				predicateFn: binaryOptions.predicate,
				trueBranch: binaryOptions.whenTrue.entryId,
				falseBranch: binaryOptions.whenFalse.entryId,
			} satisfies ConditionConfig,
		};

		const nodes: WorkflowNode[] = [node];
		for (const branch of [...binaryOptions.whenTrue.nodes, ...binaryOptions.whenFalse.nodes]) {
			if (!nodes.includes(branch)) {
				nodes.push(branch);
			}
		}

		const exitIds = [...binaryOptions.whenTrue.exitIds, ...binaryOptions.whenFalse.exitIds];

		return {
			id: binaryOptions.id,
			nodes,
			entryId: node.id,
			exitIds,
			input: binaryOptions.input,
			output: (binaryOptions.output ??
				binaryOptions.whenTrue.output ??
				(binaryOptions.whenFalse.output as AnyZod)) as OutputSchema extends AnyZod ? OutputSchema : AnyZod,
		};
	}
}

export function when<Id extends string, OutputSchema extends AnyZod>(
	options: WhenOptions<Id, OutputSchema>
): WorkflowComponent<AnyZod, OutputSchema> {
	const procedures = Array.isArray(options.on) ? options.on : [options.on];
	
	const node: WorkflowNode = {
		id: options.id,
		type: "await",
		procedureName: procedures[0], // Primary trigger procedure
		config: {
			procedures,
			mode: options.mode || 'after',
			filter: options.filter,
			timeout: options.timeout,
			// This marks it as a pause point
			pauseWorkflow: true,
		},
	};

	return {
		id: options.id,
		nodes: [node],
		entryId: node.id,
		exitIds: [node.id],
		input: undefined as unknown as AnyZod,
		output: options.output,
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
