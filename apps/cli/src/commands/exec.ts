import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { collectProjectArtifacts } from "@c4c/core";
import { execute } from "@c4c/core";
import { executeWorkflow } from "@c4c/workflow";

interface ExecOptions {
	root?: string;
	input?: string;
	inputFile?: string;
	json?: boolean;
}

/**
 * Execute a procedure or workflow by name/ID
 * Unified approach with priority: procedure > workflow
 */
export async function execCommand(
	name: string,
	options: ExecOptions
): Promise<void> {
	const rootDir = resolve(options.root ?? process.cwd());

	// Load all artifacts via introspection
	if (!options.json) {
		console.log(`[c4c] Discovering artifacts in ${rootDir}...`);
	}
	const artifacts = await collectProjectArtifacts(rootDir);

	// Parse input (same for both procedures and workflows)
	let input: unknown;
	if (options.inputFile) {
		const content = await readFile(options.inputFile, "utf-8");
		input = JSON.parse(content);
	} else if (options.input) {
		input = JSON.parse(options.input);
	} else {
		input = {};
	}

	// Priority 1: Try to find procedure
	const procedure = artifacts.procedures.get(name);
	if (procedure) {
		await executeProcedure(name, procedure, artifacts.procedures, input, options);
		return;
	}

	// Priority 2: Try to find workflow
	const workflow = artifacts.workflows.get(name);
	if (workflow) {
		await executeWorkflowById(name, workflow, artifacts.procedures, input, options);
		return;
	}

	// Not found - show helpful error
	const availableProcedures = Array.from(artifacts.procedures.keys());
	const availableWorkflows = Array.from(artifacts.workflows.keys());
	
	let errorMessage = `Artifact '${name}' not found.\n\n`;
	
	if (availableProcedures.length > 0) {
		errorMessage += `Available procedures (${availableProcedures.length}):\n`;
		errorMessage += availableProcedures.slice(0, 10).map(p => `  - ${p}`).join('\n');
		if (availableProcedures.length > 10) {
			errorMessage += `\n  ... and ${availableProcedures.length - 10} more`;
		}
		errorMessage += '\n\n';
	}
	
	if (availableWorkflows.length > 0) {
		errorMessage += `Available workflows (${availableWorkflows.length}):\n`;
		errorMessage += availableWorkflows.slice(0, 10).map(w => `  - ${w}`).join('\n');
		if (availableWorkflows.length > 10) {
			errorMessage += `\n  ... and ${availableWorkflows.length - 10} more`;
		}
	}
	
	if (availableProcedures.length === 0 && availableWorkflows.length === 0) {
		errorMessage += 'No procedures or workflows found in project.';
	}

	throw new Error(errorMessage);
}

/**
 * Execute a procedure
 */
async function executeProcedure(
	procedureName: string,
	procedure: any,
	registry: any,
	input: unknown,
	options: ExecOptions
): Promise<void> {
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
async function executeWorkflowById(
	workflowId: string,
	workflow: any,
	registry: any,
	input: unknown,
	options: ExecOptions
): Promise<void> {
	if (!options.json) {
		console.log(`[c4c] Found workflow: ${workflow.name} (v${workflow.version})`);
	}

	// Execute
	if (!options.json) {
		console.log(`[c4c] Executing workflow '${workflow.id}'...`);
		console.log(`[c4c] Input:`, JSON.stringify(input, null, 2));
	}

	try {
		const result = await executeWorkflow(workflow, registry, input as Record<string, unknown>);

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
