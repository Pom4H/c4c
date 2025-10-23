/**
 * @c4c/generators - Trigger generator using @hey-api/openapi-ts
 * 
 * Generates trigger definitions from OpenAPI specifications
 */

import { createClient } from '@hey-api/openapi-ts';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  
  console.log(`[c4c] Generated triggers for ${integrationName} at ${output}`);
}

/**
 * Generate procedures from triggers (similar to generate-integrations.mjs)
 */
export async function generateProceduresFromTriggers(options: {
  generatedDir: string;
  outputDir: string;
  provider: string;
}): Promise<void> {
  const { generatedDir, outputDir, provider } = options;
  
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
  
  // Use schemas if available, otherwise fall back to types
  const schemaPath = schemasExists ? schemasPath : typesPath;
  const hasSchemas = schemasExists;
  
  // If triggers.gen.ts exists, we can use enhanced trigger metadata
  const hasEnhancedTriggers = triggersExists;
  
  // Read the generated files
  const sdkSource = await fs.readFile(sdkPath, 'utf8');
  const schemaSource = await fs.readFile(schemaPath, 'utf8');
  
  let triggersData: any[] = [];
  if (hasEnhancedTriggers) {
    try {
      const triggersSource = await fs.readFile(triggersPath, 'utf8');
      triggersData = await parseTriggers(triggersSource);
    } catch (error) {
      console.warn('Failed to parse triggers.gen.ts, using fallback detection');
    }
  }
  
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
      
      // Check if this operation is a trigger
      const triggerInfo = triggersData.find((t) => t.operationId === op.name);
      
      return {
        ...op,
        pascalName,
        dataKey,
        responseKey,
        hasValidSchemas,
        isTrigger: !!triggerInfo,
        triggerType: triggerInfo?.type,
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

function extractOperationsFromSdk(source: string): Array<{ name: string; description?: string }> {
  // Extract function exports with JSDoc comments
  const functionPattern = /\/\*\*\n([^*]|\*(?!\/))*\*\/\s*export\s+const\s+([a-zA-Z0-9_]+)\s*=/gs;
  const operations: Array<{ name: string; description?: string }> = [];
  
  let match: RegExpExecArray | null;
  while ((match = functionPattern.exec(source)) !== null) {
    const comment = match[0];
    const name = match[2];
    
    if (name && name !== 'client') {
      // Extract description from JSDoc
      const descMatch = comment.match(/\/\*\*\s*\n\s*\*\s*([^\n]+)/);
      const description = descMatch?.[1]?.trim();
      
      operations.push({ name, description });
    }
  }
  
  return operations;
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

async function parseTriggers(source: string): Promise<any[]> {
  // Parse triggers from triggers.gen.ts
  // This is a simplified parser - in production you'd use TypeScript AST
  const triggers: any[] = [];
  
  // Look for trigger definitions
  const triggerPattern = /export\s+const\s+([a-zA-Z0-9_]+)Trigger\s*=\s*{([^}]+)}/gs;
  
  let match: RegExpExecArray | null;
  while ((match = triggerPattern.exec(source)) !== null) {
    const name = match[1];
    const body = match[2];
    
    if (name && body) {
      triggers.push({
        operationId: name,
        type: extractField(body, 'type') || 'subscription',
        stopProcedure: extractField(body, 'stopProcedure')
      });
    }
  }
  
  return triggers;
}

function extractField(source: string, fieldName: string): string | undefined {
  const pattern = new RegExp(`${fieldName}\\s*:\\s*['"](.*?)['"]`);
  const match = pattern.exec(source);
  return match?.[1];
}

function generateProcedureCode(options: {
  provider: string;
  operations: Array<any>;
  sdkImportPath: string;
  schemaImportPath: string;
  useSchemas?: boolean;
}): string {
  const { provider, operations, sdkImportPath, schemaImportPath, useSchemas = true } = options;
  
  const header = `// This file is auto-generated by c4c integrate command
// Do not edit manually.
`;
  
  const imports = useSchemas
    ? `import { applyPolicies, type Procedure, type Contract } from "@c4c/core";
import { withOAuth, getOAuthHeaders } from "@c4c/policies";
import * as sdk from "${sdkImportPath}";
import * as schemas from "${schemaImportPath}";
import { z } from "zod";
`
    : `import { applyPolicies, type Procedure, type Contract } from "@c4c/core";
import { withOAuth, getOAuthHeaders } from "@c4c/policies";
import * as sdk from "${sdkImportPath}";
import { z } from "zod";
`;
  
  const procedures = operations.map((op) => {
    const contractName = `${capitalize(provider)}${op.pascalName}Contract`;
    const handlerName = `${op.name}Handler`;
    const procedureName = `${capitalize(provider)}${op.pascalName}Procedure`;
    
    const metadata: string[] = [
      `    exposure: "internal" as const,`,
      `    roles: ["workflow-node"${op.isTrigger ? ', "trigger"' : ''}],`,
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
    envVar: "${provider.toUpperCase()}_TOKEN",
  })
);

export const ${procedureName}: Procedure = {
  contract: ${contractName},
  handler: ${handlerName},
};
`;
  }).join('\n');
  
  const exportList = `
export const ${capitalize(provider)}Procedures: Procedure[] = [
${operations.map((op) => `  ${capitalize(provider)}${op.pascalName}Procedure`).join(',\n')}
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
