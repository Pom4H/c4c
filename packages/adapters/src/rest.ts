import type { IncomingMessage, ServerResponse } from "node:http";
import { createExecutionContext, executeProcedure } from "@tsdev/core";
import type { Registry } from "@tsdev/core";

/**
 * REST API adapter for tsdev
 * Converts procedures to RESTful routes using conventions:
 * - resource.create -> POST /resource
 * - resource.list -> GET /resource
 * - resource.get -> GET /resource/:id
 * - resource.update -> PUT /resource/:id
 * - resource.delete -> DELETE /resource/:id
 */

interface RouteMatch {
	procedureName: string;
	params: Record<string, string>;
	query: Record<string, string>;
}

/**
 * Handle REST request
 */
export async function handleRESTRequest(
	req: IncomingMessage,
	res: ServerResponse,
	registry: Registry
): Promise<boolean> {
	const match = matchRESTRoute(req.url || "", req.method || "", registry);
	if (!match) {
		return false; // Not a REST route
	}

	try {
        const procedure = registry.get(match.procedureName);
		if (!procedure) {
			res.writeHead(404, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ error: "Procedure not found" }));
			return true;
		}

        // Respect exposure flags: only allow REST if explicitly exposed
        const restExposed = (procedure.contract.metadata as any)?.expose?.rest === true;
        if (!restExposed) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "REST not exposed for this procedure" }));
            return true;
        }

		// Build input from params, query, and body
		let input: Record<string, unknown> = {
			...match.params,
			...match.query,
		};

		// Parse body for POST, PUT, PATCH
		if (["POST", "PUT", "PATCH"].includes(req.method || "")) {
			const body = await parseBody(req);
			if (body) {
				const bodyData = JSON.parse(body);
				input = { ...input, ...bodyData };
			}
		}

		// Create execution context
		const context = createExecutionContext({
			transport: "rest",
			method: req.method,
			url: req.url,
			userAgent: req.headers["user-agent"],
		});

		// Execute procedure
		const result = await executeProcedure(procedure, input, context);

		// Determine status code
		const statusCode = req.method === "POST" ? 201 : 200;

		res.writeHead(statusCode, { "Content-Type": "application/json" });
		res.end(JSON.stringify(result));
		return true;
	} catch (error) {
		console.error("REST error:", error);

		const statusCode = error instanceof Error && error.message.includes("not found") ? 404 : 400;
		res.writeHead(statusCode, { "Content-Type": "application/json" });
		res.end(
			JSON.stringify({
				error: error instanceof Error ? error.message : String(error),
			})
		);
		return true;
	}
}

/**
 * Match REST route to procedure
 */
function matchRESTRoute(
	url: string,
	method: string,
	registry: Registry
): RouteMatch | null {
	const [pathname, queryString] = url.split("?");
	const parts = pathname?.split("/").filter(Boolean) || [];

	// Parse query string
	const query: Record<string, string> = {};
	if (queryString) {
		for (const param of queryString.split("&")) {
			const [key, value] = param.split("=");
			if (key && value) {
				query[key] = decodeURIComponent(value);
			}
		}
	}

	// Try to match against all procedures
	for (const [procedureName] of registry.entries()) {
		const match = matchProcedure(procedureName, parts, method);
		if (match) {
			return {
				procedureName,
				params: match,
				query,
			};
		}
	}

	return null;
}

/**
 * Match procedure name against URL parts and method
 */
function matchProcedure(
	procedureName: string,
	urlParts: string[],
	method: string
): Record<string, string> | null {
	const [resource, action] = procedureName.split(".");
	if (!resource || !action) return null;

	switch (action) {
		case "create":
			// POST /resource
			if (method === "POST" && urlParts.length === 1 && urlParts[0] === resource) {
				return {};
			}
			break;

		case "list":
			// GET /resource
			if (method === "GET" && urlParts.length === 1 && urlParts[0] === resource) {
				return {};
			}
			break;

		case "get":
			// GET /resource/:id
			if (method === "GET" && urlParts.length === 2 && urlParts[0] === resource) {
				return { id: urlParts[1] || "" };
			}
			break;

		case "update":
			// PUT /resource/:id
			if (method === "PUT" && urlParts.length === 2 && urlParts[0] === resource) {
				return { id: urlParts[1] || "" };
			}
			break;

		case "delete":
			// DELETE /resource/:id
			if (method === "DELETE" && urlParts.length === 2 && urlParts[0] === resource) {
				return { id: urlParts[1] || "" };
			}
			break;
	}

	return null;
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
        const restExposed = (procedure.contract.metadata as any)?.expose?.rest === true;
        if (!restExposed) continue;
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
function getRESTRoute(
	resource: string,
	action: string
): { method: string; path: string } | null {
	switch (action) {
		case "create":
			return { method: "POST", path: `/${resource}` };
		case "list":
			return { method: "GET", path: `/${resource}` };
		case "get":
			return { method: "GET", path: `/${resource}/:id` };
		case "update":
			return { method: "PUT", path: `/${resource}/:id` };
		case "delete":
			return { method: "DELETE", path: `/${resource}/:id` };
		default:
			return null;
	}
}
