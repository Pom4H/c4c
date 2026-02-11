#!/usr/bin/env node

/**
 * c4c CLI - thin wrapper around Vercel Workflow DevKit
 *
 * Commands:
 *   c4c dev     - Build workflows + start dev server
 *   c4c build   - Build workflow bundles (delegates to `workflow build`)
 *   c4c serve   - Start production workflow server
 */

import { Command } from "commander";
import { devCommand } from "./commands/dev.js";
import { buildCommand } from "./commands/build.js";
import { serveCommand } from "./commands/serve.js";

const program = new Command();

program
	.name("c4c")
	.description("c4c - Workflow DevKit for TypeScript (powered by useworkflow.dev)")
	.version("0.2.0");

program
	.command("dev")
	.description("Build workflows and start dev server")
	.option("-p, --port <port>", "Server port", "3000")
	.option("-r, --root <dir>", "Project root directory", ".")
	.action(devCommand);

program
	.command("build")
	.description("Build workflow bundles (runs `workflow build`)")
	.option("-r, --root <dir>", "Project root directory", ".")
	.action(buildCommand);

program
	.command("serve")
	.description("Start production workflow server")
	.option("-p, --port <port>", "Server port", "3000")
	.option("-r, --root <dir>", "Project root directory", ".")
	.action(serveCommand);

program.parse();
