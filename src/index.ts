/**
 * tsdev - Contracts-first framework
 * 
 * Main entry point for the framework
 */

// Core
export * from "./core/index.js";

// Policies
export * from "./policies/index.js";

// Adapters
export { createHttpServer } from "./adapters/http.js";
export { runCli } from "./adapters/cli.js";
