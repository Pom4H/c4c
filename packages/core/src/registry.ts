import { readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import type { Procedure, Registry } from "./types.js";

let tsLoaderReady: Promise<void> | null = null;

async function ensureTypeScriptLoader() {
	if (!tsLoaderReady) {
		tsLoaderReady = (async () => {
			try {
				const moduleId = "tsx/esm/api";
				const dynamicImport = new Function(
					"specifier",
					"return import(specifier);"
				) as (specifier: string) => Promise<{ register?: () => void }>;
				const { register } = await dynamicImport(moduleId).catch(() => ({ register: undefined }));
				if (typeof register === "function") {
					register();
				}
			} catch (error) {
				console.warn(
					"[Registry] Unable to register TypeScript loader. Only JavaScript handlers will be loaded.",
					error
				);
			}
		})();
	}
	return tsLoaderReady;
}

/**
 * Collects all procedures from handlers directory
 * This implements the "zero boilerplate, maximum reflection" principle
 */
export async function collectRegistry(handlersPath = "src/handlers"): Promise<Registry> {
	const registry: Registry = new Map();

	const absoluteRoot = resolve(handlersPath);
	const handlerFiles = await findHandlerFiles(absoluteRoot);

	for (const file of handlerFiles) {
		try {
			if (file.endsWith(".ts") || file.endsWith(".tsx")) {
				await ensureTypeScriptLoader();
			}

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

const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const IGNORED_DIRECTORIES = new Set(["node_modules", ".git", "dist", "build"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.[^.]+$/i;

async function findHandlerFiles(root: string): Promise<string[]> {
	const result: string[] = [];

	async function walk(directory: string) {
		const entries = await readdir(directory, { withFileTypes: true });
		for (const entry of entries) {
			const entryPath = join(directory, entry.name);

			if (entry.isDirectory()) {
				if (IGNORED_DIRECTORIES.has(entry.name)) continue;
				await walk(entryPath);
				continue;
			}

			if (entry.isFile()) {
				if (entry.name.endsWith(".d.ts")) continue;
				if (TEST_FILE_PATTERN.test(entry.name)) continue;

				const extension = extname(entry.name).toLowerCase();
				if (!ALLOWED_EXTENSIONS.has(extension)) continue;

				result.push(entryPath);
			}
		}
	}

	await walk(root);
	return result;
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
