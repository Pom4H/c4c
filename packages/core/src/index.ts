/**
 * @c4c/core - Core framework
 *
 * Contracts-first, transport-agnostic application framework
 */

// Executor
export { applyPolicies, createExecutionContext, execute, executeProcedure } from "./executor.js";
export {
	getContractMetadata,
	getProcedureExposure,
	getProcedureRoles,
	isProcedureVisible,
} from "./metadata.js";
export type {
	ProjectArtifacts,
	RegistryLoadResult,
	RegistryModuleIndex,
	WorkflowRegistry,
} from "./registry.js";
// Registry
export {
	collectProjectArtifacts,
	collectRegistry,
	collectRegistryDetailed,
	describeRegistry,
	formatProcedureBadges,
	formatProcedureMetadata,
	getProcedure,
	isSupportedHandlerFile,
	listProcedures,
	loadArtifactsFromModule,
	loadProceduresFromModule,
} from "./registry.js";
export type { TriggerSubscription } from "./triggers.js";
// Triggers
export {
	describeTrigger,
	findStopProcedure,
	findTriggers,
	getTriggerMetadata,
	groupTriggersByProvider,
	isTrigger,
	isTriggerStopOperation,
	TriggerSubscriptionManager,
	validateTrigger,
} from "./triggers.js";
// Type Guards
export {
	assertContract,
	assertExecutionContext,
	assertHandler,
	assertProcedure,
	hasExposure,
	hasProcedureMetadata,
	hasRole,
	isContract,
	isExecutionContext,
	isHandler,
	isProcedure,
	isTriggerProcedure,
	validateProcedure,
} from "./type-guards.js";
// Type-safe Registry
export {
	createTypedRegistry,
	executeTyped,
	type InferContext,
	type InferInput,
	type InferOutput,
	type ProcedureName,
	type ProcedureTypeMap,
	type TypedRegistry,
} from "./typed-registry.js";
// Types
export type {
	AuthRequirements,
	BaseMetadata,
	Contract,
	ContractMetadata,
	ExecutionContext,
	Handler,
	Policy,
	Procedure,
	ProcedureExposure,
	ProcedureRole,
	ProcedureType,
	Registry,
	SimplePolicy,
	TriggerMetadata,
} from "./types.js";
