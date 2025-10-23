import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { watch } from "node:fs/promises";
import { collectProjectArtifacts, type Registry, type WorkflowRegistry } from "@c4c/core";
import { createHttpServer, type HttpAppOptions } from "@c4c/adapters";
import { DEFAULTS } from "./constants.js";
import { dim } from "./formatting.js";
import { createLogWriter, interceptConsole } from "./logging.js";
import {
	ensureDevSessionAvailability,
	getDevSessionPaths,
	removeDevSessionArtifacts,
	writeDevSessionMetadata,
} from "./session.js";
import type { DevSessionMetadata, ServeMode } from "./types.js";
import { watchProject } from "./watcher.js";

export interface ServeOptions {
	port?: number;
	root?: string;
	enableDocs?: boolean;
	enableRest?: boolean;
	enableRpc?: boolean;
	enableWorkflow?: boolean;
	apiBaseUrl?: string;
}

/**
 * Serve mode - starts HTTP server with artifacts from entire project
 * No hardcoded paths! Pure introspection!
 */
export async function serve(mode: ServeMode, options: ServeOptions = {}) {
	const { projectRoot, httpOptions } = resolveServeConfiguration(mode, options);
	
	console.log(`[c4c] Discovering artifacts in ${dim(projectRoot)}`);
	const artifacts = await collectProjectArtifacts(projectRoot);
	
	console.log(`[c4c] Found ${artifacts.procedures.size} procedures, ${artifacts.workflows.size} workflows`);
	
	return createHttpServer(artifacts.procedures, httpOptions.port ?? 3000, httpOptions);
}

/**
 * Dev mode - serves with hot reload
 * Watches entire project for changes
 */
export async function dev(mode: ServeMode, options: ServeOptions = {}) {
	const { projectRoot, httpOptions } = resolveServeConfiguration(mode, options);
	const sessionPaths = getDevSessionPaths(projectRoot);
	await ensureDevSessionAvailability(sessionPaths);

	await fs.mkdir(sessionPaths.directory, { recursive: true });
	await fs.writeFile(sessionPaths.logFile, "", "utf8");

	const logWriter = createLogWriter(sessionPaths.logFile);
	const restoreConsole = interceptConsole(logWriter);

	const sessionId = randomUUID();
	
	console.log(`[c4c] Discovering artifacts in ${dim(projectRoot)}`);
	const artifacts = await collectProjectArtifacts(projectRoot);
	console.log(`[c4c] Found ${artifacts.procedures.size} procedures, ${artifacts.workflows.size} workflows`);

	const registry = artifacts.procedures;
	const workflowRegistry = artifacts.workflows;
	const moduleIndex = artifacts.moduleIndex;

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
		proceduresPath: projectRoot, // Legacy field - now same as projectRoot
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
				const stoppingMetadata = { ...metadata, status: "stopping" as const };
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
			const stoppingMetadata = { ...metadata, status: "stopping" as const };
			void writeDevSessionMetadata(sessionPaths, stoppingMetadata).catch(() => {});
		}
		const promise = performCleanup();
		if (options.exit) {
			void promise.then(() => process.exit(0));
		}
	};

	// Watch session.json for status changes. If status != running, shutdown.
	startSessionWatcher(sessionPaths.directory, sessionPaths.sessionFile, controller.signal, async () => {
		try {
			const raw = await fs.readFile(sessionPaths.sessionFile, "utf8");
			const meta = JSON.parse(raw) as DevSessionMetadata;
			if (meta.status !== "running") {
				console.log("[c4c] Stop requested (session status changed)");
				triggerShutdown("session-status");
			}
		} catch {
			// If the file is removed or unreadable, initiate shutdown as a safe default
			console.log("[c4c] Session file missing or unreadable. Stopping.");
			triggerShutdown("session-file-missing");
		}
	});

	server = createHttpServer(registry, port, httpOptions);

	for (const signal of signals) {
		const handler = () => {
			triggerShutdown(signal, { exit: true });
		};
		signalHandlers.set(signal, handler);
		process.on(signal, handler);
	}

	console.log(`[c4c] Watching ${dim(projectRoot)} for changes`);
	console.log(`[c4c] Press Ctrl+C or run: pnpm "c4c dev stop" to stop the dev server`);

	const watchTask = watchProject(
		projectRoot,
		moduleIndex,
		registry,
		workflowRegistry,
		controller.signal,
		() => triggerShutdown("watcher")
	);

	try {
		await watchTask;
	} finally {
		await performCleanup();
	}
}

function resolveServeConfiguration(mode: ServeMode, options: ServeOptions = {}) {
	const projectRoot = options.root ? resolve(options.root) : process.cwd();
	const defaults = DEFAULTS[mode] ?? DEFAULTS.all;
	const httpOptions: HttpAppOptions = {
		port: options.port ?? 3000,
		enableDocs: options.enableDocs ?? defaults.enableDocs,
		enableRest: options.enableRest ?? defaults.enableRest,
		enableRpc: options.enableRpc ?? defaults.enableRpc,
		enableWorkflow: options.enableWorkflow ?? defaults.enableWorkflow,
		workflowsPath: undefined, // Not needed anymore - workflows discovered via introspection
	};

	return { projectRoot, httpOptions };
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

function startSessionWatcher(
	sessionDir: string,
	sessionFilePath: string,
	signal: AbortSignal,
	onSessionChanged: () => void
): void {
	(async () => {
		try {
			const watcher = watch(sessionDir, { signal });
			for await (const event of watcher) {
				if (!event || !event.filename) continue;
				if (event.filename === "session.json") {
					onSessionChanged();
				}
			}
		} catch (error) {
			if (!(error instanceof Error && error.name === "AbortError")) {
				console.warn(
					`[c4c] Session watcher error: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}
	})().catch(() => {});
}
