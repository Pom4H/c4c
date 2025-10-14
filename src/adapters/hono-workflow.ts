/**
 * Hono adapter for workflow execution with SSE streaming
 * Provides ready-to-use workflow endpoints
 */

import type { Registry } from "../core/types.js";
import type { WorkflowDefinition, WorkflowExecutionResult } from "../workflow/types.js";
import { executeWorkflow } from "../workflow/runtime.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Hono = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Context = any;

export interface WorkflowAppOptions {
	/**
	 * Base path for endpoints (default: "/api/workflows")
	 */
	basePath?: string;

	/**
	 * Enable CORS (default: false)
	 */
	cors?: boolean;
}

/**
 * Create Hono app with workflow endpoints
 * 
 * Provides:
 * - GET /workflows - List all workflows
 * - GET /workflows/:id - Get workflow definition
 * - POST /workflows/:id/execute - Execute workflow with SSE streaming
 * 
 * @example
 * ```typescript
 * import { Hono } from "hono";
 * import { createWorkflowRoutes } from "@tsdev/adapters/hono-workflow";
 * 
 * const app = new Hono();
 * createWorkflowRoutes(app, registry, workflows, { basePath: "/api/workflows" });
 * ```
 */
export function createWorkflowRoutes(
	app: Hono,
	registry: Registry,
	workflows: Record<string, WorkflowDefinition>,
	options: WorkflowAppOptions = {}
): void {
	const basePath = options.basePath || "/api/workflows";

	// Ensure basePath doesn't end with /
	const cleanBasePath = basePath.replace(/\/$/, "");

	// List all workflows
	app.get(cleanBasePath, (c: Context) => {
		const workflowList = Object.values(workflows).map((wf) => ({
			id: wf.id,
			name: wf.name,
			description: wf.description,
			version: wf.version,
			nodeCount: wf.nodes.length,
			metadata: wf.metadata,
		}));
		return c.json(workflowList);
	});

	// Get workflow definition
	app.get(`${cleanBasePath}/:id`, (c: Context) => {
		const workflowId = c.req.param("id");
		const workflow = workflows[workflowId];

		if (!workflow) {
			return c.json({ error: `Workflow ${workflowId} not found` }, 404);
		}

		return c.json(workflow);
	});

	// Execute workflow with SSE streaming
	app.post(`${cleanBasePath}/:id/execute`, async (c: Context) => {
		const workflowId = c.req.param("id");
		const workflow = workflows[workflowId];

		if (!workflow) {
			return c.json({ error: `Workflow ${workflowId} not found` }, 404);
		}

		const body = await c.req.json().catch(() => ({}));
		const input = (body as { input?: Record<string, unknown> }).input || {};

		// Use Hono's streamSSE - need to import dynamically to avoid dependency
		const { streamSSE } = await import("hono/streaming");

		return streamSSE(c, async (stream) => {
			try {
				// Send start event
				await stream.writeSSE({
					data: JSON.stringify({
						type: "start",
						workflowId,
						workflowName: workflow.name,
						timestamp: Date.now(),
					}),
					event: "workflow-start",
				});

				// Execute workflow
				const result: WorkflowExecutionResult = await executeWorkflow(
					workflow,
					registry,
					input
				);

				// Send progress events for each node
				for (const nodeId of result.nodesExecuted) {
					await stream.writeSSE({
						data: JSON.stringify({
							type: "node-executed",
							nodeId,
							timestamp: Date.now(),
						}),
						event: "workflow-progress",
					});
				}

				// Send completion event
				await stream.writeSSE({
					data: JSON.stringify({
						type: "complete",
						result: {
							executionId: result.executionId,
							status: result.status,
							outputs: result.outputs,
							executionTime: result.executionTime,
							nodesExecuted: result.nodesExecuted,
						},
						timestamp: Date.now(),
					}),
					event: "workflow-complete",
				});
			} catch (error) {
				// Send error event
				await stream.writeSSE({
					data: JSON.stringify({
						type: "error",
						error: error instanceof Error ? error.message : String(error),
						timestamp: Date.now(),
					}),
					event: "workflow-error",
				});
			}
		});
	});
}

/**
 * Create a standalone Hono app with workflow endpoints
 * 
 * @example
 * ```typescript
 * import { createWorkflowApp } from "@tsdev/adapters/hono-workflow";
 * 
 * const app = createWorkflowApp(registry, workflows);
 * export default app;
 * ```
 */
export async function createWorkflowApp(
	registry: Registry,
	workflows: Record<string, WorkflowDefinition>,
	options: WorkflowAppOptions = {}
): Promise<Hono> {
	const { Hono } = await import("hono");
	const app = new Hono();

	createWorkflowRoutes(app, registry, workflows, options);

	return app;
}
