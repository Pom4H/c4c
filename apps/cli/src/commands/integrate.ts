import { resolve } from "node:path";
import { generateTriggers, generateProceduresFromTriggers } from "@c4c/generators";
import path from "node:path";

interface IntegrateCommandOptions {
    root?: string;
    name?: string;
    output?: string;
}

/**
 * Integrate an external API by generating triggers and procedures from OpenAPI spec
 */
export async function integrateCommand(
    url: string,
    options: IntegrateCommandOptions
): Promise<void> {
    const rootDir = resolve(options.root ?? process.cwd());
    
    // Extract integration name from URL if not provided
    const integrationName = options.name || extractIntegrationName(url);
    
    // Extract base URL from OpenAPI spec URL  
    let baseUrl = 'http://localhost:3000';
    try {
        const urlObj = new URL(url);
        baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    } catch {
        // Keep default
    }
    
    console.log(`[c4c] Integrating ${integrationName} from ${url}`);
    console.log(`[c4c] Base URL: ${baseUrl}`);
    
    // Determine output directory - for cross-integration, use generated/ in root
    const outputBase = options.output
        ? resolve(options.output)
        : resolve(rootDir, 'generated', integrationName);
    
    try {
        // Step 1: Generate SDK and schemas using @hey-api/openapi-ts
        console.log(`[c4c] Generating SDK and schemas...`);
        await generateTriggers({
            input: url,
            output: outputBase,
            name: integrationName
        });
        
        // Step 2: Generate procedures from the generated files
        console.log(`[c4c] Generating procedures...`);
        // Generate procedures in procedures/integrations/ so they're auto-discovered
        const proceduresOutput = resolve(rootDir, 'procedures', 'integrations', integrationName);
        
        // Load OpenAPI spec for schema extraction
        const fs = await import('node:fs/promises');
        const openApiSpecPath = path.join(outputBase, 'openapi.json');
        let openApiSpec = null;
        try {
            const specContent = await fs.readFile(openApiSpecPath, 'utf-8');
            openApiSpec = JSON.parse(specContent);
        } catch {
            console.warn('[c4c] Could not load OpenAPI spec for schema extraction');
        }
        
        await generateProceduresFromTriggers({
            generatedDir: outputBase,
            outputDir: proceduresOutput,
            provider: integrationName,
            baseUrl: baseUrl,
            openApiSpec: openApiSpec
        });
        
        console.log(`[c4c] ✓ Successfully integrated ${integrationName}`);
        console.log(`[c4c]   Generated files:`);
        console.log(`[c4c]   - SDK: ${outputBase}/sdk.gen.ts`);
        console.log(`[c4c]   - Schemas: ${outputBase}/schemas.gen.ts`);
        console.log(`[c4c]   - Types: ${outputBase}/types.gen.ts`);
        console.log(`[c4c]   - Procedures: ${proceduresOutput}/`);
        console.log();
        console.log(`[c4c] Next steps:`);
        console.log(`[c4c]   1. Procedures are auto-discovered and prefixed with '${integrationName}.'`);
        console.log(`[c4c]   2. Use in workflows: ${integrationName}.<procedure-name>`);
        console.log(`[c4c]   3. Or import SDK: import { client } from './generated/${integrationName}/sdk.gen.js'`);
        
    } catch (error) {
        console.error(`[c4c] Failed to integrate ${integrationName}:`, error);
        throw error;
    }
}

/**
 * Extract integration name from OpenAPI spec URL
 */
function extractIntegrationName(url: string): string {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        
        // Common patterns:
        // - /v2/specs/telegram.org/5.0.0/openapi.json -> telegram
        // - /openapi/github.json -> github
        // - /api/swagger.json -> use hostname
        
        // Look for domain-like parts before version numbers or file extensions
        for (let i = pathParts.length - 1; i >= 0; i--) {
            const part = pathParts[i];
            if (!part) continue;
            
            // Skip file extensions and version numbers
            if (part.match(/\.(json|yaml|yml)$/i)) continue;
            if (part.match(/^v?\d+(\.\d+)*$/)) continue;
            if (part.match(/^(openapi|swagger|api|specs?)$/i)) continue;
            
            // Extract name from domain
            if (part.includes('.')) {
                const domainParts = part.split('.');
                return sanitizeName(domainParts[0] || 'integration');
            }
            
            return sanitizeName(part);
        }
        
        // Fallback to hostname
        const hostname = urlObj.hostname.split('.')[0];
        return sanitizeName(hostname || 'integration');
        
    } catch {
        // If not a URL, extract from file path
        const basename = path.basename(url);
        const nameWithoutExt = basename.replace(/\.(json|yaml|yml)$/i, '');
        return sanitizeName(nameWithoutExt);
    }
}

/**
 * Sanitize name to be a valid identifier
 */
function sanitizeName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-') || 'integration';
}

function capitalize(str: string): string {
    if (!str) return '';
    return str[0].toUpperCase() + str.slice(1);
}
