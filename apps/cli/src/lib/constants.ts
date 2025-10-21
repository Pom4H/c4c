import type { HttpAppOptions } from "@c4c/adapters";
import type { ServeMode } from "./types.js";

export const DEV_DIR_NAME = ".c4c";
export const DEV_SESSION_SUBDIR = "dev";
export const DEV_SESSION_FILE_NAME = "session.json";
export const DEV_LOG_FILE_NAME = "dev.jsonl";
export const DEV_LOG_STATE_FILE_NAME = "log-state.json";
export const DEV_LOG_TAIL_LIMIT = 500;
export const SESSION_DISCOVERY_MAX_DEPTH = 3;
export const SESSION_DISCOVERY_IGNORE_DIRS = new Set([
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

export const DEFAULT_WORKFLOWS_PATH = "workflows";

export const DEFAULTS: Record<ServeMode, Required<Omit<HttpAppOptions, "port">>> = {
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
