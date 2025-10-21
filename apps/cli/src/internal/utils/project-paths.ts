import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

export function resolveProjectRoot(projectRoot?: string): string {
	if (!projectRoot || projectRoot === ".") {
		return process.cwd();
	}
	return isAbsolute(projectRoot) ? projectRoot : resolve(process.cwd(), projectRoot);
}

export function determineHandlersPath(root: string, explicit?: string): string {
	const candidates = [
		explicit,
		process.env.C4C_HANDLERS,
		join(root, "handlers"),
		join(root, "src/handlers"),
	];
	return pickPath(root, candidates, join(root, "src/handlers"));
}

export function determineWorkflowsPath(root: string, explicit?: string): string {
    const candidates = [
        explicit,
        process.env.C4C_WORKFLOWS_DIR,
        join(root, "workflows"),
    ];
    // Pick workflows dir if present; otherwise, fall back to handlers dir.
    const picked = pickPath(root, candidates, join(root, "workflows"));
    if (existsSync(picked)) return picked;
    // Fall back to handlers directory to unify structure when workflows/ is absent
    return determineHandlersPath(root);
}

export function resolveOutputPath(path: string): string {
	return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

function pickPath(root: string, candidates: Array<string | undefined>, fallback: string): string {
	let chosen = resolvePath(root, fallback);

	for (const candidate of candidates) {
		if (!candidate) continue;
		const resolved = resolvePath(root, candidate);
		chosen = resolved;
		if (existsSync(resolved)) {
			return resolved;
		}
	}

	return chosen;
}

function resolvePath(root: string, candidate: string): string {
	return isAbsolute(candidate) ? candidate : resolve(root, candidate);
}

