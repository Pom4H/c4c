import { readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { WorkflowDefinition } from "./types.js";

export interface WorkflowSummary {
	id: string;
	name: string;
	description?: string;
	version: string;
	nodeCount: number;
	path: string;
}

const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const IGNORED_DIRECTORIES = new Set(["node_modules", ".git", "dist", "build"]);

export async function loadWorkflowLibrary(directory: string): Promise<{
	workflows: WorkflowDefinition[];
	summaries: WorkflowSummary[];
}> {
	const absoluteRoot = resolve(directory);
	const files = await findWorkflowModules(absoluteRoot);
	const byId = new Map<string, { definition: WorkflowDefinition; path: string }>();

	for (const file of files) {
		try {
			if (file.endsWith(".ts") || file.endsWith(".tsx")) {
				await ensureTypeScriptLoader();
			}

			const module = await import(pathToFileURL(file).href);
			const definitions = extractDefinitionsFromModule(module);

			for (const definition of definitions) {
				if (!definition?.id) continue;
				if (byId.has(definition.id)) continue;
				byId.set(definition.id, { definition, path: file });
			}
		} catch (error) {
			console.warn(`[WorkflowLibrary] Failed to load workflows from ${file}:`, error);
		}
	}

	const workflows = Array.from(byId.values())
		.map((entry) => entry.definition)
		.sort((a, b) => a.name.localeCompare(b.name));

	const summaries: WorkflowSummary[] = workflows.map((definition) => {
		const entry = byId.get(definition.id);
		return {
			id: definition.id,
			name: definition.name,
			description: definition.description,
			version: definition.version,
			nodeCount: definition.nodes.length,
			path: entry?.path ?? "",
		};
	});

	return { workflows, summaries };
}

export async function loadWorkflowDefinitionById(
	directory: string,
	id: string
): Promise<WorkflowDefinition | undefined> {
	const { workflows } = await loadWorkflowLibrary(directory);
	return workflows.find((workflow) => workflow.id === id);
}

async function findWorkflowModules(root: string): Promise<string[]> {
	const result: string[] = [];

	async function walk(directory: string) {
		const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);

		for (const entry of entries) {
			const entryPath = join(directory, entry.name);

			if (entry.isDirectory()) {
				if (IGNORED_DIRECTORIES.has(entry.name)) continue;
				await walk(entryPath);
				continue;
			}

			if (!entry.isFile()) continue;
			if (entry.name.endsWith(".d.ts")) continue;

			const extension = extname(entry.name).toLowerCase();
			if (!ALLOWED_EXTENSIONS.has(extension)) continue;

			result.push(entryPath);
		}
	}

	await walk(root);
	return result;
}

function extractDefinitionsFromModule(module: Record<string, unknown>): WorkflowDefinition[] {
	const definitions: WorkflowDefinition[] = [];

	const maybeAdd = (value: unknown) => {
		if (isWorkflowDefinition(value)) {
			definitions.push(value);
		} else if (Array.isArray(value)) {
			for (const item of value) {
				if (isWorkflowDefinition(item)) {
					definitions.push(item);
				}
			}
		}
	};

	for (const value of Object.values(module)) {
		maybeAdd(value);
	}

	return definitions;
}

function isWorkflowDefinition(value: unknown): value is WorkflowDefinition {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<WorkflowDefinition>;
	return (
		typeof candidate.id === "string" &&
		typeof candidate.name === "string" &&
		typeof candidate.version === "string" &&
		Array.isArray(candidate.nodes) &&
		typeof candidate.startNode === "string"
	);
}

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
					"[WorkflowLibrary] Unable to register TypeScript loader. Only JavaScript workflows will be loaded.",
					error
				);
			}
		})();
	}
	return tsLoaderReady;
}
