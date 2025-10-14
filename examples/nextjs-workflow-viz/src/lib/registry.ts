/**
 * Registry setup with all procedures
 * Uses real tsdev framework Registry and demo procedures
 */

import type { Registry } from "@tsdev/core/types.js";
import { createRegistryFromProcedures } from "@tsdev/core/registry-helpers.js";
import { demoProcedures } from "@tsdev/examples/index.js";

/**
 * Create and configure the registry with demo procedures from framework
 */
export function setupRegistry(): Registry {
  // Use framework helper to create registry from demo procedures
  return createRegistryFromProcedures(demoProcedures);
}

// Singleton registry instance
let registryInstance: Registry | null = null;

export function getRegistry(): Registry {
  if (!registryInstance) {
    registryInstance = setupRegistry();
  }
  return registryInstance;
}
