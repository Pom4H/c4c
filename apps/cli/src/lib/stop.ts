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

	const url = new URL(`/rpc/${encodeURIComponent("dev.control.stop")}`, `http://127.0.0.1:${metadata.port}`).toString();
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 5000);

	let stopRequestAccepted = false;
	let fallbackReason: string | null = null;
	try {
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ reason: "cli-stop" }),
			signal: controller.signal,
		});
		if (response.ok) {
			stopRequestAccepted = true;
		} else if (response.status === 404) {
			fallbackReason = "Procedure not found (older dev server). Falling back to signal-based shutdown.";
		} else {
			fallbackReason = `Stop request responded with status ${response.status}`;
		}
	} catch (error) {
		if (controller.signal.aborted) {
			throw new Error("Timed out while contacting the dev server.");
		}
		fallbackReason = error instanceof Error ? error.message : String(error);
	} finally {
		clearTimeout(timeout);
	}

	if (fallbackReason) {
		console.warn(`[c4c] ${fallbackReason}`);
	}

	if (stopRequestAccepted) {
		console.log(`[c4c] Stop request sent to dev server (pid ${metadata.pid}).`);
	} else {
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
