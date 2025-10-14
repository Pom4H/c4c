#!/usr/bin/env node
import { collectRegistry } from "@tsdev/core";
import { runCli } from "@tsdev/adapters";

async function main() {
  const registry = await collectRegistry("./src/handlers");
  await runCli(registry);
}

main().catch((error) => {
  console.error("CLI error:", error);
  process.exit(1);
});
