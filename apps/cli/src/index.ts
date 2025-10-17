import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { collectRegistry } from "@tsdev/core";
import { createHttpServer, type HttpAppOptions } from "@tsdev/adapters";
import { generateRpcClientModule, type RpcClientGeneratorOptions } from "@tsdev/generators";

export type ServeMode = "all" | "rest" | "workflow" | "rpc";

export interface ServeOptions extends HttpAppOptions {
	handlersPath?: string;
	apiBaseUrl?: string;
}

const DEFAULT_WORKFLOWS_PATH = process.env.TSDEV_WORKFLOWS_DIR ?? "workflows";

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
	const handlersPath = options.handlersPath ?? process.env.TSDEV_HANDLERS ?? "src/handlers";
	const registry = await collectRegistry(handlersPath);

	const defaults = DEFAULTS[mode] ?? DEFAULTS.all;
	const httpOptions: HttpAppOptions = {
		port: options.port ?? 3000,
		enableDocs: options.enableDocs ?? defaults.enableDocs,
		enableRest: options.enableRest ?? defaults.enableRest,
		enableRpc: options.enableRpc ?? defaults.enableRpc,
		enableWorkflow: options.enableWorkflow ?? defaults.enableWorkflow,
		workflowsPath: options.workflowsPath ?? defaults.workflowsPath,
	};

	return createHttpServer(registry, httpOptions.port ?? 3000, httpOptions);
}

export interface GenerateClientOptions extends RpcClientGeneratorOptions {
	handlersPath?: string;
	outFile: string;
}

export async function generateClient(options: GenerateClientOptions): Promise<string> {
	const handlersPath = options.handlersPath ?? process.env.TSDEV_HANDLERS ?? "src/handlers";
	const registry = await collectRegistry(handlersPath);
	const moduleSource = generateRpcClientModule(registry, { baseUrl: options.baseUrl });
	const outFile = resolve(process.cwd(), options.outFile);
	await fs.mkdir(dirname(outFile), { recursive: true });
	await fs.writeFile(outFile, moduleSource, "utf8");
	return outFile;
}
