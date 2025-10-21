#!/usr/bin/env node
/**
 * HTTP Server for modules example
 * Demonstrates serving modular procedures via HTTP
 */

import { collectRegistry } from "@c4c/core";
import { createHttpServer } from "@c4c/adapters";

async function main() {
  console.log("🔍 Loading procedures from modules...\n");

  // Collect all procedures from the procedures directory
  const registry = await collectRegistry("procedures");

  console.log(`\n✅ Loaded ${registry.size} procedures\n`);

  // Start HTTP server with all features enabled
  createHttpServer(registry, 3000, {
    enableDocs: true,
    enableRpc: true,
    enableRest: true,
    enableWorkflow: false, // Not needed for this example
  });
}

main().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
