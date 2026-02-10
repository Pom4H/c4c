/**
 * HTTP endpoints for Workflow DevKit
 *
 * Provides REST API routes for starting, monitoring, and interacting
 * with workflow runs.
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
	start,
	subscribeToRun,
	subscribeToAll,
	getExecutionStore,
	resolveHook,
	isHookPending,
	type WorkflowRun,
	type WorkflowEvent as WorkflowEventType,
} from "@c4c/workflow";

/**
 * Registry of workflow functions that can be started via the API
 */
export type WorkflowRegistry = Map<
	string,
	{
		fn: (...args: unknown[]) => Promise<unknown>;
		description?: string;
	}
>;

export interface WorkflowRouterOptions {
	/** Registry of named workflow functions */
	workflows?: WorkflowRegistry;
}

/**
 * Create an HTTP router for workflow operations.
 *
 * @example
 * ```ts
 * import { createWorkflowRouter } from "@c4c/adapters";
 * import { start, step } from "@c4c/workflow";
 *
 * const add = step("add", async (a: number, b: number) => a + b);
 *
 * async function mathWorkflow(x: number) {
 *   "use workflow";
 *   return await add(x, 10);
 * }
 *
 * const workflows = new Map([
 *   ["math", { fn: mathWorkflow, description: "Simple math workflow" }],
 * ]);
 *
 * const router = createWorkflowRouter({ workflows });
 * ```
 */
export function createWorkflowRouter(
	options: WorkflowRouterOptions = {},
) {
	const router = new Hono();
	const workflows = options.workflows ?? new Map();

	// Track active runs for streaming
	const activeRuns = new Map<string, WorkflowRun>();

	/**
	 * POST /workflow/start - Start a workflow
	 *
	 * Body: { workflow: string, args?: unknown[], runId?: string }
	 * Response: { runId: string, status: string }
	 */
	router.post("/workflow/start", async (c) => {
		try {
			const body = await c.req.json<{
				workflow: string;
				args?: unknown[];
				runId?: string;
			}>();

			if (!body.workflow) {
				return c.json({ error: "workflow name is required" }, 400);
			}

			const entry = workflows.get(body.workflow);
			if (!entry) {
				const available = Array.from(workflows.keys());
				return c.json(
					{
						error: `Workflow '${body.workflow}' not found. Available: ${available.join(", ") || "none"}`,
					},
					404,
				);
			}

			const run = start(
				entry.fn as (...args: unknown[]) => Promise<unknown>,
				body.args ?? [],
				{ runId: body.runId },
			);

			activeRuns.set(run.runId, run);

			// Clean up active run when complete
			run.result
				.then(() => {
					// Keep for a while for status queries
					setTimeout(() => activeRuns.delete(run.runId), 60_000);
				})
				.catch(() => {
					setTimeout(() => activeRuns.delete(run.runId), 60_000);
				});

			// Wait for result
			try {
				const result = await run.result;
				return c.json({
					runId: run.runId,
					status: "completed",
					result,
				});
			} catch (error) {
				return c.json({
					runId: run.runId,
					status: "failed",
					error: error instanceof Error ? error.message : String(error),
				});
			}
		} catch (error) {
			return c.json(
				{ error: error instanceof Error ? error.message : String(error) },
				500,
			);
		}
	});

	/**
	 * POST /workflow/start-async - Start a workflow without waiting
	 *
	 * Body: { workflow: string, args?: unknown[], runId?: string }
	 * Response: { runId: string, status: "running" }
	 */
	router.post("/workflow/start-async", async (c) => {
		try {
			const body = await c.req.json<{
				workflow: string;
				args?: unknown[];
				runId?: string;
			}>();

			if (!body.workflow) {
				return c.json({ error: "workflow name is required" }, 400);
			}

			const entry = workflows.get(body.workflow);
			if (!entry) {
				return c.json(
					{ error: `Workflow '${body.workflow}' not found` },
					404,
				);
			}

			const run = start(
				entry.fn as (...args: unknown[]) => Promise<unknown>,
				body.args ?? [],
				{ runId: body.runId },
			);

			activeRuns.set(run.runId, run);

			run.result
				.then(() => setTimeout(() => activeRuns.delete(run.runId), 60_000))
				.catch(() => setTimeout(() => activeRuns.delete(run.runId), 60_000));

			return c.json({
				runId: run.runId,
				status: "running",
			});
		} catch (error) {
			return c.json(
				{ error: error instanceof Error ? error.message : String(error) },
				500,
			);
		}
	});

	/**
	 * GET /workflow/list - List available workflows
	 */
	router.get("/workflow/list", (c) => {
		const list = Array.from(workflows.entries()).map(
			([name, entry]) => ({
				name,
				description: entry.description,
			}),
		);
		return c.json({ workflows: list });
	});

	/**
	 * GET /workflow/runs - List workflow run history
	 */
	router.get("/workflow/runs", (c) => {
		const store = getExecutionStore();
		const runs = store.getAllRuns();
		const stats = store.getStats();
		return c.json({ runs, stats });
	});

	/**
	 * GET /workflow/runs/:runId - Get a specific run
	 */
	router.get("/workflow/runs/:runId", (c) => {
		const runId = c.req.param("runId");
		const store = getExecutionStore();
		const run = store.getRun(runId);

		if (!run) {
			return c.json({ error: `Run '${runId}' not found` }, 404);
		}

		return c.json({ run });
	});

	/**
	 * GET /workflow/runs/:runId/stream - SSE stream for a workflow run
	 */
	router.get("/workflow/runs/:runId/stream", async (c) => {
		const runId = c.req.param("runId");
		if (!runId) {
			return c.json({ error: "runId is required" }, 400);
		}

		return streamSSE(c, async (stream) => {
			let open = true;
			const cleanup = () => {
				if (!open) return;
				open = false;
				unsubscribe();
			};

			const unsubscribe = subscribeToRun(runId, (event: WorkflowEventType) => {
				stream.writeSSE({
					event: event.type,
					data: JSON.stringify(event),
					id: String(Date.now()),
				});

				if (
					event.type === "workflow.completed" ||
					event.type === "workflow.failed"
				) {
					cleanup();
					stream.close();
				}
			});

			stream.onAbort(() => {
				cleanup();
			});

			await stream.writeSSE({
				event: "connected",
				data: JSON.stringify({ runId, timestamp: Date.now() }),
			});

			// Keep-alive
			while (open) {
				await stream.sleep(15000);
				if (!open) break;
				await stream.writeSSE({
					event: "heartbeat",
					data: JSON.stringify({ runId, timestamp: Date.now() }),
				});
			}
		});
	});

	/**
	 * GET /workflow/runs-stream - SSE stream for all workflow events
	 */
	router.get("/workflow/runs-stream", async (c) => {
		return streamSSE(c, async (stream) => {
			let open = true;

			const store = getExecutionStore();

			// Send initial state
			await stream.writeSSE({
				event: "initial",
				data: JSON.stringify({
					runs: store.getAllRuns(),
					stats: store.getStats(),
					timestamp: Date.now(),
				}),
			});

			const unsubscribe = subscribeToAll((event: WorkflowEventType) => {
				if (!open) return;

				stream.writeSSE({
					event: event.type,
					data: JSON.stringify(event),
					id: String(Date.now()),
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

	/**
	 * POST /workflow/hooks/:token - Resolve a workflow hook
	 *
	 * Body: { payload: unknown }
	 */
	router.post("/workflow/hooks/:token", async (c) => {
		const token = c.req.param("token");
		if (!token) {
			return c.json({ error: "token is required" }, 400);
		}

		if (!isHookPending(token)) {
			return c.json({ error: `Hook '${token}' not found or already resolved` }, 404);
		}

		const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
		const resolved = resolveHook(token, body.payload ?? body);

		if (!resolved) {
			return c.json({ error: `Failed to resolve hook '${token}'` }, 500);
		}

		return c.json({ resolved: true, token });
	});

	return router;
}
