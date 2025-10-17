import { Hono } from "hono";
import { createExecutionContext, executeProcedure, isProcedureVisible, type Registry } from "@tsdev/core";

export function createRpcRouter(registry: Registry) {
	const router = new Hono();

	router.post("/rpc/:procedureName", async (c) => {
		const procedureName = c.req.param("procedureName");

		const procedure = registry.get(procedureName);
		if (!procedure || !isProcedureVisible(procedure.contract, "rpc")) {
			return c.json({ error: `Procedure '${procedureName}' not found` }, 404);
		}

		try {
			const input = await c.req.json<Record<string, unknown>>();

			const context = createExecutionContext({
				transport: "http",
				method: c.req.method,
				url: c.req.path,
				userAgent: c.req.header("user-agent"),
			});

			const result = await executeProcedure(procedure, input, context);
			return c.json(result, 200);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const statusCode = message.includes("not found") ? 404 : 400;
			return c.json({ error: message }, statusCode);
		}
	});

	return router;
}
