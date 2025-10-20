/**
 * Registry client for c4c integrations and workflows
 * Works like shadcn/ui - fetches from online registry and copies to project
 */

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";

const DEFAULT_REGISTRY_URL = "https://raw.githubusercontent.com/c4c/registry/main/integrations.json";

export interface Integration {
	name: string;
	description: string;
	provider: string;
	category: string;
	openapi: string;
	procedures?: string[];
	workflows?: string[];
	tags?: string[];
	authentication?: string;
	documentation?: string;
}

export interface Workflow {
	name: string;
	description: string;
	category: string;
	dependencies?: string[];
	tags?: string[];
	files: string[];
}

export interface Registry {
	version: string;
	integrations: Record<string, Integration>;
	workflows: Record<string, Workflow>;
}

/**
 * Fetch registry from URL or use local fallback
 */
export async function fetchRegistry(registryUrl?: string): Promise<Registry> {
	const url = registryUrl ?? DEFAULT_REGISTRY_URL;
	
	try {
		// Try to fetch from remote
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch registry: ${response.statusText}`);
		}
		return await response.json();
	} catch (error) {
		// Fallback to local registry
		console.warn(`[c4c] Failed to fetch remote registry, using local fallback`);
		return getLocalRegistry();
	}
}

/**
 * Get local registry (bundled with CLI)
 */
async function getLocalRegistry(): Promise<Registry> {
	const registryPath = new URL("../../../registry/integrations.json", import.meta.url);
	const content = await fs.readFile(registryPath, "utf-8");
	return JSON.parse(content);
}

/**
 * Download OpenAPI spec from URL
 */
export async function downloadOpenAPISpec(url: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download OpenAPI spec: ${response.statusText}`);
	}
	
	const contentType = response.headers.get("content-type");
	const text = await response.text();
	
	// If it's YAML, we'll need to convert to JSON or handle it directly
	// For now, we'll just return the text
	return text;
}

/**
 * Generate integration files from OpenAPI spec
 */
export async function generateIntegrationFiles(
	integration: Integration,
	projectRoot: string,
	options: { force?: boolean } = {}
): Promise<void> {
	const integrationDir = join(projectRoot, "src", "integrations", integration.provider);
	
	// Check if already exists
	try {
		await fs.access(integrationDir);
		if (!options.force) {
			throw new Error(
				`Integration '${integration.provider}' already exists. Use --force to overwrite.`
			);
		}
	} catch (error) {
		// Directory doesn't exist, that's fine
	}
	
	// Create directory
	await fs.mkdir(integrationDir, { recursive: true });
	
	console.log(`[c4c] Downloading OpenAPI spec from ${integration.openapi}...`);
	const openapiSpec = await downloadOpenAPISpec(integration.openapi);
	
	// Save OpenAPI spec
	const openapiPath = join(integrationDir, "openapi.json");
	await fs.writeFile(openapiPath, openapiSpec, "utf-8");
	
	console.log(`[c4c] Saved OpenAPI spec to ${openapiPath}`);
	console.log(`[c4c] Next steps:`);
	console.log(`  1. Run: openapi-typescript ${openapiPath} -o ${integrationDir}/generated/types.ts`);
	console.log(`  2. Generate contracts using your existing scripts`);
	console.log(`  3. Import procedures in your handlers`);
}

/**
 * Copy workflow files from registry
 */
export async function copyWorkflowFiles(
	workflow: Workflow,
	workflowId: string,
	projectRoot: string,
	options: { force?: boolean } = {}
): Promise<void> {
	const workflowsDir = join(projectRoot, "workflows");
	
	// Create workflows directory
	await fs.mkdir(workflowsDir, { recursive: true });
	
	// Copy each workflow file
	for (const file of workflow.files) {
		const targetPath = join(workflowsDir, file);
		
		// Check if exists
		try {
			await fs.access(targetPath);
			if (!options.force) {
				console.warn(`[c4c] File ${file} already exists, skipping. Use --force to overwrite.`);
				continue;
			}
		} catch {
			// File doesn't exist, that's fine
		}
		
		// Download workflow template from registry
		const templateUrl = `https://raw.githubusercontent.com/c4c/registry/main/workflows/${file}`;
		
		try {
			const response = await fetch(templateUrl);
			if (!response.ok) {
				throw new Error(`Failed to download workflow template: ${response.statusText}`);
			}
			
			const content = await response.text();
			
			// Create directory if needed
			await fs.mkdir(dirname(targetPath), { recursive: true });
			
			// Write file
			await fs.writeFile(targetPath, content, "utf-8");
			console.log(`[c4c] ✓ Created ${file}`);
		} catch (error) {
			console.error(`[c4c] Failed to download ${file}:`, error);
		}
	}
	
	console.log(`[c4c] Workflow '${workflowId}' added successfully!`);
	
	if (workflow.dependencies && workflow.dependencies.length > 0) {
		console.log(`[c4c] Required integrations: ${workflow.dependencies.join(", ")}`);
		console.log(`[c4c] Add them with: c4c add ${workflow.dependencies[0]}`);
	}
}

/**
 * List available integrations
 */
export async function listIntegrations(registryUrl?: string): Promise<void> {
	const registry = await fetchRegistry(registryUrl);
	
	console.log("\n📦 Available Integrations:\n");
	
	const categories = new Map<string, Integration[]>();
	
	for (const [id, integration] of Object.entries(registry.integrations)) {
		if (!categories.has(integration.category)) {
			categories.set(integration.category, []);
		}
		categories.get(integration.category)?.push(integration);
	}
	
	for (const [category, integrations] of categories) {
		console.log(`\n  ${category.toUpperCase()}`);
		for (const integration of integrations) {
			const id = Object.entries(registry.integrations).find(([_, v]) => v === integration)?.[0];
			console.log(`    ${id?.padEnd(20)} - ${integration.name}`);
		}
	}
	
	console.log("\n📝 Available Workflows:\n");
	
	for (const [id, workflow] of Object.entries(registry.workflows)) {
		console.log(`    ${id.padEnd(20)} - ${workflow.name}`);
	}
	
	console.log("\nUsage:");
	console.log("  c4c add google-drive");
	console.log("  c4c add workflow:etl-pipeline");
	console.log("");
}
