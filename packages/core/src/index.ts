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
	ProcedureType,
	AuthRequirements,
	TriggerMetadata,
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
	collectProjectArtifacts,
	describeRegistry,
	formatProcedureBadges,
	formatProcedureMetadata,
	getProcedure,
	isSupportedHandlerFile,
	listProcedures,
	loadProceduresFromModule,
	loadArtifactsFromModule,
} from "./registry.js";

export type { 
	RegistryLoadResult, 
	RegistryModuleIndex,
	WorkflowRegistry,
	ProjectArtifacts,
} from "./registry.js";

// Executor
export { executeProcedure, execute, createExecutionContext, applyPolicies } from "./executor.js";

// Triggers
export {
	isTrigger,
	isTriggerStopOperation,
	getTriggerMetadata,
	findTriggers,
	findStopProcedure,
	groupTriggersByProvider,
	validateTrigger,
	describeTrigger,
	TriggerSubscriptionManager,
} from "./triggers.js";

export type { TriggerSubscription } from "./triggers.js";
