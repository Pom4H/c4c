#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectRegistry } from "@tsdev/core";
import { createHttpServer } from "@tsdev/adapters";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..", "..");
const HANDLERS_DIR = path.join(PACKAGE_ROOT, "src", "handlers");
const ENV_PATH = path.join(PACKAGE_ROOT, ".env");
const PORT = Number.parseInt(process.env.PORT ?? "3100", 10);

async function loadEnv() {
	try {
		const contents = await fs.readFile(ENV_PATH, "utf8");
		for (const line of contents.split(/\r?\n/u)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) {
				continue;
			}

			const equalsIndex = trimmed.indexOf("=");
			if (equalsIndex === -1) {
				continue;
			}

			const key = trimmed.slice(0, equalsIndex).trim();
			if (!key || key in process.env) {
				continue;
			}

			const rawValue = trimmed.slice(equalsIndex + 1).trim();
			const value = rawValue.replace(/^['"]|['"]$/gu, "");
			process.env[key] = value;
		}
		console.log(`🌱 Loaded environment variables from ${path.relative(PACKAGE_ROOT, ENV_PATH)}`);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			console.warn(`⚠️  Failed to load .env file: ${(error as Error).message}`);
		}
	}
}

async function main() {
	await loadEnv();

	console.log("🔍 Collecting procedures from generated handlers...");
	const registry = await collectRegistry(HANDLERS_DIR);
	console.log(`✅ Registered ${registry.size} procedures`);

	createHttpServer(registry, PORT);
	console.log(`🚀 Runtime ready on http://localhost:${PORT}`);
}

main().catch((error) => {
	console.error("❌ Failed to start integrations runtime:", error);
	process.exit(1);
});
