"use server";

/**
 * Server Actions for workflow execution
 */

import { executeWorkflow } from "@/lib/workflow/runtime";
import {
  mathWorkflow,
  conditionalWorkflow,
  parallelWorkflow,
  complexWorkflow,
} from "@/lib/workflow/examples";
import type { WorkflowExecutionResult } from "@/lib/workflow/types";

const workflows = {
  "math-calculation": mathWorkflow,
  "conditional-processing": conditionalWorkflow,
  "parallel-tasks": parallelWorkflow,
  "complex-workflow": complexWorkflow,
};

/**
 * Execute a workflow by ID
 */
export async function executeWorkflowAction(
  workflowId: string,
  input?: Record<string, unknown>
): Promise<WorkflowExecutionResult> {
  const workflow = workflows[workflowId as keyof typeof workflows];

  if (!workflow) {
    throw new Error(`Workflow ${workflowId} not found`);
  }

  console.log(`[Server Action] Executing workflow: ${workflow.name}`);

  const result = await executeWorkflow(workflow, input);

  console.log(
    `[Server Action] Workflow completed: ${result.status} (${result.executionTime}ms)`
  );

  return result;
}

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
