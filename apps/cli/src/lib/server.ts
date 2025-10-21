import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { collectRegistry, collectRegistryDetailed, type Registry, type RegistryModuleIndex } from "@c4c/core";
import { createHttpServer, type HttpAppOptions } from "@c4c/adapters";
import { DEFAULTS, DEV_CONTROLS_LABEL } from "./constants.js";
import { formatHandlersLabel, logProcedureChange } from "./formatting.js";
import { createLogWriter, interceptConsole } from "./logging.js";
import {
	ensureDevSessionAvailability,
	getDevSessionPaths,
	removeDevSessionArtifacts,
	writeDevSessionMetadata,
} from "./session.js";
import type { DevSessionMetadata, ServeMode } from "./types.js";
import { watchHandlers } from "./watcher.js";
import { createDevControlProcedures, type DevControlProcedureDescriptor } from "../internal/handlers/dev-control.js";

export interface ServeOptions {
	port?: number;
	handlersPath?: string;
	workflowsPath?: string;
	enableDocs?: boolean;
	enableRest?: boolean;
	enableRpc?: boolean;
	enableWorkflow?: boolean;
	apiBaseUrl?: string;
	projectRoot?: string;
}

export async function serve(mode: ServeMode, options: ServeOptions = {}) {
	const { handlersPath, httpOptions } = resolveServeConfiguration(mode, options);
	const registry = await collectRegistry(handlersPath);
	return createHttpServer(registry, httpOptions.port ?? 3000, httpOptions);
}

export async function dev(mode: ServeMode, options: ServeOptions = {}) {
	const { handlersPath, httpOptions, projectRoot } = resolveServeConfiguration(mode, options);
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
    console.log(`[c4c] Press Ctrl+C or run \"pnpm \"c4c dev stop\"\" to stop the dev server`);

	const watchTask = watchHandlers(
		handlersPath,
		moduleIndex,
		registry,
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
	const projectRoot = options.projectRoot ? resolve(options.projectRoot) : process.cwd();
	const handlersOption = options.handlersPath ?? process.env.C4C_HANDLERS ?? "src/handlers";
	const handlersPath = resolve(projectRoot, handlersOption);
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
