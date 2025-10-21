#!/usr/bin/env node
/**
 * Client generator script
 * Generates a typed TypeScript client for the procedures
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { collectRegistry } from "@c4c/core";
import { generateRpcClientModule } from "@c4c/generators";

async function main() {
  console.log("🔍 Loading procedures...\n");

  // Collect all procedures
  const registry = await collectRegistry("procedures");

  console.log(`✅ Found ${registry.size} procedures\n`);

  // Generate client code
  console.log("🔧 Generating client...\n");
  const clientCode = generateRpcClientModule(registry, {
    baseUrl: "http://localhost:3000",
  });

  // Write to file
  const outputPath = resolve("generated/client.ts");
  await writeFile(outputPath, clientCode, "utf-8");

  console.log(`✅ Client generated at: ${outputPath}\n`);
  console.log("📝 You can now use the client in your TypeScript code:");
  console.log(`
  import { createc4cClient } from "./generated/client";
  
  const client = createc4cClient({
    baseUrl: "http://localhost:3000"
  });
  
  // Call procedures with full type safety
  const result = await client.procedures["users.create"]({
    name: "John Doe",
    email: "john@example.com",
    role: "user"
  });
  `);
}

main().catch((error) => {
  console.error("❌ Failed to generate client:", error);
  process.exit(1);
});
