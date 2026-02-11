import { execSync } from "node:child_process";
import { resolve } from "node:path";

interface DevOptions {
	port: string;
	root: string;
}

export async function devCommand(options: DevOptions) {
	const rootDir = resolve(options.root);
	const port = Number(options.port);

	// Step 1: Build workflows
	console.log("[c4c] Building workflows...");
	try {
		execSync("npx workflow build", {
			cwd: rootDir,
			stdio: "inherit",
		});
	} catch {
		console.error("[c4c] Build failed");
		process.exit(1);
	}

	// Step 2: Create ESM wrappers for CJS bundles
	const { existsSync, readFileSync, writeFileSync } = await import("node:fs");
	const { join } = await import("node:path");
	const wellKnown = join(rootDir, ".well-known", "workflow", "v1");

	for (const name of ["flow", "step"]) {
		const jsPath = join(wellKnown, `${name}.js`);
		if (existsSync(jsPath)) {
			const content = readFileSync(jsPath, "utf-8");
			// CJS bundles use module.exports
			if (content.includes("module.exports")) {
				writeFileSync(join(wellKnown, `${name}.cjs`), content);
				const wrapper = `import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);\nconst mod = require("./${name}.cjs");\nexport const POST = mod.POST;\nexport default mod;\n`;
				writeFileSync(join(wellKnown, `${name}.mjs`), wrapper);
			}
		}
	}

	// webhook.js is already ESM, just copy
	const webhookPath = join(wellKnown, "webhook.js");
	if (existsSync(webhookPath)) {
		const content = readFileSync(webhookPath, "utf-8");
		if (!content.includes("module.exports")) {
			writeFileSync(join(wellKnown, "webhook.mjs"), content);
		}
	}

	console.log("[c4c] ESM wrappers created");

	// Step 3: Start server
	console.log(`[c4c] Starting dev server on port ${port}...`);
	const { createWorkflowServer } = await import("@c4c/adapters");
	await createWorkflowServer({ port, rootDir });
}
