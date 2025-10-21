import { resolve, relative } from "node:path";
import { dev as runDev, type ServeOptions } from "../lib/server.js";
import { determineHandlersPath, determineWorkflowsPath } from "../internal/utils/project-paths.js";
import { stopDevServer } from "../lib/stop.js";
import { readDevLogs } from "../lib/logs.js";
import { getDevStatus } from "../lib/status.js";

interface DevCommandOptions {
	port?: number;
	root?: string;
	handlers?: string;
	workflows?: string;
	docs?: boolean;
}

export async function devCommand(options: DevCommandOptions): Promise<void> {
	const rootDir = resolve(options.root ?? process.cwd());
	const handlersPath = determineHandlersPath(rootDir, options.handlers);
	const workflowsPath = determineWorkflowsPath(rootDir, options.workflows);

    const enableDocs = options.docs ? true : undefined;

	const serveOptions: ServeOptions = {
		port: options.port,
		handlersPath,
		workflowsPath,
		enableDocs,
		projectRoot: rootDir,
	};

    await runDev("all", serveOptions);
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
		console.log(`[c4c] No running dev server found (searched from ${rootLabel}).`);
		return;
	}
    if (result.lines.length === 0) {
        console.log("[c4c] No new log entries.");
        return;
    }
    // Logs are already JSONL; just print lines as-is.
    for (const line of result.lines) {
        console.log(line);
    }
}

interface DevStatusOptions {
    root?: string;
    json?: boolean;
}

export async function devStatusCommand(options: DevStatusOptions): Promise<void> {
    const rootDir = resolve(options.root ?? process.cwd());
    const status = await getDevStatus(rootDir);
    if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
    }
    if (status.status === "none") {
        console.log(`[c4c] No running dev server found (searched from ${rootDir}).`);
        return;
    }
    console.log(`[c4c] Dev server is ${status.status} on port ${status.port} (pid ${status.pid}).`);
}

function parsePositiveInteger(value: unknown, label: string): number {
	const parsed = Number.parseInt(String(value), 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error(`Invalid ${label} '${value}'`);
	}
	return parsed;
}

// No parsing helpers needed; dev logs are JSONL.
