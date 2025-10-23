import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { collectProjectArtifacts } from "@c4c/core";
import { execute } from "@c4c/core";
import { executeWorkflow } from "@c4c/workflow";

interface ExecProcedureOptions {
	root?: string;
	input?: string;
	inputFile?: string;
	json?: boolean;
}

interface ExecWorkflowOptions {
	root?: string;
	workflow: string;
	input?: string;
	inputFile?: string;
	json?: boolean;
}

/**
 * Execute a procedure
 * Discovers all artifacts via introspection
 */
export async function execProcedureCommand(
	procedureName: string,
	options: ExecProcedureOptions
): Promise<void> {
	const rootDir = resolve(options.root ?? process.cwd());

	// Load all artifacts via introspection
	if (!options.json) {
		console.log(`[c4c] Discovering artifacts in ${rootDir}...`);
	}
	const artifacts = await collectProjectArtifacts(rootDir);
	const registry = artifacts.procedures;

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
 * Execute a workflow by ID
 * Workflows are discovered via introspection - no hardcoded paths!
 */
export async function execWorkflowCommand(options: ExecWorkflowOptions): Promise<void> {
	const rootDir = resolve(options.root ?? process.cwd());

	// Load all artifacts via introspection
	if (!options.json) {
		console.log(`[c4c] Discovering artifacts in ${rootDir}...`);
	}
	const artifacts = await collectProjectArtifacts(rootDir);

	// Find workflow by ID
	const workflow = artifacts.workflows.get(options.workflow);
	if (!workflow) {
		const availableWorkflows = Array.from(artifacts.workflows.keys()).join(", ");
		throw new Error(
			`Workflow '${options.workflow}' not found. Available workflows: ${availableWorkflows || "none"}`
		);
	}

	if (!options.json) {
		console.log(`[c4c] Found workflow: ${workflow.name} (v${workflow.version})`);
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
		console.log(`[c4c] Executing workflow '${workflow.id}'...`);
		console.log(`[c4c] Input:`, JSON.stringify(input, null, 2));
	}

	try {
		const result = await executeWorkflow(workflow, artifacts.procedures, input as Record<string, unknown>);

		if (options.json) {
			console.log(JSON.stringify(result, null, 2));
		} else {
			console.log(`[c4c] ✅ Workflow completed successfully!`);
			console.log(`[c4c] Execution ID:`, result.executionId);
			console.log(`[c4c] Status:`, result.status);
			console.log(`[c4c] Nodes executed:`, result.nodesExecuted);
			console.log(`[c4c] Execution time:`, `${result.executionTime}ms`);
			console.log(`[c4c] Output:`, JSON.stringify(result.outputs, null, 2));
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
