import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import {
    DEV_DIR_NAME,
    DEV_LOG_FILE_NAME,
    DEV_LOG_STATE_FILE_NAME,
    DEV_SESSION_FILE_NAME,
    DEV_SESSION_SUBDIR,
    SESSION_DISCOVERY_IGNORE_DIRS,
    SESSION_DISCOVERY_MAX_DEPTH,
} from "./constants.js";
import { isProcessAlive } from "./process.js";
import type { DevLogState, DevSessionMetadata, DevSessionPaths, DiscoveredSession } from "./types.js";

export function getDevSessionPaths(projectRoot: string): DevSessionPaths {
	const directory = resolve(projectRoot, DEV_DIR_NAME, DEV_SESSION_SUBDIR);
	return {
		directory,
		sessionFile: resolve(directory, DEV_SESSION_FILE_NAME),
		logFile: resolve(directory, DEV_LOG_FILE_NAME),
		logStateFile: resolve(directory, DEV_LOG_STATE_FILE_NAME),
	};
}

export async function readDevSessionMetadata(paths: DevSessionPaths): Promise<DevSessionMetadata | null> {
	try {
		const raw = await fs.readFile(paths.sessionFile, "utf8");
		return JSON.parse(raw) as DevSessionMetadata;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return null;
		}
		throw error;
	}
}

export async function writeDevSessionMetadata(paths: DevSessionPaths, metadata: DevSessionMetadata): Promise<void> {
	await fs.mkdir(paths.directory, { recursive: true });
	await fs.writeFile(paths.sessionFile, JSON.stringify(metadata, null, 2), "utf8");
}

export async function removeDevSessionArtifacts(paths: DevSessionPaths): Promise<void> {
	await removeIfExists(paths.sessionFile);
	await removeIfExists(paths.logStateFile);
}

async function removeIfExists(path: string): Promise<void> {
	try {
		await fs.rm(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return;
		}
		throw error;
	}
}

export async function ensureDevSessionAvailability(paths: DevSessionPaths): Promise<void> {
    const existing = await readDevSessionMetadata(paths);
    if (!existing) return;

    const { pid, status, startedAt } = existing;
    const processAlive = Boolean(pid && isProcessAlive(pid));

    if (processAlive) {
        // If a dev server process is alive, consider it running and prevent starting another.
        throw new Error(
            `A c4c dev server already appears to be running (pid ${pid}). Use "pnpm \"c4c dev stop\"" before starting a new session.`
        );
    }

    // If the previous process died very recently during startup, ask to retry shortly.
    if (status === "running") {
        const startedMs = startedAt ? Date.parse(startedAt) : Number.NaN;
        const recentlyStarted = Number.isFinite(startedMs) && Date.now() - startedMs < 10_000;
        if (recentlyStarted) {
            throw new Error(
                `A c4c dev server is still starting up (pid ${pid}). Try again shortly or run "pnpm \"c4c dev stop\"".`
            );
        }
    }

    await removeDevSessionArtifacts(paths);
}

export async function discoverActiveSession(projectRoot: string): Promise<DiscoveredSession | null> {
	const primaryPaths = getDevSessionPaths(projectRoot);
	const primaryMetadata = await readDevSessionMetadata(primaryPaths);
	if (primaryMetadata) {
		return { paths: primaryPaths, metadata: primaryMetadata };
	}

	return findSessionRecursively(projectRoot, SESSION_DISCOVERY_MAX_DEPTH);
}

function shouldSkipSessionDiscoveryDir(name: string): boolean {
	if (SESSION_DISCOVERY_IGNORE_DIRS.has(name)) return true;
	if (name.startsWith(".")) return true;
	return false;
}

async function findSessionRecursively(baseDir: string, depth: number): Promise<DiscoveredSession | null> {
	if (depth <= 0) {
		return null;
	}

	let entries: Array<import("node:fs").Dirent>;
	try {
		entries = await fs.readdir(baseDir, { withFileTypes: true });
	} catch {
		return null;
	}

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (typeof entry.isSymbolicLink === "function" && entry.isSymbolicLink()) continue;
		if (shouldSkipSessionDiscoveryDir(entry.name)) continue;
		const candidateRoot = join(baseDir, entry.name);
		const candidatePaths = getDevSessionPaths(candidateRoot);
		const metadata = await readDevSessionMetadata(candidatePaths);
		if (metadata) {
			return { paths: candidatePaths, metadata };
		}
		const nested = await findSessionRecursively(candidateRoot, depth - 1);
		if (nested) {
			return nested;
		}
	}

	return null;
}

export async function readLogState(paths: DevSessionPaths): Promise<DevLogState> {
	try {
		const raw = await fs.readFile(paths.logStateFile, "utf8");
		const parsed = JSON.parse(raw) as DevLogState;
		if (typeof parsed.lastReadBytes === "number") {
			return parsed;
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return { lastReadBytes: 0, updatedAt: new Date().toISOString() };
		}
		console.warn(
			`[c4c] Failed to read dev log state: ${error instanceof Error ? error.message : String(error)}`
		);
	}
	return { lastReadBytes: 0, updatedAt: new Date().toISOString() };
}

export async function writeLogState(paths: DevSessionPaths, state: DevLogState): Promise<void> {
	await fs.mkdir(paths.directory, { recursive: true });
	await fs.writeFile(paths.logStateFile, JSON.stringify(state, null, 2), "utf8");
}
