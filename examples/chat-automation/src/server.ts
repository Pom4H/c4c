#!/usr/bin/env node
import { createHttpServer } from "@tsdev/adapters";
import { createMockRegistry } from "./mock-registry.js";
import { systemWorkflow } from "./workflows.js";

const PORT = Number.parseInt(process.env.PORT || "3002", 10);

async function main() {
  const registry = createMockRegistry();
  createHttpServer(registry, PORT);
  console.log("System workflow id:", systemWorkflow.id);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
