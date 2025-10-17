import { workflow, step, condition, sequence } from "@tsdev/workflow";
import type { StepContext, ConditionContext } from "@tsdev/workflow";
import { z } from "zod";
import {
	zDriveFilesGetResponse,
	zDriveFilesListResponse,
	zDriveFilesUpdateResponse,
} from "../generated/google/drive/zod.gen.js";

const targetFileId = "1A2B3C4D5E";
type AnyStepContext = StepContext<unknown>;
type AnyConditionContext = ConditionContext<unknown>;

const lookupFile = step({
	id: "lookup-file",
	input: z.object({}),
	output: zDriveFilesGetResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("googleDrive.drive.files.get", {
			path: {
				fileId: targetFileId,
			},
			query: {
				fields: "id,name,owners,trashed,modifiedTime",
				supportsAllDrives: true,
			},
		}),
});

const restoreFile = step({
	id: "restore-file",
	input: zDriveFilesGetResponse,
	output: zDriveFilesUpdateResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("googleDrive.drive.files.update", {
			path: {
				fileId: targetFileId,
			},
			body: {
				kind: "drive#file",
				trashed: false,
			},
			query: {
				supportsAllDrives: true,
			},
		}),
});

const skipRestore = sequence({ id: "skip-restore" });

const auditLocation = step({
	id: "audit-location",
	input: z.object({}),
	output: zDriveFilesListResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("googleDrive.drive.files.list", {
			query: {
				q: `'${targetFileId}' in parents`,
				fields: "files(id,name,modifiedTime,owners)",
				supportsAllDrives: true,
				pageSize: 10,
			},
		}),
});

const checkTrashed = condition({
	id: "check-trashed",
	input: lookupFile.output,
	whenTrue: restoreFile,
	whenFalse: skipRestore,
	predicate: (ctx: AnyConditionContext) => ctx.variables.trashed === true,
});

export const driveFileRecoveryWorkflow = workflow("drive-file-recovery")
	.name("Drive File Recovery")
	.description("Restores a trashed Google Drive file and verifies its location.")
	.version("1.0.0")
	.metadata({ tags: ["google", "recovery"] })
	.step(lookupFile)
	.step(checkTrashed)
	.step(auditLocation)
	.commit();
