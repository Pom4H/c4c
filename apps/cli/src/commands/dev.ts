import { resolve, relative } from "node:path";
import { dev as runDev, type ServeOptions } from "../lib/server.js";
import { determineHandlersPath, determineWorkflowsPath } from "../lib/project-paths.js";
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
    json?: boolean;
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
    // If --json is specified, print raw JSONL lines as-is.
    if (options.json) {
        for (const line of result.lines) {
            console.log(line);
        }
        return;
    }
    // Otherwise, pretty-print parsed entries.
    for (const line of result.lines) {
        const entry = parseJsonlLogLine(line);
        if (!entry) {
            console.log(line);
            continue;
        }
        console.log(formatPrettyLogEntry(entry));
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
interface DevLogEntry {
    timestamp: string;
    level: string;
    message: string;
}

function parseJsonlLogLine(line: string): DevLogEntry | null {
    try {
        const parsed = JSON.parse(line) as Partial<DevLogEntry>;
        if (!parsed || typeof parsed !== "object") return null;
        if (typeof parsed.timestamp !== "string") return null;
        if (typeof parsed.level !== "string") return null;
        if (typeof parsed.message !== "string") return null;
        return { timestamp: parsed.timestamp, level: parsed.level, message: parsed.message };
    } catch {
        return null;
    }
}

function formatPrettyLogEntry(entry: DevLogEntry): string {
    const ts = formatTime(entry.timestamp);
    const level = normalizeLevel(entry.level);
    const icon = levelIcon(level);
    const coloredLevel = colorizeLevel(level);
    return `${dim(`[${ts}]`)} ${icon} ${coloredLevel} ${entry.message}`.trim();
}

function formatTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function normalizeLevel(lvl: string): "info" | "warn" | "error" | "log" {
    const v = String(lvl).toLowerCase();
    if (v === "warn" || v === "warning") return "warn";
    if (v === "error" || v === "err") return "error";
    if (v === "info") return "info";
    if (v === "log") return "log";
    return "info";
}

function levelIcon(level: ReturnType<typeof normalizeLevel>): string {
    switch (level) {
        case "warn":
            return "⚠";
        case "error":
            return "✖";
        case "info":
        case "log":
        default:
            return "ℹ";
    }
}

// Minimal color utilities (mirrors style used elsewhere)
const COLOR_RESET = "\u001B[0m";
const COLOR_CYAN = "\u001B[36m";
const COLOR_YELLOW = "\u001B[33m";
const COLOR_RED = "\u001B[31m";
const COLOR_DIM = "\u001B[90m";

function colorEnabled(): boolean {
    return Boolean(process.stdout?.isTTY && !process.env.NO_COLOR);
}

function dim(text: string): string {
    if (!colorEnabled()) return text;
    return `${COLOR_DIM}${text}${COLOR_RESET}`;
}

function colorize(text: string, colorCode: string): string {
    if (!colorEnabled()) return text;
    return `${colorCode}${text}${COLOR_RESET}`;
}

function colorizeLevel(level: ReturnType<typeof normalizeLevel>): string {
    switch (level) {
        case "warn":
            return colorize("WARN", COLOR_YELLOW);
        case "error":
            return colorize("ERROR", COLOR_RED);
        case "info":
            return colorize("INFO", COLOR_CYAN);
        case "log":
        default:
            return colorize("INFO", COLOR_CYAN);
    }
}
