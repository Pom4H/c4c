import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { collectProjectArtifacts } from "@c4c/core";
import { execute } from "@c4c/core";
import { start } from "@c4c/workflow";

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

	// Priority 2: Try to find workflow (exported async functions)
	// Workflows are now functions, not definition objects
	// They would be discovered by the project artifacts scanner if they export workflow functions

	// Not found - show helpful error
	const availableProcedures = Array.from(artifacts.procedures.keys());
	
	let errorMessage = `Artifact '${name}' not found.\n\n`;
	
	if (availableProcedures.length > 0) {
		errorMessage += `Available procedures (${availableProcedures.length}):\n`;
		errorMessage += availableProcedures.slice(0, 10).map(p => `  - ${p}`).join('\n');
		if (availableProcedures.length > 10) {
			errorMessage += `\n  ... and ${availableProcedures.length - 10} more`;
		}
		errorMessage += '\n\n';
	}
	
	if (availableProcedures.length === 0) {
		errorMessage += 'No procedures found in project.\n';
		errorMessage += 'Note: Workflows are now plain async functions. Use start() to run them directly.';
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
			console.log(`[c4c] Success!`);
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
			console.error(`[c4c] Execution failed:`, error);
		}
		process.exit(1);
	}
}
