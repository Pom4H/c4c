/**
 * Custom procedures for demo workflows
 */

import { z } from "zod";
import type { Procedure } from "@c4c/core";

// Log procedure
const logInput = z.object({
	message: z.string(),
	level: z.enum(["info", "warn", "error"]).optional(),
	data: z.record(z.string(), z.unknown()).optional(),
});

const logOutput = z.object({
	logged: z.boolean(),
	timestamp: z.string(),
});

export const customLog: Procedure<z.infer<typeof logInput>, z.infer<typeof logOutput>> = {
	contract: {
		name: "custom.log",
		description: "Logs a message",
		input: logInput,
		output: logOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "custom",
			tags: ["logging"],
		},
	},
	handler: async ({ message, level = "info", data }) => {
		const timestamp = new Date().toISOString();
		console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data || "");
		return {
			logged: true,
			timestamp,
		};
	},
};

// Log event procedure
const logEventInput = z.object({
	message: z.string(),
	event: z.unknown().optional(),
});

const logEventOutput = z.object({
	logged: z.boolean(),
	timestamp: z.string(),
});

export const customLogEvent: Procedure<z.infer<typeof logEventInput>, z.infer<typeof logEventOutput>> = {
	contract: {
		name: "custom.logEvent",
		description: "Logs an event with message",
		input: logEventInput,
		output: logEventOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "custom",
			tags: ["logging", "events"],
		},
	},
	handler: async ({ message, event }) => {
		const timestamp = new Date().toISOString();
		console.log(`[${timestamp}] [EVENT] ${message}`, event ? JSON.stringify(event, null, 2) : "");
		return {
			logged: true,
			timestamp,
		};
	},
};

// Validate event procedure
const validateEventInput = z.object({
	event: z.unknown(),
});

const validateEventOutput = z.object({
	valid: z.boolean(),
	errors: z.array(z.string()).optional(),
});

export const customValidateEvent: Procedure<
	z.infer<typeof validateEventInput>,
	z.infer<typeof validateEventOutput>
> = {
	contract: {
		name: "custom.validateEvent",
		description: "Validates an event",
		input: validateEventInput,
		output: validateEventOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "custom",
			tags: ["validation"],
		},
	},
	handler: async ({ event }) => {
		console.log("[validateEvent] Validating event:", event);
		// Simple validation - just check if event exists
		return {
			valid: event !== null && event !== undefined,
			errors: event ? undefined : ["Event is null or undefined"],
		};
	},
};

// Download file procedure
const downloadFileInput = z.object({
	fileId: z.string(),
	fileName: z.string().optional(),
});

const downloadFileOutput = z.object({
	success: z.boolean(),
	fileId: z.string(),
	fileName: z.string().optional(),
	size: z.number(),
});

export const customDownloadFile: Procedure<
	z.infer<typeof downloadFileInput>,
	z.infer<typeof downloadFileOutput>
> = {
	contract: {
		name: "custom.downloadFile",
		description: "Downloads a file (mock)",
		input: downloadFileInput,
		output: downloadFileOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "custom",
			tags: ["files"],
		},
	},
	handler: async ({ fileId, fileName }) => {
		console.log(`[downloadFile] Downloading file: ${fileId}`);
		// Mock download
		await new Promise((resolve) => setTimeout(resolve, 500));
		return {
			success: true,
			fileId,
			fileName,
			size: 1024,
		};
	},
};

// Update database procedure
const updateDatabaseInput = z.object({
	fileId: z.string(),
	metadata: z.unknown().optional(),
});

const updateDatabaseOutput = z.object({
	updated: z.boolean(),
	recordId: z.string(),
});

export const customUpdateDatabase: Procedure<
	z.infer<typeof updateDatabaseInput>,
	z.infer<typeof updateDatabaseOutput>
> = {
	contract: {
		name: "custom.updateDatabase",
		description: "Updates database (mock)",
		input: updateDatabaseInput,
		output: updateDatabaseOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "custom",
			tags: ["database"],
		},
	},
	handler: async ({ fileId, metadata }) => {
		console.log(`[updateDatabase] Updating database for file: ${fileId}`, metadata);
		// Mock update
		await new Promise((resolve) => setTimeout(resolve, 300));
		return {
			updated: true,
			recordId: `rec_${Date.now()}`,
		};
	},
};

// Finalize procedure
const finalizeInput = z.object({
	message: z.string(),
	data: z.unknown().optional(),
});

const finalizeOutput = z.object({
	finalized: z.boolean(),
	timestamp: z.string(),
});

export const customFinalize: Procedure<z.infer<typeof finalizeInput>, z.infer<typeof finalizeOutput>> = {
	contract: {
		name: "custom.finalize",
		description: "Finalizes workflow execution",
		input: finalizeInput,
		output: finalizeOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "custom",
			tags: ["finalization"],
		},
	},
	handler: async ({ message, data }) => {
		const timestamp = new Date().toISOString();
		console.log(`[finalize] ${message}`, data || "");
		return {
			finalized: true,
			timestamp,
		};
	},
};

// Handle error procedure
const handleErrorInput = z.object({
	error: z.unknown(),
	event: z.unknown().optional(),
});

const handleErrorOutput = z.object({
	handled: z.boolean(),
	errorMessage: z.string(),
	timestamp: z.string(),
});

export const customHandleError: Procedure<
	z.infer<typeof handleErrorInput>,
	z.infer<typeof handleErrorOutput>
> = {
	contract: {
		name: "custom.handleError",
		description: "Handles workflow errors",
		input: handleErrorInput,
		output: handleErrorOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "custom",
			tags: ["error-handling"],
		},
	},
	handler: async ({ error, event }) => {
		const timestamp = new Date().toISOString();
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`[handleError] ${errorMessage}`, event);
		return {
			handled: true,
			errorMessage,
			timestamp,
		};
	},
};

// Send notification procedure
const sendNotificationInput = z.object({
	message: z.string(),
	channel: z.string().optional(),
});

const sendNotificationOutput = z.object({
	sent: z.boolean(),
	timestamp: z.string(),
});

export const customSendNotification: Procedure<
	z.infer<typeof sendNotificationInput>,
	z.infer<typeof sendNotificationOutput>
> = {
	contract: {
		name: "custom.sendNotification",
		description: "Sends a notification (mock)",
		input: sendNotificationInput,
		output: sendNotificationOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "custom",
			tags: ["notifications"],
		},
	},
	handler: async ({ message, channel = "default" }) => {
		const timestamp = new Date().toISOString();
		console.log(`[sendNotification] [${channel}] ${message}`);
		return {
			sent: true,
			timestamp,
		};
	},
};

// Process PDF procedure
const processPDFInput = z.object({
	fileId: z.string(),
	fileName: z.string(),
});

const processPDFOutput = z.object({
	processed: z.boolean(),
	pageCount: z.number(),
	fileId: z.string(),
});

export const customProcessPDF: Procedure<
	z.infer<typeof processPDFInput>,
	z.infer<typeof processPDFOutput>
> = {
	contract: {
		name: "custom.processPDF",
		description: "Processes a PDF file (mock)",
		input: processPDFInput,
		output: processPDFOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "custom",
			tags: ["pdf", "processing"],
		},
	},
	handler: async ({ fileId, fileName }) => {
		console.log(`[processPDF] Processing PDF: ${fileName} (${fileId})`);
		// Mock processing
		await new Promise((resolve) => setTimeout(resolve, 1000));
		return {
			processed: true,
			pageCount: 10,
			fileId,
		};
	},
};

// Parse Slack command procedure
const parseSlackCommandInput = z.object({
	text: z.string(),
	user: z.string(),
	channel: z.string(),
});

const parseSlackCommandOutput = z.object({
	isCommand: z.boolean(),
	command: z.string().optional(),
	args: z.array(z.string()).optional(),
});

export const customParseSlackCommand: Procedure<
	z.infer<typeof parseSlackCommandInput>,
	z.infer<typeof parseSlackCommandOutput>
> = {
	contract: {
		name: "custom.parseSlackCommand",
		description: "Parses a Slack command",
		input: parseSlackCommandInput,
		output: parseSlackCommandOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "custom",
			tags: ["slack", "parsing"],
		},
	},
	handler: async ({ text, user, channel }) => {
		console.log(`[parseSlackCommand] Parsing: "${text}" from ${user} in ${channel}`);
		const isCommand = text.startsWith("/");
		if (isCommand) {
			const parts = text.slice(1).split(" ");
			return {
				isCommand: true,
				command: parts[0],
				args: parts.slice(1),
			};
		}
		return {
			isCommand: false,
		};
	},
};

// Execute Slack command procedure
const executeSlackCommandInput = z.object({
	command: z.string().optional(),
	args: z.array(z.string()).optional(),
});

const executeSlackCommandOutput = z.object({
	executed: z.boolean(),
	result: z.string(),
});

export const customExecuteSlackCommand: Procedure<
	z.infer<typeof executeSlackCommandInput>,
	z.infer<typeof executeSlackCommandOutput>
> = {
	contract: {
		name: "custom.executeSlackCommand",
		description: "Executes a Slack command (mock)",
		input: executeSlackCommandInput,
		output: executeSlackCommandOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "custom",
			tags: ["slack", "commands"],
		},
	},
	handler: async ({ command, args = [] }) => {
		console.log(`[executeSlackCommand] Executing: ${command}`, args);
		return {
			executed: true,
			result: `Executed command: ${command} with args: ${args.join(", ")}`,
		};
	},
};

// Delay procedure - для создания длительных workflows
const delayInput = z.object({
	seconds: z.number().min(0).max(300),
	message: z.string().optional(),
});

const delayOutput = z.object({
	delayed: z.boolean(),
	seconds: z.number(),
	startTime: z.string(),
	endTime: z.string(),
});

export const customDelay: Procedure<z.infer<typeof delayInput>, z.infer<typeof delayOutput>> = {
	contract: {
		name: "custom.delay",
		description: "Delays execution for specified seconds (for demo purposes)",
		input: delayInput,
		output: delayOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "custom",
			tags: ["timing", "demo"],
		},
	},
	handler: async ({ seconds, message }) => {
		const startTime = new Date().toISOString();
		console.log(`[delay] ${message || `Waiting ${seconds} seconds...`}`);
		
		// Delay
		await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
		
		const endTime = new Date().toISOString();
		console.log(`[delay] Completed after ${seconds} seconds`);
		
		return {
			delayed: true,
			seconds,
			startTime,
			endTime,
		};
	},
};

// Heavy computation procedure - имитация тяжелых вычислений
const heavyComputationInput = z.object({
	iterations: z.number().min(1).max(1000000),
	label: z.string().optional(),
});

const heavyComputationOutput = z.object({
	completed: z.boolean(),
	iterations: z.number(),
	result: z.number(),
	duration: z.number(),
});

export const customHeavyComputation: Procedure<
	z.infer<typeof heavyComputationInput>,
	z.infer<typeof heavyComputationOutput>
> = {
	contract: {
		name: "custom.heavyComputation",
		description: "Performs heavy computation (for demo purposes)",
		input: heavyComputationInput,
		output: heavyComputationOutput,
		metadata: {
			exposure: "internal",
			roles: ["workflow-node"],
			category: "custom",
			tags: ["computation", "demo"],
		},
	},
	handler: async ({ iterations, label }) => {
		const startTime = Date.now();
		console.log(`[heavyComputation] ${label || "Computing"} with ${iterations} iterations...`);
		
		// Simulate heavy computation
		let result = 0;
		for (let i = 0; i < iterations; i++) {
			result += Math.sqrt(i) * Math.sin(i);
			
			// Log progress every 100k iterations
			if (i > 0 && i % 100000 === 0) {
				console.log(`[heavyComputation] Progress: ${i}/${iterations}`);
			}
		}
		
		const duration = Date.now() - startTime;
		console.log(`[heavyComputation] Completed in ${duration}ms`);
		
		return {
			completed: true,
			iterations,
			result,
			duration,
		};
	},
};
