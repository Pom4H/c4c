import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { serve as runServe, type ServeOptions } from "../lib/server.js";
import type { ServeMode } from "../lib/types.js";

interface ServeCommandOptions {
    port?: number;
    root?: string;
    docs?: boolean;
    apiBase?: string;
}

/**
 * Serve command - starts HTTP server with artifacts discovered via introspection
 * No hardcoded paths! Scans entire project.
 */
export async function serveCommand(modeArg: string, options: ServeCommandOptions): Promise<void> {
	const rootDir = resolve(options.root ?? process.cwd());
	const enableDocs = options.docs ? true : undefined;

	const serveOptions: ServeOptions = {
		port: options.port,
		root: rootDir,
		enableDocs,
	};

	if (modeArg === "ui") {
		await startUi({
			...serveOptions,
			apiBaseUrl: options.apiBase,
		});
		return;
	}

	if (!isServeMode(modeArg)) {
		throw new Error(`Unknown serve mode '${modeArg}'.`);
	}

	await runServe(modeArg, serveOptions);
}

function isServeMode(value: string): value is ServeMode {
	return value === "all" || value === "rest" || value === "workflow" || value === "rpc";
}

async function startUi(options: ServeOptions): Promise<void> {
	const defaultUiPort = Number.parseInt(process.env.C4C_UI_PORT ?? "3100", 10);
	const uiPort = options.port ?? (Number.isNaN(defaultUiPort) ? 3100 : defaultUiPort);
	const apiBase = options.apiBaseUrl ?? process.env.C4C_API_BASE ?? "http://localhost:3000";

	console.log(
		`[c4c] Starting workflow UI on http://localhost:${uiPort} (API ${apiBase})`
	);

	const projectRoot = options.root ?? process.cwd();

	const child = spawn("pnpm", ["--filter", "@c4c/app-workflow", "dev"], {
		stdio: "inherit",
		cwd: process.cwd(),
		env: {
			...process.env,
			PORT: String(uiPort),
			C4C_API_BASE: apiBase,
			C4C_RPC_BASE: `${apiBase.replace(/\/$/, "")}/rpc`,
			C4C_PROJECT_ROOT: projectRoot,
			NEXT_PUBLIC_C4C_API_BASE: apiBase,
			NEXT_PUBLIC_C4C_WORKFLOW_STREAM_BASE: `${apiBase.replace(/\/$/, "")}/workflow/executions`,
		},
	});

	const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
	const forwarders: Record<string, () => void> = {};

	const cleanup = () => {
		for (const signal of signals) {
			const handler = forwarders[signal];
			if (handler) {
				process.removeListener(signal, handler);
			}
		}
	};

	for (const signal of signals) {
		const handler = () => {
			if (!child.killed) {
				child.kill(signal);
			}
		};
		forwarders[signal] = handler;
		process.on(signal, handler);
	}

	await new Promise<void>((resolvePromise, rejectPromise) => {
		child.on("error", (error) => {
			cleanup();
			rejectPromise(error);
		});
		child.on("exit", (code, signal) => {
			cleanup();
			if (signal) {
				process.kill(process.pid, signal);
				return;
			}
			if (typeof code === "number" && code !== 0) {
				rejectPromise(new Error(`Workflow UI exited with code ${code}`));
				return;
			}
			resolvePromise();
		});
	});
}
