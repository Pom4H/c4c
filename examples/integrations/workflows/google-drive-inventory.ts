import { workflow, step } from "@c4c/workflow";
import type { StepContext } from "@c4c/workflow";
import { z } from "zod";

type AnyStepContext = StepContext<unknown>;
import {
	zDriveAboutGetResponse,
	zDriveFilesListLabelsResponse,
	zDriveFilesListResponse,
	zDriveFilesWatchResponse,
} from "../generated/google/drive/zod.gen.js";

const captureAbout = step({
	id: "capture-about",
	input: z.object({}),
	output: zDriveAboutGetResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("googleDrive.drive.about.get", {
			query: {
				fields: "user(displayName,emailAddress),storageQuota(limit,usage)",
			},
		}),
});

const listFiles = step({
	id: "list-files",
	input: zDriveAboutGetResponse,
	output: zDriveFilesListResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("googleDrive.drive.files.list", {
			query: {
				pageSize: 100,
				fields: "files(id,name,mimeType,parents,owners),nextPageToken",
				spaces: "drive",
			},
		}),
});

const listLabels = step({
	id: "list-labels",
	input: zDriveFilesListResponse,
	output: zDriveFilesListLabelsResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("googleDrive.drive.files.list.labels", {
			path: {
				fileId: "appDataFolder",
			},
			query: {
				maxResults: 50,
			},
		}),
});

const enableWatch = step({
	id: "enable-watch",
	input: zDriveFilesListLabelsResponse,
	output: zDriveFilesWatchResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("googleDrive.drive.files.watch", {
			path: {
				fileId: "root",
			},
			body: {
				kind: "api#channel",
				id: "inventory-watch-channel",
				type: "web_hook",
				address: "https://acme.example/hooks/drive-inventory",
			},
		}),
});

export const googleDriveInventoryWorkflow = workflow("google-drive-inventory")
	.name("Google Drive Inventory")
	.description("Collects Drive metadata, labels, and sets up monitoring for inventory changes.")
	.version("1.0.0")
	.metadata({ tags: ["google", "inventory"] })
	.step(captureAbout)
	.step(listFiles)
	.step(listLabels)
	.step(enableWatch)
	.commit();
