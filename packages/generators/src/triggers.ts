/**
 * @c4c/generators - Trigger generator using @hey-api/openapi-ts
 * 
 * Generates trigger definitions from OpenAPI specifications
 */

import { createClient } from '@hey-api/openapi-ts';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface TriggerMetadata {
  kind: 'operation' | 'webhook' | 'callback' | 'subscription' | 'stream';
  transport?: 'sse' | 'websocket' | 'http';
  subscriptionRegister?: string;
  subscriptionCallback?: string;
}

export interface TriggerGeneratorOptions {
  /**
   * OpenAPI spec URL or file path
   */
  input: string;
  
  /**
   * Output directory for generated files
   */
  output: string;
  
  /**
   * Name of the integration (e.g., 'telegram', 'github')
   */
  name?: string;
  
  /**
   * Additional @hey-api/openapi-ts plugins
   */
  plugins?: Array<string | { name: string; [key: string]: unknown }>;
}

/**
 * Generate trigger definitions from an OpenAPI specification
 */
export async function generateTriggers(options: TriggerGeneratorOptions): Promise<void> {
  const { input, output, name, plugins = [] } = options;
  
  // Ensure output directory exists
  await fs.mkdir(output, { recursive: true });
  
  // Extract name from input URL if not provided
  const integrationName = name || extractNameFromUrl(input);
  
  // Default plugins configuration
  // Note: Trigger detection is done post-generation using OpenAPI spec analysis
  const defaultPlugins: any[] = [
    '@hey-api/schemas',
    {
      enums: 'javascript',
      name: '@hey-api/typescript'
    },
    {
      name: '@hey-api/sdk',
      transformer: false
    },
    ...plugins
  ];
  
  // Generate client with @hey-api/openapi-ts
  await createClient({
    input,
    output,
    client: '@hey-api/client-fetch',
    plugins: defaultPlugins as any
  });
  
  // Load OpenAPI spec for trigger analysis
  const spec = await loadOpenAPISpec(input);
  
  // Generate triggers metadata file
  await generateTriggersMetadata(spec, output);
  
  // Save OpenAPI spec for procedure generation
  if (spec) {
    await fs.writeFile(
      path.join(output, 'openapi.json'),
      JSON.stringify(spec, null, 2),
      'utf-8'
    );
  }
  
  console.log(`[c4c] Generated triggers for ${integrationName} at ${output}`);
}

/**
 * Generate procedures from triggers (similar to generate-integrations.mjs)
 */
export async function generateProceduresFromTriggers(options: {
  generatedDir: string;
  outputDir: string;
  provider: string;
  baseUrl?: string;
  openApiSpec?: any;
}): Promise<void> {
  const { generatedDir, outputDir, provider, baseUrl = 'http://localhost:3000', openApiSpec } = options;
  
  // Check if required files exist
  const sdkPath = path.join(generatedDir, 'sdk.gen.ts');
  const schemasPath = path.join(generatedDir, 'schemas.gen.ts');
  const typesPath = path.join(generatedDir, 'types.gen.ts');
  const triggersPath = path.join(generatedDir, 'triggers.gen.ts');
  
  const [sdkExists, schemasExists, typesExists, triggersExists] = await Promise.all([
    fileExists(sdkPath),
    fileExists(schemasPath),
    fileExists(typesPath),
    fileExists(triggersPath)
  ]);
  
  if (!sdkExists) {
    throw new Error(`Required files not found in ${generatedDir}. Need sdk.gen.ts`);
  }
  
  // Check if we have schemas or types
  if (!schemasExists && !typesExists) {
    console.warn('[c4c] Neither schemas.gen.ts nor types.gen.ts found, skipping procedure generation');
    return;
  }
  
  // Use schemas if available, otherwise fall back to types
  const schemaPath = schemasExists ? schemasPath : typesPath;
  const hasSchemas = schemasExists;
  
  // Load trigger metadata if available
  let triggerMetadata: Record<string, TriggerMetadata> = {};
  if (triggersExists) {
    try {
      const triggersSource = await fs.readFile(triggersPath, 'utf8');
      triggerMetadata = await parseTriggersMetadata(triggersSource);
    } catch (error) {
      console.warn('[c4c] Failed to parse triggers.gen.ts, using fallback detection');
    }
  }
  
  // Read the generated files
  const sdkSource = await fs.readFile(sdkPath, 'utf8');
  const schemaSource = await fs.readFile(schemaPath, 'utf8');
  
  // Extract operations from SDK
  const operations = extractOperationsFromSdk(sdkSource);
  
  // Extract schema exports
  const schemaExports = extractSchemaExportsFromSource(schemaSource);
  
  // Extract schemas from OpenAPI spec if available
  const operationSchemas = openApiSpec ? extractSchemasFromOpenApi(openApiSpec) : {};
  
  // Extract webhooks from OpenAPI spec
  const webhookOperations = openApiSpec ? extractWebhooksFromOpenApi(openApiSpec, operationSchemas) : [];
  
  // Match operations with schemas and triggers
  const resolvedOperations = operations
    .map((op) => {
      const pascalName = capitalize(op.name);
      
      // For @hey-api/schemas, the naming convention is typically {OperationName}Data and {OperationName}Response
      // Convert operation name to PascalCase for matching
      const pascalOp = op.name.charAt(0).toUpperCase() + op.name.slice(1);
      
      const possibleDataKeys = [
        `${pascalOp}Data`,
        `${op.name}Data`,
        `${pascalName}Data`,
      ];
      
      const possibleResponseKeys = [
        `${pascalOp}Response`,
        `${op.name}Response`,
        `${pascalName}Response`,
      ];
      
      const dataKey = possibleDataKeys.find((key) => schemaExports.has(key)) || `${pascalOp}Data`;
      const responseKey = possibleResponseKeys.find((key) => schemaExports.has(key)) || `${pascalOp}Response`;
      
      // For now, always create procedures even without perfect schema matches
      // The schemas exist in types.gen.ts
      const hasValidSchemas = true;
      
      // Check if this operation is a trigger (use normalized name for fuzzy matching)
      const normalizedName = normalizeOperationName(op.name);
      const triggerInfo = triggerMetadata[normalizedName];
      const isTrigger = triggerInfo && triggerInfo.kind !== 'operation';
      
      // Get schemas from OpenAPI if available
      const opSchemas = operationSchemas[op.name] || { input: null, output: null };
      
      return {
        ...op,
        pascalName,
        dataKey,
        responseKey,
        hasValidSchemas,
        isTrigger,
        triggerKind: triggerInfo?.kind,
        triggerTransport: triggerInfo?.transport,
        triggerMetadata: triggerInfo,
        inputSchema: opSchemas.input,
        outputSchema: opSchemas.output
      };
    })
    .filter((op): op is NonNullable<typeof op> => op !== null && (op as any).hasValidSchemas);
  
  // Generate procedure files (simplified structure)
  await fs.mkdir(outputDir, { recursive: true });
  
  // Create triggers subdirectory only
  const triggersDir = path.join(outputDir, 'triggers');
  await fs.mkdir(triggersDir, { recursive: true });
  
  // Separate procedures and triggers
  const procedures = resolvedOperations.filter(op => !op.isTrigger);
  const triggers = resolvedOperations.filter(op => op.isTrigger);
  
  // Generate individual procedure files in root outputDir
  for (const op of procedures) {
    const fileName = `${toDotCase(op.name).replace(/\./g, '-')}.gen.ts`;
    const filePath = path.join(outputDir, fileName);
    
    const code = generateSingleProcedureCode({
      provider,
      operation: op as any,
      sdkImportPath: path.relative(path.dirname(filePath), sdkPath).replace(/\.ts$/, '.js'),
      schemaImportPath: path.relative(path.dirname(filePath), schemaPath).replace(/\.ts$/, '.js'),
      useSchemas: hasSchemas
    });
    
    await fs.writeFile(filePath, code, 'utf8');
  }
  
  // Generate individual trigger files in triggers subdirectory
  for (const op of triggers) {
    const fileName = `${toDotCase(op.name).replace(/\./g, '-')}.gen.ts`;
    const filePath = path.join(triggersDir, fileName);
    
    const code = generateSingleProcedureCode({
      provider,
      operation: op as any,
      sdkImportPath: path.relative(path.dirname(filePath), sdkPath).replace(/\.ts$/, '.js'),
      schemaImportPath: path.relative(path.dirname(filePath), schemaPath).replace(/\.ts$/, '.js'),
      useSchemas: hasSchemas
    });
    
    await fs.writeFile(filePath, code, 'utf8');
  }
  
  // Generate webhook trigger files
  for (const webhook of webhookOperations) {
    const fileName = `${toDotCase(webhook.name).replace(/\./g, '-')}.gen.ts`;
    const filePath = path.join(triggersDir, fileName);
    
    const code = generateWebhookTriggerCode({
      provider,
      webhook: webhook as any,
    });
    
    await fs.writeFile(filePath, code, 'utf8');
  }
  
  // Combine subscription triggers and webhook triggers
  const allTriggers = [
    ...triggers,
    ...webhookOperations
  ];
  
  // Generate triggers index file
  const triggerIndexCode = generateIndexFile(
    allTriggers,
    provider,
    'triggers'
  );
  await fs.writeFile(path.join(triggersDir, 'index.ts'), triggerIndexCode, 'utf8');
  
  // Generate main index file with all procedures exported directly
  const mainIndexCode = generateMainIndexFile(procedures, allTriggers, provider);
  await fs.writeFile(path.join(outputDir, 'index.ts'), mainIndexCode, 'utf8');
  
  console.log(`[c4c] Generated procedures at ${outputDir}`);
  console.log(`[c4c]   - Procedures: ${procedures.length} files in ${outputDir}`);
  console.log(`[c4c]   - Triggers: ${allTriggers.length} files in ${triggersDir}`);
}

function extractNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    // Try to extract from common patterns
    // e.g., /v2/specs/telegram.org/5.0.0/openapi.json -> telegram
    const nameIndex = pathParts.findIndex((part) => 
      part.endsWith('.json') || part.endsWith('.yaml') || part.endsWith('.yml')
    );
    
    if (nameIndex > 0) {
      const domainPart = pathParts[nameIndex - 1];
      return domainPart.split('.')[0] || 'integration';
    }
    
    return pathParts[pathParts.length - 1]?.replace(/\.(json|yaml|yml)$/, '') || 'integration';
  } catch {
    // If not a URL, extract from file path
    return path.basename(url, path.extname(url));
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function capitalize(str: string): string {
  if (!str) return '';
  return str[0].toUpperCase() + str.slice(1);
}

/**
 * Convert kebab-case or snake_case to PascalCase
 * e.g., task-manager -> TaskManager, notification_service -> NotificationService
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function extractOperationsFromSdk(source: string): Array<{ name: string; description?: string; rawName?: string }> {
  // Extract function exports with JSDoc comments
  const functionPattern = /\/\*\*\n([^*]|\*(?!\/))*\*\/\s*export\s+const\s+([a-zA-Z0-9_]+)\s*=/gs;
  const operations: Array<{ name: string; description?: string; rawName?: string }> = [];
  
  let match: RegExpExecArray | null;
  while ((match = functionPattern.exec(source)) !== null) {
    const comment = match[0];
    const name = match[2];
    
    if (name && name !== 'client') {
      // Extract description from JSDoc
      const descMatch = comment.match(/\/\*\*\s*\n\s*\*\s*([^\n]+)/);
      const description = descMatch?.[1]?.trim();
      
      // Convert from camelCase to snake_case with method prefix for matching with triggerMetadata
      // e.g., postSetWebhook -> post__setWebhook
      const rawName = camelCaseToSnakeWithMethod(name);
      
      operations.push({ name, description, rawName });
    }
  }
  
  return operations;
}

/**
 * Convert camelCase operation name to snake_case with method prefix
 * e.g., postSetWebhook -> post__setWebhook
 */
function camelCaseToSnakeWithMethod(name: string): string {
  // Extract method prefix (get, post, put, delete, etc.)
  const methodMatch = name.match(/^(get|post|put|patch|delete|head|options|trace)/i);
  if (!methodMatch) {
    return name;
  }
  
  const method = methodMatch[1].toLowerCase();
  const rest = name.slice(method.length);
  
  // Convert rest to snake_case
  const snakeCaseRest = rest
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
  
  return `${method}__${snakeCaseRest}`;
}

function extractSchemaExportsFromSource(source: string): Set<string> {
  // For @hey-api/schemas, schemas are JSON schema objects, not Zod schemas
  // Look for pattern like: export const FooSchema = { ... }
  const schemaPattern = /export\s+const\s+([a-zA-Z0-9_]+Schema)\s*=/g;
  const exports = new Set<string>();
  
  let match: RegExpExecArray | null;
  while ((match = schemaPattern.exec(source)) !== null) {
    const name = match[1];
    if (name) {
      // Store both with and without "Schema" suffix
      exports.add(name);
      exports.add(name.replace(/Schema$/, ''));
    }
  }
  
  return exports;
}

/**
 * Parse trigger metadata from triggers.gen.ts
 */
async function parseTriggersMetadata(source: string): Promise<Record<string, TriggerMetadata>> {
  try {
    // Extract the triggerMetadata object from the source
    const match = source.match(/export const triggerMetadata = ({[\s\S]*?}) as const;/);
    if (!match) {
      return {};
    }
    
    // Parse the JSON object
    return JSON.parse(match[1]);
  } catch (error) {
    console.warn('[c4c] Failed to parse trigger metadata:', error);
    return {};
  }
}

/**
 * Extract schemas from OpenAPI specification (which contains Zod schemas)
 */
function extractSchemasFromOpenApi(spec: any): Record<string, { input: string | null; output: string | null }> {
  const schemas: Record<string, { input: string | null; output: string | null }> = {};
  
  if (!spec || !spec.paths) {
    return schemas;
  }
  
  // Get components for $ref resolution
  const components = spec.components?.schemas || {};
  
  // Process each path and operation
  for (const [pathStr, pathItem] of Object.entries(spec.paths || {})) {
    const pathObj = pathItem as any;
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];
    
    for (const method of methods) {
      const operation = pathObj[method];
      if (!operation || !operation.operationId) continue;
      
      const operationId = operation.operationId;
      
      // Extract input schema from requestBody
      let inputSchema: string | null = null;
      if (operation.requestBody?.content) {
        const content = operation.requestBody.content;
        const jsonContent = content['application/json'] || content['application/x-www-form-urlencoded'];
        if (jsonContent?.schema) {
          // Convert JSON Schema to Zod code string
          inputSchema = jsonSchemaToZod(jsonContent.schema, components);
        }
      } else if (operation.parameters && operation.parameters.length > 0) {
        // Handle query/path parameters
        const paramSchemas: string[] = [];
        for (const param of operation.parameters) {
          if (param.in === 'query' || param.in === 'path') {
            const paramType = param.schema?.type || 'string';
            const zodType = paramType === 'integer' || paramType === 'number' ? 'z.number()' : 
                           paramType === 'boolean' ? 'z.boolean()' : 'z.string()';
            const optional = param.required ? '' : '.optional()';
            paramSchemas.push(`${param.name}: ${zodType}${optional}`);
          }
        }
        if (paramSchemas.length > 0) {
          inputSchema = `z.object({\n  ${paramSchemas.join(',\n  ')}\n})`;
        }
      }
      
      // Extract output schema from response
      let outputSchema: string | null = null;
      if (operation.responses) {
        const successResponse = operation.responses['200'] || operation.responses['201'] || operation.responses['default'];
        if (successResponse?.content) {
          const content = successResponse.content;
          const jsonContent = content['application/json'];
          if (jsonContent?.schema) {
            // Convert JSON Schema to Zod code string
            outputSchema = jsonSchemaToZod(jsonContent.schema, components);
          }
        }
      }
      
      schemas[operationId] = {
        input: inputSchema,
        output: outputSchema
      };
    }
  }
  
  return schemas;
}

/**
 * Convert Zod schema object (with _def) to Zod code string
 */
function zodSchemaToZodCode(schema: any): string | null {
  if (!schema || !schema._def) {
    return null;
  }
  
  const typeName = schema._def.typeName;
  
  if (typeName === 'ZodObject') {
    const shape = typeof schema._def.shape === 'function' ? schema._def.shape() : schema._def.shape;
    if (!shape || Object.keys(shape).length === 0) {
      return 'z.object({})';
    }
    
    const properties: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      const propCode = zodSchemaToZodCode(value);
      if (propCode) {
        properties.push(`${key}: ${propCode}`);
      }
    }
    
    if (properties.length === 0) {
      return 'z.object({})';
    }
    
    return `z.object({\n  ${properties.join(',\n  ')}\n})`;
  }
  
  if (typeName === 'ZodString') {
    let code = 'z.string()';
    const checks = schema._def.checks || [];
    for (const check of checks) {
      if (check.kind === 'min') {
        code += `.min(${check.value})`;
      } else if (check.kind === 'max') {
        code += `.max(${check.value})`;
      } else if (check.kind === 'email') {
        code += '.email()';
      } else if (check.kind === 'url') {
        code += '.url()';
      } else if (check.kind === 'datetime') {
        code += '.datetime()';
      }
    }
    return code;
  }
  
  if (typeName === 'ZodNumber' || typeName === 'ZodBigInt') {
    return 'z.number()';
  }
  
  if (typeName === 'ZodBoolean') {
    return 'z.boolean()';
  }
  
  if (typeName === 'ZodArray') {
    const itemsCode = zodSchemaToZodCode(schema._def.type);
    return `z.array(${itemsCode || 'z.unknown()'})`;
  }
  
  if (typeName === 'ZodEnum') {
    const values = schema._def.values || [];
    if (values.length === 0) return null;
    const enumValues = values.map((v: any) => JSON.stringify(v)).join(', ');
    return `z.enum([${enumValues}])`;
  }
  
  if (typeName === 'ZodOptional') {
    const innerCode = zodSchemaToZodCode(schema._def.innerType);
    return `${innerCode}.optional()`;
  }
  
  if (typeName === 'ZodNullable') {
    const innerCode = zodSchemaToZodCode(schema._def.innerType);
    return `${innerCode}.nullable()`;
  }
  
  if (typeName === 'ZodDefault') {
    const innerCode = zodSchemaToZodCode(schema._def.innerType);
    return innerCode; // We don't include .default() in generated code
  }
  
  if (typeName === 'ZodRecord') {
    return 'z.record(z.string(), z.unknown())';
  }
  
  if (typeName === 'ZodUnknown' || typeName === 'ZodAny') {
    return 'z.unknown()';
  }
  
  // Fallback
  return 'z.unknown()';
}

/**
 * Convert JSON Schema to Zod schema
 */
function jsonSchemaToZod(schema: any, components: Record<string, any> = {}): string {
  // Handle $ref
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop();
    if (refName && components[refName]) {
      return jsonSchemaToZod(components[refName], components);
    }
    return 'z.unknown()';
  }
  
  // Handle oneOf (union)
  if (schema.oneOf && Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    const variants = schema.oneOf.map((s: any) => jsonSchemaToZod(s, components));
    return `z.union([${variants.join(', ')}])`;
  }
  
  // Handle anyOf (union)
  if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    const variants = schema.anyOf.map((s: any) => jsonSchemaToZod(s, components));
    return `z.union([${variants.join(', ')}])`;
  }
  
  // Handle allOf (intersection)
  if (schema.allOf && Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const variants = schema.allOf.map((s: any) => jsonSchemaToZod(s, components));
    return variants.join('.and(');
  }
  
  // Handle type
  if (schema.type === 'object') {
    if (!schema.properties || Object.keys(schema.properties).length === 0) {
      // Check for additionalProperties
      if (schema.additionalProperties === false) {
        return 'z.object({})';
      }
      return 'z.record(z.string(), z.unknown())';
    }
    
    const properties: string[] = [];
    const required = schema.required || [];
    
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const propZod = jsonSchemaToZod(propSchema as any, components);
      const isRequired = required.includes(key);
      const optional = isRequired ? '' : '.optional()';
      const safeKey = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : `"${key}"`;
      properties.push(`${safeKey}: ${propZod}${optional}`);
    }
    
    return `z.object({\n  ${properties.join(',\n  ')}\n})`;
  }
  
  if (schema.type === 'array') {
    const itemsZod = schema.items ? jsonSchemaToZod(schema.items, components) : 'z.unknown()';
    return `z.array(${itemsZod})`;
  }
  
  // Handle nullable
  if (schema.nullable === true) {
    const baseType = jsonSchemaToZodType(schema);
    return `${baseType}.nullable()`;
  }
  
  return jsonSchemaToZodType(schema);
}

/**
 * Convert simple JSON Schema type to Zod type
 */
function jsonSchemaToZodType(schema: any): string {
  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
    const values = schema.enum.map((v: any) => JSON.stringify(v)).join(', ');
    return `z.enum([${values}])`;
  }
  
  // Handle const
  if (schema.const !== undefined) {
    return `z.literal(${JSON.stringify(schema.const)})`;
  }
  
  switch (schema.type) {
    case 'string': {
      let str = 'z.string()';
      
      // Format validations
      if (schema.format === 'date-time') str += '.datetime()';
      else if (schema.format === 'email') str += '.email()';
      else if (schema.format === 'url' || schema.format === 'uri') str += '.url()';
      else if (schema.format === 'uuid') str += '.uuid()';
      // Note: Zod doesn't have a built-in .date() method, dates are handled as strings
      
      // Length validations
      if (schema.minLength !== undefined) str += `.min(${schema.minLength})`;
      if (schema.maxLength !== undefined) str += `.max(${schema.maxLength})`;
      
      // Pattern validation
      if (schema.pattern) {
        const escapedPattern = schema.pattern.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        str += `.regex(new RegExp('${escapedPattern}'))`;
      }
      
      return str;
    }
    case 'number':
    case 'integer': {
      let num = 'z.number()';
      
      if (schema.type === 'integer') num += '.int()';
      if (schema.minimum !== undefined) num += `.min(${schema.minimum})`;
      if (schema.maximum !== undefined) num += `.max(${schema.maximum})`;
      if (schema.exclusiveMinimum !== undefined) num += `.gt(${schema.exclusiveMinimum})`;
      if (schema.exclusiveMaximum !== undefined) num += `.lt(${schema.exclusiveMaximum})`;
      
      return num;
    }
    case 'boolean':
      return 'z.boolean()';
    case 'null':
      return 'z.null()';
    default:
      return 'z.unknown()';
  }
}

/**
 * Generate code for a single procedure
 */
function generateSingleProcedureCode(options: {
  provider: string;
  operation: any;
  sdkImportPath: string;
  schemaImportPath: string;
  useSchemas?: boolean;
}): string {
  const { provider, operation: op, sdkImportPath, schemaImportPath, useSchemas = true } = options;
  
  const header = `// This file is auto-generated by c4c integrate command
// Do not edit manually.

`;
  
  const envVarName = `${provider.toUpperCase().replace(/-/g, '_')}_URL`;
  
  const imports = `import { applyPolicies, type Procedure, type Contract } from "@c4c/core";
import { withOAuth, getOAuthHeaders } from "@c4c/policies";
import * as sdk from "${sdkImportPath}";
import { createClient, createConfig } from "@hey-api/client-fetch";
import { z } from "zod";
`;
  
  const providerPascal = toPascalCase(provider);
  const providerEnvName = provider.toUpperCase().replace(/-/g, '_');
  const contractName = `${providerPascal}${op.pascalName}Contract`;
  const handlerName = `${op.name}Handler`;
  const procedureName = `${providerPascal}${op.pascalName}Procedure`;
  
  const metadata: string[] = [
    `    exposure: "external" as const,`,
    `    roles: ["api-endpoint", "workflow-node"${op.isTrigger ? ', "trigger"' : ''}],`,
    `    provider: "${provider}",`,
    `    operation: "${op.name}",`,
    `    tags: ["${provider}"],`
  ];
  
  if (op.isTrigger && op.triggerMetadata) {
    metadata.push(`    type: "trigger" as const,`);
    metadata.push(`    trigger: {`);
    // Map trigger kind to type
    const triggerType = op.triggerMetadata.kind === 'webhook' ? 'webhook' : 
                        op.triggerMetadata.kind === 'stream' ? 'stream' : 
                        op.triggerMetadata.kind === 'subscription' ? 'subscription' : 'webhook';
    metadata.push(`      type: "${triggerType}",`);
    metadata.push(`    },`);
  }
  
  // Use extracted schemas if available, otherwise use z.unknown()
  // z.unknown() is safer than z.any() and forces type checking
  const inputSchema = op.inputSchema || 'z.unknown()';
  const outputSchema = op.outputSchema || 'z.unknown()';
  
  const code = `
export const ${contractName}: Contract = {
  name: "${provider}.${toDotCase(op.name)}",
  description: "${op.description || op.name}",
  input: ${inputSchema},
  output: ${outputSchema},
  metadata: {
${metadata.join('\n')}
  },
};

const ${handlerName} = applyPolicies(
  async (input, context) => {
    const baseUrl = process.env.${envVarName} || context.metadata?.['${provider}Url'] as string | undefined;
    if (!baseUrl) {
      throw new Error(\`${envVarName} environment variable is not set\`);
    }
    
    const headers = getOAuthHeaders(context, "${provider}");
    
    // Create custom client with proper baseURL configuration
    const customClient = createClient(createConfig({ baseUrl }));
    
    const result = await sdk.${op.name}({ 
      body: input,
      headers,
      client: customClient 
    } as any);
    
    if (result && typeof result === "object" && "data" in result) {
      return (result as { data: unknown }).data;
    }
    return result as unknown;
  },
  withOAuth({
    provider: "${provider}",
    metadataTokenKey: "${provider}Token",
    envVar: "${providerEnvName}_TOKEN",
  })
);

export const ${procedureName}: Procedure = {
  contract: ${contractName},
  handler: ${handlerName},
};
`;
  
  return header + imports + code;
}

/**
 * Extract webhooks from OpenAPI specification
 */
function extractWebhooksFromOpenApi(spec: any, operationSchemas: Record<string, { input: string | null; output: string | null }>): any[] {
  const webhooks: any[] = [];
  
  if (!spec || !spec.webhooks) {
    return webhooks;
  }
  
  // Process webhooks
  for (const [webhookName, webhookItem] of Object.entries(spec.webhooks)) {
    const webhookObj = webhookItem as any;
    const methods = ['post', 'get', 'put', 'patch', 'delete'];
    
    for (const method of methods) {
      const operation = webhookObj[method];
      if (!operation) continue;
      
      const operationId = operation.operationId || `${webhookName}Webhook`;
      // Convert webhook name to camelCase, removing dots and underscores
      const cleanName = operationId.replace(/[._-]/g, ' ')
        .split(' ')
        .map((word: string, index: number) => index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
      const camelCaseName = cleanName.charAt(0).toLowerCase() + cleanName.slice(1);
      const pascalName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      
      // Extract schemas for this webhook
      let inputSchema: string | null = null;
      let outputSchema: string | null = null;
      
      // Input from requestBody (the webhook payload)
      if (operation.requestBody?.content) {
        const content = operation.requestBody.content;
        const jsonContent = content['application/json'];
        if (jsonContent?.schema) {
          inputSchema = jsonSchemaToZod(jsonContent.schema, spec.components?.schemas || {});
        }
      }
      
      // Output is usually just acknowledgment
      if (operation.responses) {
        const successResponse = operation.responses['200'] || operation.responses['201'] || operation.responses['default'];
        if (successResponse?.content) {
          const content = successResponse.content;
          const jsonContent = content['application/json'];
          if (jsonContent?.schema) {
            outputSchema = jsonSchemaToZod(jsonContent.schema, spec.components?.schemas || {});
          }
        }
      }
      
      webhooks.push({
        name: camelCaseName,
        pascalName,
        description: operation.summary || operation.description || `Webhook: ${webhookName}`,
        inputSchema: inputSchema || 'z.object({})',
        outputSchema: outputSchema || 'z.object({})',
        webhookName,
        isTrigger: true,
        isWebhook: true
      });
    }
  }
  
  return webhooks;
}

/**
 * Generate code for a webhook trigger
 */
function generateWebhookTriggerCode(options: {
  provider: string;
  webhook: any;
}): string {
  const { provider, webhook } = options;
  
  const header = `// This file is auto-generated by c4c integrate command
// Do not edit manually.

`;
  
  const imports = `import type { Procedure, Contract } from "@c4c/core";
import { z } from "zod";
`;
  
  const providerPascal = toPascalCase(provider);
  const contractName = `${providerPascal}${webhook.pascalName}Contract`;
  const procedureName = `${providerPascal}${webhook.pascalName}Procedure`;
  
  const metadata: string[] = [
    `    exposure: "external" as const,`,
    `    roles: ["workflow-node"],`,
    `    provider: "${provider}",`,
    `    operation: "${webhook.name}",`,
    `    tags: ["${provider}", "webhook"],`,
    `    type: "trigger" as const,`,
    `    trigger: {`,
    `      type: "webhook",`,
    `    },`
  ];
  
  const code = `
export const ${contractName}: Contract = {
  name: "${provider}.${toDotCase(webhook.name)}",
  description: "${webhook.description}",
  input: ${webhook.inputSchema},
  output: ${webhook.outputSchema},
  metadata: {
${metadata.join('\n')}
  },
};

// Webhook triggers don't have a handler - they are registered as event receivers
export const ${procedureName}: Procedure = {
  contract: ${contractName},
  handler: async () => {
    throw new Error('Webhook triggers should not be called directly - they are invoked by the workflow engine');
  },
};
`;
  
  return header + imports + code;
}

/**
 * Generate index file for procedures or triggers
 */
function generateIndexFile(operations: any[], provider: string, type: 'procedures' | 'triggers'): string {
  const header = `// This file is auto-generated by c4c integrate command
// Do not edit manually.

`;
  
  const providerPascal = toPascalCase(provider);
  
  const imports = operations.map(op => {
    const fileName = toDotCase(op.name).replace(/\./g, '-');
    const procedureName = `${providerPascal}${op.pascalName}Procedure`;
    return `export { ${procedureName} } from './${fileName}.gen.js';`;
  }).join('\n');
  
  const exportList = `
import type { Procedure } from "@c4c/core";
${operations.map(op => {
  const fileName = toDotCase(op.name).replace(/\./g, '-');
  const procedureName = `${providerPascal}${op.pascalName}Procedure`;
  return `import { ${procedureName} } from './${fileName}.gen.js';`;
}).join('\n')}

export const ${providerPascal}${capitalize(type)}: Procedure[] = [
${operations.map(op => `  ${providerPascal}${op.pascalName}Procedure`).join(',\n')}
];
`;
  
  return header + imports + '\n' + exportList;
}

/**
 * Generate main index file that exports all procedures and triggers
 */
function generateMainIndexFile(procedures: any[], triggers: any[], provider: string): string {
  const header = `// This file is auto-generated by c4c integrate command
// Do not edit manually.

`;
  
  const providerPascal = toPascalCase(provider);
  
  // Export individual procedures
  const procedureExports = procedures.map(op => {
    const fileName = toDotCase(op.name).replace(/\./g, '-');
    const procedureName = `${providerPascal}${op.pascalName}Procedure`;
    return `export { ${procedureName} } from './${fileName}.gen.js';`;
  }).join('\n');
  
  // Import procedures for the array
  const procedureImports = procedures.map(op => {
    const fileName = toDotCase(op.name).replace(/\./g, '-');
    const procedureName = `${providerPascal}${op.pascalName}Procedure`;
    return `import { ${procedureName} } from './${fileName}.gen.js';`;
  }).join('\n');
  
  // Create procedures array
  const proceduresArray = `
import type { Procedure } from "@c4c/core";
${procedureImports}

export const ${providerPascal}Procedures: Procedure[] = [
${procedures.map(op => `  ${providerPascal}${op.pascalName}Procedure`).join(',\n')}
];
`;
  
  // Re-export triggers
  const triggersReexport = `
// Re-export triggers
export * from './triggers/index.js';
`;
  
  return header + procedureExports + '\n' + proceduresArray + triggersReexport;
}

function generateProcedureCode(options: {
  provider: string;
  operations: Array<any>;
  sdkImportPath: string;
  schemaImportPath: string;
  useSchemas?: boolean;
  baseUrl?: string;
}): string {
  const { provider, operations, sdkImportPath, schemaImportPath, useSchemas = true, baseUrl = 'http://localhost:3000' } = options;
  
  const header = `// This file is auto-generated by c4c integrate command
// Do not edit manually.
`;
  
  // Generate environment variable name for base URL
  const envVarName = `${provider.toUpperCase().replace(/-/g, '_')}_URL`;
  
  // Build the client configuration code with correct baseUrl
  const sdkConfigCode = `// Configure SDK client with base URL from environment
const baseUrl = process.env.${envVarName} || '${baseUrl}';
sdk.client.setConfig({ baseUrl });
`;
  
  const imports = useSchemas
    ? `import { applyPolicies, type Procedure, type Contract } from "@c4c/core";
import { withOAuth, getOAuthHeaders } from "@c4c/policies";
import * as sdk from "${sdkImportPath}";
import * as schemas from "${schemaImportPath}";
import { z } from "zod";

${sdkConfigCode}`
    : `import { applyPolicies, type Procedure, type Contract } from "@c4c/core";
import { withOAuth, getOAuthHeaders } from "@c4c/policies";
import * as sdk from "${sdkImportPath}";
import { z } from "zod";

${sdkConfigCode}`;
  
  const procedures = operations.map((op) => {
    const providerPascal = toPascalCase(provider);
    const providerEnvName = provider.toUpperCase().replace(/-/g, '_');
    const contractName = `${providerPascal}${op.pascalName}Contract`;
    const handlerName = `${op.name}Handler`;
    const procedureName = `${providerPascal}${op.pascalName}Procedure`;
    
    const metadata: string[] = [
      `    exposure: "external" as const,`,
      `    roles: ["api-endpoint", "workflow-node"${op.isTrigger ? ', "trigger"' : ''}],`,
      `    provider: "${provider}",`,
      `    operation: "${op.name}",`,
      `    tags: ["${provider}"],`
    ];
    
    if (op.isTrigger && op.triggerMetadata) {
      metadata.push(`    type: "trigger" as const,`);
      metadata.push(`    trigger: {`);
      metadata.push(`      type: "${op.triggerType || 'subscription'}",`);
      if (op.triggerMetadata.stopProcedure) {
        metadata.push(`      stopProcedure: "${op.triggerMetadata.stopProcedure}",`);
        metadata.push(`      requiresChannelManagement: true,`);
      }
      metadata.push(`    },`);
    }
    
    // For @hey-api/schemas, we need to use z.unknown() when schemas are not available
    // z.unknown() is safer than z.any() and forces type checking
    const inputSchema = 'z.unknown()';
    const outputSchema = 'z.unknown()';
    
    return `
export const ${contractName}: Contract = {
  name: "${provider}.${toDotCase(op.name)}",
  description: "${op.description || op.name}",
  input: ${inputSchema},
  output: ${outputSchema},
  metadata: {
${metadata.join('\n')}
  },
};

const ${handlerName} = applyPolicies(
  async (input, context) => {
    const headers = getOAuthHeaders(context, "${provider}");
    const request: Record<string, unknown> = { ...input };
    if (headers) {
      request.headers = {
        ...((request.headers as Record<string, string> | undefined) ?? {}),
        ...headers,
      };
    }
    const result = await sdk.${op.name}(request as any);
    if (result && typeof result === "object" && "data" in result) {
      return (result as { data: unknown }).data;
    }
    return result as unknown;
  },
  withOAuth({
    provider: "${provider}",
    metadataTokenKey: "${provider}Token",
    envVar: "${providerEnvName}_TOKEN",
  })
);

export const ${procedureName}: Procedure = {
  contract: ${contractName},
  handler: ${handlerName},
};
`;
  }).join('\n');
  
  const providerPascal = toPascalCase(provider);
  const exportList = `
export const ${providerPascal}Procedures: Procedure[] = [
${operations.map((op) => `  ${providerPascal}${op.pascalName}Procedure`).join(',\n')}
];
`;
  
  return header + '\n' + imports + '\n' + procedures + '\n' + exportList;
}

function toDotCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1.$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1.$2')
    .toLowerCase();
}

/**
 * Normalize operation name for matching
 * Removes all non-alphanumeric and converts to lowercase for fuzzy matching
 */
function normalizeOperationName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

/**
 * Load OpenAPI spec from URL or file
 */
async function loadOpenAPISpec(input: string): Promise<any> {
  try {
    // Check if it's a URL
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const response = await fetch(input);
      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAPI spec: ${response.statusText}`);
      }
      return await response.json();
    }
    
    // Load from file
    const content = await fs.readFile(input, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`[c4c] Could not load OpenAPI spec for trigger analysis: ${error}`);
    return null;
  }
}

/**
 * Determine trigger kind based on heuristics (from your fork's logic)
 */
function determineTriggerKind(
  operation: any,
  path: string,
  operationId?: string,
  isWebhook = false
): TriggerMetadata['kind'] {
  // Check x-transport extension
  const transport = operation['x-transport'] || operation.extensions?.['x-transport'];
  if (transport === 'sse' || transport === 'websocket') {
    return 'stream';
  }
  
  // Check for SSE in responses
  if (operation.responses) {
    for (const response of Object.values(operation.responses)) {
      const content = (response as any).content;
      if (content && (content['text/event-stream'] || content['application/stream+json'])) {
        return 'stream';
      }
    }
  }
  
  // Explicit webhook
  if (isWebhook) {
    return 'webhook';
  }
  
  // Check operation ID and summary for trigger keywords
  const opId = operationId?.toLowerCase() || '';
  const summary = (operation.summary || '').toLowerCase();
  const description = (operation.description || '').toLowerCase();
  
  // Webhook patterns in operation ID or description
  const webhookPatterns = [
    'webhook', 'setwebhook', 'deletewebhook', 'getwebhookinfo',
    'getupdates', // Telegram's polling endpoint
  ];
  
  for (const pattern of webhookPatterns) {
    if (opId.includes(pattern) || summary.includes(pattern) || description.includes(pattern)) {
      return 'subscription';
    }
  }
  
  // Watch endpoints - must be explicit "watch" at the end or in operation name
  const hasWatchInOperation = opId.endsWith('watch') || opId.includes('watch');
  const hasWatchInPath = /\/(watch|observe)$/i.test(path); // Only at the end of path
  const hasWatchInDescription = /watch\s+(for|changes|updates|notifications)/i.test(description) ||
                                /receive\s+(notifications|updates|changes)/i.test(description);
  
  if (hasWatchInOperation || hasWatchInPath || hasWatchInDescription) {
    return 'subscription';
  }
  
  // Subscription heuristics from path and parameters
  const hasSubscribeInPath = /\/(subscribe|subscriptions|webhook)$/i.test(path); // Only at end
  const hasTopic = operation['x-topic'] || operation.extensions?.['x-topic'];
  const hasCallbackUrl = operation.parameters?.some(
    (p: any) => {
      const name = p.name?.toLowerCase() || '';
      return name === 'callbackurl' || 
             name === 'callback_url' || 
             name === 'webhookurl' || 
             name === 'webhook_url' ||
             (name === 'url' && (summary.includes('webhook') || description.includes('webhook')));
    }
  );
  
  // Push notification / channel endpoints
  const hasPushNotification = description.includes('push notification') || 
                              description.includes('receive notification') ||
                              summary.includes('push notification');
  
  if (hasSubscribeInPath || hasTopic || hasCallbackUrl || hasPushNotification) {
    return 'subscription';
  }
  
  return 'operation';
}

/**
 * Determine transport type for streams
 */
function determineTransport(operation: any): TriggerMetadata['transport'] {
  const transport = operation['x-transport'] || operation.extensions?.['x-transport'];
  if (transport) {
    return transport;
  }
  
  if (operation.responses) {
    for (const response of Object.values(operation.responses)) {
      const content = (response as any).content;
      if (content?.['text/event-stream']) {
        return 'sse';
      }
      if (content?.['application/stream+json']) {
        return 'sse';
      }
    }
  }
  
  return undefined;
}

/**
 * Generate triggers metadata file
 */
async function generateTriggersMetadata(spec: any, output: string): Promise<void> {
  if (!spec || !spec.paths) {
    console.warn('[c4c] No OpenAPI spec available for trigger analysis');
    return;
  }
  
  // Map from normalized name to trigger metadata
  const triggers: Record<string, TriggerMetadata> = {};
  const normalizedMap: Record<string, string> = {}; // normalized -> original operationId
  
  // Process regular operations from paths
  for (const [pathStr, pathItem] of Object.entries(spec.paths || {})) {
    const pathObj = pathItem as any;
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];
    
    for (const method of methods) {
      const operation = pathObj[method];
      if (!operation) continue;
      
      const operationId = operation.operationId || `${method}_${pathStr.replace(/\W/g, '_')}`;
      const kind = determineTriggerKind(operation, pathStr, operationId);
      
      const metadata: TriggerMetadata = {
        kind,
      };
      
      if (kind === 'stream') {
        metadata.transport = determineTransport(operation);
      }
      
      // Store with normalized key for fuzzy matching
      const normalizedKey = normalizeOperationName(operationId);
      normalizedMap[normalizedKey] = operationId;
      triggers[normalizedKey] = metadata;
    }
  }
  
  // Process webhooks
  if (spec.webhooks) {
    for (const [name, webhookItem] of Object.entries(spec.webhooks)) {
      const webhookObj = webhookItem as any;
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];
      
      for (const method of methods) {
        const operation = webhookObj[method];
        if (!operation) continue;
        
        const operationId = operation.operationId || `webhook_${name}_${method}`;
        const normalizedKey = normalizeOperationName(operationId);
        normalizedMap[normalizedKey] = operationId;
        triggers[normalizedKey] = {
          kind: 'webhook',
        };
      }
    }
  }
  
  // Generate triggers.gen.ts with both normalized and display names
  const triggersCode = `// This file is auto-generated by @c4c/generators
// Trigger metadata extracted from OpenAPI specification

export const triggerMetadata = ${JSON.stringify(triggers, null, 2)} as const;

export const triggerOperationNames = ${JSON.stringify(normalizedMap, null, 2)} as const;

export type TriggerKind = 'operation' | 'webhook' | 'callback' | 'subscription' | 'stream';

export interface TriggerMetadata {
  kind: TriggerKind;
  transport?: 'sse' | 'websocket' | 'http';
  subscriptionRegister?: string;
  subscriptionCallback?: string;
}

// Helper to get trigger metadata by operation name (normalized)
export function getTriggerMetadata(operationName: string): TriggerMetadata | undefined {
  const normalized = operationName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return triggerMetadata[normalized as keyof typeof triggerMetadata];
}

// Get all triggers of a specific kind
export function getTriggersByKind(kind: TriggerKind): string[] {
  return Object.entries(triggerMetadata)
    .filter(([_, meta]) => meta.kind === kind)
    .map(([id]) => triggerOperationNames[id as keyof typeof triggerOperationNames] || id);
}
`;
  
  await fs.writeFile(path.join(output, 'triggers.gen.ts'), triggersCode, 'utf-8');
  console.log('[c4c] Generated triggers metadata at triggers.gen.ts');
}
