import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { collectRegistry } from "@c4c/core";
import { execute } from "@c4c/core";
import { executeWorkflow } from "@c4c/workflow";
import { determineProceduresPath, determineWorkflowsPath } from "../lib/project-paths.js";

interface ExecProcedureOptions {
	root?: string;
	input?: string;
	inputFile?: string;
	json?: boolean;
}

interface ExecWorkflowOptions {
	root?: string;
	file: string;
	input?: string;
	inputFile?: string;
	json?: boolean;
}

/**
 * Execute a procedure
 */
export async function execProcedureCommand(
	procedureName: string,
	options: ExecProcedureOptions
): Promise<void> {
	const rootDir = resolve(options.root ?? process.cwd());
	const proceduresPath = determineProceduresPath(rootDir);

	// Load registry
	if (!options.json) {
		console.log(`[c4c] Loading procedures from ${proceduresPath}...`);
	}
	const registry = await collectRegistry(proceduresPath);

	// Get procedure
	const procedure = registry.get(procedureName);
	if (!procedure) {
		throw new Error(
			`Procedure '${procedureName}' not found. Available: ${Array.from(registry.keys()).join(", ")}`
		);
	}

	// Parse input
	let input: unknown;
	if (options.inputFile) {
		const content = await readFile(options.inputFile, "utf-8");
		input = JSON.parse(content);
	} else if (options.input) {
		input = JSON.parse(options.input);
	} else {
		input = {};
	}

	// Execute
	if (!options.json) {
		console.log(`[c4c] Executing procedure '${procedureName}'...`);
		console.log(`[c4c] Input:`, JSON.stringify(input, null, 2));
	}

	try {
		const result = await execute(registry, procedureName, input);

		if (options.json) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			console.log(`[c4c] ✅ Success!`);
			console.log(`[c4c] Output:`, JSON.stringify(result, null, 2));
		}
	} catch (error) {
		if (options.json) {
			console.error(
				JSON.stringify(
					{
						error: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined,
					},
					null,
					2
				)
			);
		} else {
			console.error(`[c4c] ❌ Execution failed:`, error);
		}
		process.exit(1);
	}
}

/**
 * Execute a workflow
 */
export async function execWorkflowCommand(options: ExecWorkflowOptions): Promise<void> {
	const rootDir = resolve(options.root ?? process.cwd());
	const proceduresPath = determineProceduresPath(rootDir);
	const workflowsPath = determineWorkflowsPath(rootDir);
	
	// Try to resolve workflow path - check if it's already a full path or needs to be resolved
	let workflowPath: string;
	if (options.file.endsWith('.ts') || options.file.endsWith('.js')) {
		// If it has an extension, treat as relative path from root or absolute
		workflowPath = resolve(rootDir, options.file);
	} else {
		// Otherwise, try to find it in workflows directory
		workflowPath = resolve(workflowsPath, `${options.file}.ts`);
	}

	// Load registry
	if (!options.json) {
		console.log(`[c4c] Loading procedures from ${proceduresPath}...`);
	}
	const registry = await collectRegistry(proceduresPath);

	// Load workflow
	if (!options.json) {
		console.log(`[c4c] Loading workflow from ${workflowPath}...`);
	}

	let workflow: any;
	try {
		const workflowModule = await import(workflowPath);
		workflow = workflowModule.default || workflowModule;

		// If the module exports a workflow builder, get the workflow
		if (typeof workflow === "object" && workflow.workflow) {
			workflow = workflow.workflow;
		}
	} catch (error) {
		throw new Error(
			`Failed to load workflow from '${workflowPath}': ${error instanceof Error ? error.message : String(error)}`
		);
	}

	// Parse input
	let input: unknown;
	if (options.inputFile) {
		const content = await readFile(options.inputFile, "utf-8");
		input = JSON.parse(content);
	} else if (options.input) {
		input = JSON.parse(options.input);
	} else {
		input = {};
	}

	// Execute
	if (!options.json) {
		console.log(`[c4c] Executing workflow...`);
		console.log(`[c4c] Input:`, JSON.stringify(input, null, 2));
	}

	try {
		const result = await executeWorkflow(workflow, registry, input as Record<string, unknown>);

		if (options.json) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			console.log(`[c4c] ✅ Workflow completed successfully!`);
			console.log(`[c4c] Output:`, JSON.stringify(result, null, 2));
		}
	} catch (error) {
		if (options.json) {
			console.error(
				JSON.stringify(
					{
						error: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined,
					},
					null,
					2
				)
			);
		} else {
			console.error(`[c4c] ❌ Workflow execution failed:`, error);
		}
		process.exit(1);
	}
}
