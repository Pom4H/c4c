import { workflow, step, parallel } from "@tsdev/workflow";
import type { StepContext } from "@tsdev/workflow";
import { z } from "zod";

type AnyStepContext = StepContext<unknown>;

const task1 = step({
	id: "task-1",
	input: z.object({}),
	output: z.object({ result: z.number() }),
	execute: ({ engine }: AnyStepContext) =>
		engine.run("math.add", {
			a: 10,
			b: 20,
		}),
});

const task2 = step({
	id: "task-2",
	input: z.object({}),
	output: z.object({ result: z.number() }),
	execute: ({ engine }: AnyStepContext) =>
		engine.run("math.multiply", {
			a: 5,
			b: 6,
		}),
});

const task3 = step({
	id: "task-3",
	input: z.object({}),
	output: z.object({ result: z.number() }),
	execute: ({ engine }: AnyStepContext) =>
		engine.run("math.subtract", {
			a: 100,
			b: 25,
		}),
});

const parallelExecution = parallel({
	id: "parallel-execution",
	branches: [task1, task2, task3],
	waitForAll: true,
	input: z.object({}),
	output: z.object({
		task1: task1.output,
		task2: task2.output,
		task3: task3.output,
	}),
});

const aggregateResults = step({
	id: "aggregate-results",
	input: z.object({}),
	output: z.object({}),
	execute: ({ engine }: AnyStepContext) => engine.run("data.save", {}),
});

export const parallelTasksWorkflow = workflow("parallel-tasks")
	.name("Parallel Task Execution")
	.description("Executes multiple tasks simultaneously")
	.version("1.0.0")
	.metadata({ tags: ["parallel", "demo"] })
	.step(parallelExecution)
	.step(aggregateResults)
	.commit();
