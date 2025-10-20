#!/usr/bin/env node
import { collectRegistry } from "@c4c/core";
import { runCli } from "@c4c/adapters";

async function main() {
  const registry = await collectRegistry("./src/handlers");
  await runCli(registry);
}

main().catch((error) => {
  console.error("CLI error:", error);
  process.exit(1);
});
