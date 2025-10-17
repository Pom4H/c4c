import { workflow, step, parallel, condition } from "@tsdev/workflow";
import type { StepContext, ConditionContext } from "@tsdev/workflow";
import { z } from "zod";
import {
	zDriveAboutGetResponse,
	zDriveChangesGetStartPageTokenResponse,
	zDriveDrivesListResponse,
} from "../generated/google/drive/zod.gen.js";
import { zPostCallsStatsResponse, zVasPricesResponse } from "../generated/avito/items/zod.gen.js";

type AnyStepContext = StepContext<unknown>;
type AnyConditionContext = ConditionContext<unknown>;

const initialDriveSnapshot = step({
	id: "initial-drive-snapshot",
	input: z.object({}),
	output: zDriveAboutGetResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("googleDrive.drive.about.get", {
			query: {
				fields: "user,storageQuota",
			},
		}),
});

const listSharedDrives = step({
	id: "list-shared-drives",
	input: zDriveAboutGetResponse,
	output: zDriveDrivesListResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("googleDrive.drive.drives.list", {
			query: {
				pageSize: 20,
				fields: "drives(id,name,createdTime)",
			},
		}),
});

const collectAvitoCalls = step({
	id: "collect-avito-calls",
	input: zDriveAboutGetResponse,
	output: zPostCallsStatsResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("avitoItems.post.calls.stats", {
			path: {
				user_id: 1234567890,
			},
			body: {
				dateFrom: "2024-01-01",
				dateTo: "2024-01-31",
				itemIds: [9876543210],
			},
			headers: {
				"Content-Type": "application/json",
			},
		}),
});

const gatherData = parallel({
	id: "gather-data",
	branches: [listSharedDrives, collectAvitoCalls],
	waitForAll: true,
	input: zDriveAboutGetResponse,
	output: z.object({
		drives: zDriveDrivesListResponse,
		calls: zPostCallsStatsResponse,
	}),
});

const loadVasPricing = step({
	id: "load-vas-pricing",
	input: zPostCallsStatsResponse,
	output: zVasPricesResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("avitoItems.vas.prices", {
			path: {
				user_id: 1234567890,
			},
			body: {
				itemIds: [9876543210, 9876543209],
			},
		}),
});

const refreshAbout = step({
	id: "refresh-about",
	input: zPostCallsStatsResponse,
	output: zDriveAboutGetResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("googleDrive.drive.about.get", {
			query: {
				fields: "storageQuota, user",
			},
		}),
});

const callsPriority = condition({
	id: "calls-priority",
	input: gatherData.output,
	whenTrue: loadVasPricing,
	whenFalse: refreshAbout,
	predicate: (ctx: AnyConditionContext) => {
		const items = (ctx.variables.result as { items?: unknown[] } | undefined)?.items;
		return Array.isArray(items) && items.length > 0;
	},
});

const finalize = step({
	id: "finalize",
	input: z.union([zVasPricesResponse, zDriveAboutGetResponse]),
	output: zDriveChangesGetStartPageTokenResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("googleDrive.drive.changes.get.start.page.token", {}),
});

export const integratedOperationsWorkflow = workflow("integrated-operations")
	.name("Cross-Provider Operations")
	.description("Coordinates Google Drive telemetry with Avito performance data using real handlers.")
	.version("1.0.0")
	.metadata({ tags: ["google", "avito", "orchestration"] })
	.step(initialDriveSnapshot)
	.step(gatherData)
	.step(callsPriority)
	.step(finalize)
	.commit();
