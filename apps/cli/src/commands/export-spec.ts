/**
 * Export OpenAPI specification from c4c procedures
 * 
 * Generates OpenAPI spec from registry, including webhooks for triggers
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { collectRegistry } from '@c4c/core';
import { generateOpenAPISpec } from '@c4c/generators';

export interface ExportSpecOptions {
  output?: string;
  format?: 'json' | 'yaml';
  root?: string;
  title?: string;
  version?: string;
  description?: string;
  serverUrl?: string;
  includeWebhooks?: boolean;
  includeTriggers?: boolean;
}

export async function exportSpecCommand(options: ExportSpecOptions = {}): Promise<void> {
  const {
    output = './openapi.json',
    format = 'json',
    root = process.cwd(),
    title,
    version = '1.0.0',
    description,
    serverUrl,
    includeWebhooks = true,
    includeTriggers = true,
  } = options;

  console.log('🎯 Exporting OpenAPI specification...\n');
  console.log(`Root: ${root}`);

  // 1. Find all procedure files
  const procedureDirs = [
    path.join(root, 'procedures'),
    path.join(root, 'procedures/integrations'),
    path.join(root, 'src/procedures'),
  ];

  // 2. Collect registry from procedures
  console.log('📂 Scanning for procedures...');
  
  const registry = await collectRegistry(root);
  
  const procedures = Array.from(registry.values());
  const procedureCount = procedures.length;
  const triggerCount = procedures.filter(p => 
    p.contract.metadata?.type === 'trigger' || 
    p.contract.metadata?.roles?.includes('trigger')
  ).length;

  if (procedureCount === 0) {
    console.log('\n❌ No procedures found!');
    console.log('\nMake sure you have procedures in:');
    console.log(`  - ${root}/procedures/`);
    console.log(`  - ${root}/src/procedures/`);
    process.exit(1);
  }

  console.log(`\n📊 Found ${procedureCount} procedure(s)`);
  if (triggerCount > 0) {
    console.log(`   Including ${triggerCount} trigger(s)`);
  }
  
  for (const [name, proc] of registry.entries()) {
    const isTrigger = proc.contract.metadata?.type === 'trigger' || 
                     proc.contract.metadata?.roles?.includes('trigger');
    console.log(`  ✓ ${name}${isTrigger ? ' (trigger)' : ''}`);
  }

  // 3. Generate OpenAPI spec
  const servers = serverUrl ? [{ url: serverUrl }] : undefined;
  
  const spec = generateOpenAPISpec(registry, {
    title: title || path.basename(root) + ' API',
    version,
    description: description || `API specification for ${path.basename(root)}`,
    servers,
    includeWebhooks,
    includeTriggers,
  });

  // 4. Write output file
  const outputPath = path.isAbsolute(output) ? output : path.join(root, output);
  const outputDir = path.dirname(outputPath);
  
  await fs.mkdir(outputDir, { recursive: true });
  
  const content = format === 'yaml' 
    ? JSON.stringify(spec, null, 2) // TODO: Implement YAML serialization
    : JSON.stringify(spec, null, 2);
  
  await fs.writeFile(outputPath, content, 'utf-8');

  console.log(`\n✅ OpenAPI specification exported!`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Format: ${format}`);
  
  if (spec.paths) {
    const pathCount = Object.keys(spec.paths).length;
    console.log(`   Paths: ${pathCount}`);
  }
  
  if (spec.webhooks) {
    const webhookCount = Object.keys(spec.webhooks).length;
    console.log(`   Webhooks: ${webhookCount}`);
  }

  console.log('\n💡 Next steps:');
  console.log(`   1. Share this spec with other c4c applications`);
  console.log(`   2. Use it for integration: c4c integrate ${outputPath}`);
  console.log(`   3. View in Swagger UI: https://editor.swagger.io/`);
}

// Helper: Find all procedure files recursively
async function findProcedureFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subFiles = await findProcedureFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && /\.(ts|js|mjs)$/.test(entry.name)) {
        // Include TypeScript and JavaScript files
        if (!entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // Directory doesn't exist or not accessible
  }
  
  return files;
}

// Helper: Check if value is a Procedure
function isProcedure(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'contract' in value &&
    'handler' in value &&
    typeof (value as any).handler === 'function'
  );
}
