#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { Command } from "commander";
import process from "node:process";
import { serveCommand } from "./commands/serve.js";
import { devCommand, devLogsCommand, devStopCommand, devStatusCommand } from "./commands/dev.js";
import { generateClientCommand } from "./commands/generate.js";

const pkg = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8")
);

const program = new Command();
program
	.name("c4c")
	.description("c4c (Code For Coders) CLI")
	.version(pkg.version ?? "0.0.0");

program
	.command("serve")
	.description("Start the c4c HTTP server")
	.argument("[mode]", "Mode to run (all|rest|workflow|rpc|ui)", "all")
	.option("-p, --port <number>", "Port to listen on", parsePort)
	.option("--root <path>", "Project root containing handlers/ and workflows", process.cwd())
	.option("--workflows <path>", "Custom workflows directory (overrides root)")
    .option("--docs", "Force enable docs endpoints")
	.option("--api-base <url>", "Workflow API base URL used in UI mode", process.env.C4C_API_BASE)
	.action(async (modeArg: string, options) => {
		try {
			await serveCommand(modeArg, options);
		} catch (error) {
			console.error(
				`[c4c] ${error instanceof Error ? error.message : String(error)}`
			);
			process.exit(1);
		}
	});

const devCommandDef = program
    .command("dev")
    .description("Start the c4c HTTP server with watch mode")
    .option("-p, --port <number>", "Port to listen on", parsePort)
	.option("--root <path>", "Project root containing handlers/", process.cwd())
	.option("--workflows <path>", "Custom workflows directory (overrides root)")
    .option("--docs", "Force enable docs endpoints")
    .action(async (options) => {
		try {
            await devCommand(options);
		} catch (error) {
			console.error(
				`[c4c] ${error instanceof Error ? error.message : String(error)}`
			);
			process.exit(1);
		}
	});

devCommandDef
	.command("stop")
	.description("Stop the running c4c dev server")
	.option("--root <path>", "Project root containing handlers/", process.cwd())
	.action(async (options) => {
		try {
			await devStopCommand(options);
		} catch (error) {
			console.error(
				`[c4c] ${error instanceof Error ? error.message : String(error)}`
			);
			process.exit(1);
		}
	});

devCommandDef
	.command("logs")
	.description("Print stdout logs from the running c4c dev server")
	.option("--root <path>", "Project root containing handlers/", process.cwd())
    .option("--json", "Output raw JSONL instead of pretty output")
	.option("--tail <number>", "Number of log lines from the end of the file to display")
	.action(async (options) => {
		try {
			await devLogsCommand(options);
		} catch (error) {
			console.error(
				`[c4c] ${error instanceof Error ? error.message : String(error)}`
			);
			process.exit(1);
		}
	});

devCommandDef
    .command("status")
    .description("Show status of the running c4c dev server")
    .option("--root <path>", "Project root containing handlers/", process.cwd())
    .option("--json", "Output JSON status report")
    .action(async (options) => {
        try {
            await devStatusCommand(options);
        } catch (error) {
            console.error(
                `[c4c] ${error instanceof Error ? error.message : String(error)}`
            );
            process.exit(1);
        }
    });

const generate = program
	.command("generate")
	.description("Run code generators");

generate
	.command("client")
	.description("Generate a typed client from contracts")
	.option("--root <path>", "Project root containing handlers/", process.cwd())
	.option("--out <file>", "Output file for the generated client", "c4c-client.ts")
	.option("--base-url <url>", "Base URL embedded in generated client")
	.action(async (options) => {
		try {
			await generateClientCommand(options);
		} catch (error) {
			console.error(
				`[c4c] ${error instanceof Error ? error.message : String(error)}`
			);
			process.exit(1);
		}
	});

program.parseAsync(process.argv).catch((error) => {
	console.error(`[c4c] ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});

function parsePort(value: string): number {
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed <= 0) {
		throw new Error(`Invalid port '${value}'`);
	}
	return parsed;
}
