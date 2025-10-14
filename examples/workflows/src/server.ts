#!/usr/bin/env node
/**
 * Workflow examples server
 * Demonstrates workflow execution with mock procedures
 */

import { createHttpServer } from "@tsdev/adapters";
import { createMockRegistry } from "./mock-registry.js";

const PORT = Number.parseInt(process.env.PORT || "3001", 10);

async function main() {
  console.log("🔍 Creating mock registry for workflow examples...");
  
  const registry = createMockRegistry();
  
  console.log(`✅ Registered ${registry.size} procedures\n`);
  
  createHttpServer(registry, PORT);
}

main().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
