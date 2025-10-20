import { z } from "zod";
import type { Procedure, Registry } from "@c4c/core";
import { executeWorkflow } from "./runtime.js";
import type { WorkflowDefinition } from "./types.js";
import type { SubWorkflowConfig } from "./types.js";

/**
 * Factory for a procedure that runs a sub-workflow by id.
 * Expects the caller to supply a `workflows` registry (id -> WorkflowDefinition).
 */
export function createSubworkflowProcedure(
  workflows: Map<string, WorkflowDefinition>,
  options?: { name?: string; description?: string }
): Procedure<SubWorkflowConfig & Record<string, unknown>, Record<string, unknown>> {
  const name = options?.name ?? "workflow.run";
  const description = options?.description ?? "Execute a sub-workflow by id";

  return {
    contract: {
      name,
      description,
      input: z.object({
        workflowId: z.string(),
        input: z.record(z.string(), z.unknown()).optional(),
        mergeOutputs: z.boolean().optional(),
      }) as unknown as z.ZodType<SubWorkflowConfig & Record<string, unknown>>, // align with core types
      output: z.record(z.string(), z.unknown()),
    },
    handler: async (input, context) => {
      const cfg = input as unknown as SubWorkflowConfig;
      const wf = workflows.get(cfg.workflowId);
      if (!wf) {
        throw new Error(`Sub-workflow not found: ${cfg.workflowId}`);
      }

      const registry = (context.metadata?.registry ?? null) as Registry | null;
      if (!registry) {
        throw new Error("Registry is required in execution context metadata to run sub-workflow");
      }

      const result = await executeWorkflow(wf, registry, cfg.input ?? {});
      return cfg.mergeOutputs ? result.outputs : { [cfg.workflowId]: result.outputs };
    },
  };
}
