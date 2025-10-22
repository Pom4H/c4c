import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { collectRegistry } from "@c4c/core";
import { generateRpcClientModule, type RpcClientGeneratorOptions } from "@c4c/generators";

export interface GenerateClientOptions {
	proceduresPath?: string;
	outFile: string;
	baseUrl?: string;
}

export async function generateClient(options: GenerateClientOptions): Promise<string> {
	const proceduresPath = options.proceduresPath ?? process.env.C4C_PROCEDURES ?? "src/procedures";
	const registry = await collectRegistry(proceduresPath);
	const moduleSource = generateRpcClientModule(registry, { baseUrl: options.baseUrl });
	const outFile = resolve(process.cwd(), options.outFile);
	await fs.mkdir(dirname(outFile), { recursive: true });
	await fs.writeFile(outFile, moduleSource, "utf8");
	return outFile;
}
