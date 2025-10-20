#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { Command } from "commander";
import { isAbsolute, join, relative, resolve } from "node:path";
import process from "node:process";
import {
	serve,
	generateClient,
	type GenerateClientOptions,
	type ServeMode,
	type ServeOptions,
} from "./index.js";

const pkg = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8")
);

const program = new Command();
program
	.name("c4c")
	.description("c4c (Code For Coders) CLI")
	.version(pkg.version ?? "0.0.0");

program
	.command("serve")
	.description("Start the c4c HTTP server")
	.argument("[mode]", "Mode to run (all|rest|workflow|rpc|ui)", "all")
	.option("-p, --port <number>", "Port to listen on", parsePort)
	.option("--root <path>", "Project root containing handlers/ and workflows", process.cwd())
	.option("--handlers <path>", "Custom handlers directory (overrides root)")
	.option("--workflows <path>", "Custom workflows directory (overrides root)")
	.option("--docs", "Force enable docs endpoints")
	.option("--disable-docs", "Disable docs endpoints")
	.option("--quiet", "Reduce startup logging")
	.option("--api-base <url>", "Workflow API base URL used in UI mode", process.env.C4C_API_BASE)
	.action(async (modeArg: string, options) => {
		try {
			const rootDir = resolve(options.root ?? process.cwd());
			const handlersPath = determineHandlersPath(rootDir, options.handlers);
			const workflowsPath = determineWorkflowsPath(rootDir, options.workflows);

		if (options.quiet) {
			process.env.C4C_QUIET = "1";
		}

			const enableDocs =
				options.docs ? true : options.disableDocs ? false : undefined;

			const serveOptions: ServeOptions = {
				port: options.port,
				handlersPath,
				workflowsPath,
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
			console.error(`[c4c] Unknown serve mode '${modeArg}'.`);
			process.exit(1);
		}

		await serve(modeArg, serveOptions);
	} catch (error) {
		console.error(
			`[c4c] ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
});

const generate = program
	.command("generate")
	.description("Run code generators");

generate
	.command("client")
	.description("Generate a typed client from contracts")
	.option("--root <path>", "Project root containing handlers/", process.cwd())
	.option("--handlers <path>", "Custom handlers directory (overrides root)")
	.option("--out <file>", "Output file for the generated client", "c4c-client.ts")
	.option("--base-url <url>", "Base URL embedded in generated client")
	.action(async (options) => {
		try {
		const rootDir = resolve(options.root ?? process.cwd());
		const handlersPath = determineHandlersPath(rootDir, options.handlers);
		const outFile = resolveOutputPath(options.out ?? "c4c-client.ts");

		const clientOptions: GenerateClientOptions = {
			outFile,
			handlersPath,
			baseUrl: options.baseUrl,
		};

		const outputPath = await generateClient(clientOptions);
		const outputLabel = relative(process.cwd(), outputPath) || outputPath;
		console.log(`[c4c] Generated client at ${outputLabel}`);
	} catch (error) {
		console.error(
			`[c4c] ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
});

program.parseAsync(process.argv).catch((error) => {
	console.error(`[c4c] ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});

function parsePort(value: string): number {
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed <= 0) {
		throw new Error(`Invalid port '${value}'`);
	}
	return parsed;
}

function isServeMode(value: string): value is ServeMode {
	return value === "all" || value === "rest" || value === "workflow" || value === "rpc";
}

function determineHandlersPath(root: string, explicit?: string): string {
	const candidates = [
		explicit,
		process.env.C4C_HANDLERS,
		join(root, "handlers"),
		join(root, "src/handlers"),
	];
	return pickPath(root, candidates, join(root, "src/handlers"));
}

function determineWorkflowsPath(root: string, explicit?: string): string {
	const candidates = [
		explicit,
		process.env.C4C_WORKFLOWS_DIR,
		join(root, "workflows"),
	];
	return pickPath(root, candidates, join(root, "workflows"));
}

function pickPath(root: string, candidates: Array<string | undefined>, fallback: string): string {
	let chosen = resolvePath(root, fallback);

	for (const candidate of candidates) {
		if (!candidate) continue;
		const resolved = resolvePath(root, candidate);
		chosen = resolved;
		if (existsSync(resolved)) {
			return resolved;
		}
	}

	return chosen;
}

function resolvePath(root: string, candidate: string): string {
	return isAbsolute(candidate) ? candidate : resolve(root, candidate);
}

function resolveOutputPath(path: string): string {
	return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

async function startUi(options: ServeOptions) {
	const defaultUiPort = Number.parseInt(process.env.C4C_UI_PORT ?? "3100", 10);
	const uiPort = options.port ?? (Number.isNaN(defaultUiPort) ? 3100 : defaultUiPort);
	const apiBase =
		options.apiBaseUrl ?? process.env.C4C_API_BASE ?? "http://localhost:3000";

	console.log(
		`[c4c] Starting workflow UI on http://localhost:${uiPort} (API ${apiBase})`
	);

	const workflowsDir =
		options.workflowsPath ?? determineWorkflowsPath(process.cwd());

	const child = spawn("pnpm", ["--filter", "@c4c/app-workflow", "dev"], {
		stdio: "inherit",
		cwd: process.cwd(),
		env: {
			...process.env,
			PORT: String(uiPort),
			C4C_API_BASE: apiBase,
			C4C_RPC_BASE: `${apiBase.replace(/\/$/, "")}/rpc`,
			C4C_WORKFLOWS_DIR: workflowsDir,
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
