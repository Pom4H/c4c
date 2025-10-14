import { createExecutionContext, executeProcedure } from "@tsdev/core";
import type { Registry } from "@tsdev/core";

/**
 * CLI adapter for tsdev
 * Demonstrates transport-agnostic principle - same handlers work via CLI
 */
export async function runCli(registry: Registry, args: string[]) {
	const [procedureName, ...inputArgs] = args;

	// List all procedures if no procedure name provided
	if (!procedureName || procedureName === "list" || procedureName === "--list") {
		console.log("\n📋 Available procedures:\n");
		for (const [name, procedure] of registry.entries()) {
			console.log(`  ${name}`);
			if (procedure.contract.description) {
				console.log(`    ${procedure.contract.description}`);
			}
		}
		console.log("");
		return;
	}

	// Get procedure from registry
	const procedure = registry.get(procedureName);
	if (!procedure) {
		console.error(`❌ Procedure '${procedureName}' not found`);
		console.log("\nRun with --list to see available procedures");
		process.exit(1);
	}

	try {
		// Parse CLI arguments to input object
		const input = parseCliArgs(inputArgs);

		// Create execution context
		const context = createExecutionContext({
			transport: "cli",
			args: process.argv,
		});

		// Execute procedure
		console.log(`\n🔧 Executing: ${procedureName}`);
		console.log(`📥 Input:`, JSON.stringify(input, null, 2));

		const result = await executeProcedure(procedure, input, context);

		console.log(`\n✅ Success!`);
		console.log(`📤 Output:`, JSON.stringify(result, null, 2));
		console.log("");
	} catch (error) {
		console.error(`\n❌ Error:`, error instanceof Error ? error.message : String(error));
		console.log("");
		process.exit(1);
	}
}

/**
 * Parse CLI arguments into input object
 * Supports: --key value and --key=value formats
 * Also supports JSON: --json '{"key": "value"}'
 */
function parseCliArgs(args: string[]): Record<string, unknown> {
	// Check for --json flag
	const jsonIndex = args.indexOf("--json");
	if (jsonIndex !== -1 && args[jsonIndex + 1]) {
		return JSON.parse(args[jsonIndex + 1]);
	}

	const input: Record<string, unknown> = {};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg?.startsWith("--")) {
			const key = arg.slice(2);

			// Handle --key=value format
			if (key.includes("=")) {
				const [k, ...valueParts] = key.split("=");
				if (k) {
					input[k] = parseValue(valueParts.join("="));
				}
			} else {
				// Handle --key value format
				const value = args[i + 1];
				if (value && !value.startsWith("--")) {
					input[key] = parseValue(value);
					i++; // Skip next arg as it's the value
				} else {
					// Flag without value (boolean true)
					input[key] = true;
				}
			}
		}
	}

	return input;
}

/**
 * Parse string value to appropriate type
 */
function parseValue(value: string): unknown {
	// Try to parse as number
	if (!Number.isNaN(Number(value))) {
		return Number(value);
	}

	// Try to parse as boolean
	if (value === "true") return true;
	if (value === "false") return false;

	// Try to parse as JSON
	if (value.startsWith("{") || value.startsWith("[")) {
		try {
			return JSON.parse(value);
		} catch {
			// Not valid JSON, return as string
		}
	}

	return value;
}
