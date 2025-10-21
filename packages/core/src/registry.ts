import { readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { AuthRequirements, Procedure, ProcedureRole, Registry } from "./types.js";

let tsLoaderReady: Promise<void> | null = null;
const COLOR_RESET = "\u001B[0m";
const COLOR_DIM = "\u001B[90m";
const ROLE_COLOR: Record<ProcedureRole, string> = {
	"workflow-node": "\u001B[36m", // cyan
	"api-endpoint": "\u001B[35m", // magenta
	"sdk-client": "\u001B[33m", // yellow
};

const COLOR_ENABLED = () => Boolean(process.stdout?.isTTY && !process.env.NO_COLOR);

export type RegistryModuleIndex = Map<string, Set<string>>;

export interface RegistryLoadResult {
	registry: Registry;
	moduleIndex: RegistryModuleIndex;
}

async function ensureTypeScriptLoader() {
	if (!tsLoaderReady) {
		tsLoaderReady = (async () => {
			try {
				const moduleId = "tsx/esm/api";
				const dynamicImport = new Function(
					"specifier",
					"return import(specifier);"
				) as (specifier: string) => Promise<{ register?: () => void }>;
				const { register } = await dynamicImport(moduleId).catch(() => ({ register: undefined }));
				if (typeof register === "function") {
					register();
				}
			} catch (error) {
				console.warn(
					"[Registry] Unable to register TypeScript loader. Only JavaScript procedures will be loaded.",
					error
				);
			}
		})();
	}
	return tsLoaderReady;
}

/**
 * Collects all procedures from procedures directory
 * This implements the "zero boilerplate, maximum reflection" principle
 */
export async function collectRegistry(proceduresPath = "src/procedures"): Promise<Registry> {
	const { registry } = await collectRegistryDetailed(proceduresPath);
	return registry;
}

export async function collectRegistryDetailed(proceduresPath = "src/procedures"): Promise<RegistryLoadResult> {
	const registry: Registry = new Map();
	const moduleIndex: RegistryModuleIndex = new Map();
	const absoluteRoot = resolve(proceduresPath);
	const procedureFiles = await findProcedureFiles(absoluteRoot);

	for (const file of procedureFiles) {
		try {
			const procedures = await loadProceduresFromModule(file);
			const names = new Set<string>();

			for (const [procedureName, procedure] of procedures) {
				registry.set(procedureName, procedure);
				names.add(procedureName);
				logProcedureEvent("Registered", procedureName, procedure, absoluteRoot, file);
			}

			moduleIndex.set(file, names);
		} catch (error) {
			console.error(`[Registry] Failed to load procedure from ${file}:`, error);
		}
	}

	return { registry, moduleIndex };
}

export async function loadProceduresFromModule(
	modulePath: string,
	options: { versionHint?: string } = {}
): Promise<Map<string, Procedure>> {
	if (modulePath.endsWith(".ts") || modulePath.endsWith(".tsx")) {
		await ensureTypeScriptLoader();
	}

	const specifier = buildModuleSpecifier(modulePath, options.versionHint);
	const imported = await import(specifier);
	const procedures = new Map<string, Procedure>();

	for (const [exportName, exportValue] of Object.entries(imported)) {
		if (isProcedure(exportValue)) {
			const procedureName = exportValue.contract.name || exportName;
			procedures.set(procedureName, exportValue as Procedure);
		}
	}

	return procedures;
}

const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const IGNORED_DIRECTORIES = new Set(["node_modules", ".git", "dist", "build"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.[^.]+$/i;

export function isSupportedHandlerFile(filePath: string): boolean {
	if (filePath.endsWith(".d.ts")) return false;
	if (TEST_FILE_PATTERN.test(filePath)) return false;
	const extension = extname(filePath).toLowerCase();
	return ALLOWED_EXTENSIONS.has(extension);
}

async function findProcedureFiles(root: string): Promise<string[]> {
	const result: string[] = [];

	async function walk(directory: string) {
		const entries = await readdir(directory, { withFileTypes: true });
		for (const entry of entries) {
			const entryPath = join(directory, entry.name);

			if (entry.isDirectory()) {
				if (IGNORED_DIRECTORIES.has(entry.name)) continue;
				await walk(entryPath);
				continue;
			}

			if (entry.isFile()) {
				if (!isSupportedHandlerFile(entryPath)) continue;
				result.push(entryPath);
			}
		}
	}

	await walk(root);
	return result;
}

/**
 * Type guard to check if an export is a valid Procedure
 */
function isProcedure(value: unknown): value is Procedure {
	return (
		typeof value === "object" &&
		value !== null &&
		"contract" in value &&
		"handler" in value &&
		typeof (value as { handler: unknown }).handler === "function"
	);
}

/**
 * Get procedure by name from registry
 */
export function getProcedure(registry: Registry, name: string): Procedure | undefined {
	return registry.get(name);
}

/**
 * List all procedure names in registry
 */
export function listProcedures(registry: Registry): string[] {
	return Array.from(registry.keys());
}

/**
 * Get registry metadata for introspection
 */
export function describeRegistry(registry: Registry) {
	return Array.from(registry.entries()).map(([name, procedure]) => ({
		name,
		description: procedure.contract.description,
		metadata: procedure.contract.metadata,
		inputSchema: procedure.contract.input,
		outputSchema: procedure.contract.output,
	}));
}

function buildModuleSpecifier(filePath: string, versionHint?: string): string {
	const url = pathToFileURL(filePath);
	if (versionHint) {
		url.searchParams.set("v", versionHint);
	}
	return url.href;
}

function logProcedureEvent(
	action: string,
	procedureName: string,
	procedure: Procedure,
	proceduresRoot?: string,
	sourcePath?: string
) {
	const parts: string[] = [];
	parts.push(`[Registry] ${formatRegistryAction(action)} ${procedureName}`);

	const badges = formatProcedureBadges(procedure);
	if (badges) {
		parts.push(badges);
	}

	const metadataLine = formatProcedureMetadataCompact(procedure);
	if (metadataLine) {
		parts.push(metadataLine);
	}

	const location = proceduresRoot && sourcePath ? formatProcedureLocation(proceduresRoot, sourcePath) : "";
	if (location) {
		parts.push(location);
	}

	console.log(parts.join(" "));
}

function formatRegistryAction(action: string): string {
	switch (action) {
		case "Registered":
			return "+";
		case "Updated":
			return "~";
		case "Removed":
			return "-";
		default:
			return action;
	}
}

function formatProcedureLocation(proceduresRoot: string, sourcePath: string): string {
	const relativePath = relative(proceduresRoot, sourcePath);
	if (relativePath === "") {
		return dim("@internal");
	}
	return dim(`@${relativePath}`);
}

function formatProcedureMetadataCompact(procedure: Procedure): string {
	const metadata = procedure.contract.metadata;
	if (!metadata) return "";

	const parts: string[] = [];

	if (metadata.roles?.length) {
		const roles = metadata.roles.length === 1 && metadata.roles[0] === "workflow-node" ? [] : metadata.roles;
		if (roles.length) {
			const coloredRoles = roles.map((role) => colorizeRole(role)).join(",");
			parts.push(`roles=${coloredRoles}`);
		}
	}

	if (metadata.category) {
		parts.push(`cat=${metadata.category}`);
	}

	if (metadata.tags?.length) {
		parts.push(`tags=${formatList(metadata.tags, 2)}`);
	}

	if (metadata.auth && hasAuthMetadata(metadata.auth)) {
		const auth = metadata.auth;
		const authParts: string[] = [];
		if (auth.authScheme) {
			authParts.push(auth.authScheme);
		}
		if (auth.requiredRoles?.length) {
			authParts.push(`roles:${formatList(auth.requiredRoles, 2)}`);
		}
		if (auth.requiredPermissions?.length) {
			authParts.push(`perms:${formatList(auth.requiredPermissions, 2)}`);
		}
		if (!authParts.length && auth.requiresAuth) {
			authParts.push("required");
		}
		if (authParts.length) {
			parts.push(`auth=${authParts.join(" ")}`);
		}
	}

	return parts.join(" | ");
}

function formatList(values: string[], max: number): string {
	if (values.length <= max) {
		return values.join(",");
	}
	const visible = values.slice(0, max).join(",");
	return `${visible},+${values.length - max}`;
}

export function formatProcedureBadges(procedure: Procedure): string {
	const metadata = procedure.contract.metadata;
	const badges: string[] = [];
	const exposure = metadata?.exposure;
	if (exposure) {
		badges.push(`[${exposure}]`);
	}

	if (metadata?.auth && hasAuthMetadata(metadata.auth)) {
		badges.push("[auth]");
	}

	return badges.join(" ");
}

export function formatProcedureMetadata(procedure: Procedure): string {
	const metadata = procedure.contract.metadata;
	if (!metadata) return "";

	const parts: string[] = [];

	if (metadata.roles?.length) {
		const coloredRoles = metadata.roles.map((role) => colorizeRole(role)).join(" ");
		parts.push(`roles: ${coloredRoles}`);
	}

	if (metadata.category) {
		parts.push(`category: ${metadata.category}`);
	}

	if (metadata.tags?.length) {
		parts.push(`tags: ${metadata.tags.join(", ")}`);
	}

	if (metadata.auth && hasAuthMetadata(metadata.auth)) {
		const authParts: string[] = [];
		if (metadata.auth.authScheme) {
			authParts.push(metadata.auth.authScheme);
		}
		if (metadata.auth.requiredRoles?.length) {
			authParts.push(`roles ${metadata.auth.requiredRoles.join(", ")}`);
		}
		if (metadata.auth.requiredPermissions?.length) {
			authParts.push(`perms ${metadata.auth.requiredPermissions.join(", ")}`);
		}
		parts.push(`auth: ${authParts.join(" | ") || "required"}`);
	}

	return parts.join(" - ");
}

function colorizeRole(role: ProcedureRole): string {
	const code = ROLE_COLOR[role];
	if (!code || !COLOR_ENABLED()) {
		return role;
	}
	return `${code}${role}${COLOR_RESET}`;
}

function dim(text: string): string {
	if (!COLOR_ENABLED()) return text;
	return `${COLOR_DIM}${text}${COLOR_RESET}`;
}

function hasAuthMetadata(auth?: AuthRequirements | null): boolean {
	if (!auth) return false;
	return Boolean(
		auth.requiresAuth ||
		auth.authScheme ||
		(auth.requiredRoles && auth.requiredRoles.length > 0) ||
		(auth.requiredPermissions && auth.requiredPermissions.length > 0)
	);
}
