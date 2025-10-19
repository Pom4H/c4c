#!/usr/bin/env tsx

/**
 * Example: OpenAPI to tsdev generation
 * 
 * This example demonstrates how to generate tsdev contracts and handlers
 * from an OpenAPI specification.
 */

import { createHttpServer } from "@tsdev/adapters";
import { collectRegistry } from "@tsdev/core";
import { OpenAPIGenerator } from "@tsdev/generators";

// Example OpenAPI spec
const exampleOpenAPISpec = {
  openapi: "3.0.0",
  info: {
    title: "Example API",
    version: "1.0.0",
    description: "An example API for demonstration"
  },
  servers: [
    {
      url: "https://api.example.com",
      description: "Production server"
    }
  ],
  paths: {
    "/users": {
      get: {
        operationId: "users.list",
        summary: "List users",
        responses: {
          "200": {
            description: "List of users",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/User"
                  }
                }
              }
            }
          }
        }
      },
      post: {
        operationId: "users.create",
        summary: "Create user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateUserRequest"
              }
            }
          }
        },
        responses: {
          "201": {
            description: "User created",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/User"
                }
              }
            }
          }
        }
      }
    },
    "/users/{id}": {
      get: {
        operationId: "users.get",
        summary: "Get user by ID",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: {
              type: "string"
            }
          }
        ],
        responses: {
          "200": {
            description: "User details",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/User"
                }
              }
            }
          }
        }
      }
    },
    "/webhooks/payment": {
      post: {
        operationId: "webhooks.payment",
        summary: "Payment webhook",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  event: {
                    type: "string"
                  },
                  data: {
                    type: "object"
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Webhook processed"
          }
        }
      }
    },
    "/oauth/callback": {
      get: {
        operationId: "oauth.callback",
        summary: "OAuth callback",
        parameters: [
          {
            name: "code",
            in: "query",
            required: true,
            schema: {
              type: "string"
            }
          },
          {
            name: "state",
            in: "query",
            schema: {
              type: "string"
            }
          }
        ],
        responses: {
          "200": {
            description: "Authorization successful"
          }
        }
      }
    }
  },
  components: {
    schemas: {
      User: {
        type: "object",
        properties: {
          id: {
            type: "string"
          },
          name: {
            type: "string"
          },
          email: {
            type: "string",
            format: "email"
          }
        },
        required: ["id", "name", "email"]
      },
      CreateUserRequest: {
        type: "object",
        properties: {
          name: {
            type: "string"
          },
          email: {
            type: "string",
            format: "email"
          }
        },
        required: ["name", "email"]
      }
    },
    securitySchemes: {
      OAuth2: {
        type: "oauth2",
        flows: {
          authorizationCode: {
            authorizationUrl: "https://auth.example.com/oauth/authorize",
            tokenUrl: "https://auth.example.com/oauth/token",
            scopes: {
              read: "Read access",
              write: "Write access"
            }
          }
        }
      }
    }
  },
  security: [
    {
      OAuth2: ["read", "write"]
    }
  ]
};

async function main() {
  console.log("🚀 Starting OpenAPI Generator Example");
  console.log("");

  // Generate contracts and handlers from OpenAPI spec
  console.log("📝 Generating contracts and handlers from OpenAPI spec...");
  const generator = new OpenAPIGenerator(exampleOpenAPISpec, {
    baseUrl: "https://api.example.com",
    generateTypes: true,
    generateWebhooks: true,
    generateOAuthCallbacks: true,
  });

  const files = await generator.generate();
  const stats = generator.getStats();

  console.log("✅ Generation complete!");
  console.log(`   📊 Statistics:`);
  console.log(`      Total operations: ${stats.totalOperations}`);
  console.log(`      API operations: ${stats.apiOperations}`);
  console.log(`      Webhook operations: ${stats.webhookOperations}`);
  console.log(`      OAuth callback operations: ${stats.oauthCallbackOperations}`);
  console.log(`      Has OAuth: ${stats.hasOAuth ? "Yes" : "No"}`);
  console.log("");

  // Save generated files
  console.log("💾 Saving generated files...");
  const fs = await import("fs/promises");
  const path = await import("path");

  const outputDir = "./generated";
  await fs.mkdir(outputDir, { recursive: true });

  await fs.writeFile(path.join(outputDir, "contracts.ts"), files.contracts);
  await fs.writeFile(path.join(outputDir, "handlers.ts"), files.handlers);
  await fs.writeFile(path.join(outputDir, "index.ts"), files.index);
  await fs.writeFile(path.join(outputDir, "package.json"), files.packageJson);

  if (files.types) {
    await fs.writeFile(path.join(outputDir, "types.ts"), files.types);
  }
  if (files.zodSchemas) {
    await fs.writeFile(path.join(outputDir, "schemas.ts"), files.zodSchemas);
  }
  if (files.webhooks) {
    await fs.writeFile(path.join(outputDir, "webhooks.ts"), files.webhooks);
  }
  if (files.oauthCallbacks) {
    await fs.writeFile(path.join(outputDir, "oauth-callbacks.ts"), files.oauthCallbacks);
  }

  console.log(`✅ Files saved to ${outputDir}/`);
  console.log("");

  // Start HTTP server with generated procedures
  console.log("🌐 Starting HTTP server...");
  console.log("   The server will include:");
  console.log("   - OpenAPI generator endpoints");
  console.log("   - Generated procedures (if any)");
  console.log("   - Swagger UI documentation");
  console.log("");

  // For this example, we'll start with an empty registry
  // In a real scenario, you would load the generated procedures
  const registry = await collectRegistry("./handlers");
  
  const server = createHttpServer(registry, 3000, {
    enableDocs: true,
    enableRpc: true,
    enableRest: true,
    enableWorkflow: true,
    enableOpenAPIGenerator: true,
  });

  console.log("🎉 Server started!");
  console.log("   Visit http://localhost:3000/docs for Swagger UI");
  console.log("   Visit http://localhost:3000/openapi/templates for available templates");
  console.log("   Use POST http://localhost:3000/openapi/validate to validate specs");
  console.log("   Use POST http://localhost:3000/openapi/generate to generate code");
  console.log("");
  console.log("Press Ctrl+C to stop the server");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});