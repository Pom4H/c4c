/**
 * HTTP endpoints for workflow system
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Registry } from "../core/types.js";
import { generateWorkflowHTML, generateWorkflowUI } from "../workflow/generator.js";
import { executeWorkflow, validateWorkflow } from "../workflow/runtime.js";
import type { WorkflowDefinition } from "../workflow/types.js";

/**
 * Handle workflow-related HTTP requests
 */
export async function handleWorkflowRequest(
	req: IncomingMessage,
	res: ServerResponse,
	registry: Registry
): Promise<boolean> {
	const url = req.url || "";

	// Workflow node palette (visual UI)
	if (url === "/workflow/palette" && req.method === "GET") {
		const html = generateWorkflowHTML(registry);
		res.writeHead(200, { "Content-Type": "text/html" });
		res.end(html);
		return true;
	}

	// Workflow UI configuration (JSON)
	if (url === "/workflow/ui-config" && req.method === "GET") {
		const config = generateWorkflowUI(registry);
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify(config, null, 2));
		return true;
	}

	// Execute workflow
	if (url === "/workflow/execute" && req.method === "POST") {
		try {
			const body = await parseBody(req);
			const { workflow, input } = JSON.parse(body) as {
				workflow: WorkflowDefinition;
				input?: Record<string, unknown>;
			};

			// Validate workflow
			const errors = validateWorkflow(workflow, registry);
			if (errors.length > 0) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ errors }));
				return true;
			}

			// Execute workflow
			const result = await executeWorkflow(workflow, registry, input);

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(result, null, 2));
			return true;
		} catch (error) {
			res.writeHead(500, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					error: error instanceof Error ? error.message : String(error),
				})
			);
			return true;
		}
	}

	// Validate workflow
	if (url === "/workflow/validate" && req.method === "POST") {
		try {
			const body = await parseBody(req);
			const workflow = JSON.parse(body) as WorkflowDefinition;

			const errors = validateWorkflow(workflow, registry);

			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					valid: errors.length === 0,
					errors,
				})
			);
			return true;
		} catch (error) {
			res.writeHead(400, { "Content-Type": "application/json" });
			res.end(
				JSON.stringify({
					error: error instanceof Error ? error.message : String(error),
				})
			);
			return true;
		}
	}

	return false; // Not a workflow request
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
