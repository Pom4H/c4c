import { resolve, relative } from "node:path";
import { dev as runDev, type ServeOptions } from "../lib/server.js";
import type { DevUserType, ServeMode } from "../lib/types.js";
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
	agent?: boolean;
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

	const userType: DevUserType = options.agent ? "agent" : "human";
	const serveOptions: ServeOptions = {
		port: options.port,
		handlersPath,
		workflowsPath,
		enableDocs,
		projectRoot: rootDir,
		userType,
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
	for (const line of result.lines) {
		console.log(line);
	}
}

function parsePositiveInteger(value: unknown, label: string): number {
	const parsed = Number.parseInt(String(value), 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error(`Invalid ${label} '${value}'`);
	}
	return parsed;
}
