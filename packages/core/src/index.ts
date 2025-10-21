/**
 * @c4c/core - Core framework
 * 
 * Contracts-first, transport-agnostic application framework
 */

// Types
export type {
	Contract,
	Procedure,
	Handler,
	Registry,
	ExecutionContext,
	Policy,
	ContractMetadata,
	ProcedureExposure,
	ProcedureRole,
	AuthRequirements,
} from "./types.js";

export {
	getContractMetadata,
	getProcedureExposure,
	getProcedureRoles,
	isProcedureVisible,
} from "./metadata.js";

// Registry
export {
	collectRegistry,
	collectRegistryDetailed,
	describeRegistry,
	formatProcedureBadges,
	formatProcedureMetadata,
	getProcedure,
	isSupportedHandlerFile,
	listProcedures,
	loadProceduresFromModule,
} from "./registry.js";

export type { RegistryLoadResult, RegistryModuleIndex } from "./registry.js";

// Executor
export { executeProcedure, createExecutionContext, applyPolicies } from "./executor.js";
