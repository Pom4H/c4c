/**
 * Demo workflows
 */

import type { WorkflowDefinition } from "../../../dist/workflow/types.js";

/**
 * Simple math workflow
 */
export const mathWorkflow: WorkflowDefinition = {
  id: "math-calculation",
  name: "Math Calculation",
  description: "Adds 10 + 5 and multiplies result by 2",
  version: "1.0.0",
  startNode: "add",
  nodes: [
    {
      id: "add",
      type: "procedure",
      procedureName: "math.add",
      config: { a: 10, b: 5 },
      next: "multiply",
    },
    {
      id: "multiply",
      type: "procedure",
      procedureName: "math.multiply",
      config: { a: 2 },
      next: undefined,
    },
  ],
};

/**
 * Greeting workflow
 */
export const greetingWorkflow: WorkflowDefinition = {
  id: "greeting",
  name: "Greeting",
  description: "Greets a user",
  version: "1.0.0",
  startNode: "greet",
  variables: { name: "World" },
  nodes: [
    {
      id: "greet",
      type: "procedure",
      procedureName: "greet",
      config: {},
      next: undefined,
    },
  ],
};

export const workflows = {
  "math-calculation": mathWorkflow,
  "greeting": greetingWorkflow,
};
