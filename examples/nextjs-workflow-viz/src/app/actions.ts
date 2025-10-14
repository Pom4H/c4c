"use server";

/**
 * Server Actions for workflow metadata (no longer executes workflows)
 * Workflow execution now handled by Hono SSE endpoints
 */

import {
  mathWorkflow,
  conditionalWorkflow,
  parallelWorkflow,
  complexWorkflow,
} from "@/lib/workflow/examples";

const workflows = {
  "math-calculation": mathWorkflow,
  "conditional-processing": conditionalWorkflow,
  "parallel-tasks": parallelWorkflow,
  "complex-workflow": complexWorkflow,
};

/**
 * Get all available workflows
 */
export async function getAvailableWorkflows() {
  return Object.values(workflows).map((wf) => ({
    id: wf.id,
    name: wf.name,
    description: wf.description,
    version: wf.version,
    nodeCount: wf.nodes.length,
    metadata: wf.metadata,
  }));
}

/**
 * Get workflow definition by ID
 */
export async function getWorkflowDefinition(workflowId: string) {
  const workflow = workflows[workflowId as keyof typeof workflows];
  if (!workflow) {
    throw new Error(`Workflow ${workflowId} not found`);
  }
  return workflow;
}
