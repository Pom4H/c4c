#!/usr/bin/env node

/**
 * Demonstration script: List all detected triggers in integrations
 */

import { collectRegistry, findTriggers, describeTrigger, groupTriggersByProvider } from "@c4c/core";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROCEDURES_PATH = resolve(SCRIPT_DIR, "..", "procedures");

async function main() {
	console.log("🔍 Discovering procedures...\n");
	
	const registry = await collectRegistry(PROCEDURES_PATH);
	
	console.log(`✅ Loaded ${registry.size} procedures\n`);
	
	// Find all triggers
	const triggers = findTriggers(registry);
	
	console.log(`\n🎯 Found ${triggers.size} triggers:\n`);
	console.log("━".repeat(80));
	
	for (const [name, procedure] of triggers) {
		console.log(`\n📡 ${name}`);
		console.log(`   ${describeTrigger(procedure)}`);
		
		if (procedure.contract.description) {
			console.log(`   📝 ${procedure.contract.description}`);
		}
	}
	
	// Group by provider
	console.log("\n\n");
	console.log("━".repeat(80));
	console.log("📦 Triggers by Provider:\n");
	
	const grouped = groupTriggersByProvider(registry);
	
	for (const [provider, providerTriggers] of grouped) {
		console.log(`\n${provider.toUpperCase()} (${providerTriggers.size} triggers):`);
		
		for (const [name, procedure] of providerTriggers) {
			const shortName = name.replace(`${provider}.`, "");
			console.log(`  • ${shortName}`);
		}
	}
	
	console.log("\n" + "━".repeat(80));
	console.log("\n✨ Done!\n");
}

main().catch((error) => {
	console.error("❌ Error:", error);
	process.exit(1);
});
