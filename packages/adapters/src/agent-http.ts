/**
 * HTTP endpoints for AI agent operations
 * Provides high-level API for agents to manage workflows
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Registry } from "@tsdev/core";
import type { WorkflowDefinition } from "@tsdev/workflow";
import { AgentWorkflowManager, type GitConfig } from "@tsdev/git";

let agentManager: AgentWorkflowManager | null = null;

/**
 * Initialize agent manager with git config
 */
export function initializeAgentManager(gitConfig: GitConfig, registry: Registry): void {
	agentManager = AgentWorkflowManager.create(gitConfig, registry);
}

/**
 * Handle agent-related HTTP requests
 */
export async function handleAgentRequest(
	req: IncomingMessage,
	res: ServerResponse,
	registry: Registry,
): Promise<boolean> {
	if (!agentManager) {
		// Agent manager not initialized - skip
		return false;
	}

	const url = req.url || "";

	// POST /agent/task - Handle task (main agent endpoint)
	if (url === "/agent/task" && req.method === "POST") {
		try {
			const body = await parseBody(req);
			const { task, workflow, input, options } = JSON.parse(body) as {
				task: string;
				workflow?: WorkflowDefinition;
				input?: Record<string, unknown>;
				options?: {
					minConfidence?: number;
					autoImprove?: boolean;
					agentId?: string;
				};
			};

			if (!task) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "task is required" }));
				return true;
			}

			const result = await agentManager.handleTask(task, workflow || null, {
				input,
				...options,
			});

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(result, null, 2));
			return true;
		} catch (error) {
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					error: error instanceof Error ? error.message : String(error),
				}),
			);
			return true;
		}
	}

	// GET /agent/workflow/search?task=... - Search for workflows
	if (url.startsWith("/agent/workflow/search") && req.method === "GET") {
		try {
			const urlObj = new URL(url, `http://${req.headers.host}`);
			const task = urlObj.searchParams.get("task");
			const minConfidence = parseFloat(urlObj.searchParams.get("minConfidence") || "0.6");

			if (!task) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "task parameter is required" }));
				return true;
			}

			const workflow = await agentManager.findWorkflow(task, minConfidence);

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ workflow }, null, 2));
			return true;
		} catch (error) {
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					error: error instanceof Error ? error.message : String(error),
				}),
			);
			return true;
		}
	}

	// POST /agent/workflow/save - Save new workflow
	if (url === "/agent/workflow/save" && req.method === "POST") {
		try {
			const body = await parseBody(req);
			const { workflow, task, agentId } = JSON.parse(body) as {
				workflow: WorkflowDefinition;
				task?: string;
				agentId?: string;
			};

			if (!workflow) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "workflow is required" }));
				return true;
			}

			const result = await agentManager.saveWorkflow(workflow, task, agentId);

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(result, null, 2));
			return true;
		} catch (error) {
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					error: error instanceof Error ? error.message : String(error),
				}),
			);
			return true;
		}
	}

	// POST /agent/workflow/improve - Improve workflow based on executions
	if (url === "/agent/workflow/improve" && req.method === "POST") {
		try {
			const body = await parseBody(req);
			const { workflow, executions, agentId } = JSON.parse(body) as {
				workflow: WorkflowDefinition;
				executions: any[];
				agentId?: string;
			};

			if (!workflow || !executions) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "workflow and executions are required" }));
				return true;
			}

			const result = await agentManager.improveWorkflow(workflow, executions, agentId);

			if (!result) {
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ message: "No improvements needed" }));
				return true;
			}

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(result, null, 2));
			return true;
		} catch (error) {
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					error: error instanceof Error ? error.message : String(error),
				}),
			);
			return true;
		}
	}

	// GET /agent/workflows - List all workflows
	if (url === "/agent/workflows" && req.method === "GET") {
		try {
			const workflows = await agentManager.listWorkflows();

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ workflows }, null, 2));
			return true;
		} catch (error) {
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					error: error instanceof Error ? error.message : String(error),
				}),
			);
			return true;
		}
	}

	// GET /agent/workflow/:id - Get workflow by ID
	const workflowMatch = url.match(/^\/agent\/workflow\/([^\/]+)$/);
	if (workflowMatch && req.method === "GET") {
		try {
			const workflowId = workflowMatch[1];
			const workflow = await agentManager.getWorkflow(workflowId);

			if (!workflow) {
				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "Workflow not found" }));
				return true;
			}

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ workflow }, null, 2));
			return true;
		} catch (error) {
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					error: error instanceof Error ? error.message : String(error),
				}),
			);
			return true;
		}
	}

	return false; // Not an agent request
}

/**
 * Parse HTTP request body
 */
function parseBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", (chunk) => {
			body += chunk.toString();
		});
		req.on("end", () => resolve(body));
		req.on("error", reject);
	});
}
