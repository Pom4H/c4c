/**
 * HTTP endpoints for workflow system
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
	getContractMetadata,
	getProcedureExposure,
	getProcedureRoles,
	type Registry,
} from "@c4c/core";
import { generateOpenAPISpec } from "@c4c/generators";
import {
	executeWorkflow,
	validateWorkflow,
	subscribeToExecution,
	loadWorkflowLibrary,
	loadWorkflowDefinitionById,
	type WorkflowDefinition,
	type WorkflowResumeState,
	type WorkflowSummary,
} from "@c4c/workflow";
import { listRESTRoutes } from "./rest.js";

interface WorkflowUIPayload {
	generatedAt: string;
	registrySize: number;
	nodes: Array<{
		id: string;
		name: string;
		description?: string;
		category: string;
		tags: string[];
		exposure: string;
		roles: string[];
		rpcPath: string;
		restRoutes: Array<{ method: string; path: string }>;
		schemas: {
			input?: unknown;
			output?: unknown;
		};
		metadata: Record<string, unknown>;
	}>;
	categories: Array<{ id: string; label: string; count: number }>;
	routes: {
		stream: string;
		execute: string;
		validate: string;
		resume: string;
	};
}

export interface WorkflowRouterOptions {
	workflowsPath?: string;
}

export function createWorkflowRouter(registry: Registry, options: WorkflowRouterOptions = {}) {
	const router = new Hono();
	const workflowsPath = options.workflowsPath ?? process.env.c4c_WORKFLOWS_DIR ?? "workflows";

	router.get("/workflow/palette", (c) => {
		const html = generateWorkflowHTML(registry);
		return c.html(html);
	});

	router.get("/workflow/ui-config", (c) => {
		const config = generateWorkflowUI(registry);
		return c.json(config, 200);
	});

	router.get("/workflow/definitions", async (c) => {
		const library = await loadWorkflowLibrary(workflowsPath);
		const workflows = library.summaries.map((summary) => summarizeWorkflow(summary));
		return c.json({ workflows }, 200);
	});

	router.get("/workflow/definitions/:workflowId", async (c) => {
		const workflowId = c.req.param("workflowId");
		if (!workflowId) {
			return c.json({ error: "workflowId is required" }, 400);
		}

		const definition = await loadWorkflowDefinitionById(workflowsPath, workflowId);
		if (!definition) {
			return c.json({ error: `Workflow '${workflowId}' not found` }, 404);
		}

		return c.json({ definition }, 200);
	});

	router.get("/workflow/executions", async (c) => {
		try {
			const { getExecutionStore } = await import("@c4c/workflow");
			const store = getExecutionStore();
			const executions = store.getAllExecutionsJSON();
			const stats = store.getStats();

			return c.json({
				executions,
				stats,
			}, 200);
		} catch (error) {
			return c.json({ error: "Failed to get executions" }, 500);
		}
	});

	router.get("/workflow/executions/:executionId", async (c) => {
		const executionId = c.req.param("executionId");
		if (!executionId) {
			return c.json({ error: "executionId is required" }, 400);
		}

		try {
			const { getExecutionStore } = await import("@c4c/workflow");
			const store = getExecutionStore();
			const execution = store.getExecutionJSON(executionId);

			if (!execution) {
				return c.json({ error: `Execution '${executionId}' not found` }, 404);
			}

			return c.json({ execution }, 200);
		} catch (error) {
			return c.json({ error: "Failed to get execution" }, 500);
		}
	});

	router.post("/workflow/execute", async (c) => {
		try {
			const body = await c.req.json<{
				workflow?: WorkflowDefinition;
				workflowId?: string;
				input?: Record<string, unknown>;
				executionId?: string;
			}>();

			let workflow = body.workflow;
			if (!workflow && body.workflowId) {
				workflow = await loadWorkflowDefinitionById(workflowsPath, body.workflowId);
				if (!workflow) {
					return c.json({ error: `Workflow '${body.workflowId}' not found` }, 404);
				}
			}

			if (!workflow) {
				return c.json({ error: "workflow or workflowId is required" }, 400);
			}

			const errors = validateWorkflow(workflow, registry);
			if (errors.length > 0) {
				return c.json({ errors }, 400);
			}

			const result = await executeWorkflow(
				workflow,
				registry,
				body.input ?? {},
				body.executionId ? { executionId: body.executionId } : undefined
			);
			return c.json(result, 200);
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
		}
	});

	// Resume endpoint removed - use TriggerWorkflowManager for event-driven workflows
	router.post("/workflow/resume", async (c) => {
		return c.json({ 
			error: "Resume endpoint removed. Use TriggerWorkflowManager for event-driven workflows." 
		}, 410); // 410 Gone
	});

	router.post("/workflow/validate", async (c) => {
		try {
			const workflow = await c.req.json<WorkflowDefinition>();
			const errors = validateWorkflow(workflow, registry);
			return c.json({ valid: errors.length === 0, errors }, 200);
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
		}
	});

	router.get("/workflow/executions/:executionId/stream", async (c) => {
		const executionId = c.req.param("executionId");
		if (!executionId) {
			return c.json({ error: "executionId is required" }, 400);
		}

		return streamSSE(c, async (stream) => {
			let open = true;
			const cleanup = () => {
				if (!open) return;
				open = false;
				unsubscribe();
			};

			const unsubscribe = subscribeToExecution(executionId, (event) => {
				void stream.writeSSE({
					event: event.type,
					data: JSON.stringify(event),
					id: String(Date.now()),
				});

				if (
					event.type === "workflow.completed" ||
					event.type === "workflow.failed" ||
					event.type === "workflow.paused"
				) {
					cleanup();
					stream.close();
				}
			});

			stream.onAbort(() => {
				cleanup();
			});

			await stream.writeSSE({
				event: "workflow.stream.connected",
				data: JSON.stringify({ executionId, timestamp: Date.now() }),
			});

			while (open) {
				await stream.sleep(15000);
				if (!open) break;
				await stream.writeSSE({
					event: "heartbeat",
					data: JSON.stringify({ executionId, timestamp: Date.now() }),
				});
			}
		});
	});

	router.get("/workflow/executions-stream", async (c) => {
		return streamSSE(c, async (stream) => {
			let open = true;

			// Get initial data
			const { getExecutionStore } = await import("@c4c/workflow");
			const store = getExecutionStore();

			// Send initial state
			await stream.writeSSE({
				event: "executions.initial",
				data: JSON.stringify({
					executions: store.getAllExecutionsJSON(),
					stats: store.getStats(),
					timestamp: Date.now(),
				}),
			});

			// Subscribe to all workflow events
			const { subscribeToAllExecutions } = await import("@c4c/workflow");
			const unsubscribe = subscribeToAllExecutions((event) => {
				if (!open) return;

				// Send event
				void stream.writeSSE({
					event: event.type,
					data: JSON.stringify(event),
					id: String(Date.now()),
				});

				// Send updated stats after each event
				void stream.writeSSE({
					event: "executions.update",
					data: JSON.stringify({
						executions: store.getAllExecutionsJSON(),
						stats: store.getStats(),
						timestamp: Date.now(),
					}),
				});
			});

			stream.onAbort(() => {
				open = false;
				unsubscribe();
			});

			// Keep-alive
			while (open) {
				await stream.sleep(15000);
				if (!open) break;
				await stream.writeSSE({
					event: "heartbeat",
					data: JSON.stringify({ timestamp: Date.now() }),
				});
			}
		});
	});

	return router;
}

function generateWorkflowHTML(registry: Registry): string {
	const uiData = buildWorkflowUIPayload(registry);
	const serializedData = JSON.stringify(uiData).replace(/</g, "\\u003c");
	const nodeRows = uiData.nodes
		.map(
			(node) => `<tr>
	<td>${escapeHtml(node.name)}</td>
	<td>${escapeHtml(node.category)}</td>
	<td>${escapeHtml(node.roles.join(", "))}</td>
	<td>${escapeHtml(node.exposure)}</td>
	<td>${escapeHtml(node.tags.join(", "))}</td>
	<td>${escapeHtml(node.rpcPath)}</td>
</tr>`
		)
		.join("\n");

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<title>c4c Workflow Palette</title>
	<style>
		body { font-family: system-ui, sans-serif; padding: 24px; background: #0b1120; color: #e2e8f0; }
		h1 { margin-bottom: 8px; }
		table { border-collapse: collapse; width: 100%; margin-top: 24px; }
		th, td { border-bottom: 1px solid #1e293b; padding: 10px 12px; text-align: left; }
		th { text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; color: #94a3b8; }
		tr:hover { background: rgba(148, 163, 184, 0.1); }
		code { background: rgba(148, 163, 184, 0.15); padding: 2px 6px; border-radius: 4px; }
		.caption { color: #94a3b8; margin-top: 4px; }
	</style>
</head>
<body>
	<h1>Workflow Palette</h1>
	<p class="caption">${uiData.nodes.length} workflow-capable procedures · generated ${escapeHtml(
		new Date(uiData.generatedAt).toLocaleString()
	)}</p>
	<table>
		<thead>
			<tr>
				<th>Procedure</th>
				<th>Category</th>
				<th>Roles</th>
				<th>Exposure</th>
				<th>Tags</th>
				<th>RPC Path</th>
			</tr>
		</thead>
		<tbody>
			${nodeRows}
		</tbody>
	</table>
	<script>
		window.__c4c_WORKFLOW_UI__ = ${serializedData};
	</script>
</body>
</html>`;
}

function generateWorkflowUI(registry: Registry): WorkflowUIPayload {
	return buildWorkflowUIPayload(registry);
}

function buildWorkflowUIPayload(registry: Registry): WorkflowUIPayload {
	const openapi = generateOpenAPISpec(registry, {
		title: "c4c Workflow API",
		version: "1.0.0",
		description: "Auto-generated palette data for workflow tooling",
	});

	const restRouteMap = new Map<string, Array<{ method: string; path: string }>>();
	for (const route of listRESTRoutes(registry)) {
		const existing = restRouteMap.get(route.procedure) ?? [];
		existing.push({ method: route.method, path: route.path });
		restRouteMap.set(route.procedure, existing);
	}

	const nodes: WorkflowUIPayload["nodes"] = [];
	for (const [name, procedure] of registry.entries()) {
		const roles = getProcedureRoles(procedure.contract);
		if (!roles.includes("workflow-node")) {
			continue;
		}

		const rpcPath = `/rpc/${name}`;
		const rpcOperation = (openapi.paths?.[rpcPath] as Record<string, unknown> | undefined)?.post as
			| Record<string, any>
			| undefined
			| null;
		const inputSchema =
			rpcOperation?.requestBody?.content?.["application/json"]?.schema ?? undefined;
		const outputSchema =
			rpcOperation?.responses?.["200"]?.content?.["application/json"]?.schema ?? undefined;

		const metadata = getContractMetadata(procedure.contract);
		const title =
			typeof metadata.title === "string"
				? metadata.title
				: typeof metadata.name === "string"
					? metadata.name
					: undefined;
		const category = String(
			metadata.category ?? name.split(".")[0] ?? metadata.tags?.[0] ?? "uncategorised"
		);
		const tags = Array.isArray(metadata.tags) ? (metadata.tags.filter((tag) => typeof tag === "string") as string[]) : [];

		nodes.push({
			id: name,
			name: title ?? procedure.contract.description ?? name,
			description: procedure.contract.description,
			category,
			tags,
			exposure: getProcedureExposure(procedure.contract),
			roles,
			rpcPath,
			restRoutes: restRouteMap.get(name) ?? [],
			schemas: {
				input: inputSchema,
				output: outputSchema,
			},
			metadata,
		});
	}

	const categoryCounts = new Map<string, number>();
	for (const node of nodes) {
		categoryCounts.set(node.category, (categoryCounts.get(node.category) ?? 0) + 1);
	}

	const categories = Array.from(categoryCounts.entries())
		.map(([id, count]) => ({
			id,
			label: formatCategoryLabel(id),
			count,
		}))
		.sort((a, b) => a.label.localeCompare(b.label));

	return {
		generatedAt: new Date().toISOString(),
		registrySize: nodes.length,
		nodes: nodes.sort((a, b) => a.name.localeCompare(b.name)),
		categories,
		routes: {
			stream: "/workflow/executions/:id/stream",
			execute: "/workflow/execute",
			validate: "/workflow/validate",
			resume: "/workflow/resume",
		},
	};
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function formatCategoryLabel(value: string): string {
	const cleaned = value.replace(/[-_.]/g, " ").toLowerCase();
	return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeWorkflow(summary: WorkflowSummary) {
	return {
		id: summary.id,
		name: summary.name,
		description: summary.description,
		version: summary.version,
		nodeCount: summary.nodeCount,
	};
}
