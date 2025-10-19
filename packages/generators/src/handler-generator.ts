/**
 * Handler generator from OpenAPI operations
 * Generates HTTP client handlers for OpenAPI operations
 */

import type { ParsedOperation, OpenAPISpec } from "./openapi-parser.js";
import type { GeneratedContract } from "./contract-generator.js";

export interface GeneratedHandler {
  name: string;
  operation: ParsedOperation;
  contract: GeneratedContract;
  handlerCode: string;
  isWebhook: boolean;
  isOAuthCallback: boolean;
}

export interface HandlerGeneratorOptions {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  authType?: "none" | "bearer" | "apiKey" | "oauth2";
  authConfig?: {
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    oauth2?: {
      clientId: string;
      clientSecret: string;
      tokenUrl: string;
      scopes?: string[];
    };
  };
}

export class HandlerGenerator {
  private options: HandlerGeneratorOptions;

  constructor(options: HandlerGeneratorOptions = {}) {
    this.options = {
      baseUrl: "https://api.example.com",
      timeout: 30000,
      retries: 3,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "tsdev-generated-client/1.0.0",
      },
      authType: "none",
      ...options,
    };
  }

  /**
   * Generate handlers from operations and contracts
   */
  generateHandlers(
    operations: ParsedOperation[],
    contracts: GeneratedContract[]
  ): GeneratedHandler[] {
    const contractMap = new Map(contracts.map(c => [c.name, c]));
    
    return operations.map(operation => {
      const contract = contractMap.get(operation.operationId);
      if (!contract) {
        throw new Error(`No contract found for operation: ${operation.operationId}`);
      }

      return this.generateHandler(operation, contract);
    });
  }

  /**
   * Generate a single handler
   */
  private generateHandler(operation: ParsedOperation, contract: GeneratedContract): GeneratedHandler {
    const handlerCode = this.generateHandlerCode(operation, contract);

    return {
      name: operation.operationId,
      operation,
      contract,
      handlerCode,
      isWebhook: operation.isWebhook || false,
      isOAuthCallback: operation.isOAuthCallback || false,
    };
  }

  /**
   * Generate handler code
   */
  private generateHandlerCode(operation: ParsedOperation, contract: GeneratedContract): string {
    const lines: string[] = [];
    
    lines.push(`// Handler for ${operation.operationId}`);
    lines.push(`// ${operation.method} ${operation.path}`);
    if (operation.description) {
      lines.push(`// ${operation.description}`);
    }
    lines.push("");

    // Generate the handler function
    lines.push(`export const ${operation.operationId}Handler = async (`);
    lines.push(`  input: z.infer<typeof ${operation.operationId}InputSchema>,`);
    lines.push(`  context: ExecutionContext`);
    lines.push(`): Promise<z.infer<typeof ${operation.operationId}OutputSchema>> => {`);

    // Generate URL construction
    lines.push(`  const baseUrl = "${this.options.baseUrl}";`);
    lines.push(`  let url = \`\${baseUrl}${this.buildUrlTemplate(operation.path)}\`;`);
    lines.push("");

    // Generate query parameters
    const queryParams = operation.parameters.filter(p => p.in === "query");
    if (queryParams.length > 0) {
      lines.push("  // Add query parameters");
      lines.push("  const queryParams = new URLSearchParams();");
      for (const param of queryParams) {
        lines.push(`  if (input.${param.name} !== undefined) {`);
        lines.push(`    queryParams.append("${param.name}", String(input.${param.name}));`);
        lines.push("  }");
      }
      lines.push("  if (queryParams.toString()) {");
      lines.push("    url += `?${queryParams.toString()}`;");
      lines.push("  }");
      lines.push("");
    }

    // Generate headers
    lines.push("  // Prepare headers");
    lines.push("  const headers: Record<string, string> = {");
    for (const [key, value] of Object.entries(this.options.headers || {})) {
      lines.push(`    "${key}": "${value}",`);
    }
    
    // Add header parameters
    const headerParams = operation.parameters.filter(p => p.in === "header");
    for (const param of headerParams) {
      lines.push(`    ...(input.${param.name} ? { "${param.name}": String(input.${param.name}) } : {}),`);
    }
    
    lines.push("  };");
    lines.push("");

    // Generate authentication
    if (this.options.authType !== "none") {
      lines.push("  // Add authentication");
      lines.push(this.generateAuthCode());
      lines.push("");
    }

    // Generate request body
    if (operation.requestBody) {
      lines.push("  // Prepare request body");
      lines.push("  let body: string | undefined;");
      lines.push("  if (operation.requestBody) {");
      lines.push("    const bodyData = { ...input };");
      lines.push("    // Remove path and query parameters from body");
      for (const param of operation.parameters) {
        if (param.in === "path" || param.in === "query") {
          lines.push(`    delete bodyData.${param.name};`);
        }
      }
      lines.push("    body = JSON.stringify(bodyData);");
      lines.push("  }");
      lines.push("");
    }

    // Generate fetch request
    lines.push("  // Make HTTP request");
    lines.push("  const response = await fetch(url, {");
    lines.push(`    method: "${operation.method}",`);
    lines.push("    headers,");
    if (operation.requestBody) {
      lines.push("    body,");
    }
    lines.push("  });");
    lines.push("");

    // Generate response handling
    lines.push("  // Handle response");
    lines.push("  if (!response.ok) {");
    lines.push("    const errorText = await response.text().catch(() => 'Unknown error');");
    lines.push("    throw new Error(`HTTP ${response.status}: ${errorText}`);");
    lines.push("  }");
    lines.push("");
    lines.push("  const data = await response.json();");
    lines.push("  return data;");
    lines.push("};");

    return lines.join("\n");
  }

  /**
   * Build URL template with path parameters
   */
  private buildUrlTemplate(path: string): string {
    return path.replace(/\{([^}]+)\}/g, (match, paramName) => {
      return `\${input.${paramName}}`;
    });
  }

  /**
   * Generate authentication code
   */
  private generateAuthCode(): string {
    const lines: string[] = [];
    
    switch (this.options.authType) {
      case "bearer":
        lines.push("  if (this.options.authConfig?.token) {");
        lines.push("    headers.Authorization = `Bearer ${this.options.authConfig.token}`;");
        lines.push("  }");
        break;
        
      case "apiKey":
        const headerName = this.options.authConfig?.apiKeyHeader || "X-API-Key";
        lines.push("  if (this.options.authConfig?.apiKey) {");
        lines.push(`    headers["${headerName}"] = this.options.authConfig.apiKey;`);
        lines.push("  }");
        break;
        
      case "oauth2":
        lines.push("  // OAuth2 authentication would be implemented here");
        lines.push("  // This requires token management and refresh logic");
        break;
    }
    
    return lines.join("\n");
  }

  /**
   * Generate webhook handlers
   */
  generateWebhookHandlers(webhookOperations: ParsedOperation[]): string {
    const lines: string[] = [];
    
    lines.push("// Webhook handlers");
    lines.push("// These handlers are designed to receive webhook calls");
    lines.push("");

    for (const operation of webhookOperations) {
      lines.push(`export const ${operation.operationId}WebhookHandler = async (`);
      lines.push("  request: Request,");
      lines.push("  context: ExecutionContext");
      lines.push("): Promise<Response> => {");
      lines.push("");
      lines.push("  try {");
      lines.push("    const body = await request.json();");
      lines.push("    // Process webhook payload");
      lines.push("    console.log('Webhook received:', body);");
      lines.push("");
      lines.push("    // Return success response");
      lines.push("    return new Response(JSON.stringify({ status: 'success' }), {");
      lines.push("      status: 200,");
      lines.push("      headers: { 'Content-Type': 'application/json' }");
      lines.push("    });");
      lines.push("  } catch (error) {");
      lines.push("    console.error('Webhook error:', error);");
      lines.push("    return new Response(JSON.stringify({ error: 'Internal server error' }), {");
      lines.push("      status: 500,");
      lines.push("      headers: { 'Content-Type': 'application/json' }");
      lines.push("    });");
      lines.push("  }");
      lines.push("};");
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Generate OAuth callback handlers
   */
  generateOAuthCallbackHandlers(oauthOperations: ParsedOperation[]): string {
    const lines: string[] = [];
    
    lines.push("// OAuth callback handlers");
    lines.push("// These handlers process OAuth authorization callbacks");
    lines.push("");

    for (const operation of oauthOperations) {
      lines.push(`export const ${operation.operationId}CallbackHandler = async (`);
      lines.push("  request: Request,");
      lines.push("  context: ExecutionContext");
      lines.push("): Promise<Response> => {");
      lines.push("");
      lines.push("  try {");
      lines.push("    const url = new URL(request.url);");
      lines.push("    const code = url.searchParams.get('code');");
      lines.push("    const state = url.searchParams.get('state');");
      lines.push("    const error = url.searchParams.get('error');");
      lines.push("");
      lines.push("    if (error) {");
      lines.push("      console.error('OAuth error:', error);");
      lines.push("      return new Response('OAuth authorization failed', { status: 400 });");
      lines.push("    }");
      lines.push("");
      lines.push("    if (!code) {");
      lines.push("      return new Response('Missing authorization code', { status: 400 });");
      lines.push("    }");
      lines.push("");
      lines.push("    // Exchange code for token");
      lines.push("    // This would typically involve calling the OAuth token endpoint");
      lines.push("    console.log('OAuth callback received:', { code, state });");
      lines.push("");
      lines.push("    return new Response('Authorization successful', { status: 200 });");
      lines.push("  } catch (error) {");
      lines.push("    console.error('OAuth callback error:', error);");
      lines.push("    return new Response('Internal server error', { status: 500 });");
      lines.push("  }");
      lines.push("};");
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Generate complete handler module
   */
  generateHandlerModule(handlers: GeneratedHandler[]): string {
    const lines: string[] = [];
    
    lines.push("// Auto-generated handlers from OpenAPI spec");
    lines.push("// Do not edit manually.");
    lines.push("");
    lines.push("import { z } from 'zod';");
    lines.push("import type { ExecutionContext } from '@tsdev/core';");
    lines.push("");

    // Generate handler functions
    for (const handler of handlers) {
      lines.push(handler.handlerCode);
      lines.push("");
    }

    // Generate webhook handlers
    const webhookHandlers = handlers.filter(h => h.isWebhook);
    if (webhookHandlers.length > 0) {
      lines.push(this.generateWebhookHandlers(webhookHandlers.map(h => h.operation)));
    }

    // Generate OAuth callback handlers
    const oauthHandlers = handlers.filter(h => h.isOAuthCallback);
    if (oauthHandlers.length > 0) {
      lines.push(this.generateOAuthCallbackHandlers(oauthHandlers.map(h => h.operation)));
    }

    return lines.join("\n");
  }
}