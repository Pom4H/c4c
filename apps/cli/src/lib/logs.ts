import { promises as fs } from "node:fs";
import { DEV_LOG_TAIL_LIMIT } from "./constants.js";
import { splitLines, tailLines } from "./log-utils.js";
import { discoverActiveSession, readLogState, writeLogState } from "./session.js";
import type { DevLogReadResult, DevSessionMetadata } from "./types.js";

const MAX_LOG_TAIL_LINES = DEV_LOG_TAIL_LIMIT;

export interface DevLogsOptions {
	projectRoot: string;
	tail?: number;
}

export async function readDevLogs(options: DevLogsOptions): Promise<DevLogReadResult | null> {
	const resolved = await discoverActiveSession(options.projectRoot);
	if (!resolved) {
		return null;
	}

	const { paths: sessionPaths, metadata } = resolved;
	const timestamp = new Date().toISOString();
	const tailInput = typeof options.tail === "number" && options.tail > 0 ? Math.floor(options.tail) : undefined;
	const tail = tailInput ? Math.min(tailInput, MAX_LOG_TAIL_LINES) : undefined;
	const state = await readLogState(sessionPaths);
	const requestPayload: { tail?: number; offset?: number } = {};
	if (tail) {
		requestPayload.tail = tail;
	} else {
		requestPayload.offset = state.lastReadBytes;
	}

	let buffer: Buffer;
	try {
		buffer = await fs.readFile(sessionPaths.logFile);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { lines: [], nextOffset: 0 };
		}
		throw error;
	}

	const byteLength = buffer.byteLength;
	if (tail) {
		const lines = tailLines(splitLines(buffer.toString("utf8")), tail);
		await writeLogState(sessionPaths, { lastReadBytes: byteLength, updatedAt: timestamp });
		return { lines, nextOffset: byteLength };
	}

	const startOffset = state.lastReadBytes > byteLength ? 0 : state.lastReadBytes;
	const slice = startOffset > 0 ? buffer.subarray(startOffset) : buffer;
	const lines = splitLines(slice.toString("utf8"));
	await writeLogState(sessionPaths, { lastReadBytes: byteLength, updatedAt: timestamp });
	return { lines, nextOffset: byteLength };
}
