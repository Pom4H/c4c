import type { Contract, ContractMetadata, ProcedureExposure, ProcedureRole } from "./types.js";

export type ProcedureTarget = "rest" | "rpc" | "workflow" | "catalog" | "client";

const DEFAULT_ROLES: ProcedureRole[] = ["api-endpoint", "workflow-node", "sdk-client"];

export function getContractMetadata(contract: Contract): ContractMetadata {
	return contract.metadata ?? {};
}

export function getProcedureExposure(contract: Contract): ProcedureExposure {
	const metadata = getContractMetadata(contract);
	return metadata.exposure ?? "external";
}

export function getProcedureRoles(contract: Contract): ProcedureRole[] {
	const metadata = getContractMetadata(contract);
	const roles = metadata.roles;
	if (!roles || roles.length === 0) {
		return DEFAULT_ROLES;
	}
	return roles;
}

export function isProcedureVisible(contract: Contract, target: ProcedureTarget): boolean {
	const exposure = getProcedureExposure(contract);
	const roles = getProcedureRoles(contract);

	switch (target) {
		case "workflow":
			return roles.includes("workflow-node");
		case "rest":
		case "rpc":
			return exposure !== "internal" && roles.includes("api-endpoint");
		case "client":
			return (
				exposure !== "internal" && (roles.includes("sdk-client") || roles.includes("api-endpoint"))
			);
		case "catalog":
		default:
			return true;
	}
}
