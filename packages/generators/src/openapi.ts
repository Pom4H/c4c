import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { Contract, Registry } from "@tsdev/core";

/**
 * OpenAPI 3.0 specification types
 */
export interface OpenAPISpec {
	openapi: string;
	info: {
		title: string;
		version: string;
		description?: string;
	};
	servers?: Array<{ url: string; description?: string }>;
	paths: Record<string, PathItem>;
	components?: {
		schemas?: Record<string, unknown>;
	};
}

interface PathItem {
	[method: string]: Operation;
}

interface Operation {
	summary?: string;
	description?: string;
	operationId: string;
	tags?: string[];
	requestBody?: RequestBody;
	responses: Record<string, Response>;
	parameters?: Parameter[];
}

interface RequestBody {
	required: boolean;
	content: {
		"application/json": {
			schema: unknown;
		};
	};
}

interface Response {
	description: string;
	content?: {
		"application/json": {
			schema: unknown;
		};
	};
}

interface Parameter {
	name: string;
	in: "path" | "query" | "header";
	required: boolean;
	schema: unknown;
}

/**
 * Generate OpenAPI 3.0 specification from registry
 */
export function generateOpenAPISpec(
	registry: Registry,
	options: {
		title?: string;
		version?: string;
		description?: string;
		servers?: Array<{ url: string; description?: string }>;
	} = {}
): OpenAPISpec {
	const {
		title = "tsdev API",
		version = "1.0.0",
		description = "API generated from tsdev contracts",
		servers = [{ url: "http://localhost:3000", description: "Development server" }],
	} = options;

	const spec: OpenAPISpec = {
		openapi: "3.0.0",
		info: {
			title,
			version,
			description,
		},
		servers,
		paths: {},
		components: {
			schemas: {},
		},
	};

	// Generate paths for each procedure
	for (const [name, procedure] of registry.entries()) {
		// RPC-style endpoint
		const rpcPath = `/rpc/${name}`;
		spec.paths[rpcPath] = generateRPCPath(procedure.contract);

		// RESTful endpoint (if applicable)
		const restPath = generateRESTPath(procedure.contract);
		if (restPath) {
			Object.assign(spec.paths, restPath);
		}
	}

	return spec;
}

/**
 * Generate RPC-style path
 */
function generateRPCPath(contract: Contract): PathItem {
	const inputSchema = zodToJsonSchema(contract.input as ZodType, {
		name: `${contract.name}.Input`,
	});
	const outputSchema = zodToJsonSchema(contract.output as ZodType, {
		name: `${contract.name}.Output`,
	});

	return {
		post: {
			summary: contract.description || contract.name,
			description: contract.description,
			operationId: contract.name,
			tags: extractTags(contract),
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: inputSchema,
					},
				},
			},
			responses: {
				"200": {
					description: "Successful response",
					content: {
						"application/json": {
							schema: outputSchema,
						},
					},
				},
				"400": {
					description: "Validation error",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									error: { type: "string" },
								},
							},
						},
					},
				},
				"500": {
					description: "Internal server error",
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									error: { type: "string" },
								},
							},
						},
					},
				},
			},
		},
	};
}

/**
 * Generate RESTful path from contract name
 * Supports conventions like: resource.action -> /resource/action
 */
function generateRESTPath(contract: Contract): Record<string, PathItem> | null {
	const parts = contract.name.split(".");
	if (parts.length < 2) return null;

	const [resource, action] = parts;
	const inputSchema = zodToJsonSchema(contract.input as ZodType, {
		name: `${contract.name}.Input`,
	});
	const outputSchema = zodToJsonSchema(contract.output as ZodType, {
		name: `${contract.name}.Output`,
	});

	// Map action to HTTP method and path
	const mapping = getRESTMapping(resource || "", action || "");
	if (!mapping) return null;

	return {
		[mapping.path]: {
			[mapping.method]: {
				summary: contract.description || contract.name,
				description: contract.description,
				operationId: `${contract.name}_rest`,
				tags: extractTags(contract),
				...(mapping.hasBody && {
					requestBody: {
						required: true,
						content: {
							"application/json": {
								schema: inputSchema,
							},
						},
					},
				}),
				...(mapping.parameters && {
					parameters: mapping.parameters,
				}),
				responses: {
					"200": {
						description: "Successful response",
						content: {
							"application/json": {
								schema: outputSchema,
							},
						},
					},
					"400": {
						description: "Validation error",
					},
					"404": {
						description: "Resource not found",
					},
				},
			},
		},
	};
}

/**
 * Map action to REST convention
 */
function getRESTMapping(resource: string, action: string): {
	method: string;
	path: string;
	hasBody: boolean;
	parameters?: Parameter[];
} | null {
	switch (action) {
		case "create":
			return {
				method: "post",
				path: `/${resource}`,
				hasBody: true,
			};
		case "list":
			return {
				method: "get",
				path: `/${resource}`,
				hasBody: false,
				parameters: [
					{
						name: "limit",
						in: "query",
						required: false,
						schema: { type: "integer" },
					},
					{
						name: "offset",
						in: "query",
						required: false,
						schema: { type: "integer" },
					},
				],
			};
		case "get":
			return {
				method: "get",
				path: `/${resource}/{id}`,
				hasBody: false,
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
			};
		case "update":
			return {
				method: "put",
				path: `/${resource}/{id}`,
				hasBody: true,
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
			};
		case "delete":
			return {
				method: "delete",
				path: `/${resource}/{id}`,
				hasBody: false,
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
			};
		default:
			return null;
	}
}

/**
 * Extract tags from contract metadata
 */
function extractTags(contract: Contract): string[] {
	if (contract.metadata?.tags && Array.isArray(contract.metadata.tags)) {
		return contract.metadata.tags as string[];
	}
	// Default tag from contract name
	const parts = contract.name.split(".");
	return parts.length > 1 ? [parts[0] || ""] : ["default"];
}

/**
 * Generate OpenAPI specification as JSON string
 */
export function generateOpenAPIJSON(registry: Registry, options = {}): string {
	const spec = generateOpenAPISpec(registry, options);
	return JSON.stringify(spec, null, 2);
}

/**
 * Generate OpenAPI specification as YAML (simplified)
 */
export function generateOpenAPIYAML(registry: Registry, options = {}): string {
	const spec = generateOpenAPISpec(registry, options);
	// Simple YAML conversion (for production, use a proper YAML library)
	return JSON.stringify(spec, null, 2);
}
