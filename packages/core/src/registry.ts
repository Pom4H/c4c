import { globSync } from "glob";
import type { Procedure, Registry } from "@tsdev/workflow";

/**
 * Collects all procedures from handlers directory
 * This implements the "zero boilerplate, maximum reflection" principle
 */
export async function collectRegistry(handlersPath = "src/handlers"): Promise<Registry> {
	const registry: Registry = new Map();

	// Find all TypeScript files in handlers directory
	const handlerFiles = globSync(`${handlersPath}/**/*.ts`, {
		absolute: true,
		ignore: ["**/*.test.ts", "**/*.spec.ts"],
	});

	for (const file of handlerFiles) {
		try {
			// Dynamic import of handler module
			const module = await import(file);

			// Extract all exported procedures
			for (const [exportName, exportValue] of Object.entries(module)) {
				if (isProcedure(exportValue)) {
					const procedureName = exportValue.contract.name || exportName;
					registry.set(procedureName, exportValue as Procedure);
					console.log(`[Registry] Registered procedure: ${procedureName}`);
				}
			}
		} catch (error) {
			console.error(`[Registry] Failed to load handler from ${file}:`, error);
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
