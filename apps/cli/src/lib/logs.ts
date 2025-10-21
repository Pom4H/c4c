import { promises as fs } from "node:fs";
import { DEV_CONTROL_LOG_TAIL_LIMIT } from "../internal/contracts/dev-control.js";
import { splitLines, tailLines } from "../internal/utils/logs.js";
import { discoverActiveSession, readLogState, writeLogState } from "./session.js";
import type { DevLogReadResult, DevSessionMetadata } from "./types.js";

const MAX_LOG_TAIL_LINES = DEV_CONTROL_LOG_TAIL_LIMIT;

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

	const rpcResult = await callDevLogsProcedure(metadata, requestPayload);
	if (rpcResult) {
		await writeLogState(sessionPaths, {
			lastReadBytes: rpcResult.nextOffset,
			updatedAt: timestamp,
		});
		return rpcResult;
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

async function callDevLogsProcedure(
	metadata: DevSessionMetadata,
	body: { tail?: number; offset?: number }
): Promise<DevLogReadResult | null> {
	if (!metadata.port) {
		return null;
	}
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 1500);
	try {
		const response = await fetch(
			new URL(`/rpc/${encodeURIComponent("dev.control.logs")}`, `http://127.0.0.1:${metadata.port}`).toString(),
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
				signal: controller.signal,
			}
		);
		if (response.status === 404) {
			return null;
		}
		if (!response.ok) {
			return null;
		}
		const data = (await response.json()) as { lines?: unknown; nextOffset?: unknown };
		if (!Array.isArray(data.lines) || typeof data.nextOffset !== "number") {
			return null;
		}
		const lines = data.lines.map((line) => String(line));
		return { lines, nextOffset: data.nextOffset };
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}
