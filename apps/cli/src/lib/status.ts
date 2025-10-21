import { discoverActiveSession } from "./session.js";
import type { DevStatusReport } from "./types.js";

export async function getDevStatus(projectRoot: string): Promise<DevStatusReport> {
  const resolved = await discoverActiveSession(projectRoot);
  if (!resolved) {
    return { status: "none" };
  }
  const { metadata } = resolved;
  return {
    status: metadata.status,
    pid: metadata.pid,
    port: metadata.port,
    mode: metadata.mode,
    projectRoot: metadata.projectRoot,
    proceduresPath: metadata.proceduresPath,
    startedAt: metadata.startedAt,
  };
}
