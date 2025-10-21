import { resolve, relative } from "node:path";
import { generateClient as runGenerateClient, type GenerateClientOptions } from "../lib/generate.js";
import { determineHandlersPath, resolveOutputPath } from "../lib/project-paths.js";

interface GenerateClientCommandOptions {
	root?: string;
	handlers?: string;
	out?: string;
	baseUrl?: string;
}

export async function generateClientCommand(options: GenerateClientCommandOptions): Promise<void> {
	const rootDir = resolve(options.root ?? process.cwd());
	const handlersPath = determineHandlersPath(rootDir, options.handlers);
	const outFile = resolveOutputPath(options.out ?? "c4c-client.ts");

	const clientOptions: GenerateClientOptions = {
		outFile,
		handlersPath,
		baseUrl: options.baseUrl,
	};

	const outputPath = await runGenerateClient(clientOptions);
	const outputLabel = relative(process.cwd(), outputPath) || outputPath;
	console.log(`[c4c] Generated client at ${outputLabel}`);
}
