import { globSync } from "glob";
import type { Procedure, Registry } from "./types.js";

/**
 * Collects all procedures from handlers directory
 * This implements the "zero boilerplate, maximum reflection" principle
 */
export async function collectRegistry(handlersPath: string | string[] = "src/handlers"): Promise<Registry> {
    const paths = Array.isArray(handlersPath) ? handlersPath : [handlersPath];
    return await collectRegistryFromPaths(paths);
}

/**
 * Collect procedures from multiple directories (e.g., ['src/handlers', 'procedures'])
 */
export async function collectRegistryFromPaths(handlersPaths: string[] = ["src/handlers", "procedures"]): Promise<Registry> {
    const registry: Registry = new Map();

    for (const basePath of handlersPaths) {
        // Find all TypeScript files in the directory
        const handlerFiles = globSync(`${basePath}/**/*.ts`, {
            absolute: true,
            ignore: ["**/*.test.ts", "**/*.spec.ts"],
        });

        for (const file of handlerFiles) {
            try {
                const module = await import(file);

                for (const [exportName, exportValue] of Object.entries(module)) {
                    if (isProcedure(exportValue)) {
                        const procedureName = (exportValue as Procedure).contract.name || exportName;
                        // Last-write wins if duplicated across paths; log a warning
                        if (registry.has(procedureName)) {
                            console.warn(`[Registry] Duplicate procedure name '${procedureName}' discovered. Overwriting with definition from ${file}.`);
                        }
                        registry.set(procedureName, exportValue as Procedure);
                        console.log(`[Registry] Registered procedure: ${procedureName}`);
                    }
                }
            } catch (error) {
                console.error(`[Registry] Failed to load handler from ${file}:`, error);
            }
        }
    }

    return registry;
}

/**
 * Type guard to check if an export is a valid Procedure
 */
function isProcedure(value: unknown): value is Procedure {
	return (
		typeof value === "object" &&
		value !== null &&
		"contract" in value &&
		"handler" in value &&
		typeof (value as { handler: unknown }).handler === "function"
	);
}

/**
 * Get procedure by name from registry
 */
export function getProcedure(registry: Registry, name: string): Procedure | undefined {
	return registry.get(name);
}

/**
 * List all procedure names in registry
 */
export function listProcedures(registry: Registry): string[] {
	return Array.from(registry.keys());
}

/**
 * Get registry metadata for introspection
 */
export function describeRegistry(registry: Registry) {
	return Array.from(registry.entries()).map(([name, procedure]) => ({
		name,
		description: procedure.contract.description,
		metadata: procedure.contract.metadata,
		inputSchema: procedure.contract.input,
		outputSchema: procedure.contract.output,
	}));
}
