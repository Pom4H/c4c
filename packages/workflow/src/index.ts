/**
 * @c4c/workflow - Re-exports from Vercel Workflow DevKit
 *
 * This is a convenience package that re-exports the `workflow` npm package.
 * You can also import directly from "workflow" if you prefer.
 *
 * Usage:
 *   import { sleep, FatalError, createWebhook } from "@c4c/workflow";
 *
 * Or directly:
 *   import { sleep, FatalError, createWebhook } from "workflow";
 *
 * See https://useworkflow.dev for full documentation.
 */

export {
	FatalError,
	RetryableError,
	getStepMetadata,
	getWorkflowMetadata,
	sleep,
	getWritable,
	createWebhook,
	createHook,
	defineHook,
} from "workflow";
