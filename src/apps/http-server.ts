/**
 * HTTP Server Application
 *
 * Demonstrates the transport-agnostic principle:
 * - Same handlers work via HTTP
 * - No handler code knows about HTTP
 * - Self-describing registry powers introspection
 */

import { createHttpServer } from "../adapters/http.js";
import { collectRegistry } from "../core/registry.js";

async function main() {
	console.log("🔍 Collecting procedures from handlers...\n");

	// Automatically discover all procedures (zero boilerplate)
	const registry = await collectRegistry("src/handlers");

	console.log(`\n✅ Registered ${registry.size} procedures\n`);

	// Start HTTP server with the registry
	const port = Number.parseInt(process.env.PORT || "3000", 10);
	createHttpServer(registry, port);
}

main().catch((error) => {
	console.error("Failed to start server:", error);
	process.exit(1);
});
