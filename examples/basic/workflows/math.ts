/**
 * Simple Demo Workflow - uses math and data procedures
 * Can be executed immediately without external dependencies
 */

import type { WorkflowDefinition } from "@c4c/workflow";

/**
 * Simple Math Workflow
 * Demonstrates basic sequential execution with math operations
 */
export const simpleMathWorkflow: WorkflowDefinition = {
  id: "simple-math-workflow",
  name: "Simple Math Workflow",
  description: "Basic math operations workflow for testing",
  version: "1.0.0",

  startNode: "add",

  nodes: [
    {
      id: "add",
      type: "procedure",
      procedureName: "math.add",
      config: {
        a: 10,
        b: 5,
      },
      next: "multiply",
    },
    {
      id: "multiply",
      type: "procedure",
      procedureName: "math.multiply",
      config: {
        a: 3,
        b: 2,
      },
      next: "subtract",
    },
    {
      id: "subtract",
      type: "procedure",
      procedureName: "math.subtract",
      config: {
        a: 20,
        b: 8,
      },
    },
  ],
};
