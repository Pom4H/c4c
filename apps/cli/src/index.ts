import { promises as fs } from "node:fs";
import { watch, type FileChangeInfo } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { format } from "node:util";
import {
	collectRegistry,
	collectRegistryDetailed,
	formatProcedureBadges,
	isSupportedHandlerFile,
	loadProceduresFromModule,
	type AuthRequirements,
	type Procedure,
	type Registry,
	type RegistryModuleIndex,
} from "@c4c/core";
import { createHttpServer, type HttpAppOptions } from "@c4c/adapters";
import { generateRpcClientModule, type RpcClientGeneratorOptions } from "@c4c/generators";
import {
	DEV_CONTROL_LOG_TAIL_LIMIT,
} from "./internal/contracts/dev-control.js";
import {
	createDevControlProcedures,
	type DevControlProcedureDescriptor,
} from "./internal/handlers/dev-control.js";
import { splitLines, tailLines } from "./internal/utils/logs.js";

export type ServeMode = "all" | "rest" | "workflow" | "rpc";

export interface ServeOptions extends HttpAppOptions {
	handlersPath?: string;
	apiBaseUrl?: string;
	projectRoot?: string;
	userType?: DevUserType;
}

export type DevUserType = "human" | "agent";

type DevSessionStatus = "running" | "stopping";

interface DevSessionMetadata {
	id: string;
	pid: number;
	port: number;
	mode: ServeMode;
	projectRoot: string;
	handlersPath: string;
	userType: DevUserType;
	logFile: string;
	startedAt: string;
	status: DevSessionStatus;
}

interface DevLogState {
	lastReadBytes: number;
	updatedAt: string;
}

interface DevLogReadResult {
	lines: string[];
	nextOffset: number;
}

interface DevSessionPaths {
	directory: string;
	sessionFile: string;
	logFile: string;
	logStateFile: string;
}

export interface DevLogsOptions {
	projectRoot: string;
	tail?: number;
}

interface DiscoveredSession {
	paths: DevSessionPaths;
	metadata: DevSessionMetadata;
}

type ConsoleMethod = "log" | "info" | "warn" | "error";

interface LogWriter {
	write(method: ConsoleMethod, args: unknown[]): void;
	flush(): Promise<void>;
}

const DEV_DIR_NAME = ".c4c";
const DEV_SESSION_SUBDIR = "dev";
const DEV_SESSION_FILE_NAME = "session.json";
const DEV_LOG_FILE_NAME = "dev.log";
const DEV_LOG_STATE_FILE_NAME = "log-state.json";
const DEV_CONTROLS_LABEL = "[dev-controls]";
const SESSION_DISCOVERY_MAX_DEPTH = 3;
const SESSION_DISCOVERY_IGNORE_DIRS = new Set([
	".git",
	".hg",
	".svn",
	".turbo",
	".next",
	".c4c",
	".cache",
	"coverage",
	"dist",
	"build",
	"out",
	"tmp",
	"temp",
	"node_modules",
	"vendor",
	".pnpm",
]);

const MAX_LOG_TAIL_LINES = DEV_CONTROL_LOG_TAIL_LIMIT;

function shouldSkipSessionDiscoveryDir(name: string): boolean {
	if (SESSION_DISCOVERY_IGNORE_DIRS.has(name)) return true;
	if (name.startsWith(".")) return true;
	return false;
}

const DEFAULT_WORKFLOWS_PATH = process.env.C4C_WORKFLOWS_DIR ?? "workflows";

const DEFAULTS: Record<ServeMode, Required<Omit<HttpAppOptions, "port">>> = {
	all: {
		enableDocs: true,
		enableRest: true,
		enableRpc: true,
		enableWorkflow: true,
		workflowsPath: DEFAULT_WORKFLOWS_PATH,
	},
	rest: {
		enableDocs: true,
		enableRest: true,
		enableRpc: false,
		enableWorkflow: false,
		workflowsPath: DEFAULT_WORKFLOWS_PATH,
	},
	workflow: {
		enableDocs: false,
		enableRest: false,
		enableRpc: false,
		enableWorkflow: true,
		workflowsPath: DEFAULT_WORKFLOWS_PATH,
	},
	rpc: {
		enableDocs: false,
		enableRest: false,
		enableRpc: true,
		enableWorkflow: false,
		workflowsPath: DEFAULT_WORKFLOWS_PATH,
	},
};

export async function serve(mode: ServeMode, options: ServeOptions = {}) {
	const { handlersPath, httpOptions } = resolveServeConfiguration(mode, options);
	const registry = await collectRegistry(handlersPath);
	return createHttpServer(registry, httpOptions.port ?? 3000, httpOptions);
}

export async function dev(mode: ServeMode, options: ServeOptions = {}) {
	const { handlersPath, httpOptions, projectRoot } = resolveServeConfiguration(mode, options);
	const userType: DevUserType = options.userType ?? "human";
	const sessionPaths = getDevSessionPaths(projectRoot);
	await ensureDevSessionAvailability(sessionPaths);

	await fs.mkdir(sessionPaths.directory, { recursive: true });
	await fs.writeFile(sessionPaths.logFile, "", "utf8");

	const logWriter = createLogWriter(sessionPaths.logFile);
	const restoreConsole = interceptConsole(logWriter);

	const sessionId = randomUUID();
	const { registry, moduleIndex } = await collectRegistryDetailed(handlersPath);

	if (!httpOptions.enableRpc) {
		httpOptions.enableRpc = true;
	}

	const port = httpOptions.port ?? 3000;
	httpOptions.port = port;

	const metadata: DevSessionMetadata = {
		id: sessionId,
		pid: process.pid,
		port,
		mode,
		projectRoot,
		handlersPath,
		userType,
		logFile: sessionPaths.logFile,
		startedAt: new Date().toISOString(),
		status: "running",
	};

	await writeDevSessionMetadata(sessionPaths, metadata);

	const controller = new AbortController();
	const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
	const signalHandlers = new Map<NodeJS.Signals, () => void>();
	let cleanupInitiated = false;
	let cleanupPromise: Promise<void> | null = null;
	let server: unknown;

	const performCleanup = async () => {
		if (cleanupPromise) return cleanupPromise;
		cleanupPromise = (async () => {
			if (!cleanupInitiated) {
				cleanupInitiated = true;
				const stoppingMetadata = { ...metadata, status: "stopping" as DevSessionStatus };
				try {
					await writeDevSessionMetadata(sessionPaths, stoppingMetadata);
				} catch {
					// Best-effort persistence only.
				}
			}
			let caughtError: unknown = null;
			try {
				controller.abort();
				for (const [signal, handler] of signalHandlers) {
					process.off(signal, handler);
				}
				await closeServer(server);
			} catch (error) {
				caughtError = error;
			} finally {
				let artifactCleanupError: unknown = null;
				try {
					await removeDevSessionArtifacts(sessionPaths);
				} catch (error) {
					artifactCleanupError = error;
				}
				if (artifactCleanupError) {
					console.error(
						`[c4c] Failed to clear dev session state: ${
							artifactCleanupError instanceof Error ? artifactCleanupError.message : String(artifactCleanupError)
						}`
					);
				}
				if (caughtError) {
					console.error(
						`[c4c] Dev server shutdown encountered an error: ${
							caughtError instanceof Error ? caughtError.message : String(caughtError)
						}`
					);
				}
				await logWriter.flush();
				restoreConsole();
			}
		})();
		return cleanupPromise;
	};

	const triggerShutdown = (reason: string, options: { exit?: boolean } = {}) => {
		if (!cleanupInitiated) {
			cleanupInitiated = true;
			const stoppingMetadata = { ...metadata, status: "stopping" as DevSessionStatus };
			void writeDevSessionMetadata(sessionPaths, stoppingMetadata).catch(() => {});
		}
		const promise = performCleanup();
		if (options.exit) {
			void promise.then(() => process.exit(0));
		}
	};

	const controlProcedures: DevControlProcedureDescriptor[] = createDevControlProcedures({
		requestStop: (reason) => {
		if (reason) {
			console.log(`[c4c] Stop requested: ${reason}`);
		} else {
			console.log("[c4c] Stop requested");
		}
		triggerShutdown("rpc");
		},
		logFile: sessionPaths.logFile,
		sourcePath: join(handlersPath, DEV_CONTROLS_LABEL),
	});

	for (const control of controlProcedures) {
		registry.set(control.name, control.procedure);
		logProcedureChange("Registered", control.name, control.procedure, handlersPath, control.sourcePath);
	}

	server = createHttpServer(registry, port, httpOptions);

	for (const signal of signals) {
		const handler = () => {
			triggerShutdown(signal, { exit: true });
		};
		signalHandlers.set(signal, handler);
		process.on(signal, handler);
	}

	const handlersLabel = formatHandlersLabel(handlersPath);
	console.log(`[c4c] Watching handlers in ${handlersLabel}`);
	if (userType === "agent") {
		console.log(`[c4c] pnpm "c4c dev stop" to stop the dev server`);
	} else {
		console.log(`[c4c] Press Ctrl+C to stop the dev server`);
	}

	const watchTask = (async () => {
		try {
			let watcher: AsyncIterable<FileChangeInfo<string>>;
			try {
				watcher = watch(handlersPath, {
					recursive: true,
					signal: controller.signal,
				});
			} catch (error) {
				if (isRecursiveWatchUnavailable(error)) {
					console.warn(
						"[c4c] Recursive watching is not supported on this platform. Watching the top-level handlers directory only."
					);
					watcher = watch(handlersPath, {
						signal: controller.signal,
					});
				} else {
					throw error;
				}
			}

			for await (const event of watcher) {
				const fileName = event.filename;
				if (!fileName) continue;
				const filePath = resolve(handlersPath, fileName);
				if (!isSupportedHandlerFile(filePath)) continue;

				const exists = await fileExists(filePath);
				if (event.eventType === "rename" && !exists) {
					await removeModuleProcedures(moduleIndex, registry, filePath, handlersPath);
					continue;
				}

				if (!exists) continue;
				await reloadModuleProcedures(moduleIndex, registry, filePath, handlersPath);
			}
		} catch (error) {
			if (!isAbortError(error)) {
				console.error(
					`[c4c] Watcher stopped: ${error instanceof Error ? error.message : String(error)}`
				);
				triggerShutdown("watcher");
			}
		}
	})();

	try {
		await watchTask;
	} finally {
		await performCleanup();
	}
}

export interface GenerateClientOptions extends RpcClientGeneratorOptions {
	handlersPath?: string;
	outFile: string;
}

export async function generateClient(options: GenerateClientOptions): Promise<string> {
	const handlersPath = options.handlersPath ?? process.env.C4C_HANDLERS ?? "src/handlers";
	const registry = await collectRegistry(handlersPath);
	const moduleSource = generateRpcClientModule(registry, { baseUrl: options.baseUrl });
	const outFile = resolve(process.cwd(), options.outFile);
	await fs.mkdir(dirname(outFile), { recursive: true });
	await fs.writeFile(outFile, moduleSource, "utf8");
	return outFile;
}

export async function stopDevServer(projectRoot: string): Promise<void> {
	const resolved = await discoverActiveSession(projectRoot);
	if (!resolved) {
		const label = formatHandlersLabel(projectRoot);
		console.log(`[c4c] No running dev server found (searched from ${label}).`);
		return;
	}

	const { paths: sessionPaths, metadata } = resolved;

	if (!isProcessAlive(metadata.pid)) {
		console.log("[c4c] Found stale dev session metadata. Cleaning up.");
		await removeDevSessionArtifacts(sessionPaths);
		return;
	}

	const url = new URL(`/rpc/${encodeURIComponent("dev.control.stop")}`, `http://127.0.0.1:${metadata.port}`).toString();
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5000);

	let stopRequestAccepted = false;
	let fallbackReason: string | null = null;
	try {
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ reason: "cli-stop" }),
			signal: controller.signal,
		});
		if (response.ok) {
			stopRequestAccepted = true;
		} else if (response.status === 404) {
			fallbackReason = "Procedure not found (older dev server). Falling back to signal-based shutdown.";
		} else {
			fallbackReason = `Stop request responded with status ${response.status}`;
		}
	} catch (error) {
		if (controller.signal.aborted) {
			throw new Error("Timed out while contacting the dev server.");
		}
		fallbackReason = error instanceof Error ? error.message : String(error);
	} finally {
		clearTimeout(timeout);
	}

	if (fallbackReason) {
		console.warn(`[c4c] ${fallbackReason}`);
	}

	if (stopRequestAccepted) {
		console.log(`[c4c] Stop request sent to dev server (pid ${metadata.pid}).`);
	} else {
		console.log(`[c4c] Sending SIGTERM to dev server (pid ${metadata.pid}).`);
		try {
			process.kill(metadata.pid, "SIGTERM");
		} catch (killError) {
			throw new Error(
				`Failed to send SIGTERM to pid ${metadata.pid}: ${killError instanceof Error ? killError.message : String(killError)}`
			);
		}
	}
	const exited = await waitForProcessExit(metadata.pid, 7000);
	if (exited) {
		await removeDevSessionArtifacts(sessionPaths);
		console.log("[c4c] Dev server stopped.");
	} else {
		console.warn(
			`[c4c] Dev server (pid ${metadata.pid}) is still shutting down. Check logs if it does not exit.`
		);
	}
}

export async function readDevLogs(options: DevLogsOptions): Promise<DevLogReadResult | null> {
	const resolved = await discoverActiveSession(options.projectRoot);
	if (!resolved) {
		return null;
	}

	const { paths: sessionPaths, metadata } = resolved;
	const timestamp = new Date().toISOString();
	const tailInput = typeof options.tail === "number" && options.tail > 0 ? Math.floor(options.tail) : undefined;
	const tail = tailInput ? Math.min(tailInput, MAX_LOG_TAIL_LINES) : undefined;
	const state = await readLogState(sessionPaths);
	const requestPayload: { tail?: number; offset?: number } = {};
	if (tail) {
		requestPayload.tail = tail;
	} else {
		requestPayload.offset = state.lastReadBytes;
	}

	const rpcResult = await callDevLogsProcedure(metadata, requestPayload);
	if (rpcResult) {
		await writeLogState(sessionPaths, {
			lastReadBytes: rpcResult.nextOffset,
			updatedAt: timestamp,
		});
		return rpcResult;
	}

	let buffer: Buffer;
	try {
		buffer = await fs.readFile(sessionPaths.logFile);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { lines: [], nextOffset: 0 };
		}
		throw error;
	}

	const byteLength = buffer.byteLength;
	if (tail) {
		const lines = tailLines(splitLines(buffer.toString("utf8")), tail);
		await writeLogState(sessionPaths, { lastReadBytes: byteLength, updatedAt: timestamp });
		return { lines, nextOffset: byteLength };
	}

	const startOffset = state.lastReadBytes > byteLength ? 0 : state.lastReadBytes;
	const slice = startOffset > 0 ? buffer.subarray(startOffset) : buffer;
	const lines = splitLines(slice.toString("utf8"));
	await writeLogState(sessionPaths, { lastReadBytes: byteLength, updatedAt: timestamp });
	return { lines, nextOffset: byteLength };
}

function resolveServeConfiguration(mode: ServeMode, options: ServeOptions = {}) {
	const projectRoot = options.projectRoot ? resolve(options.projectRoot) : process.cwd();
	const handlersOption = options.handlersPath ?? process.env.C4C_HANDLERS ?? "src/handlers";
	const handlersPath = isAbsolute(handlersOption) ? handlersOption : resolve(projectRoot, handlersOption);
	const defaults = DEFAULTS[mode] ?? DEFAULTS.all;
	const httpOptions: HttpAppOptions = {
		port: options.port ?? 3000,
		enableDocs: options.enableDocs ?? defaults.enableDocs,
		enableRest: options.enableRest ?? defaults.enableRest,
		enableRpc: options.enableRpc ?? defaults.enableRpc,
		enableWorkflow: options.enableWorkflow ?? defaults.enableWorkflow,
		workflowsPath: options.workflowsPath ?? defaults.workflowsPath,
	};

	return { handlersPath, httpOptions, projectRoot };
}

async function reloadModuleProcedures(
	moduleIndex: RegistryModuleIndex,
	registry: Registry,
	filePath: string,
	handlersRoot: string
) {
	const previous = moduleIndex.get(filePath) ?? new Set<string>();
	try {
		const procedures = await loadProceduresFromModule(filePath, {
			versionHint: Date.now().toString(36),
		});
		const nextNames = new Set(procedures.keys());

		for (const name of previous) {
			if (!nextNames.has(name)) {
				const existing = registry.get(name);
				if (existing) {
					logProcedureChange("Removed", name, existing, filePath, handlersRoot);
				}
				registry.delete(name);
			}
		}

		for (const [name, procedure] of procedures) {
			const action = previous.has(name) ? "Updated" : "Registered";
			registry.set(name, procedure);
			logProcedureChange(action, name, procedure, filePath, handlersRoot);
		}

		moduleIndex.set(filePath, nextNames);
	} catch (error) {
		console.error(`[Registry] Failed to reload handler from ${filePath}:`, error);
	}
}

async function removeModuleProcedures(
	moduleIndex: RegistryModuleIndex,
	registry: Registry,
	filePath: string,
	handlersRoot: string
) {
	const previous = moduleIndex.get(filePath);
	if (!previous) return;

	for (const name of previous) {
		const existing = registry.get(name);
		if (existing) {
			logProcedureChange("Removed", name, existing, filePath, handlersRoot);
		}
		registry.delete(name);
	}

	moduleIndex.delete(filePath);
}

function logProcedureChange(
	action: string,
	procedureName: string,
	procedure: Procedure | undefined,
	sourcePath: string,
	handlersRoot: string
) {
	const parts: string[] = [];
	parts.push(`[Registry] ${formatRegistryAction(action)} ${procedureName}`);

	const badges = procedure ? formatProcedureBadges(procedure) : "";
	if (badges) {
		parts.push(badges);
	}

	const metadata = procedure ? formatConciseProcedureMetadata(procedure) : "";
	if (metadata) {
		parts.push(metadata);
	}

	const location = formatProcedureLocation(sourcePath, handlersRoot);
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

function formatProcedureLocation(sourcePath: string, handlersRoot: string): string {
	const relativePathRaw = sourcePath ? relative(handlersRoot, sourcePath) : null;
	const relativePath = relativePathRaw === null ? null : relativePathRaw === "" ? "." : relativePathRaw;
	if (!relativePath) return "";
	if (relativePath === ".") {
		return dim("@internal");
	}
	return dim(`@${relativePath}`);
}

function formatConciseProcedureMetadata(procedure: Procedure): string {
	const metadata = procedure.contract.metadata;
	if (!metadata) return "";

	const parts: string[] = [];

	if (metadata.roles?.length) {
		const roles = metadata.roles.length === 1 && metadata.roles[0] === "workflow-node" ? [] : metadata.roles;
		if (roles.length) {
			const formattedRoles = roles.map((role) => colorizeProcedureRole(role)).join(",");
			parts.push(`roles=${formattedRoles}`);
		}
	}

	if (metadata.category) {
		parts.push(`cat=${metadata.category}`);
	}

	if (metadata.tags?.length) {
		parts.push(`tags=${formatList(metadata.tags, 2)}`);
	}

	if (metadata.auth && hasAuthMetadata(metadata.auth)) {
		const { auth } = metadata;
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

const PROCEDURE_ROLE_COLOR: Record<string, string> = {
	"workflow-node": "\u001B[36m",
	"api-endpoint": "\u001B[35m",
	"sdk-client": "\u001B[33m",
};

function colorizeProcedureRole(role: string): string {
	if (!colorEnabled()) return role;
	const color = PROCEDURE_ROLE_COLOR[role];
	if (!color) return role;
	return `${color}${role}${COLOR_RESET}`;
}

function formatList(values: string[], max: number): string {
	if (values.length <= max) {
		return values.join(",");
	}
	const visible = values.slice(0, max).join(",");
	return `${visible},+${values.length - max}`;
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

function getDevSessionPaths(projectRoot: string): DevSessionPaths {
	const directory = resolve(projectRoot, DEV_DIR_NAME, DEV_SESSION_SUBDIR);
	return {
		directory,
		sessionFile: resolve(directory, DEV_SESSION_FILE_NAME),
		logFile: resolve(directory, DEV_LOG_FILE_NAME),
		logStateFile: resolve(directory, DEV_LOG_STATE_FILE_NAME),
	};
}

async function ensureDevSessionAvailability(paths: DevSessionPaths): Promise<void> {
	const existing = await readDevSessionMetadata(paths);
	if (!existing) return;

	const { pid, status, startedAt } = existing;
	const processAlive = Boolean(pid && isProcessAlive(pid));
	let serverResponsive = false;

	if (processAlive) {
		serverResponsive = await isDevServerResponsive(existing);
	}

	if (processAlive && serverResponsive) {
		throw new Error(
			`A c4c dev server already appears to be running (pid ${pid}). Use "pnpm \"c4c dev stop\"" before starting a new session.`
		);
	}

	if (processAlive && status === "running") {
		const startedMs = startedAt ? Date.parse(startedAt) : Number.NaN;
		const recentlyStarted = Number.isFinite(startedMs) && Date.now() - startedMs < 10_000;
		if (recentlyStarted) {
			throw new Error(
				`A c4c dev server is still starting up (pid ${pid}). Try again shortly or run "pnpm \"c4c dev stop\"".`
			);
		}
	}

	await removeDevSessionArtifacts(paths);
}

async function readDevSessionMetadata(paths: DevSessionPaths): Promise<DevSessionMetadata | null> {
	try {
		const raw = await fs.readFile(paths.sessionFile, "utf8");
		return JSON.parse(raw) as DevSessionMetadata;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return null;
		}
		throw error;
	}
}

async function writeDevSessionMetadata(paths: DevSessionPaths, metadata: DevSessionMetadata): Promise<void> {
	await fs.mkdir(paths.directory, { recursive: true });
	await fs.writeFile(paths.sessionFile, JSON.stringify(metadata, null, 2), "utf8");
}

async function removeDevSessionArtifacts(paths: DevSessionPaths): Promise<void> {
	await removeIfExists(paths.sessionFile);
	await removeIfExists(paths.logStateFile);
}

async function removeIfExists(path: string): Promise<void> {
	try {
		await fs.rm(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return;
		}
		throw error;
	}
}

function isProcessAlive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) {
		return false;
	}
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function discoverActiveSession(projectRoot: string): Promise<DiscoveredSession | null> {
	const primaryPaths = getDevSessionPaths(projectRoot);
	const primaryMetadata = await readDevSessionMetadata(primaryPaths);
	if (primaryMetadata) {
		return { paths: primaryPaths, metadata: primaryMetadata };
	}

	return findSessionRecursively(projectRoot, SESSION_DISCOVERY_MAX_DEPTH);
}

async function findSessionRecursively(baseDir: string, depth: number): Promise<DiscoveredSession | null> {
	if (depth <= 0) {
		return null;
	}

	let entries: Array<import("node:fs").Dirent>;
	try {
		entries = await fs.readdir(baseDir, { withFileTypes: true });
	} catch {
		return null;
	}

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (typeof entry.isSymbolicLink === "function" && entry.isSymbolicLink()) continue;
		if (shouldSkipSessionDiscoveryDir(entry.name)) continue;
		const candidateRoot = join(baseDir, entry.name);
		const candidatePaths = getDevSessionPaths(candidateRoot);
		const metadata = await readDevSessionMetadata(candidatePaths);
		if (metadata) {
			return { paths: candidatePaths, metadata };
		}
		const nested = await findSessionRecursively(candidateRoot, depth - 1);
		if (nested) {
			return nested;
		}
	}

	return null;
}

async function isDevServerResponsive(metadata: DevSessionMetadata): Promise<boolean> {
	if (!metadata.port) {
		return false;
	}
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 750);
	try {
		const response = await fetch(`http://127.0.0.1:${metadata.port}/health`, {
			method: "GET",
			signal: controller.signal,
		});
		return response.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timeout);
	}
}

async function callDevLogsProcedure(
	metadata: DevSessionMetadata,
	body: { tail?: number; offset?: number }
): Promise<DevLogReadResult | null> {
	if (!metadata.port) {
		return null;
	}
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 1500);
	try {
		const response = await fetch(
			new URL(`/rpc/${encodeURIComponent("dev.control.logs")}`, `http://127.0.0.1:${metadata.port}`).toString(),
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
				signal: controller.signal,
			}
		);
		if (response.status === 404) {
			return null;
		}
		if (!response.ok) {
			return null;
		}
		const data = (await response.json()) as { lines?: unknown; nextOffset?: unknown };
		if (!Array.isArray(data.lines) || typeof data.nextOffset !== "number") {
			return null;
		}
		const lines = data.lines.map((line) => String(line));
		return { lines, nextOffset: data.nextOffset };
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

function createLogWriter(logFile: string): LogWriter {
	let pending: Promise<void> = Promise.resolve();

	const enqueue = (line: string) => {
		pending = pending
			.then(() => fs.appendFile(logFile, line, "utf8"))
			.catch(() => {});
	};

	return {
		write(method: ConsoleMethod, args: unknown[]) {
			const timestamp = new Date().toISOString();
			const message = format(...args);
			const line = `[${timestamp}] [${method.toUpperCase()}] ${message}\n`;
			enqueue(line);
		},
		flush() {
			return pending.catch(() => {});
		},
	};
}

function interceptConsole(logWriter: LogWriter): () => void {
	const methods: ConsoleMethod[] = ["log", "info", "warn", "error"];
	const originals = new Map<ConsoleMethod, (...args: unknown[]) => void>();

	for (const method of methods) {
		const original = console[method].bind(console) as (...args: unknown[]) => void;
		originals.set(method, original);
		(console as Record<ConsoleMethod, (...args: unknown[]) => void>)[method] = (...args: unknown[]) => {
			logWriter.write(method, args);
			original(...args);
		};
	}

	return () => {
		for (const method of methods) {
			const original = originals.get(method);
			if (original) {
				(console as Record<ConsoleMethod, (...args: unknown[]) => void>)[method] = original;
			}
		}
	};
}

async function readLogState(paths: DevSessionPaths): Promise<DevLogState> {
	try {
		const raw = await fs.readFile(paths.logStateFile, "utf8");
		const parsed = JSON.parse(raw) as DevLogState;
		if (typeof parsed.lastReadBytes === "number") {
			return parsed;
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { lastReadBytes: 0, updatedAt: new Date().toISOString() };
		}
		console.warn(
			`[c4c] Failed to read dev log state: ${error instanceof Error ? error.message : String(error)}`
		);
	}
	return { lastReadBytes: 0, updatedAt: new Date().toISOString() };
}

async function writeLogState(paths: DevSessionPaths, state: DevLogState): Promise<void> {
	await fs.mkdir(paths.directory, { recursive: true });
	await fs.writeFile(paths.logStateFile, JSON.stringify(state, null, 2), "utf8");
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (!isProcessAlive(pid)) {
			return true;
		}
		await delay(150);
	}
	return !isProcessAlive(pid);
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function formatHandlersLabel(handlersPath: string): string {
	const label = relative(process.cwd(), handlersPath) || handlersPath;
	return label;
}

async function fileExists(path: string): Promise<boolean> {
	try {
		const stats = await fs.stat(path);
		return stats.isFile();
	} catch {
		return false;
	}
}

async function closeServer(server: unknown): Promise<void> {
	if (!server || typeof server !== "object") return;
	const closable = server as { close?: (callback: (err?: Error) => void) => void };
	if (typeof closable.close !== "function") return;
	await new Promise<void>((resolvePromise) => {
		closable.close?.((error?: Error | null) => {
			if (error) {
				console.error(`[c4c] Failed to close server: ${error.message}`);
			}
			resolvePromise();
		});
	});
}

function isRecursiveWatchUnavailable(error: unknown): boolean {
	return (
		error instanceof Error &&
		"code" in error &&
		(error as NodeJS.ErrnoException).code === "ERR_FEATURE_UNAVAILABLE_ON_PLATFORM"
	);
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError";
}

const COLOR_RESET = "\u001B[0m";
const COLOR_DIM = "\u001B[90m";

function colorEnabled(): boolean {
	return Boolean(process.stdout?.isTTY && !process.env.NO_COLOR);
}

function dim(text: string): string {
	if (!colorEnabled()) return text;
	return `${COLOR_DIM}${text}${COLOR_RESET}`;
}
