import { workflow, step } from "@c4c/workflow";
import type { StepContext } from "@c4c/workflow";
import { z } from "zod";

type AnyStepContext = StepContext<unknown>;

const start = step({
	id: "start",
	input: z.object({}),
	output: z.object({ result: z.number() }),
	execute: ({ engine }: AnyStepContext) =>
		engine.run("math.add", {
			a: 5,
			b: 5,
		}),
});

const willFail = step({
	id: "will-fail",
	input: z.object({}),
	output: z.object({}),
	execute: ({ engine }: AnyStepContext) =>
		engine.run("math.divide", {
			a: 100,
			b: 0,
		}),
});

const neverReached = step({
	id: "never-reached",
	input: z.object({}),
	output: z.object({}),
	execute: ({ engine }: AnyStepContext) => engine.run("data.save", {}),
});

export const errorDemoWorkflow = workflow("error-demo")
	.name("Error Handling Demo")
	.description("Demonstrates node failure and error span propagation")
	.version("1.0.0")
	.metadata({ tags: ["error", "+otel"] })
	.variables({ a: 10, b: 0 })
	.step(start)
	.step(willFail)
	.step(neverReached)
	.commit();
