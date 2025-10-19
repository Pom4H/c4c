/**
 * Contract generator from OpenAPI schemas
 * Converts OpenAPI schemas to Zod schemas for tsdev contracts
 */

import { z } from "zod";
import type { Schema, ParsedOperation } from "./openapi-parser.js";

export interface GeneratedContract {
  name: string;
  description?: string;
  input: z.ZodTypeAny;
  output: z.ZodTypeAny;
  metadata: {
    source: "openapi";
    operationId: string;
    method: string;
    path: string;
    tags: string[];
    isWebhook?: boolean;
    isOAuthCallback?: boolean;
  };
}

export class ContractGenerator {
  private schemaCache = new Map<string, z.ZodTypeAny>();

  /**
   * Generate contracts from OpenAPI operations
   */
  generateContracts(operations: ParsedOperation[]): GeneratedContract[] {
    return operations.map(operation => this.generateContract(operation));
  }

  /**
   * Generate a single contract from an operation
   */
  private generateContract(operation: ParsedOperation): GeneratedContract {
    const input = this.generateInputSchema(operation);
    const output = this.generateOutputSchema(operation);

    return {
      name: operation.operationId,
      description: operation.description || operation.summary,
      input,
      output,
      metadata: {
        source: "openapi",
        operationId: operation.operationId,
        method: operation.method,
        path: operation.path,
        tags: operation.tags,
        isWebhook: operation.isWebhook,
        isOAuthCallback: operation.isOAuthCallback,
      },
    };
  }

  /**
   * Generate input schema from operation parameters and request body
   */
  private generateInputSchema(operation: ParsedOperation): z.ZodTypeAny {
    const fields: Record<string, z.ZodTypeAny> = {};

    // Add path parameters
    for (const param of operation.parameters) {
      if (param.in === "path") {
        fields[param.name] = this.convertSchemaToZod(param.schema);
      }
    }

    // Add query parameters
    for (const param of operation.parameters) {
      if (param.in === "query") {
        const schema = this.convertSchemaToZod(param.schema);
        fields[param.name] = param.required ? schema : schema.optional();
      }
    }

    // Add header parameters
    for (const param of operation.parameters) {
      if (param.in === "header") {
        const schema = this.convertSchemaToZod(param.schema);
        fields[param.name] = param.required ? schema : schema.optional();
      }
    }

    // Add request body
    if (operation.requestBody) {
      const bodySchema = this.extractRequestBodySchema(operation.requestBody);
      if (bodySchema) {
        Object.assign(fields, bodySchema);
      }
    }

    if (Object.keys(fields).length === 0) {
      return z.object({});
    }

    return z.object(fields);
  }

  /**
   * Generate output schema from operation responses
   */
  private generateOutputSchema(operation: ParsedOperation): z.ZodTypeAny {
    // Find the first 2xx response
    const successResponse = operation.responses.find(resp => 
      resp.statusCode.startsWith("2")
    );

    if (!successResponse || !successResponse.content) {
      return z.object({});
    }

    // Get the first content type (prefer application/json)
    const contentTypes = Object.keys(successResponse.content);
    const jsonContentType = contentTypes.find(ct => ct.includes("application/json"));
    const contentType = jsonContentType || contentTypes[0];
    
    if (!contentType) {
      return z.object({});
    }

    const mediaType = successResponse.content[contentType];
    return this.convertSchemaToZod(mediaType.schema);
  }

  /**
   * Extract request body schema
   */
  private extractRequestBodySchema(requestBody: ParsedRequestBody): Record<string, z.ZodTypeAny> | null {
    if (!requestBody.content) {
      return null;
    }

    // Prefer application/json
    const jsonContentType = Object.keys(requestBody.content).find(ct => 
      ct.includes("application/json")
    );
    const contentType = jsonContentType || Object.keys(requestBody.content)[0];
    
    if (!contentType) {
      return null;
    }

    const mediaType = requestBody.content[contentType];
    const schema = this.convertSchemaToZod(mediaType.schema);
    
    // If it's an object, return its properties
    if (schema instanceof z.ZodObject) {
      return schema.shape;
    }

    // Otherwise wrap in a generic field
    return { data: schema };
  }

  /**
   * Convert OpenAPI schema to Zod schema
   */
  private convertSchemaToZod(schema: Schema): z.ZodTypeAny {
    if (schema.$ref) {
      // Handle references (simplified - would need full resolution)
      return z.any();
    }

    const type = schema.type || "string";
    const nullable = schema.enum?.includes(null) || false;
    const optional = !schema.required;

    let zodSchema: z.ZodTypeAny;

    switch (type) {
      case "string":
        zodSchema = z.string();
        if (schema.enum) {
          zodSchema = z.enum(schema.enum.filter(v => v !== null) as [string, ...string[]]);
        }
        if (schema.format === "date") {
          zodSchema = z.string().datetime();
        }
        if (schema.format === "email") {
          zodSchema = z.string().email();
        }
        if (schema.format === "uri") {
          zodSchema = z.string().url();
        }
        if (schema.pattern) {
          zodSchema = z.string().regex(new RegExp(schema.pattern));
        }
        if (schema.minLength !== undefined) {
          zodSchema = zodSchema.min(schema.minLength);
        }
        if (schema.maxLength !== undefined) {
          zodSchema = zodSchema.max(schema.maxLength);
        }
        break;

      case "number":
        zodSchema = z.number();
        if (schema.minimum !== undefined) {
          zodSchema = zodSchema.min(schema.minimum);
        }
        if (schema.maximum !== undefined) {
          zodSchema = zodSchema.max(schema.maximum);
        }
        if (schema.multipleOf !== undefined) {
          zodSchema = zodSchema.multipleOf(schema.multipleOf);
        }
        break;

      case "integer":
        zodSchema = z.number().int();
        if (schema.minimum !== undefined) {
          zodSchema = zodSchema.min(schema.minimum);
        }
        if (schema.maximum !== undefined) {
          zodSchema = zodSchema.max(schema.maximum);
        }
        if (schema.multipleOf !== undefined) {
          zodSchema = zodSchema.multipleOf(schema.multipleOf);
        }
        break;

      case "boolean":
        zodSchema = z.boolean();
        break;

      case "array":
        if (schema.items) {
          const itemSchema = this.convertSchemaToZod(schema.items);
          zodSchema = z.array(itemSchema);
        } else {
          zodSchema = z.array(z.any());
        }
        if (schema.minItems !== undefined) {
          zodSchema = zodSchema.min(schema.minItems);
        }
        if (schema.maxItems !== undefined) {
          zodSchema = zodSchema.max(schema.maxItems);
        }
        if (schema.uniqueItems) {
          zodSchema = zodSchema.refine(
            (arr) => new Set(arr).size === arr.length,
            "Array items must be unique"
          );
        }
        break;

      case "object":
        if (schema.properties) {
          const shape: Record<string, z.ZodTypeAny> = {};
          for (const [key, propSchema] of Object.entries(schema.properties)) {
            const isRequired = schema.required?.includes(key) || false;
            const zodProp = this.convertSchemaToZod(propSchema);
            shape[key] = isRequired ? zodProp : zodProp.optional();
          }
          zodSchema = z.object(shape);
        } else {
          zodSchema = z.object({});
        }
        if (schema.additionalProperties === true) {
          zodSchema = zodSchema.catchall(z.any());
        } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
          const additionalSchema = this.convertSchemaToZod(schema.additionalProperties);
          zodSchema = zodSchema.catchall(additionalSchema);
        }
        break;

      default:
        zodSchema = z.any();
    }

    // Handle nullable
    if (nullable) {
      zodSchema = zodSchema.nullable();
    }

    // Handle default values
    if (schema.default !== undefined) {
      zodSchema = zodSchema.default(schema.default);
    }

    // Handle enum
    if (schema.enum && type !== "string") {
      zodSchema = z.enum(schema.enum as [any, ...any[]]);
    }

    return zodSchema;
  }

  /**
   * Generate TypeScript types from contracts
   */
  generateTypeDefinitions(contracts: GeneratedContract[]): string {
    const lines: string[] = [];
    
    lines.push("// Auto-generated TypeScript types from OpenAPI spec");
    lines.push("// Do not edit manually.\n");

    for (const contract of contracts) {
      const inputTypeName = `${contract.name}Input`;
      const outputTypeName = `${contract.name}Output`;
      
      lines.push(`export type ${inputTypeName} = z.infer<typeof ${contract.name}InputSchema>;`);
      lines.push(`export type ${outputTypeName} = z.infer<typeof ${contract.name}OutputSchema>;`);
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Generate Zod schema definitions
   */
  generateZodDefinitions(contracts: GeneratedContract[]): string {
    const lines: string[] = [];
    
    lines.push("// Auto-generated Zod schemas from OpenAPI spec");
    lines.push("// Do not edit manually.\n");
    lines.push("import { z } from 'zod';\n");

    for (const contract of contracts) {
      const inputSchemaName = `${contract.name}InputSchema`;
      const outputSchemaName = `${contract.name}OutputSchema`;
      
      lines.push(`export const ${inputSchemaName} = ${this.zodSchemaToString(contract.input)};`);
      lines.push(`export const ${outputSchemaName} = ${this.zodSchemaToString(contract.output)};`);
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Convert Zod schema to string representation
   */
  private zodSchemaToString(schema: z.ZodTypeAny): string {
    // This is a simplified implementation
    // In a real implementation, you'd need to traverse the Zod schema
    // and generate the appropriate string representation
    return "z.any()"; // Placeholder
  }
}