import { z } from "zod";
import { createDocument } from "zod-openapi";
import { isProcedureVisible, type Contract, type Registry } from "@c4c/core";

export interface OpenAPISpec {
	openapi: string;
	info: {
		title: string;
		version: string;
		description?: string;
	};
	servers?: Array<{ url: string; description?: string }>;
	paths: Record<string, unknown>;
	components?: Record<string, unknown>;
}

interface Parameter {
	name: string;
	in: "path" | "query" | "header";
	required: boolean;
	schema: unknown;
}

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
		title = "c4c API",
		version = "1.0.0",
		description = "API generated from c4c contracts",
		servers = [{ url: "http://localhost:3000", description: "Development server" }],
	} = options;

	const paths: Record<string, any> = {};

	for (const [name, procedure] of registry.entries()) {
		const { contract } = procedure;

		if (isProcedureVisible(contract, "rpc")) {
			const rpcPath = `/rpc/${name}`;
			paths[rpcPath] = {
				...(paths[rpcPath] ?? {}),
				post: buildRpcOperation(contract),
			};
		}

		if (isProcedureVisible(contract, "rest")) {
			const restEntry = buildRestOperation(contract);
			if (restEntry) {
				const { path, method, operation } = restEntry;
				paths[path] = {
					...(paths[path] ?? {}),
					[method]: operation,
				};
			}
		}
	}

	const document = createDocument({
		openapi: "3.1.0",
		info: {
			title,
			version,
			description,
		},
		servers,
		paths,
	});

	return document as OpenAPISpec;
}

function buildRpcOperation(contract: Contract) {
	const name = contract.name || "unknown";
	return {
		summary: contract.description || name,
		description: contract.description,
		operationId: name,
		tags: extractTags(contract),
		requestBody: {
			content: {
				"application/json": {
					schema: contract.input,
				},
			},
		},
		responses: successAndErrorResponses(contract.output),
	};
}

function buildRestOperation(
	contract: Contract
): { path: string; method: string; operation: any } | null {
	const name = contract.name || "unknown";
	const parts = name.split(".");
	if (parts.length < 2) return null;

	const [resource, action] = parts;
	const mapping = getRestMapping(resource || "", action || "");
	if (!mapping) return null;

	const operation: any = {
		summary: contract.description || name,
		description: contract.description,
		operationId: `${contract.name}_rest`,
		tags: extractTags(contract),
		responses: successAndErrorResponses(contract.output),
	};

	if (mapping.parameters?.length) {
		operation.parameters = mapping.parameters;
	}

	if (mapping.hasBody) {
		operation.requestBody = {
			content: {
				"application/json": {
					schema: contract.input,
				},
			},
		};
	}

	return {
		path: mapping.path,
		method: mapping.method,
		operation,
	};
}

function successAndErrorResponses(outputSchema: Contract["output"]) {
	return {
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
					schema: z.object({
						error: z.string(),
					}),
				},
			},
		},
		"500": {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: z.object({
						error: z.string(),
					}),
				},
			},
		},
	};
}

function getRestMapping(
	resource: string,
	action: string
):
	| {
			method: string;
			path: string;
			hasBody: boolean;
			parameters?: Array<Parameter>;
	  }
	| null {
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

function extractTags(contract: Contract): string[] {
	if (contract.metadata?.tags && Array.isArray(contract.metadata.tags)) {
		return contract.metadata.tags as string[];
	}
	const name = contract.name || "unknown";
	const parts = name.split(".");
	return parts.length > 1 ? [parts[0] || ""] : ["default"];
}

export function generateOpenAPIJSON(registry: Registry, options = {}): string {
	const spec = generateOpenAPISpec(registry, options);
	return JSON.stringify(spec, null, 2);
}

export function generateOpenAPIYAML(registry: Registry, options = {}): string {
	const spec = generateOpenAPISpec(registry, options);
	return JSON.stringify(spec, null, 2);
}
