import { promises as fs } from "node:fs";
import { watch, type FileChangeInfo } from "node:fs/promises";
import { resolve } from "node:path";
import type { Registry, WorkflowRegistry } from "@c4c/core";
import { isSupportedHandlerFile, reloadModuleArtifacts, removeModuleArtifacts, type ArtifactModuleIndex } from "./registry.js";

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

/**
 * Watch entire project for changes to procedures and workflows
 * Single watcher - handles both artifact types
 * No hardcoded paths!
 */
export async function watchProject(
	projectRoot: string,
	moduleIndex: ArtifactModuleIndex,
	registry: Registry,
	workflowRegistry: WorkflowRegistry,
	signal: AbortSignal,
	onError: (error: unknown) => void
): Promise<void> {
	try {
		let watcher: AsyncIterable<FileChangeInfo<string>>;
		try {
			watcher = watch(projectRoot, {
				recursive: true,
				signal,
			});
		} catch (error) {
			if (isRecursiveWatchUnavailable(error)) {
				console.warn(
					"[c4c] Recursive watching is not supported on this platform. Watching only top-level directory."
				);
				watcher = watch(projectRoot, { signal });
			} else {
				throw error;
			}
		}

		for await (const event of watcher) {
			const fileName = event.filename;
			if (!fileName) continue;
			const filePath = resolve(projectRoot, fileName);
			if (!isSupportedHandlerFile(filePath)) continue;

			const exists = await fileExists(filePath);
			if (event.eventType === "rename" && !exists) {
				await removeModuleArtifacts(moduleIndex, registry, workflowRegistry, filePath, projectRoot);
				continue;
			}

			if (!exists) continue;
			await reloadModuleArtifacts(moduleIndex, registry, workflowRegistry, filePath, projectRoot);
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

/**
 * Legacy function for backward compatibility
 * @deprecated Use watchProject instead
 */
export const watchProcedures = watchProject;
