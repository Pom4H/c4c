/**
 * Create a mock procedure registry for demo
 * 
 * This simulates the framework's registry but with simple mock procedures
 * In a real app, you would use the actual framework registry
 */

import { z } from "zod";
import { mockProcedures } from "./mock-procedures";

// Import types from framework core
type Registry = Map<string, Procedure>;

interface Procedure {
  contract: {
    name: string;
    description?: string;
    input: z.ZodType;
    output: z.ZodType;
  };
  handler: (input: unknown, context?: unknown) => Promise<unknown>;
}

/**
 * Create a mock registry from mock procedures
 */
export function createMockRegistry(): Registry {
  const registry: Registry = new Map();

  // Convert mock procedures to framework-style procedures
  for (const [name, handler] of Object.entries(mockProcedures)) {
    const procedure: Procedure = {
      contract: {
        name,
        description: `Mock procedure: ${name}`,
        input: z.record(z.unknown()),
        output: z.record(z.unknown()),
      },
      handler: async (input) => {
        return await handler(input as Record<string, unknown>);
      },
    };
    
    registry.set(name, procedure);
  }

  return registry;
}
