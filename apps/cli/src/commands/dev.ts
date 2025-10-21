import { resolve, relative } from "node:path";
import { dev as runDev, type ServeOptions } from "../lib/server.js";
import type { ServeMode } from "../lib/types.js";
import { determineHandlersPath, determineWorkflowsPath } from "../internal/utils/project-paths.js";
import { stopDevServer } from "../lib/stop.js";
import { readDevLogs } from "../lib/logs.js";

interface DevCommandOptions {
	port?: number;
	root?: string;
	handlers?: string;
	workflows?: string;
	docs?: boolean;
	disableDocs?: boolean;
	quiet?: boolean;
}

export async function devCommand(modeArg: string, options: DevCommandOptions): Promise<void> {
	if (!isServeMode(modeArg)) {
		throw new Error(`Unknown dev mode '${modeArg}'.`);
	}

	const rootDir = resolve(options.root ?? process.cwd());
	const handlersPath = determineHandlersPath(rootDir, options.handlers);
	const workflowsPath = determineWorkflowsPath(rootDir, options.workflows);

	if (options.quiet) {
		process.env.C4C_QUIET = "1";
	}

	const enableDocs = options.docs ? true : options.disableDocs ? false : undefined;

	const serveOptions: ServeOptions = {
		port: options.port,
		handlersPath,
		workflowsPath,
		enableDocs,
		projectRoot: rootDir,
	};

	await runDev(modeArg, serveOptions);
}

function isServeMode(value: string): value is ServeMode {
	return value === "all" || value === "rest" || value === "workflow" || value === "rpc";
}

interface DevStopOptions {
	root?: string;
}

export async function devStopCommand(options: DevStopOptions): Promise<void> {
	const rootDir = resolve(options.root ?? process.cwd());
	await stopDevServer(rootDir);
}

interface DevLogsOptions {
	root?: string;
	tail?: number;
	json?: boolean;
}

export async function devLogsCommand(options: DevLogsOptions): Promise<void> {
	const rootDir = resolve(options.root ?? process.cwd());
	const tailValue = options.tail !== undefined ? parsePositiveInteger(options.tail, "tail") : undefined;
	const rootLabel = (() => {
		const relativeRoot = relative(process.cwd(), rootDir);
		if (!relativeRoot || relativeRoot === "") return rootDir;
		return relativeRoot;
	})();
	const result = await readDevLogs({ projectRoot: rootDir, tail: tailValue });
	if (!result) {
		if (options.json) {
			console.log(JSON.stringify({ running: false, lines: [] }, null, 2));
		} else {
			console.log(`[c4c] No running dev server found (searched from ${rootLabel}).`);
		}
		return;
	}
	if (options.json) {
		console.log(JSON.stringify({ 
			running: true, 
			lines: result.lines,
			nextOffset: result.nextOffset 
		}, null, 2));
	} else {
		if (result.lines.length === 0) {
			console.log("[c4c] No new log entries.");
			return;
		}
		for (const line of result.lines) {
			console.log(line);
		}
	}
}

function parsePositiveInteger(value: unknown, label: string): number {
	const parsed = Number.parseInt(String(value), 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error(`Invalid ${label} '${value}'`);
	}
	return parsed;
}

interface DevStatusOptions {
	root?: string;
	json?: boolean;
}

export async function devStatusCommand(options: DevStatusOptions): Promise<void> {
	const { discoverActiveSession } = await import("../lib/session.js");
	const rootDir = resolve(options.root ?? process.cwd());
	const resolved = await discoverActiveSession(rootDir);
	
	if (!resolved) {
		if (options.json) {
			console.log(JSON.stringify({ running: false }, null, 2));
		} else {
			console.log("[c4c] No running dev server found.");
		}
		return;
	}

	const { metadata } = resolved;
	
	if (options.json) {
		console.log(JSON.stringify({
			running: true,
			pid: metadata.pid,
			port: metadata.port,
			mode: metadata.mode,
			status: metadata.status,
			startedAt: metadata.startedAt,
		}, null, 2));
	} else {
		console.log(`[c4c] Dev server is running`);
		console.log(`  PID: ${metadata.pid}`);
		console.log(`  Port: ${metadata.port}`);
		console.log(`  Mode: ${metadata.mode}`);
		console.log(`  Status: ${metadata.status}`);
		console.log(`  Started: ${metadata.startedAt}`);
	}
}
