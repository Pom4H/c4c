import type { ExecutionContext, Handler, Procedure, Registry } from "./types.js";

/**
 * Execute a procedure with input validation and output validation
 */
export async function executeProcedure<TInput, TOutput>(
	procedure: Procedure<TInput, TOutput>,
	input: unknown,
	context: ExecutionContext
): Promise<TOutput> {
	// Validate input against contract
	const validatedInput = procedure.contract.input.parse(input);

	// Execute handler
	const result = await procedure.handler(validatedInput, context);

	// Validate output against contract
	const validatedOutput = procedure.contract.output.parse(result);

	return validatedOutput;
}

/**
 * Execute a procedure from registry by name
 */
export async function execute(
	registry: Registry,
	procedureName: string,
	input: unknown,
	context?: ExecutionContext
): Promise<unknown> {
	const procedure = registry.get(procedureName);
	if (!procedure) {
		throw new Error(`Procedure '${procedureName}' not found in registry`);
	}

	const ctx = context ?? createExecutionContext();
	return executeProcedure(procedure, input, ctx);
}

/**
 * Create execution context
 */
export function createExecutionContext(
	metadata: Record<string, unknown> = {}
): ExecutionContext {
	return {
		requestId: generateRequestId(),
		timestamp: new Date(),
		metadata,
	};
}

/**
 * Simple request ID generator
 */
function generateRequestId(): string {
	return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Apply policies to a handler (composability)
 */
export function applyPolicies<TInput, TOutput>(
	handler: Handler<TInput, TOutput>,
	...policies: Array<(h: Handler<TInput, TOutput>) => Handler<TInput, TOutput>>
): Handler<TInput, TOutput> {
	return policies.reduce((h, policy) => policy(h), handler);
}
