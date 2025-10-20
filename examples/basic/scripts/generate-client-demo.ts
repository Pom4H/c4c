/**
 * Demo script showing client generation with auth metadata
 * 
 * This script demonstrates how the generated client automatically includes
 * authentication headers for protected procedures.
 */

import { collectRegistry } from "@c4c/core";
import { generateRpcClientModule } from "@c4c/generators";

async function generateClientDemo() {
	console.log("📦 Collecting registry from handlers...\n");
	
	// Collect all procedures from handlers directory
	const registry = await collectRegistry("src/handlers");
	
	console.log(`✅ Found ${registry.size} procedures\n`);
	
	// List all procedures with their auth requirements
	console.log("🔐 Procedures and their auth requirements:\n");
	for (const [name, procedure] of registry.entries()) {
		const auth = procedure.contract.metadata?.auth as {
			requiresAuth?: boolean;
			requiredRoles?: string[];
			requiredPermissions?: string[];
		} | undefined;
		
		if (auth?.requiresAuth) {
			console.log(`  ✓ ${name}`);
			if (auth.requiredRoles) {
				console.log(`    - Roles: ${auth.requiredRoles.join(", ")}`);
			}
			if (auth.requiredPermissions) {
				console.log(`    - Permissions: ${auth.requiredPermissions.join(", ")}`);
			}
		} else {
			console.log(`  ○ ${name} (public)`);
		}
	}
	
	console.log("\n📝 Generating TypeScript client...\n");
	
	// Generate client code
	const clientCode = generateRpcClientModule(registry, {
		baseUrl: "http://localhost:3000",
	});
	
	console.log("✅ Client generated successfully!\n");
	console.log("=" .repeat(80));
	console.log("Preview of generated client (first 100 lines):");
	console.log("=" .repeat(80));
	
	const lines = clientCode.split("\n");
	console.log(lines.slice(0, 100).join("\n"));
	
	if (lines.length > 100) {
		console.log("\n... (truncated, total lines: " + lines.length + ")");
	}
	
	console.log("\n" + "=" .repeat(80));
	console.log("\n💡 Key features in the generated client:\n");
	console.log("  1. authToken option for static authentication");
	console.log("  2. getAuthToken() for dynamic token retrieval");
	console.log("  3. Automatic Authorization header for protected procedures");
	console.log("  4. Metadata about which procedures require auth");
	console.log("  5. Type-safe procedure definitions\n");
	
	console.log("📖 Usage example:\n");
	console.log(`
  import { createTsdevClient } from "./generated/client";

  const client = createTsdevClient({
    baseUrl: "http://localhost:3000",
    authToken: "your-jwt-token", // ← Will be added to protected procedures
  });

  // Protected procedure - automatically includes auth header
  await client.procedures.getUserProfile({ userId: "123" });

  // Public procedure - no auth header added
  await client.procedures.add({ a: 1, b: 2 });
	`.trim());
	
	console.log("\n");
}

// Run if executed directly
if (require.main === module) {
	generateClientDemo().catch(console.error);
}

export { generateClientDemo };
