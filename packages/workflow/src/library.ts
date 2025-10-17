import { promises as fs } from "node:fs";
import { extname, join } from "node:path";
import type { WorkflowDefinition } from "./types.js";

export interface WorkflowSummary {
	id: string;
	name: string;
	description?: string;
	version: string;
	nodeCount: number;
	path: string;
}

const WORKFLOW_EXTENSION = ".json";

export async function loadWorkflowLibrary(directory: string): Promise<{
	workflows: WorkflowDefinition[];
	summaries: WorkflowSummary[];
}> {
	const entries = await safeReadDirectory(directory);
	const workflows: WorkflowDefinition[] = [];
	const summaries: WorkflowSummary[] = [];

	for (const entry of entries) {
		if (!entry.isFile()) continue;
		if (extname(entry.name).toLowerCase() !== WORKFLOW_EXTENSION) continue;

		const path = join(directory, entry.name);
		const definition = await safeReadWorkflow(path);
		if (!definition) continue;

		workflows.push(definition);
		summaries.push({
			id: definition.id,
			name: definition.name,
			description: definition.description,
			version: definition.version,
			nodeCount: definition.nodes.length,
			path,
		});
	}

	// Sort by name for consistent output
	summaries.sort((a, b) => a.name.localeCompare(b.name));
	workflows.sort((a, b) => a.name.localeCompare(b.name));

	return { workflows, summaries };
}

export async function loadWorkflowDefinitionById(
	directory: string,
	id: string
): Promise<WorkflowDefinition | undefined> {
	const filename = `${id}${WORKFLOW_EXTENSION}`;
	const path = join(directory, filename);
	return safeReadWorkflow(path);
}

async function safeReadDirectory(directory: string) {
	try {
		return await fs.readdir(directory, { withFileTypes: true });
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

async function safeReadWorkflow(path: string): Promise<WorkflowDefinition | undefined> {
	try {
		const raw = await fs.readFile(path, "utf8");
		const definition = JSON.parse(raw) as WorkflowDefinition;
		if (!definition?.id) {
			console.warn(`[WorkflowLibrary] Workflow file ${path} missing 'id'. Skipping.`);
			return undefined;
		}
		return definition;
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
			console.warn(`[WorkflowLibrary] Failed to load workflow from ${path}:`, error);
		}
		return undefined;
	}
}
