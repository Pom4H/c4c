import type { WorkflowDefinition } from "@c4c/workflow";

/**
 * Long Running Workflow - ~1 minute execution time
 * Perfect for watching real-time updates in UI
 */
export const longRunningWorkflow: WorkflowDefinition = {
  id: "long-running-workflow",
  name: "Long Running Workflow (1 minute)",
  description:
    "Demonstrates real-time updates with delays - takes about 1 minute to complete",
  version: "1.0.0",

  startNode: "start",

  nodes: [
    {
      id: "start",
      type: "procedure",
      procedureName: "custom.log",
      config: {
        message: "🚀 Starting long-running workflow...",
        level: "info",
      },
      next: "phase-1",
    },
    {
      id: "phase-1",
      type: "procedure",
      procedureName: "custom.delay",
      config: {
        seconds: 10,
        message: "⏳ Phase 1: Initializing (10 seconds)...",
      },
      next: "fetch-data",
    },
    {
      id: "fetch-data",
      type: "procedure",
      procedureName: "data.fetch",
      config: {
        userId: "demo-user-123",
      },
      next: "phase-2",
    },
    {
      id: "phase-2",
      type: "procedure",
      procedureName: "custom.delay",
      config: {
        seconds: 15,
        message: "⏳ Phase 2: Processing data (15 seconds)...",
      },
      next: "parallel-tasks",
    },
    {
      id: "parallel-tasks",
      type: "parallel",
      config: {
        branches: ["compute-branch", "io-branch"],
        waitForAll: true,
      },
      next: "phase-3",
    },
    {
      id: "compute-branch",
      type: "procedure",
      procedureName: "custom.heavyComputation",
      config: {
        iterations: 500000,
        label: "💻 Computing analytics...",
      },
    },
    {
      id: "io-branch",
      type: "procedure",
      procedureName: "custom.delay",
      config: {
        seconds: 12,
        message: "💾 Saving to database...",
      },
    },
    {
      id: "phase-3",
      type: "procedure",
      procedureName: "custom.delay",
      config: {
        seconds: 10,
        message: "⏳ Phase 3: Finalizing (10 seconds)...",
      },
      next: "send-notification",
    },
    {
      id: "send-notification",
      type: "procedure",
      procedureName: "custom.sendNotification",
      config: {
        message: "✅ Long-running workflow completed successfully!",
        channel: "slack",
      },
      next: "complete",
    },
    {
      id: "complete",
      type: "procedure",
      procedureName: "custom.log",
      config: {
        message: "🎉 Workflow completed! Total time: ~1 minute",
        level: "info",
      },
    },
  ],
};
