import { z } from "zod";
import type { Registry, Procedure } from "@tsdev/core";
import { mockProcedures } from "./mock-procedures.js";

/**
 * Create a mock registry from mock procedures
 * In a real application, this would use collectRegistry() to auto-discover handlers
 */
export function createMockRegistry(): Registry {
  const registry: Registry = new Map();

  // Convert mock procedures to proper Procedure objects
  for (const [name, handler] of Object.entries(mockProcedures)) {
    const procedure: Procedure = {
      contract: {
        name,
        description: `Mock procedure: ${name}`,
        input: z.any(),
        output: z.any(),
      },
      handler,
    };
    
    registry.set(name, procedure);
  }

  return registry;
}
