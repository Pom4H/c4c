import { execSync } from "node:child_process";
import { resolve } from "node:path";

interface BuildOptions {
	root: string;
}

export function buildCommand(options: BuildOptions) {
	const rootDir = resolve(options.root);
	console.log(`[c4c] Building workflows in ${rootDir}...`);

	try {
		execSync("npx workflow build", {
			cwd: rootDir,
			stdio: "inherit",
		});
	} catch {
		console.error("[c4c] Build failed");
		process.exit(1);
	}
}
