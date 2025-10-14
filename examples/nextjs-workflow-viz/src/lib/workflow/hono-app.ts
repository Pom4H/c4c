/**
 * Hono app for workflow execution with SSE
 * Using real tsdev framework adapter
 */

import { Hono } from "hono";
import { createWorkflowRoutes } from "@tsdev/adapters/hono-workflow";
import { getRegistry } from "../registry";
import {
  mathWorkflow,
  conditionalWorkflow,
  parallelWorkflow,
  complexWorkflow,
} from "./examples";
import type { WorkflowDefinition } from "./types";

const workflows: Record<string, WorkflowDefinition> = {
  "math-calculation": mathWorkflow,
  "conditional-processing": conditionalWorkflow,
  "parallel-tasks": parallelWorkflow,
  "complex-workflow": complexWorkflow,
};

const app = new Hono();

// Add workflow routes using framework adapter
createWorkflowRoutes(app, getRegistry(), workflows, { basePath: "/api/workflows" });

export default app;
