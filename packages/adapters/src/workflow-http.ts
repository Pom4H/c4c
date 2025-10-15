/**
 * HTTP endpoints for workflow system
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Registry } from "@tsdev/core";
import { executeWorkflow, validateWorkflow, resumeWorkflow, type WorkflowDefinition, type WorkflowResumeState } from "@tsdev/workflow";

// TODO: Move workflow generators to @tsdev/generators or @tsdev/workflow
// For now, stub these out
function generateWorkflowHTML(registry: Registry): string {
	return "<html><body><h1>Workflow Palette - Coming Soon</h1></body></html>";
}

function generateWorkflowUI(registry: Registry): object {
	return { nodes: [], categories: [], connections: [] };
}

/**
 * Handle workflow-related HTTP requests
 */
export async function handleWorkflowRequest(
	req: IncomingMessage,
	res: ServerResponse,
	registry: Registry
): Promise<boolean> {
    const url = req.url || "";
    const [pathname, queryString] = url.split("?");
    const query = new URLSearchParams(queryString || "");

	// Workflow node palette (visual UI)
	if (url === "/workflow/palette" && req.method === "GET") {
		const html = generateWorkflowHTML(registry);
		res.writeHead(200, { "Content-Type": "text/html" });
		res.end(html);
		return true;
	}

	// Workflow UI configuration (JSON)
    if (pathname === "/workflow/ui-config" && req.method === "GET") {
		const config = generateWorkflowUI(registry);
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify(config, null, 2));
		return true;
	}

	// Execute workflow
    if (pathname === "/workflow/execute" && req.method === "POST") {
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

    // Execute workflow asynchronously and return executionId immediately
    if (pathname === "/workflow/execute-async" && req.method === "POST") {
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

            const executionId = `wf_exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

            // Fire-and-forget execution
            executeWorkflow(workflow, registry, input ?? {}, { executionId }).catch((err) => {
                // Errors will be published via events by runtime
                console.error("[Workflow] Async execution failed:", err);
            });

            res.writeHead(202, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ executionId }));
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

    // Server-Sent Events: subscribe to workflow execution events
    if (pathname === "/workflow/events" && req.method === "GET") {
        const executionId = query.get("executionId");
        if (!executionId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "executionId is required" }));
            return true;
        }

        // Set SSE headers
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        });

        const send = (event: unknown) => {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        };

        // Heartbeat
        const heartbeat = setInterval(() => {
            res.write(`: keep-alive\n\n`);
        }, 15000);

        // Dynamic import to avoid tight coupling
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        import("@tsdev/workflow/src/events").then(({ subscribeToExecution }) => {
            const unsubscribe = subscribeToExecution(executionId, (evt: unknown) => send(evt));

            const cleanup = () => {
                clearInterval(heartbeat);
                try { unsubscribe(); } catch {}
                res.end();
            };

            req.on("close", cleanup);
            req.on("end", cleanup);
        });

        return true;
    }

	// Resume workflow
    if (pathname === "/workflow/resume" && req.method === "POST") {
		try {
			const body = await parseBody(req);
			const { workflow, resumeState, variablesDelta } = JSON.parse(body) as {
				workflow: WorkflowDefinition;
				resumeState: WorkflowResumeState;
				variablesDelta?: Record<string, unknown>;
			};

			// Validate that resumeState workflow id matches
			if (resumeState.workflowId !== workflow.id) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "resumeState.workflowId does not match workflow.id" }));
				return true;
			}

			const result = await resumeWorkflow(workflow, registry, resumeState, variablesDelta ?? {});

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
