/**
 * Type-safe Registry implementation
 *
 * This module provides utilities for creating type-safe registries
 * where procedure types are preserved through get/set operations
 */

import type { ExecutionContext, Procedure } from "./types.js";

/**
 * Procedure map type - can be extended via module augmentation
 *
 * @example
 * ```typescript
 * // In your code, augment this interface:
 * declare module "@c4c/core" {
 *   interface ProcedureTypeMap {
 *     "math.add": Procedure<{ a: number; b: number }, { result: number }>;
 *     "users.create": Procedure<CreateUserInput, User>;
 *   }
 * }
 * ```
 */
// biome-ignore lint/suspicious/noEmptyInterface: This interface is meant to be extended via module augmentation
export interface ProcedureTypeMap {
	// Empty by default, extended via module augmentation
}

/**
 * Extract procedure names from type map
 */
export type ProcedureName = keyof ProcedureTypeMap extends never ? string : keyof ProcedureTypeMap;

/**
 * Type-safe registry interface
 */
export interface TypedRegistry {
	/**
	 * Get procedure with preserved types
	 */
	get<K extends ProcedureName>(
		name: K
	): K extends keyof ProcedureTypeMap ? ProcedureTypeMap[K] : Procedure | undefined;

	/**
	 * Set procedure with type checking
	 */
	set<K extends ProcedureName>(
		name: K,
		procedure: K extends keyof ProcedureTypeMap ? ProcedureTypeMap[K] : Procedure
	): this;

	/**
	 * Check if procedure exists
	 */
	has(name: ProcedureName): boolean;

	/**
	 * Delete procedure
	 */
	delete(name: ProcedureName): boolean;

	/**
	 * Get all procedure names
	 */
	keys(): IterableIterator<ProcedureName>;

	/**
	 * Get all procedures
	 */
	values(): IterableIterator<Procedure>;

	/**
	 * Get all entries
	 */
	entries(): IterableIterator<[ProcedureName, Procedure]>;

	/**
	 * Number of procedures
	 */
	readonly size: number;

	/**
	 * Iterate over procedures
	 */
	forEach(
		callbackfn: (value: Procedure, key: ProcedureName, map: TypedRegistry) => void,
		thisArg?: unknown
	): void;
}

/**
 * Create a type-safe registry
 */
export function createTypedRegistry(): TypedRegistry {
	const map = new Map<string, Procedure>();

	return {
		get<K extends ProcedureName>(name: K) {
			return map.get(name as string) as K extends keyof ProcedureTypeMap
				? ProcedureTypeMap[K]
				: Procedure | undefined;
		},

		set<K extends ProcedureName>(
			name: K,
			procedure: K extends keyof ProcedureTypeMap ? ProcedureTypeMap[K] : Procedure
		) {
			map.set(name as string, procedure as Procedure);
			return this;
		},

		has(name: ProcedureName): boolean {
			return map.has(name as string);
		},

		delete(name: ProcedureName): boolean {
			return map.delete(name as string);
		},

		keys(): IterableIterator<ProcedureName> {
			return map.keys() as IterableIterator<ProcedureName>;
		},

		values(): IterableIterator<Procedure> {
			return map.values();
		},

		entries(): IterableIterator<[ProcedureName, Procedure]> {
			return map.entries() as IterableIterator<[ProcedureName, Procedure]>;
		},

		get size(): number {
			return map.size;
		},

		forEach(
			callbackfn: (value: Procedure, key: ProcedureName, map: TypedRegistry) => void,
			thisArg?: unknown
		): void {
			map.forEach((value, key) => {
				callbackfn.call(thisArg, value, key as ProcedureName, this);
			});
		},
	};
}

/**
 * Helper to infer input type from procedure name
 */
export type InferInput<K extends ProcedureName> = K extends keyof ProcedureTypeMap
	? ProcedureTypeMap[K] extends Procedure<infer I, unknown>
		? I
		: unknown
	: unknown;

/**
 * Helper to infer output type from procedure name
 */
export type InferOutput<K extends ProcedureName> = K extends keyof ProcedureTypeMap
	? ProcedureTypeMap[K] extends Procedure<unknown, infer O>
		? O
		: unknown
	: unknown;

/**
 * Helper to infer context type from procedure name
 */
export type InferContext<K extends ProcedureName> = K extends keyof ProcedureTypeMap
	? ProcedureTypeMap[K] extends Procedure<unknown, unknown, infer C>
		? C
		: ExecutionContext
	: ExecutionContext;

/**
 * Type-safe execute function
 */
export async function executeTyped<K extends ProcedureName>(
	registry: TypedRegistry,
	name: K,
	input: InferInput<K>,
	context?: InferContext<K>
): Promise<InferOutput<K>> {
	const procedure = registry.get(name);
	if (!procedure) {
		throw new Error(`Procedure '${String(name)}' not found in registry`);
	}

	// Validate input
	const validatedInput = procedure.contract.input.parse(input);

	// Create context if not provided
	const ctx =
		context ??
		({
			requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
			timestamp: new Date(),
			metadata: {},
		} as InferContext<K>);

	// Execute handler
	const result = await procedure.handler(validatedInput, ctx as ExecutionContext);

	// Validate output
	const validatedOutput = procedure.contract.output.parse(result);

	return validatedOutput as InferOutput<K>;
}
