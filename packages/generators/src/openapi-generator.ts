/**
 * Main OpenAPI generator that orchestrates the entire generation process
 */

import { OpenAPIParser, parseOpenAPISpec, type OpenAPISpec } from "./openapi-parser.js";
import { ContractGenerator, type GeneratedContract } from "./contract-generator.js";
import { HandlerGenerator, type GeneratedHandler, type HandlerGeneratorOptions } from "./handler-generator.js";

export interface OpenAPIGeneratorOptions extends HandlerGeneratorOptions {
  outputDir?: string;
  generateTypes?: boolean;
  generateHandlers?: boolean;
  generateWebhooks?: boolean;
  generateOAuthCallbacks?: boolean;
  packageName?: string;
  packageVersion?: string;
}

export interface GeneratedFiles {
  contracts: string;
  handlers: string;
  types?: string;
  zodSchemas?: string;
  webhooks?: string;
  oauthCallbacks?: string;
  index: string;
  packageJson: string;
}

export class OpenAPIGenerator {
  private options: OpenAPIGeneratorOptions;
  private parser: OpenAPIParser;
  private contractGenerator: ContractGenerator;
  private handlerGenerator: HandlerGenerator;

  constructor(spec: OpenAPISpec | string, options: OpenAPIGeneratorOptions = {}) {
    this.options = {
      outputDir: "./generated",
      generateTypes: true,
      generateHandlers: true,
      generateWebhooks: true,
      generateOAuthCallbacks: true,
      packageName: "generated-api",
      packageVersion: "1.0.0",
      ...options,
    };

    const openApiSpec = typeof spec === "string" ? parseOpenAPISpec(spec) : spec;
    this.parser = new OpenAPIParser(openApiSpec);
    this.contractGenerator = new ContractGenerator();
    this.handlerGenerator = new HandlerGenerator(options);
  }

  /**
   * Generate all files from OpenAPI spec
   */
  async generate(): Promise<GeneratedFiles> {
    const operations = this.parser.parseOperations();
    const contracts = this.contractGenerator.generateContracts(operations);
    const handlers = this.handlerGenerator.generateHandlers(operations, contracts);

    const files: GeneratedFiles = {
      contracts: this.generateContractsFile(contracts),
      handlers: this.generateHandlersFile(handlers),
      index: this.generateIndexFile(contracts, handlers),
      packageJson: this.generatePackageJson(),
    };

    if (this.options.generateTypes) {
      files.types = this.contractGenerator.generateTypeDefinitions(contracts);
      files.zodSchemas = this.contractGenerator.generateZodDefinitions(contracts);
    }

    if (this.options.generateWebhooks) {
      const webhookOperations = this.parser.getWebhookOperations();
      if (webhookOperations.length > 0) {
        files.webhooks = this.handlerGenerator.generateWebhookHandlers(webhookOperations);
      }
    }

    if (this.options.generateOAuthCallbacks) {
      const oauthOperations = this.parser.getOAuthCallbackOperations();
      if (oauthOperations.length > 0) {
        files.oauthCallbacks = this.handlerGenerator.generateOAuthCallbackHandlers(oauthOperations);
      }
    }

    return files;
  }

  /**
   * Generate contracts file
   */
  private generateContractsFile(contracts: GeneratedContract[]): string {
    const lines: string[] = [];
    
    lines.push("// Auto-generated contracts from OpenAPI spec");
    lines.push("// Do not edit manually.");
    lines.push("");
    lines.push("import { z } from 'zod';");
    lines.push("import type { Contract } from '@tsdev/core';");
    lines.push("");

    for (const contract of contracts) {
      lines.push(`export const ${contract.name}Contract: Contract = {`);
      lines.push(`  name: "${contract.name}",`);
      if (contract.description) {
        lines.push(`  description: "${contract.description}",`);
      }
      lines.push(`  input: ${contract.name}InputSchema,`);
      lines.push(`  output: ${contract.name}OutputSchema,`);
      lines.push(`  metadata: {`);
      lines.push(`    source: "${contract.metadata.source}",`);
      lines.push(`    operationId: "${contract.metadata.operationId}",`);
      lines.push(`    method: "${contract.metadata.method}",`);
      lines.push(`    path: "${contract.metadata.path}",`);
      lines.push(`    tags: [${contract.metadata.tags.map(t => `"${t}"`).join(", ")}],`);
      if (contract.metadata.isWebhook) {
        lines.push(`    isWebhook: true,`);
      }
      if (contract.metadata.isOAuthCallback) {
        lines.push(`    isOAuthCallback: true,`);
      }
      lines.push(`  },`);
      lines.push("};");
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Generate handlers file
   */
  private generateHandlersFile(handlers: GeneratedHandler[]): string {
    return this.handlerGenerator.generateHandlerModule(handlers);
  }

  /**
   * Generate index file
   */
  private generateIndexFile(contracts: GeneratedContract[], handlers: GeneratedHandler[]): string {
    const lines: string[] = [];
    
    lines.push("// Auto-generated index file from OpenAPI spec");
    lines.push("// Do not edit manually.");
    lines.push("");
    lines.push("// Export contracts");
    for (const contract of contracts) {
      lines.push(`export { ${contract.name}Contract } from './contracts.js';`);
    }
    lines.push("");

    lines.push("// Export handlers");
    for (const handler of handlers) {
      lines.push(`export { ${handler.name}Handler } from './handlers.js';`);
    }
    lines.push("");

    // Export webhook handlers if any
    const webhookHandlers = handlers.filter(h => h.isWebhook);
    if (webhookHandlers.length > 0) {
      lines.push("// Export webhook handlers");
      for (const handler of webhookHandlers) {
        lines.push(`export { ${handler.name}WebhookHandler } from './webhooks.js';`);
      }
      lines.push("");
    }

    // Export OAuth callback handlers if any
    const oauthHandlers = handlers.filter(h => h.isOAuthCallback);
    if (oauthHandlers.length > 0) {
      lines.push("// Export OAuth callback handlers");
      for (const handler of oauthHandlers) {
        lines.push(`export { ${handler.name}CallbackHandler } from './oauth-callbacks.js';`);
      }
      lines.push("");
    }

    // Export procedures
    lines.push("// Export procedures");
    lines.push("import type { Procedure } from '@tsdev/core';");
    lines.push("");
    
    for (const contract of contracts) {
      const handler = handlers.find(h => h.name === contract.name);
      if (handler) {
        lines.push(`export const ${contract.name}Procedure: Procedure = {`);
        lines.push(`  contract: ${contract.name}Contract,`);
        lines.push(`  handler: ${contract.name}Handler,`);
        lines.push("};");
      }
    }

    return lines.join("\n");
  }

  /**
   * Generate package.json
   */
  private generatePackageJson(): string {
    const packageJson = {
      name: this.options.packageName,
      version: this.options.packageVersion,
      type: "module",
      main: "./index.js",
      types: "./index.d.ts",
      exports: {
        ".": {
          types: "./index.d.ts",
          import: "./index.js"
        }
      },
      dependencies: {
        "@tsdev/core": "workspace:*",
        "zod": "^4.1.12"
      },
      devDependencies: {
        "@types/node": "^20.0.0",
        "typescript": "^5.0.0"
      }
    };

    return JSON.stringify(packageJson, null, 2);
  }

  /**
   * Get statistics about the generated API
   */
  getStats(): {
    totalOperations: number;
    webhookOperations: number;
    oauthCallbackOperations: number;
    apiOperations: number;
    hasOAuth: boolean;
  } {
    const operations = this.parser.parseOperations();
    const webhookOps = this.parser.getWebhookOperations();
    const oauthOps = this.parser.getOAuthCallbackOperations();
    const apiOps = this.parser.getApiOperations();
    const oauthConfig = this.parser.getOAuthConfig();

    return {
      totalOperations: operations.length,
      webhookOperations: webhookOps.length,
      oauthCallbackOperations: oauthOps.length,
      apiOperations: apiOps.length,
      hasOAuth: oauthConfig !== null,
    };
  }

  /**
   * Get OAuth configuration
   */
  getOAuthConfig() {
    return this.parser.getOAuthConfig();
  }

  /**
   * Get webhook operations
   */
  getWebhookOperations() {
    return this.parser.getWebhookOperations();
  }

  /**
   * Get OAuth callback operations
   */
  getOAuthCallbackOperations() {
    return this.parser.getOAuthCallbackOperations();
  }
}

/**
 * Convenience function to generate from OpenAPI spec
 */
export async function generateFromOpenAPI(
  spec: OpenAPISpec | string,
  options?: OpenAPIGeneratorOptions
): Promise<GeneratedFiles> {
  const generator = new OpenAPIGenerator(spec, options);
  return generator.generate();
}