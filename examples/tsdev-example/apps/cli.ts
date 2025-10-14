#!/usr/bin/env node

/**
 * CLI Application
 * 
 * Demonstrates the transport-agnostic principle:
 * - Same handlers work via CLI
 * - No handler code knows about CLI
 * - Self-describing registry enables discovery
 */

import { runCli } from "../adapters/cli.js";
import { collectRegistry } from "../core/registry.js";

async function main() {
	// Automatically discover all procedures
	const registry = await collectRegistry("src/handlers");

	// Run CLI with remaining arguments
	const args = process.argv.slice(2);
	await runCli(registry, args);
}

main().catch((error) => {
	console.error("CLI error:", error);
	process.exit(1);
});
