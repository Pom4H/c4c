#!/usr/bin/env node
import { collectRegistry } from "@c4c/core";
import { createHttpServer } from "@c4c/adapters";

const PORT = Number.parseInt(process.env.PORT || "3000", 10);

async function main() {
  console.log("🔍 Collecting procedures from handlers...");
  
  const registry = await collectRegistry("./src/handlers");
  
  console.log(`✅ Registered ${registry.size} procedures\n`);
  
  createHttpServer(registry, PORT);
}

main().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
