import { workflow, step } from "@tsdev/workflow";
import type { StepContext } from "@tsdev/workflow";
import { z } from "zod";

type AnyStepContext = StepContext<unknown>;

const addNumbers = step({
	id: "add-numbers",
	input: z.object({}),
	output: z.object({ result: z.number() }),
	execute: ({ engine }: AnyStepContext) =>
		engine.run("math.add", {
			a: 10,
			b: 5,
		}),
});

const multiplyResult = step({
	id: "multiply-result",
	input: addNumbers.output,
	output: z.object({ result: z.number() }),
	execute: ({ engine }: AnyStepContext) =>
		engine.run("math.multiply", {
			a: 2,
		}),
});

const subtractValue = step({
	id: "subtract-value",
	input: multiplyResult.output,
	output: z.object({ result: z.number() }),
	execute: ({ engine }: AnyStepContext) =>
		engine.run("math.subtract", {
			a: 100,
		}),
});

export const mathCalculationWorkflow = workflow("math-calculation")
	.name("Math Calculation Workflow")
	.description("Demonstrates sequential math operations")
	.version("1.0.0")
	.metadata({ tags: ["math", "demo"] })
	.variables({ a: 10, b: 5 })
	.step(addNumbers)
	.step(multiplyResult)
	.step(subtractValue)
	.commit();
