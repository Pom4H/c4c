/**
 * Example workflow definitions
 */

import type { WorkflowDefinition } from "@tsdev/workflow";

/**
 * Simple math calculation workflow
 */
export const mathWorkflow: WorkflowDefinition = {
  id: "math-calculation",
  name: "Math Calculation Workflow",
  description: "Demonstrates sequential math operations",
  version: "1.0.0",
  startNode: "add-numbers",
  variables: {
    a: 10,
    b: 5,
  },
  nodes: [
    {
      id: "add-numbers",
      type: "procedure",
      procedureName: "math.add",
      config: {
        a: 10,
        b: 5,
      },
      next: "multiply-result",
    },
    {
      id: "multiply-result",
      type: "procedure",
      procedureName: "math.multiply",
      config: {
        a: 2,
      },
      next: "subtract-value",
    },
    {
      id: "subtract-value",
      type: "procedure",
      procedureName: "math.subtract",
      config: {
        a: 100,
      },
      next: undefined,
    },
  ],
  metadata: {
    tags: ["math", "demo"],
  },
};

/**
 * Conditional workflow with branching
 */
export const conditionalWorkflow: WorkflowDefinition = {
  id: "conditional-processing",
  name: "Conditional Data Processing",
  description: "Processes data differently based on user tier",
  version: "1.0.0",
  startNode: "fetch-user",
  variables: {
    userId: "user_123",
  },
  nodes: [
    {
      id: "fetch-user",
      type: "procedure",
      procedureName: "data.fetch",
      config: {
        userId: "user_123",
      },
      next: "check-premium",
    },
    {
      id: "check-premium",
      type: "condition",
      config: {
        expression: "isPremium === true",
        trueBranch: "premium-processing",
        falseBranch: "basic-processing",
      },
    },
    {
      id: "premium-processing",
      type: "procedure",
      procedureName: "data.process",
      config: {
        mode: "premium",
      },
      next: "save-results",
    },
    {
      id: "basic-processing",
      type: "procedure",
      procedureName: "data.process",
      config: {
        mode: "basic",
      },
      next: "save-results",
    },
    {
      id: "save-results",
      type: "procedure",
      procedureName: "data.save",
      next: undefined,
    },
  ],
  metadata: {
    tags: ["data", "conditional"],
  },
};

/**
 * Parallel execution workflow
 */
export const parallelWorkflow: WorkflowDefinition = {
  id: "parallel-tasks",
  name: "Parallel Task Execution",
  description: "Executes multiple tasks simultaneously",
  version: "1.0.0",
  startNode: "parallel-execution",
  variables: {},
  nodes: [
    {
      id: "parallel-execution",
      type: "parallel",
      config: {
        branches: ["task-1", "task-2", "task-3"],
        waitForAll: true,
      },
      next: "aggregate-results",
    },
    {
      id: "task-1",
      type: "procedure",
      procedureName: "math.add",
      config: { a: 10, b: 20 },
    },
    {
      id: "task-2",
      type: "procedure",
      procedureName: "math.multiply",
      config: { a: 5, b: 6 },
    },
    {
      id: "task-3",
      type: "procedure",
      procedureName: "math.subtract",
      config: { a: 100, b: 25 },
    },
    {
      id: "aggregate-results",
      type: "procedure",
      procedureName: "data.save",
      next: undefined,
    },
  ],
  metadata: {
    tags: ["parallel", "demo"],
  },
};

/**
 * Complex workflow combining multiple patterns
 */
export const complexWorkflow: WorkflowDefinition = {
  id: "complex-workflow",
  name: "Complex Multi-Pattern Workflow",
  description: "Demonstrates sequential, conditional, and parallel patterns",
  version: "1.0.0",
  startNode: "init-data",
  variables: {
    userId: "user_456",
  },
  nodes: [
    {
      id: "init-data",
      type: "procedure",
      procedureName: "data.fetch",
      config: {
        userId: "user_456",
      },
      next: "parallel-checks",
    },
    {
      id: "parallel-checks",
      type: "parallel",
      config: {
        branches: ["check-1", "check-2"],
        waitForAll: true,
      },
      next: "evaluate-results",
    },
    {
      id: "check-1",
      type: "procedure",
      procedureName: "math.add",
      config: { a: 1, b: 1 },
    },
    {
      id: "check-2",
      type: "procedure",
      procedureName: "math.multiply",
      config: { a: 2, b: 3 },
    },
    {
      id: "evaluate-results",
      type: "condition",
      config: {
        expression: "score > 50",
        trueBranch: "high-score-processing",
        falseBranch: "low-score-processing",
      },
    },
    {
      id: "high-score-processing",
      type: "procedure",
      procedureName: "data.process",
      config: {
        mode: "advanced",
      },
      next: "finalize",
    },
    {
      id: "low-score-processing",
      type: "procedure",
      procedureName: "data.process",
      config: {
        mode: "standard",
      },
      next: "finalize",
    },
    {
      id: "finalize",
      type: "procedure",
      procedureName: "data.save",
      next: undefined,
    },
  ],
  metadata: {
    tags: ["complex", "demo"],
  },
};

export const workflows = [
  mathWorkflow,
  conditionalWorkflow,
  parallelWorkflow,
  complexWorkflow,
];

/**
 * Workflow demonstrating error handling
 */
export const errorWorkflow: WorkflowDefinition = {
  id: "error-demo",
  name: "Error Handling Demo",
  description: "Demonstrates node failure and error span propagation",
  version: "1.0.0",
  startNode: "start",
  variables: {
    a: 10,
    b: 0,
  },
  nodes: [
    {
      id: "start",
      type: "procedure",
      procedureName: "math.add",
      config: { a: 5, b: 5 },
      next: "will-fail",
    },
    {
      id: "will-fail",
      type: "procedure",
      procedureName: "math.divide",
      config: { a: 100, b: 0 },
      next: "never-reached",
    },
    {
      id: "never-reached",
      type: "procedure",
      procedureName: "data.save",
    },
  ],
  metadata: {
    tags: ["error", "+otel"],
  },
};

export const workflowsWithError = [
  mathWorkflow,
  conditionalWorkflow,
  parallelWorkflow,
  complexWorkflow,
  errorWorkflow,
];
