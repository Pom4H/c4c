/**
 * Post-build script: create ESM wrappers for CJS handler bundles.
 *
 * `workflow build` outputs flow.js and step.js as CommonJS.
 * We generate .mjs wrappers so they can be imported from ESM code.
 */

import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const wellKnown = join(__dirname, "..", ".well-known", "workflow", "v1");

// For CJS bundles (flow.js, step.js): rename to .cjs, create ESM .mjs wrapper
for (const name of ["flow", "step"]) {
	const cjsPath = join(wellKnown, `${name}.js`);
	const content = readFileSync(cjsPath, "utf-8");

	// Write .cjs file
	writeFileSync(join(wellKnown, `${name}.cjs`), content);

	// Write .mjs ESM wrapper that re-exports from .cjs
	const esmWrapper = `import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const mod = require("./${name}.cjs");
export const POST = mod.POST;
export default mod;
`;
	writeFileSync(join(wellKnown, `${name}.mjs`), esmWrapper);
}

// webhook.js is already ESM - just copy to .mjs for consistency
const webhookContent = readFileSync(join(wellKnown, "webhook.js"), "utf-8");
writeFileSync(join(wellKnown, "webhook.mjs"), webhookContent);

console.log("ESM wrappers created: flow.mjs, step.mjs, webhook.mjs");
