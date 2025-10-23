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
}): Promise<void> {
  const { generatedDir, outputDir, provider, baseUrl = 'http://localhost:3000' } = options;
  
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
      
      return {
        ...op,
        pascalName,
        dataKey,
        responseKey,
        hasValidSchemas,
        isTrigger,
        triggerKind: triggerInfo?.kind,
        triggerTransport: triggerInfo?.transport,
        triggerMetadata: triggerInfo
      };
    })
    .filter((op): op is NonNullable<typeof op> => op !== null && (op as any).hasValidSchemas);
  
  // Generate procedure file
  await fs.mkdir(outputDir, { recursive: true });
  const procedureCode = generateProcedureCode({
    provider,
    operations: resolvedOperations as any[],
    sdkImportPath: path.relative(outputDir, sdkPath).replace(/\.ts$/, '.js'),
    schemaImportPath: path.relative(outputDir, schemaPath).replace(/\.ts$/, '.js'),
    useSchemas: hasSchemas
  });
  
  const outputPath = path.join(outputDir, 'procedures.gen.ts');
  await fs.writeFile(outputPath, procedureCode, 'utf8');
  
  console.log(`[c4c] Generated procedures at ${outputPath}`);
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
    
    // For @hey-api/schemas, we need to wrap JSON schemas in z.any() for now
    // In the future, we could convert JSON schemas to Zod or use json-schema-to-zod
    const inputSchema = 'z.any()';
    const outputSchema = 'z.any()';
    
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
