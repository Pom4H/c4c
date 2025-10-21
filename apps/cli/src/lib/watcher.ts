import { promises as fs } from "node:fs";
import { watch, type FileChangeInfo } from "node:fs/promises";
import { resolve } from "node:path";
import type { Registry, RegistryModuleIndex } from "@c4c/core";
import { isSupportedHandlerFile, reloadModuleProcedures, removeModuleProcedures } from "./registry.js";

export async function fileExists(path: string): Promise<boolean> {
	try {
		const stats = await fs.stat(path);
		return stats.isFile();
	} catch {
		return false;
	}
}

export function isRecursiveWatchUnavailable(error: unknown): boolean {
	return (
		error instanceof Error &&
		"code" in error &&
		(error as NodeJS.ErrnoException).code === "ERR_FEATURE_UNAVAILABLE_ON_PLATFORM"
	);
}

export function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError";
}

export async function watchHandlers(
	handlersPath: string,
	moduleIndex: RegistryModuleIndex,
	registry: Registry,
	signal: AbortSignal,
	onError: (error: unknown) => void
): Promise<void> {
	try {
		let watcher: AsyncIterable<FileChangeInfo<string>>;
		try {
			watcher = watch(handlersPath, {
				recursive: true,
				signal,
			});
		} catch (error) {
			if (isRecursiveWatchUnavailable(error)) {
				console.warn(
					"[c4c] Recursive watching is not supported on this platform. Watching the top-level handlers directory only."
				);
				watcher = watch(handlersPath, { signal });
			} else {
				throw error;
			}
		}

		for await (const event of watcher) {
			const fileName = event.filename;
			if (!fileName) continue;
			const filePath = resolve(handlersPath, fileName);
			if (!isSupportedHandlerFile(filePath)) continue;

			const exists = await fileExists(filePath);
			if (event.eventType === "rename" && !exists) {
				await removeModuleProcedures(moduleIndex, registry, filePath, handlersPath);
				continue;
			}

			if (!exists) continue;
			await reloadModuleProcedures(moduleIndex, registry, filePath, handlersPath);
		}
	} catch (error) {
		if (!isAbortError(error)) {
			console.error(
				`[c4c] Watcher stopped: ${error instanceof Error ? error.message : String(error)}`
			);
			onError(error);
		}
	}
}
