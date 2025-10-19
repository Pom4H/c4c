/**
 * HTTP adapter for OpenAPI generation
 * Provides endpoints for generating tsdev contracts and handlers from OpenAPI specs
 */

import { Hono } from "hono";
import { OpenAPIGenerator, type OpenAPIGeneratorOptions } from "@tsdev/generators";
import type { Registry, DynamicLoader } from "@tsdev/core";

export interface OpenAPIGeneratorConfig {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  authType?: "none" | "bearer" | "apiKey" | "oauth2";
  authConfig?: {
    token?: string;
    apiKey?: string;
    apiKeyHeader?: string;
    oauth2?: {
      clientId: string;
      clientSecret: string;
      tokenUrl: string;
      scopes?: string[];
    };
  };
}

export function createOpenAPIGeneratorRouter(
  config: OpenAPIGeneratorConfig = {},
  dynamicLoader?: DynamicLoader
) {
  const app = new Hono();

  // POST /openapi/generate - Generate contracts and handlers from OpenAPI spec
  app.post("/openapi/generate", async (c) => {
    try {
      const body = await c.req.json();
      const { spec, options = {}, loadDynamically = true } = body;

      if (!spec) {
        return c.json({ error: "OpenAPI spec is required" }, 400);
      }

      const generatorOptions: OpenAPIGeneratorOptions = {
        ...config,
        ...options,
      };

      const generator = new OpenAPIGenerator(spec, generatorOptions);
      const files = await generator.generate();
      const stats = generator.getStats();

      let moduleId: string | undefined;
      let module: any = undefined;

      // If dynamic loading is enabled and loader is available
      if (loadDynamically && dynamicLoader) {
        // Generate unique module ID
        const { createHash } = await import("crypto");
        const specHash = createHash("md5").update(JSON.stringify(spec)).digest("hex");
        moduleId = `openapi-${specHash.slice(0, 12)}`;

        // Load module dynamically
        module = await dynamicLoader.loadModule(moduleId, files, {
          name: spec.info?.title || "Generated API",
          source: "openapi",
        });
      }

      return c.json({
        success: true,
        files: loadDynamically ? undefined : files, // Don't return files if loaded dynamically
        stats,
        oauthConfig: generator.getOAuthConfig(),
        webhookOperations: generator.getWebhookOperations(),
        oauthCallbackOperations: generator.getOAuthCallbackOperations(),
        module: module ? {
          id: module.id,
          name: module.name,
          gitBranch: module.gitBranch,
          gitCommit: module.gitCommit,
          procedures: Array.from(module.procedures.keys()),
        } : undefined,
      });
    } catch (error) {
      console.error("OpenAPI generation error:", error);
      return c.json(
        { 
          error: "Failed to generate from OpenAPI spec", 
          details: error instanceof Error ? error.message : String(error) 
        }, 
        500
      );
    }
  });

  // POST /openapi/validate - Validate OpenAPI spec
  app.post("/openapi/validate", async (c) => {
    try {
      const body = await c.req.json();
      const { spec } = body;

      if (!spec) {
        return c.json({ error: "OpenAPI spec is required" }, 400);
      }

      const generator = new OpenAPIGenerator(spec);
      const stats = generator.getStats();

      return c.json({
        valid: true,
        stats,
        oauthConfig: generator.getOAuthConfig(),
        webhookOperations: generator.getWebhookOperations().map(op => ({
          operationId: op.operationId,
          method: op.method,
          path: op.path,
          summary: op.summary,
        })),
        oauthCallbackOperations: generator.getOAuthCallbackOperations().map(op => ({
          operationId: op.operationId,
          method: op.method,
          path: op.path,
          summary: op.summary,
        })),
      });
    } catch (error) {
      console.error("OpenAPI validation error:", error);
      return c.json(
        { 
          valid: false,
          error: "Invalid OpenAPI spec", 
          details: error instanceof Error ? error.message : String(error) 
        }, 
        400
      );
    }
  });

  // GET /openapi/templates - Get generation templates
  app.get("/openapi/templates", async (c) => {
    const templates = {
      basic: {
        name: "Basic API",
        description: "Simple REST API with CRUD operations",
        spec: {
          openapi: "3.0.0",
          info: {
            title: "Basic API",
            version: "1.0.0",
            description: "A simple REST API example"
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
            }
          }
        }
      },
      webhook: {
        name: "Webhook API",
        description: "API with webhook endpoints",
        spec: {
          openapi: "3.0.0",
          info: {
            title: "Webhook API",
            version: "1.0.0",
            description: "API with webhook support"
          },
          paths: {
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
            }
          }
        }
      },
      oauth: {
        name: "OAuth API",
        description: "API with OAuth authentication",
        spec: {
          openapi: "3.0.0",
          info: {
            title: "OAuth API",
            version: "1.0.0",
            description: "API with OAuth 2.0 authentication"
          },
          components: {
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
          ],
          paths: {
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
          }
        }
      }
    };

    return c.json({ templates });
  });

  // GET /openapi/modules - List all loaded modules
  app.get("/openapi/modules", async (c) => {
    if (!dynamicLoader) {
      return c.json({ error: "Dynamic loading not available" }, 503);
    }

    const modules = dynamicLoader.getModules();
    const stats = dynamicLoader.getStats();

    return c.json({
      modules: modules.map(module => ({
        id: module.id,
        name: module.name,
        version: module.version,
        source: module.source,
        createdAt: module.createdAt,
        updatedAt: module.updatedAt,
        gitBranch: module.gitBranch,
        gitCommit: module.gitCommit,
        procedureCount: module.procedures.size,
        procedures: Array.from(module.procedures.keys()),
      })),
      stats,
    });
  });

  // POST /openapi/modules/:id/reload - Reload a specific module
  app.post("/openapi/modules/:id/reload", async (c) => {
    if (!dynamicLoader) {
      return c.json({ error: "Dynamic loading not available" }, 503);
    }

    const moduleId = c.req.param("id");
    const module = await dynamicLoader.reloadModule(moduleId);

    if (!module) {
      return c.json({ error: "Module not found" }, 404);
    }

    return c.json({
      success: true,
      module: {
        id: module.id,
        name: module.name,
        updatedAt: module.updatedAt,
        procedures: Array.from(module.procedures.keys()),
      },
    });
  });

  // DELETE /openapi/modules/:id - Unload a specific module
  app.delete("/openapi/modules/:id", async (c) => {
    if (!dynamicLoader) {
      return c.json({ error: "Dynamic loading not available" }, 503);
    }

    const moduleId = c.req.param("id");
    const success = await dynamicLoader.unloadModule(moduleId);

    if (!success) {
      return c.json({ error: "Module not found" }, 404);
    }

    return c.json({ success: true });
  });

  // GET /openapi/modules/:id - Get module details
  app.get("/openapi/modules/:id", async (c) => {
    if (!dynamicLoader) {
      return c.json({ error: "Dynamic loading not available" }, 503);
    }

    const moduleId = c.req.param("id");
    const module = dynamicLoader.getModule(moduleId);

    if (!module) {
      return c.json({ error: "Module not found" }, 404);
    }

    return c.json({
      id: module.id,
      name: module.name,
      version: module.version,
      source: module.source,
      createdAt: module.createdAt,
      updatedAt: module.updatedAt,
      gitBranch: module.gitBranch,
      gitCommit: module.gitCommit,
      procedures: Array.from(module.procedures.entries()).map(([name, procedure]) => ({
        name,
        description: procedure.contract.description,
        metadata: procedure.contract.metadata,
      })),
    });
  });

  return app;
}