import type { Contract } from "@c4c/core";
import { z } from "zod";

/**
 * Maximum number of log lines that can be tailed in a single request.
 */
export const DEV_CONTROL_LOG_TAIL_LIMIT = 500;

/**
 * Input schema for dev.control.stop
 */
export const devControlStopInput = z.object({
	reason: z.string().optional(),
});

/**
 * Output schema for dev.control.stop
 */
export const devControlStopOutput = z.object({
	status: z.literal("stopping"),
});

/**
 * Contract for stopping the dev server.
 */
export const devControlStopContract = {
	name: "dev.control.stop",
	description: "Stops the running c4c dev server",
	input: devControlStopInput,
	output: devControlStopOutput,
	metadata: {
		exposure: "external",
		roles: ["sdk-client", "api-endpoint"],
		category: "devtools",
		tags: ["cli", "control"],
	},
} as unknown as Contract;

/**
 * Input schema for dev.control.logs
 */
export const devControlLogsInput = z.object({
	offset: z.number().int().min(0).optional(),
	tail: z.number().int().min(1).max(DEV_CONTROL_LOG_TAIL_LIMIT).optional(),
});

/**
 * Output schema for dev.control.logs
 */
export const devControlLogsOutput = z.object({
	lines: z.array(z.string()),
	nextOffset: z.number().int().min(0),
});

/**
 * Contract for reading dev server logs.
 */
export const devControlLogsContract = {
	name: "dev.control.logs",
	description: "Reads logs from the running c4c dev server",
	input: devControlLogsInput,
	output: devControlLogsOutput,
	metadata: {
		exposure: "external",
		roles: ["sdk-client", "api-endpoint"],
		category: "devtools",
		tags: ["cli", "logs"],
	},
} as unknown as Contract;
