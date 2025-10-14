#!/usr/bin/env tsx

/**
 * Hono SSE Server for Workflow Execution
 * 
 * Provides real-time workflow execution via Server-Sent Events
 * Replaces Next.js Server Actions with streaming updates
 */

import { serve } from "@hono/node-server";
import { createRegistry } from "../core/registry.js";
import { createWorkflowSSEApp } from "../adapters/hono-sse.js";
import { add as addHandler, multiply as multiplyHandler } from "../handlers/math.js";
import { addContract, multiplyContract } from "../contracts/math.js";

async function main() {
  console.log("🚀 Starting Hono SSE Workflow Server...\n");

  // Create registry with contracts and handlers
  const registry = createRegistry();
  
  // Register math procedures
  registry.set("math.add", addHandler);
  registry.set("math.multiply", multiplyHandler);

  console.log(`📋 Registered ${registry.size} procedures`);

  // Create Hono app with SSE endpoints
  const app = createWorkflowSSEApp(registry);

  // Start server
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;
  
  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    console.log(`🌐 Hono SSE Server running at http://localhost:${info.port}`);
    console.log(`\n📡 SSE Endpoints:`);
    console.log(`   Health Check:     GET  http://localhost:${info.port}/health`);
    console.log(`   Procedures:       GET  http://localhost:${info.port}/procedures`);
    console.log(`   Workflow Execute: POST http://localhost:${info.port}/workflow/execute-sse`);
    console.log(`   Procedure Execute: POST http://localhost:${info.port}/procedure/execute-sse/:name`);
    console.log(`   Workflow Validate: POST http://localhost:${info.port}/workflow/validate`);
    console.log(`\n💡 Usage:`);
    console.log(`   Connect to SSE endpoint and send workflow definition as JSON`);
    console.log(`   Receive real-time updates during execution`);
    console.log(``);
  });
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down Hono SSE Server...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n👋 Shutting down Hono SSE Server...");
  process.exit(0);
});

main().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});