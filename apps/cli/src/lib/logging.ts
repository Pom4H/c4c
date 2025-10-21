import { promises as fs } from "node:fs";
import { format } from "node:util";
import type { ConsoleMethod, LogWriter } from "./types.js";

export function createLogWriter(logFile: string): LogWriter {
	let pending: Promise<void> = Promise.resolve();

	const enqueue = (line: string) => {
		pending = pending
			.then(() => fs.appendFile(logFile, line, "utf8"))
			.catch(() => {});
	};

    return {
        write(method: ConsoleMethod, args: unknown[]) {
            const timestamp = new Date().toISOString();
            const message = format(...args);
            const level = method === "log" ? "info" : method;
            const entry = {
                timestamp,
                level,
                message,
            } as const;
            enqueue(JSON.stringify(entry) + "\n");
        },
        flush() {
            return pending.catch(() => {});
        },
    };
}

export function interceptConsole(logWriter: LogWriter): () => void {
	const methods: ConsoleMethod[] = ["log", "info", "warn", "error"];
	const originals = new Map<ConsoleMethod, (...args: unknown[]) => void>();

	for (const method of methods) {
		const original = console[method].bind(console) as (...args: unknown[]) => void;
		originals.set(method, original);
		(console as Record<ConsoleMethod, (...args: unknown[]) => void>)[method] = (...args: unknown[]) => {
			logWriter.write(method, args);
			original(...args);
		};
	}

	return () => {
		for (const method of methods) {
			const original = originals.get(method);
			if (original) {
				(console as Record<ConsoleMethod, (...args: unknown[]) => void>)[method] = original;
			}
		}
	};
}
