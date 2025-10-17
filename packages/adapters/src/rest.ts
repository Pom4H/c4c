import { Hono } from "hono";
import type { Context } from "hono";
import { createExecutionContext, executeProcedure, isProcedureVisible, type Registry } from "@tsdev/core";

interface Parameter {
	name: string;
	in: "path" | "query";
	required: boolean;
	schema: unknown;
}

interface RestMapping {
	method: "GET" | "POST" | "PUT" | "DELETE";
	path: string;
	hasBody: boolean;
	parameters?: Array<Parameter>;
}

/**
 * REST API adapter for tsdev
 * Converts procedures to RESTful routes using conventions:
 * - resource.create -> POST /resource
 * - resource.list -> GET /resource
 * - resource.get -> GET /resource/:id
 * - resource.update -> PUT /resource/:id
 * - resource.delete -> DELETE /resource/:id
 */

export function createRestRouter(registry: Registry) {
	const router = new Hono();

	for (const [procedureName, procedure] of registry.entries()) {
		if (!isProcedureVisible(procedure.contract, "rest")) continue;

		const [resource, action] = procedureName.split(".");
		if (!resource || !action) continue;

		const mapping = getRESTMapping(resource, action);
		if (!mapping) continue;

		router.on(mapping.method, mapping.path, async (c) => {
			const procedure = registry.get(procedureName);
			if (!procedure) {
				return c.json({ error: "Procedure not found" }, 404);
			}

			try {
				const input = await buildRestInput(c, mapping);

				const context = createExecutionContext({
					transport: "rest",
					method: c.req.method,
					url: c.req.path,
					userAgent: c.req.header("user-agent"),
				});

				const result = await executeProcedure(procedure, input, context);
				const statusCode = mapping.method === "POST" ? 201 : 200;
				return c.json(result, statusCode);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				const statusCode = message.includes("not found") ? 404 : 400;
				return c.json({ error: message }, statusCode);
			}
		});
	}

	return router;
}

/**
 * List all REST routes available
 */
export function listRESTRoutes(registry: Registry): Array<{
	method: string;
	path: string;
	procedure: string;
}> {
	const routes: Array<{ method: string; path: string; procedure: string }> = [];

	for (const [procedureName, procedure] of registry.entries()) {
		if (!isProcedureVisible(procedure.contract, "rest")) continue;

		const [resource, action] = procedureName.split(".");
		if (!resource || !action) continue;

		const route = getRESTRoute(resource, action);
		if (route) {
			routes.push({
				...route,
				procedure: procedureName,
			});
		}
	}

	return routes;
}

/**
 * Get REST route for a resource action
 */
function getRESTMapping(resource: string, action: string): RestMapping | null {
	switch (action) {
		case "create":
			return { method: "POST", path: `/${resource}`, hasBody: true };
		case "list":
			return {
				method: "GET",
				path: `/${resource}`,
				hasBody: false,
				parameters: [
					{ name: "limit", in: "query", required: false, schema: { type: "integer" } },
					{ name: "offset", in: "query", required: false, schema: { type: "integer" } },
				],
			};
		case "get":
			return {
				method: "GET",
				path: `/${resource}/:id`,
				hasBody: false,
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
			};
		case "update":
			return {
				method: "PUT",
				path: `/${resource}/:id`,
				hasBody: true,
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
			};
		case "delete":
			return {
				method: "DELETE",
				path: `/${resource}/:id`,
				hasBody: false,
				parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
			};
		default:
			return null;
	}
}

async function buildRestInput(c: Context, mapping: RestMapping) {
	const input: Record<string, unknown> = {};

	for (const param of mapping?.parameters ?? []) {
		if (param.in === "path") {
			const value = c.req.param(param.name);
			if (value === undefined || value === "") {
				if (param.required) {
					throw new Error(`Path parameter '${param.name}' is required`);
				}
			} else {
				input[param.name] = value;
			}
		}

		if (param.in === "query") {
			const value = c.req.query(param.name);
			if (value !== undefined) {
				input[param.name] = value;
			} else if (param.required) {
				throw new Error(`Query parameter '${param.name}' is required`);
			}
		}
	}

	if (mapping?.hasBody) {
		try {
			const body = await c.req.json<Record<string, unknown>>();
			Object.assign(input, body);
		} catch {
			throw new Error("Invalid JSON body");
		}
	}

	return input;
}

function getRESTRoute(
	resource: string,
	action: string
): { method: string; path: string } | null {
	const mapping = getRESTMapping(resource, action);
	if (!mapping) return null;
	return { method: mapping.method, path: mapping.path };
}
