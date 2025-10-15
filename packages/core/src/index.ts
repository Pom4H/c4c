/**
 * @tsdev/core - Core framework
 * 
 * Contracts-first, transport-agnostic application framework
 */

// Types
export type { Contract, Procedure, Handler, Registry, ExecutionContext, Policy } from "./types.js";

// Registry
export { collectRegistry, collectRegistryFromPaths, getProcedure, listProcedures, describeRegistry } from "./registry.js";

// Executor
export { executeProcedure, createExecutionContext, applyPolicies } from "./executor.js";

// Procedure events for observability
export type { ProcedureEvent, ProcedureListener } from "./events.js";
export { subscribeProcedures, subscribeProcedureRequest } from "./events.js";
