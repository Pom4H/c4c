import { promises as fs } from "node:fs";
import { formatHandlersLabel } from "./formatting.js";
import { isProcessAlive, waitForProcessExit } from "./process.js";
import { discoverActiveSession, removeDevSessionArtifacts } from "./session.js";

export async function stopDevServer(projectRoot: string): Promise<void> {
	const resolved = await discoverActiveSession(projectRoot);
	if (!resolved) {
		const label = formatHandlersLabel(projectRoot);
		console.log(`[c4c] No running dev server found (searched from ${label}).`);
		return;
	}

    const { paths: sessionPaths, metadata } = resolved;

	if (!isProcessAlive(metadata.pid)) {
		console.log("[c4c] Found stale dev session metadata. Cleaning up.");
		await removeDevSessionArtifacts(sessionPaths);
		return;
	}

    // Request stop via file-based trigger first
    try {
        await fs.mkdir(sessionPaths.directory, { recursive: true });
        await fs.writeFile(sessionPaths.stopFile, "", "utf8");
        console.log(`[c4c] Stop file created. Asking dev server (pid ${metadata.pid}) to stop.`);
    } catch (e) {
        console.warn(`[c4c] Failed to write stop file: ${e instanceof Error ? e.message : String(e)}`);
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
