#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(SCRIPT_DIR, "..");
const WORKSPACE_ROOT = path.resolve(PACKAGE_ROOT, "..", "..");
const GENERATED_ROOT = path.resolve(PACKAGE_ROOT, "generated");
const OUTPUT_ROOT = path.resolve(PACKAGE_ROOT, "src");

async function main() {
	const targets = await discoverTargets(GENERATED_ROOT);
	if (targets.length === 0) {
		console.warn("No generated integrations found under", GENERATED_ROOT);
		return;
	}

	const generatedModules = [];

	for (const target of targets) {
		const modulePath = await processTarget(target);
		if (modulePath) {
			generatedModules.push(modulePath);
		}
	}

	if (generatedModules.length > 0) {
		await writeHandlersIndex(generatedModules);
	}
}

/**
 * Recursively find directories that contain an OpenAPI-generated SDK.
 */
async function discoverTargets(root) {
	const entries = await fs.readdir(root, { withFileTypes: true });
	const targets = [];

	for (const entry of entries) {
		const fullPath = path.join(root, entry.name);
		if (entry.isDirectory()) {
			const sdkPath = path.join(fullPath, "sdk.gen.ts");
			const zodPath = path.join(fullPath, "zod.gen.ts");

			const [sdkExists, zodExists] = await Promise.all([
				fileExists(sdkPath),
				fileExists(zodPath),
			]);

			if (sdkExists && zodExists) {
				const relative = path.relative(GENERATED_ROOT, fullPath);
				targets.push({
					path: fullPath,
					relative,
					sdkPath,
					zodPath,
				});
				continue;
			}

			const nested = await discoverTargets(fullPath);
			targets.push(...nested);
		}
	}

	return targets;
}

async function processTarget(target) {
	const { sdkPath, zodPath, relative } = target;
	const sdkSource = await fs.readFile(sdkPath, "utf8");
	const zodSource = await fs.readFile(zodPath, "utf8");

	const operations = extractOperations(sdkSource, sdkPath);
	if (operations.length === 0) {
		console.warn(`Skipping ${relative}: no exported operations found.`);
		return;
	}

	const zodExports = extractZodExports(zodSource);

	const providerParts = relative.split(path.sep);
	const provider = providerParts[0];
	const serviceParts = providerParts.slice(1);

	const pascalPrefix = capitalize(provider) + serviceParts.map(capitalize).join("");
	const providerId = provider + serviceParts.map(capitalize).join("");
	const envVar = [provider, ...serviceParts]
		.map((part) => part.replace(/[^a-zA-Z0-9]/g, ""))
		.join("_")
		.toUpperCase()
		.concat("_TOKEN");
	const metadataTokenKey = `${providerId}Token`;

	const resolvedOperations = operations
		.map((operation) => {
			const pascalName = capitalize(operation.name);
			const dataKey = `z${pascalName}Data`;
			const responseKey = `z${pascalName}Response`;

			if (!zodExports.has(dataKey) || !zodExports.has(responseKey)) {
				return null;
			}

			return {
				...operation,
				pascalName,
				dataKey,
				responseKey,
			};
		})
		.filter(Boolean);

	if (resolvedOperations.length === 0) {
		console.warn(`Skipping ${relative}: no matching Zod schemas found for SDK exports.`);
		return;
	}

	const outputDir = path.join(OUTPUT_ROOT, relative);
	await fs.mkdir(outputDir, { recursive: true });

	const outputPath = path.join(outputDir, "procedures.gen.ts");
	const importPathSdk = normalizeImportPath(outputDir, sdkPath);
	const importPathZod = normalizeImportPath(outputDir, zodPath);

	const fileContent = renderFile({
		pascalPrefix,
		providerId,
		envVar,
		metadataTokenKey,
		provider,
		serviceParts,
		importPathSdk,
		importPathZod,
		operations: resolvedOperations,
	});

	await fs.writeFile(outputPath, fileContent, "utf8");
	console.log(`Generated procedures for ${relative} → ${path.relative(WORKSPACE_ROOT, outputPath)}`);

	return path.relative(OUTPUT_ROOT, outputPath);
}

function extractOperations(source, fileName) {
	const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
	const operations = [];

	sourceFile.forEachChild((node) => {
		if (
			ts.isVariableStatement(node) &&
			node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
		) {
			for (const declaration of node.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name)) {
					const name = declaration.name.text;
					const description = readJsDoc(node, sourceFile);
					operations.push({ name, description });
				}
			}
		}
	});

	return operations;
}

function extractZodExports(source) {
	const sourceFile = ts.createSourceFile("zod.gen.ts", source, ts.ScriptTarget.Latest, true);
	const exports = new Set();

	sourceFile.forEachChild((node) => {
		if (
			ts.isVariableStatement(node) &&
			node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
		) {
			for (const declaration of node.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name)) {
					exports.add(declaration.name.text);
				}
			}
		}
	});

	return exports;
}

function readJsDoc(node, sourceFile) {
	const jsDocNodes = ts.getJSDocCommentsAndTags(node);
	if (!jsDocNodes || jsDocNodes.length === 0) {
		return null;
	}

	const docNode = jsDocNodes.find((doc) => ts.isJSDoc(doc));
	if (!docNode) {
		return null;
	}

	const { comment } = docNode;
	if (!comment) {
		return null;
	}

	if (typeof comment === "string") {
		return comment.trim();
	}

	// Handle structured JSDoc comments
	return comment
		.map((part) => ("text" in part ? part.text : ""))
		.join("")
		.trim();
}

function normalizeImportPath(fromDir, targetFile) {
	const relative = path.relative(fromDir, targetFile);
	return ensurePosix(relative).replace(/\.ts$/u, ".js");
}

function ensurePosix(p) {
	return p.split(path.sep).join("/");
}

function capitalize(value) {
	if (!value) return "";
	return value[0].toUpperCase() + value.slice(1);
}

function toDotCase(value) {
	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1.$2")
		.replace(/([A-Z])([A-Z][a-z])/g, "$1.$2")
		.toLowerCase();
}

function escapeString(value) {
	return JSON.stringify(value);
}

function renderFile({
	pascalPrefix,
	providerId,
	envVar,
	metadataTokenKey,
	provider,
	serviceParts,
	importPathSdk,
	importPathZod,
	operations,
}) {
	const header = `// This file is auto-generated by scripts/generate-contracts.mjs\n// Do not edit manually.\n`;

	const imports = [
		`import { applyPolicies, type Procedure, type Contract } from "@tsdev/core";`,
		`import { withOAuth, getOAuthHeaders } from "@tsdev/policies";`,
		`import * as sdk from "${importPathSdk}";`,
		`import * as zod from "${importPathZod}";`,
	].join("\n");

	const body = operations
		.map((operation) => {
			const contractName = `${pascalPrefix}${operation.pascalName}Contract`;
			const handlerName = `${operation.name}Handler`;
			const procedureName = `${pascalPrefix}${operation.pascalName}Procedure`;
			const tagsArray = `[${[provider, ...serviceParts]
				.map((tag) => escapeString(tag))
				.join(", ")}]`;

			const description = operation.description
				? escapeString(operation.description)
				: escapeString(operation.name);

			const contract = [
				`export const ${contractName}: Contract = {`,
				`  name: ${escapeString(
					`${providerId}.${toDotCase(operation.name)}`
				)},`,
				`  description: ${description},`,
				`  input: zod.${operation.dataKey},`,
				`  output: zod.${operation.responseKey},`,
				`  metadata: {`,
				`    exposure: "internal",`,
				`    roles: ["workflow-node"],`,
				`    provider: ${escapeString(providerId)},`,
				`    operation: ${escapeString(operation.name)},`,
				`    tags: ${tagsArray},`,
				`  },`,
				`};`,
			].join("\n");

			const handler = [
				`const ${handlerName} = applyPolicies(`,
				`  async (input, context) => {`,
				`    const headers = getOAuthHeaders(context, ${escapeString(providerId)});`,
				`    const request: Record<string, unknown> = { ...input };`,
				`    if (headers) {`,
				`      request.headers = {`,
				`        ...((request.headers as Record<string, string> | undefined) ?? {}),`,
				`        ...headers,`,
				`      };`,
				`    }`,
				`    const result = await sdk.${operation.name}(request as any);`,
				`    if (result && typeof result === "object" && "data" in result) {`,
				`      return (result as { data: unknown }).data;`,
				`    }`,
				`    return result as unknown;`,
				`  },`,
				`  withOAuth({`,
				`    provider: ${escapeString(providerId)},`,
				`    metadataTokenKey: ${escapeString(metadataTokenKey)},`,
				`    envVar: ${escapeString(envVar)},`,
				`  })`,
				`);`,
			].join("\n");

			const procedure = [
				`export const ${procedureName}: Procedure = {`,
				`  contract: ${contractName},`,
				`  handler: ${handlerName},`,
				`};`,
			].join("\n");

			return [contract, handler, procedure].join("\n\n");
		})
		.join("\n\n");

	const collectionName = `${pascalPrefix}Procedures`;
	const exports = `export const ${collectionName}: Procedure[] = [\n${operations
		.map((operation) => `  ${pascalPrefix}${operation.pascalName}Procedure`)
		.join(",\n")}\n];`;

	return [header, imports, "", body, "", exports, ""].join("\n");
}

async function writeHandlersIndex(modules) {
	const handlersDir = path.join(OUTPUT_ROOT, "handlers");
	await fs.mkdir(handlersDir, { recursive: true });

	const exports = modules
		.sort()
		.map((modulePath) => {
			const absoluteModulePath = path.join(OUTPUT_ROOT, modulePath);
			const relativePath = path.relative(handlersDir, absoluteModulePath);
			return `export * from "${ensurePosix(relativePath).replace(/\.ts$/u, ".js")}";`;
		})
		.join("\n");

	const contents = `// Auto-generated by scripts/generate-contracts.mjs\n// Re-exports all generated procedures for registry discovery.\n${exports}\n`;
	const outputPath = path.join(handlersDir, "generated.ts");
	await fs.writeFile(outputPath, contents, "utf8");
	console.log(`Updated handler bridge → ${path.relative(WORKSPACE_ROOT, outputPath)}`);
}

async function fileExists(p) {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
