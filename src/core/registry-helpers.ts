/**
 * Helper functions for working with Registry
 */

import type { Registry, Procedure } from "./types.js";

/**
 * Create registry from a record of procedures
 * Handles type casting automatically
 * 
 * @example
 * ```typescript
 * import { createRegistryFromProcedures } from "@tsdev/core/registry-helpers";
 * 
 * const registry = createRegistryFromProcedures({
 *   "math.add": addProcedure,
 *   "math.multiply": multiplyProcedure,
 * });
 * ```
 */
export function createRegistryFromProcedures(
	procedures: Record<string, Procedure>
): Registry {
	const registry: Registry = new Map();

	for (const [name, procedure] of Object.entries(procedures)) {
		registry.set(name, procedure);
	}

	return registry;
}

/**
 * Register multiple procedures at once
 * 
 * @example
 * ```typescript
 * const registry = new Map();
 * registerProcedures(registry, {
 *   "math.add": addProcedure,
 *   "math.multiply": multiplyProcedure,
 * });
 * ```
 */
export function registerProcedures(
	registry: Registry,
	procedures: Record<string, Procedure>
): void {
	for (const [name, procedure] of Object.entries(procedures)) {
		registry.set(name, procedure);
	}
}

/**
 * Create an empty registry
 * 
 * @example
 * ```typescript
 * const registry = createRegistry();
 * registry.set("math.add", addProcedure);
 * ```
 */
export function createRegistry(): Registry {
	return new Map();
}

/**
 * Get all procedure names from registry
 */
export function getProcedureNames(registry: Registry): string[] {
	return Array.from(registry.keys());
}

/**
 * Check if procedure exists in registry
 */
export function hasProcedure(registry: Registry, name: string): boolean {
	return registry.has(name);
}

/**
 * Get procedure from registry with type safety
 */
export function getProcedure(
	registry: Registry,
	name: string
): Procedure | undefined {
	return registry.get(name);
}

/**
 * Merge multiple registries into one
 */
export function mergeRegistries(...registries: Registry[]): Registry {
	const merged: Registry = new Map();

	for (const registry of registries) {
		for (const [name, procedure] of registry.entries()) {
			if (merged.has(name)) {
				console.warn(
					`[Registry] Procedure ${name} already exists, overwriting`
				);
			}
			merged.set(name, procedure);
		}
	}

	return merged;
}
