import { readFile } from "node:fs/promises";
import type { Procedure } from "@c4c/core";
import { devControlLogsContract, devControlStopContract } from "../contracts/dev-control.js";
import { splitLines, tailLines } from "../utils/logs.js";

export interface DevControlProcedureDescriptor {
	name: string;
	procedure: Procedure;
	sourcePath: string;
}

export interface DevControlHandlerOptions {
	requestStop: (reason?: string) => void;
	logFile: string;
	sourcePath: string;
}

/**
 * Create procedures for controlling the dev server.
 */
export function createDevControlProcedures(
	options: DevControlHandlerOptions
): DevControlProcedureDescriptor[] {
	const { requestStop, logFile, sourcePath } = options;

	const stopProcedure = {
		contract: devControlStopContract,
		handler: async ({ reason }: { reason?: string }) => {
			setImmediate(() => {
				requestStop(reason);
			});
			return { status: "stopping" } as const;
		},
	} as unknown as Procedure;

	const logsProcedure = {
		contract: devControlLogsContract,
		handler: async ({ offset, tail }: { offset?: number; tail?: number }) => {
			try {
				const buffer = await readFile(logFile);
				const byteLength = buffer.byteLength;

				if (tail && tail > 0) {
					const lines = tailLines(splitLines(buffer.toString("utf8")), tail);
					return { lines, nextOffset: byteLength } as const;
				}

				const start = typeof offset === "number" && offset >= 0 ? Math.min(offset, byteLength) : 0;
				const slice = start > 0 ? buffer.subarray(start) : buffer;
				const lines = splitLines(slice.toString("utf8"));
				return { lines, nextOffset: byteLength } as const;
			} catch (error) {
				throw new Error(
					`Unable to read dev logs: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		},
	} as unknown as Procedure;

	return [
		{ name: stopProcedure.contract.name, procedure: stopProcedure, sourcePath },
		{ name: logsProcedure.contract.name, procedure: logsProcedure, sourcePath },
	];
}
