#!/usr/bin/env node

/**
 * Test script for dynamic loading functionality
 * Demonstrates how to load OpenAPI specs dynamically and test them
 */

const API_BASE = "http://localhost:3000";

async function testDynamicLoading() {
  console.log("🧪 Testing Dynamic Loading Functionality");
  console.log("");

  // Test 1: Load a simple OpenAPI spec
  console.log("1️⃣ Loading a simple OpenAPI spec...");
  
  const simpleSpec = {
    openapi: "3.0.0",
    info: {
      title: "Test API",
      version: "1.0.0",
      description: "A simple test API"
    },
    servers: [
      {
        url: "https://api.test.com",
        description: "Test server"
      }
    ],
    paths: {
      "/test": {
        get: {
          operationId: "test.get",
          summary: "Get test data",
          responses: {
            "200": {
              description: "Success",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: {
                        type: "string"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  try {
    const response = await fetch(`${API_BASE}/openapi/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        spec: simpleSpec,
        options: {
          baseUrl: "https://api.test.com",
          generateTypes: true,
          generateWebhooks: false,
          generateOAuthCallbacks: false,
        },
        loadDynamically: true,
      }),
    });

    const result = await response.json();
    
    if (result.success && result.module) {
      console.log("✅ Module loaded successfully!");
      console.log(`   Module ID: ${result.module.id}`);
      console.log(`   Module Name: ${result.module.name}`);
      console.log(`   Git Branch: ${result.module.gitBranch || "N/A"}`);
      console.log(`   Procedures: ${result.module.procedures.join(", ")}`);
    } else {
      console.log("❌ Failed to load module:", result.error);
      return;
    }
  } catch (error) {
    console.log("❌ Error loading module:", error.message);
    return;
  }

  console.log("");

  // Test 2: List all loaded modules
  console.log("2️⃣ Listing all loaded modules...");
  
  try {
    const response = await fetch(`${API_BASE}/openapi/modules`);
    const result = await response.json();
    
    if (result.modules) {
      console.log(`✅ Found ${result.modules.length} loaded modules:`);
      result.modules.forEach((module, index) => {
        console.log(`   ${index + 1}. ${module.name} (${module.id})`);
        console.log(`      Procedures: ${module.procedures.length}`);
        console.log(`      Source: ${module.source}`);
        console.log(`      Git Branch: ${module.gitBranch || "N/A"}`);
      });
      
      console.log(`\n📊 Statistics:`);
      console.log(`   Total Modules: ${result.stats.totalModules}`);
      console.log(`   Total Procedures: ${result.stats.totalProcedures}`);
      console.log(`   Git Enabled: ${result.stats.gitEnabled}`);
    } else {
      console.log("❌ Failed to list modules:", result.error);
    }
  } catch (error) {
    console.log("❌ Error listing modules:", error.message);
  }

  console.log("");

  // Test 3: Get module details
  if (result.module) {
    console.log("3️⃣ Getting module details...");
    
    try {
      const response = await fetch(`${API_BASE}/openapi/modules/${result.module.id}`);
      const details = await response.json();
      
      if (details.id) {
        console.log("✅ Module details retrieved:");
        console.log(`   ID: ${details.id}`);
        console.log(`   Name: ${details.name}`);
        console.log(`   Version: ${details.version}`);
        console.log(`   Source: ${details.source}`);
        console.log(`   Created: ${details.createdAt}`);
        console.log(`   Updated: ${details.updatedAt}`);
        console.log(`   Git Branch: ${details.gitBranch || "N/A"}`);
        console.log(`   Git Commit: ${details.gitCommit || "N/A"}`);
        
        if (details.procedures && details.procedures.length > 0) {
          console.log(`   Procedures:`);
          details.procedures.forEach(proc => {
            console.log(`     - ${proc.name}: ${proc.description}`);
          });
        }
      } else {
        console.log("❌ Failed to get module details:", details.error);
      }
    } catch (error) {
      console.log("❌ Error getting module details:", error.message);
    }
  }

  console.log("");
  console.log("🎉 Dynamic loading test completed!");
  console.log("");
  console.log("Next steps:");
  console.log("1. Visit http://localhost:3000 to see the web interface");
  console.log("2. Check the generated modules in ./generated-modules/");
  console.log("3. Test the generated procedures via the API");
  console.log("4. Use git to see the created branches and commits");
}

// Run the test
testDynamicLoading().catch(console.error);