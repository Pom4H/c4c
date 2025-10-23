import { resolve, relative } from "node:path";
import { writeFile } from "node:fs/promises";
import { resolveOutputPath } from "../lib/project-paths.js";
import { generateRpcClientModule } from "@c4c/generators";
import { collectProjectArtifacts } from "@c4c/core";

interface GenerateClientCommandOptions {
    root?: string;
    out?: string;
    baseUrl?: string;
}

export async function generateClientCommand(options: GenerateClientCommandOptions): Promise<void> {
	const rootDir = resolve(options.root ?? process.cwd());
	const artifacts = await collectProjectArtifacts(rootDir);
	const outFile = resolveOutputPath(options.out ?? "c4c-client.ts");

	const clientCode = generateRpcClientModule(artifacts.procedures, {
		baseUrl: options.baseUrl,
	});

	await writeFile(outFile, clientCode, "utf-8");
	
	const outputLabel = relative(process.cwd(), outFile) || outFile;
	console.log(`[c4c] Generated client at ${outputLabel}`);
}
