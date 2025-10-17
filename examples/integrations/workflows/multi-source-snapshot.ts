import { workflow, step, parallel } from "@tsdev/workflow";
import type { StepContext } from "@tsdev/workflow";
import { z } from "zod";

type AnyStepContext = StepContext<unknown>;
import {
	zDriveAboutGetResponse,
	zDriveChangesListResponse,
	zDriveDrivesListResponse,
	zDriveFilesListResponse,
} from "../generated/google/drive/zod.gen.js";
import { zPostCallsStatsResponse } from "../generated/avito/items/zod.gen.js";

const seedContext = step({
	id: "seed-context",
	input: z.object({}),
	output: zDriveAboutGetResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("googleDrive.drive.about.get", {
			query: {
				fields: "user,storageQuota,storageQuota(limit,usage,usageInDrive)",
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
				fields: "drives(id,name,createdTime,hidden)",
				pageSize: 10,
			},
		}),
});

const recentFiles = step({
	id: "recent-files",
	input: zDriveAboutGetResponse,
	output: zDriveFilesListResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("googleDrive.drive.files.list", {
			query: {
				fields: "files(id,name,owners,createdTime,modifiedTime)",
				orderBy: "modifiedTime desc",
				pageSize: 25,
				q: "mimeType != 'application/vnd.google-apps.folder'",
			},
		}),
});

const recentCalls = step({
	id: "recent-calls",
	input: zDriveAboutGetResponse,
	output: zPostCallsStatsResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("avitoItems.post.calls.stats", {
			path: {
				user_id: 1234567890,
			},
			body: {
				dateFrom: "2024-02-01",
				dateTo: "2024-02-07",
				itemIds: [9876543210, 9876543209],
			},
			headers: {
				Authorization: "",
				"Content-Type": "application/json",
			},
		}),
});

const collectSignals = parallel({
	id: "collect-signals",
	branches: [listSharedDrives, recentFiles, recentCalls],
	waitForAll: true,
	input: zDriveAboutGetResponse,
	output: z.object({
		sharedDrives: zDriveDrivesListResponse,
		files: zDriveFilesListResponse,
		calls: zPostCallsStatsResponse,
	}),
});

const compileDigest = step({
	id: "compile-digest",
	input: zDriveFilesListResponse,
	output: zDriveChangesListResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("googleDrive.drive.changes.list", {
			query: {
				pageToken: "START_PAGE_TOKEN",
				pageSize: 50,
				includeItemsFromAllDrives: true,
				spaces: "drive",
				fields: "changes(fileId,time,type,file(name,mimeType,owners))",
			},
		}),
});

export const multiSourceSnapshotWorkflow = workflow("multi-source-snapshot")
	.name("Multi-Source Snapshot")
	.description("Aggregates Drive and Avito metrics into a consolidated snapshot.")
	.version("1.0.0")
	.metadata({ tags: ["google", "avito", "snapshot"] })
	.step(seedContext)
	.step(collectSignals)
	.step(compileDigest)
	.commit();
