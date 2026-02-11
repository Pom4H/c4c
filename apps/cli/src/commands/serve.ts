import { resolve } from "node:path";

interface ServeOptions {
	port: string;
	root: string;
}

export async function serveCommand(options: ServeOptions) {
	const rootDir = resolve(options.root);
	const port = Number(options.port);

	const { createWorkflowServer } = await import("@c4c/adapters");
	await createWorkflowServer({ port, rootDir });
}
