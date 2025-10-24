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
	webhooks?: Record<string, unknown>;
	'x-c4c-triggers'?: Record<string, unknown>;
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
		includeWebhooks?: boolean;
		includeTriggers?: boolean;
	} = {}
): OpenAPISpec {
	const {
		title = "c4c API",
		version = "1.0.0",
		description = "API generated from c4c contracts",
		servers = [{ url: "http://localhost:3000", description: "Development server" }],
		includeWebhooks = true,
		includeTriggers = true,
	} = options;

	const paths: Record<string, any> = {};
	const webhooks: Record<string, any> = {};
	const triggers: Record<string, any> = {};

	for (const [name, procedure] of registry.entries()) {
		const { contract } = procedure;

		// Check if this is a trigger
		const isTrigger = contract.metadata?.type === "trigger" || 
		                  contract.metadata?.roles?.includes("trigger");

		if (isTrigger && includeWebhooks) {
			// Add to webhooks section
			const webhookOperation = buildWebhookOperation(contract, name);
			if (webhookOperation) {
				webhooks[name] = webhookOperation;
			}

			// Add trigger metadata
			if (includeTriggers && contract.metadata?.trigger) {
				triggers[name] = {
					type: contract.metadata.trigger.type,
					provider: contract.metadata.provider,
					eventTypes: contract.metadata.trigger.eventTypes,
					stopProcedure: contract.metadata.trigger.stopProcedure,
					requiresChannelManagement: contract.metadata.trigger.requiresChannelManagement,
					supportsFiltering: contract.metadata.trigger.supportsFiltering,
					pollingInterval: contract.metadata.trigger.pollingInterval,
				};
			}
		}

		const isVisibleRpc = isProcedureVisible(contract, "rpc");
		const isVisibleRest = isProcedureVisible(contract, "rest");

		if (isVisibleRpc) {
			const rpcPath = `/rpc/${name}`;
			paths[rpcPath] = {
				...(paths[rpcPath] ?? {}),
				post: buildRpcOperation(contract),
			};
		}

		if (isVisibleRest) {
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

	const spec = document as OpenAPISpec;

	// Add webhooks if any
	if (Object.keys(webhooks).length > 0) {
		spec.webhooks = webhooks;
	}

	// Add c4c trigger metadata
	if (Object.keys(triggers).length > 0) {
		spec['x-c4c-triggers'] = triggers;
	}

	return spec;
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

function buildWebhookOperation(contract: Contract, name: string) {
	const triggerMetadata = contract.metadata?.trigger;
	
	return {
		post: {
			summary: contract.description || `${name} webhook`,
			description: contract.description || `Webhook callback for ${name} trigger`,
			operationId: `${name}_webhook`,
			tags: extractTags(contract),
			'x-c4c-trigger-type': triggerMetadata?.type || 'webhook',
			'x-c4c-provider': contract.metadata?.provider,
			'x-c4c-event-types': triggerMetadata?.eventTypes,
			requestBody: {
				description: 'Webhook payload',
				content: {
					'application/json': {
						schema: contract.output, // Output schema = what trigger emits
					},
				},
			},
			responses: {
				'200': {
					description: 'Webhook received successfully',
					content: {
						'application/json': {
							schema: z.object({
								success: z.boolean(),
								message: z.string().optional(),
							}),
						},
					},
				},
			},
		},
	};
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
