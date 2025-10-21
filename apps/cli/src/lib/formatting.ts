import { relative } from "node:path";
import { formatProcedureBadges, type AuthRequirements, type Procedure } from "@c4c/core";

const COLOR_RESET = "\u001B[0m";
const COLOR_DIM = "\u001B[90m";

const PROCEDURE_ROLE_COLOR: Record<string, string> = {
	"workflow-node": "\u001B[36m",
	"api-endpoint": "\u001B[35m",
	"sdk-client": "\u001B[33m",
};

export function colorEnabled(): boolean {
	return Boolean(process.stdout?.isTTY && !process.env.NO_COLOR);
}

export function dim(text: string): string {
	if (!colorEnabled()) return text;
	return `${COLOR_DIM}${text}${COLOR_RESET}`;
}

function colorizeProcedureRole(role: string): string {
	if (!colorEnabled()) return role;
	const color = PROCEDURE_ROLE_COLOR[role];
	if (!color) return role;
	return `${color}${role}${COLOR_RESET}`;
}

function formatList(values: string[], max: number): string {
	if (values.length <= max) {
		return values.join(",");
	}
	const visible = values.slice(0, max).join(",");
	return `${visible},+${values.length - max}`;
}

function hasAuthMetadata(auth?: AuthRequirements | null): boolean {
	if (!auth) return false;
	return Boolean(
		auth.requiresAuth ||
		auth.authScheme ||
		(auth.requiredRoles && auth.requiredRoles.length > 0) ||
		(auth.requiredPermissions && auth.requiredPermissions.length > 0)
	);
}

export function formatRegistryAction(action: string): string {
	switch (action) {
		case "Registered":
			return "+";
		case "Updated":
			return "~";
		case "Removed":
			return "-";
		default:
			return action;
	}
}

export function formatProcedureLocation(sourcePath: string, proceduresRoot: string): string {
	const relativePathRaw = sourcePath ? relative(proceduresRoot, sourcePath) : null;
	const relativePath = relativePathRaw === null ? null : relativePathRaw === "" ? "." : relativePathRaw;
	if (!relativePath) return "";
	if (relativePath === ".") {
		return dim("@internal");
	}
	return dim(`@${relativePath}`);
}

export function formatConciseProcedureMetadata(procedure: Procedure): string {
	const metadata = procedure.contract.metadata;
	if (!metadata) return "";

	const parts: string[] = [];

	if (metadata.roles?.length) {
		const roles = metadata.roles.length === 1 && metadata.roles[0] === "workflow-node" ? [] : metadata.roles;
		if (roles.length) {
			const formattedRoles = roles.map((role) => colorizeProcedureRole(role)).join(",");
			parts.push(`roles=${formattedRoles}`);
		}
	}

	if (metadata.category) {
		parts.push(`cat=${metadata.category}`);
	}

	if (metadata.tags?.length) {
		parts.push(`tags=${formatList(metadata.tags, 2)}`);
	}

	if (metadata.auth && hasAuthMetadata(metadata.auth)) {
		const { auth } = metadata;
		const authParts: string[] = [];
		if (auth.authScheme) {
			authParts.push(auth.authScheme);
		}
		if (auth.requiredRoles?.length) {
			authParts.push(`roles:${formatList(auth.requiredRoles, 2)}`);
		}
		if (auth.requiredPermissions?.length) {
			authParts.push(`perms:${formatList(auth.requiredPermissions, 2)}`);
		}
		if (!authParts.length && auth.requiresAuth) {
			authParts.push("required");
		}
		if (authParts.length) {
			parts.push(`auth=${authParts.join(" ")}`);
		}
	}

	return parts.join(" | ");
}

export function logProcedureChange(
	action: string,
	procedureName: string,
	procedure: Procedure | undefined,
	sourcePath: string,
	proceduresRoot: string
) {
	const parts: string[] = [];
	parts.push(`[Registry] ${formatRegistryAction(action)} ${procedureName}`);

	const badges = procedure ? formatProcedureBadges(procedure) : "";
	if (badges) {
		parts.push(badges);
	}

	const metadata = procedure ? formatConciseProcedureMetadata(procedure) : "";
	if (metadata) {
		parts.push(metadata);
	}

	const location = formatProcedureLocation(sourcePath, proceduresRoot);
	if (location) {
		parts.push(location);
	}

	console.log(parts.join(" "));
}

export function formatProceduresLabel(proceduresPath: string): string {
	const label = relative(process.cwd(), proceduresPath) || proceduresPath;
	return label;
}
