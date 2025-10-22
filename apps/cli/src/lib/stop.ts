import { promises as fs } from "node:fs";
import { formatProceduresLabel } from "./formatting.js";
import { isProcessAlive, waitForProcessExit } from "./process.js";
import { discoverActiveSession, removeDevSessionArtifacts, writeDevSessionMetadata } from "./session.js";
import type { DevSessionMetadata } from "./types.js";

export async function stopDevServer(projectRoot: string): Promise<void> {
	const resolved = await discoverActiveSession(projectRoot);
	if (!resolved) {
		const label = formatProceduresLabel(projectRoot);
		console.log(`[c4c] No running dev server found (searched from ${label}).`);
		return;
	}

    const { paths: sessionPaths, metadata } = resolved;

	if (!isProcessAlive(metadata.pid)) {
		console.log("[c4c] Found stale dev session metadata. Cleaning up.");
		await removeDevSessionArtifacts(sessionPaths);
		return;
	}

    // Ask server to stop by flipping status in session.json
    try {
        const updated: DevSessionMetadata = { ...metadata, status: "stopping" };
        await writeDevSessionMetadata(sessionPaths, updated);
        console.log(`[c4c] Stop requested via session file (pid ${metadata.pid}).`);
    } catch (e) {
        console.warn(`[c4c] Failed to update session file: ${e instanceof Error ? e.message : String(e)}`);
        console.log(`[c4c] Sending SIGTERM to dev server (pid ${metadata.pid}).`);
        try {
            process.kill(metadata.pid, "SIGTERM");
        } catch (killError) {
            throw new Error(
                `Failed to send SIGTERM to pid ${metadata.pid}: ${killError instanceof Error ? killError.message : String(killError)}`
            );
        }
    }
	const exited = await waitForProcessExit(metadata.pid, 7000);
	if (exited) {
		await removeDevSessionArtifacts(sessionPaths);
		console.log("[c4c] Dev server stopped.");
	} else {
		console.warn(
			`[c4c] Dev server (pid ${metadata.pid}) is still shutting down. Check logs if it does not exit.`
		);
	}
}
