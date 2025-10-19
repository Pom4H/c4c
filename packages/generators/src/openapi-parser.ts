/**
 * OpenAPI/Swagger parser for generating tsdev contracts and handlers
 */

import { z } from "zod";

export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, Schema>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  security?: Array<Record<string, string[]>>;
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
  head?: Operation;
  options?: Operation;
  trace?: Operation;
  parameters?: Parameter[];
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  security?: Array<Record<string, string[]>>;
  callbacks?: Record<string, Callback>;
}

export interface Parameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  required?: boolean;
  description?: string;
  schema?: Schema;
  style?: string;
  explode?: boolean;
}

export interface RequestBody {
  description?: string;
  content: Record<string, MediaType>;
  required?: boolean;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
  headers?: Record<string, Header>;
}

export interface MediaType {
  schema?: Schema;
  encoding?: Record<string, Encoding>;
}

export interface Header {
  description?: string;
  required?: boolean;
  schema?: Schema;
}

export interface Encoding {
  contentType?: string;
  headers?: Record<string, Header>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

export interface Callback {
  [expression: string]: PathItem;
}

export interface Schema {
  type?: "string" | "number" | "integer" | "boolean" | "array" | "object";
  format?: string;
  description?: string;
  example?: any;
  default?: any;
  enum?: any[];
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  not?: Schema;
  additionalProperties?: boolean | Schema;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  pattern?: string;
  multipleOf?: number;
  $ref?: string;
}

export interface SecurityScheme {
  type: "apiKey" | "http" | "oauth2" | "openIdConnect";
  description?: string;
  name?: string;
  in?: "query" | "header" | "cookie";
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface ParsedOperation {
  operationId: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses: ParsedResponse[];
  security?: Array<Record<string, string[]>>;
  callbacks?: Record<string, Callback>;
  isWebhook?: boolean;
  isOAuthCallback?: boolean;
}

export interface ParsedParameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  required: boolean;
  description?: string;
  schema: Schema;
}

export interface ParsedRequestBody {
  description?: string;
  required: boolean;
  content: Record<string, ParsedMediaType>;
}

export interface ParsedMediaType {
  schema: Schema;
}

export interface ParsedResponse {
  statusCode: string;
  description: string;
  content?: Record<string, ParsedMediaType>;
}

export class OpenAPIParser {
  private spec: OpenAPISpec;
  private resolvedSchemas: Map<string, Schema> = new Map();

  constructor(spec: OpenAPISpec) {
    this.spec = spec;
    this.resolveSchemas();
  }

  /**
   * Parse all operations from the OpenAPI spec
   */
  parseOperations(): ParsedOperation[] {
    const operations: ParsedOperation[] = [];

    for (const [path, pathItem] of Object.entries(this.spec.paths)) {
      const methods = ["get", "post", "put", "delete", "patch", "head", "options", "trace"] as const;
      
      for (const method of methods) {
        const operation = pathItem[method];
        if (!operation) continue;

        const parsedOp = this.parseOperation(operation, method, path);
        if (parsedOp) {
          operations.push(parsedOp);
        }
      }
    }

    return operations;
  }

  /**
   * Parse a single operation
   */
  private parseOperation(operation: Operation, method: string, path: string): ParsedOperation | null {
    if (!operation.operationId) {
      // Generate operationId from method and path
      const pathParts = path.split("/").filter(Boolean);
      const resource = pathParts[0] || "unknown";
      const action = this.getActionFromMethod(method);
      operation.operationId = `${resource}.${action}`;
    }

    const parameters = this.parseParameters(operation.parameters || []);
    const requestBody = operation.requestBody ? this.parseRequestBody(operation.requestBody) : undefined;
    const responses = this.parseResponses(operation.responses);
    const isWebhook = this.detectWebhook(operation, path);
    const isOAuthCallback = this.detectOAuthCallback(operation, path);

    return {
      operationId: operation.operationId,
      method: method.toUpperCase(),
      path,
      summary: operation.summary,
      description: operation.description,
      tags: operation.tags || [],
      parameters,
      requestBody,
      responses,
      security: operation.security,
      callbacks: operation.callbacks,
      isWebhook,
      isOAuthCallback,
    };
  }

  /**
   * Parse parameters from operation
   */
  private parseParameters(parameters: Parameter[]): ParsedParameter[] {
    return parameters.map(param => ({
      name: param.name,
      in: param.in,
      required: param.required || false,
      description: param.description,
      schema: this.resolveSchema(param.schema || { type: "string" }),
    }));
  }

  /**
   * Parse request body from operation
   */
  private parseRequestBody(requestBody: RequestBody): ParsedRequestBody {
    const content: Record<string, ParsedMediaType> = {};
    
    for (const [mediaType, mediaTypeObj] of Object.entries(requestBody.content)) {
      content[mediaType] = {
        schema: this.resolveSchema(mediaTypeObj.schema || { type: "object" }),
      };
    }

    return {
      description: requestBody.description,
      required: requestBody.required || false,
      content,
    };
  }

  /**
   * Parse responses from operation
   */
  private parseResponses(responses: Record<string, Response>): ParsedResponse[] {
    return Object.entries(responses).map(([statusCode, response]) => {
      const content: Record<string, ParsedMediaType> = {};
      
      if (response.content) {
        for (const [mediaType, mediaTypeObj] of Object.entries(response.content)) {
          content[mediaType] = {
            schema: this.resolveSchema(mediaTypeObj.schema || { type: "object" }),
          };
        }
      }

      return {
        statusCode,
        description: response.description,
        content: Object.keys(content).length > 0 ? content : undefined,
      };
    });
  }

  /**
   * Detect if operation is a webhook
   */
  private detectWebhook(operation: Operation, path: string): boolean {
    // Check for webhook indicators
    const webhookKeywords = ["webhook", "callback", "hook", "notification", "event"];
    const pathLower = path.toLowerCase();
    const summaryLower = (operation.summary || "").toLowerCase();
    const descriptionLower = (operation.description || "").toLowerCase();
    
    return webhookKeywords.some(keyword => 
      pathLower.includes(keyword) || 
      summaryLower.includes(keyword) || 
      descriptionLower.includes(keyword)
    );
  }

  /**
   * Detect if operation is an OAuth callback
   */
  private detectOAuthCallback(operation: Operation, path: string): boolean {
    // Check for OAuth callback indicators
    const oauthKeywords = ["oauth", "callback", "redirect", "authorize", "token"];
    const pathLower = path.toLowerCase();
    const summaryLower = (operation.summary || "").toLowerCase();
    const descriptionLower = (operation.description || "").toLowerCase();
    
    return oauthKeywords.some(keyword => 
      pathLower.includes(keyword) || 
      summaryLower.includes(keyword) || 
      descriptionLower.includes(keyword)
    );
  }

  /**
   * Get action name from HTTP method
   */
  private getActionFromMethod(method: string): string {
    const methodMap: Record<string, string> = {
      get: "get",
      post: "create",
      put: "update",
      patch: "update",
      delete: "delete",
      head: "head",
      options: "options",
      trace: "trace",
    };
    return methodMap[method.toLowerCase()] || "unknown";
  }

  /**
   * Resolve schema references
   */
  private resolveSchema(schema: Schema): Schema {
    if (schema.$ref) {
      const refPath = schema.$ref.replace("#/", "").split("/");
      let current: any = this.spec;
      
      for (const part of refPath) {
        current = current?.[part];
      }
      
      if (current) {
        return this.resolveSchema(current);
      }
    }
    
    return schema;
  }

  /**
   * Resolve all schemas in the spec
   */
  private resolveSchemas(): void {
    if (this.spec.components?.schemas) {
      for (const [name, schema] of Object.entries(this.spec.components.schemas)) {
        this.resolvedSchemas.set(name, this.resolveSchema(schema));
      }
    }
  }

  /**
   * Get all webhook operations
   */
  getWebhookOperations(): ParsedOperation[] {
    return this.parseOperations().filter(op => op.isWebhook);
  }

  /**
   * Get all OAuth callback operations
   */
  getOAuthCallbackOperations(): ParsedOperation[] {
    return this.parseOperations().filter(op => op.isOAuthCallback);
  }

  /**
   * Get all regular API operations (non-webhook, non-oauth)
   */
  getApiOperations(): ParsedOperation[] {
    return this.parseOperations().filter(op => !op.isWebhook && !op.isOAuthCallback);
  }

  /**
   * Get OAuth configuration from the spec
   */
  getOAuthConfig(): OAuthFlows | null {
    if (!this.spec.components?.securitySchemes) {
      return null;
    }

    for (const scheme of Object.values(this.spec.components.securitySchemes)) {
      if (scheme.type === "oauth2" && scheme.flows) {
        return scheme.flows;
      }
    }

    return null;
  }
}

/**
 * Parse OpenAPI spec from JSON or YAML
 */
export function parseOpenAPISpec(specData: string | object): OpenAPISpec {
  let spec: OpenAPISpec;
  
  if (typeof specData === "string") {
    try {
      spec = JSON.parse(specData);
    } catch {
      // Try to parse as YAML (would need yaml parser)
      throw new Error("YAML parsing not implemented yet. Please provide JSON format.");
    }
  } else {
    spec = specData as OpenAPISpec;
  }

  // Validate basic structure
  if (!spec.info || !spec.paths) {
    throw new Error("Invalid OpenAPI spec: missing required fields 'info' or 'paths'");
  }

  return spec;
}