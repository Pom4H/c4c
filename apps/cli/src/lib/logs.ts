import { promises as fs } from "node:fs";
import { splitLines, tailLines } from "../internal/utils/logs.js";
import { discoverActiveSession, readLogState, writeLogState } from "./session.js";
import type { DevLogReadResult } from "./types.js";

const MAX_LOG_TAIL_LINES = 500;

export interface DevLogsOptions {
	projectRoot: string;
	tail?: number;
}

export async function readDevLogs(options: DevLogsOptions): Promise<DevLogReadResult | null> {
	const resolved = await discoverActiveSession(options.projectRoot);
	if (!resolved) {
		return null;
	}

	const { paths: sessionPaths } = resolved;
	const timestamp = new Date().toISOString();
	const tailInput = typeof options.tail === "number" && options.tail > 0 ? Math.floor(options.tail) : undefined;
	const tail = tailInput ? Math.min(tailInput, MAX_LOG_TAIL_LINES) : undefined;
	const state = await readLogState(sessionPaths);

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
