/**
 * Registry setup with all procedures
 * Uses real tsdev framework Registry
 */

import type { Registry, Procedure } from "@tsdev/core/types.js";
import { addProcedure, multiplyProcedure, subtractProcedure } from "./procedures/math";
import { fetchDataProcedure, processDataProcedure, saveDataProcedure } from "./procedures/data";

/**
 * Create and configure the registry with all procedures
 */
export function setupRegistry(): Registry {
  // Registry is a Map<string, Procedure> in tsdev
  const registry: Registry = new Map();

  // Register math procedures
  registry.set("math.add", addProcedure);
  registry.set("math.multiply", multiplyProcedure);
  registry.set("math.subtract", subtractProcedure);

  // Register data procedures
  registry.set("data.fetch", fetchDataProcedure);
  registry.set("data.process", processDataProcedure);
  registry.set("data.save", saveDataProcedure);

  return registry;
}

// Singleton registry instance
let registryInstance: Registry | null = null;

export function getRegistry(): Registry {
  if (!registryInstance) {
    registryInstance = setupRegistry();
  }
  return registryInstance;
}
