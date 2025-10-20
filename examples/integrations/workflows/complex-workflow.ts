import { workflow, step, parallel, condition } from "@c4c/workflow";
import type { StepContext, ConditionContext } from "@c4c/workflow";
import { z } from "zod";

const mathResultSchema = z.object({ result: z.number() });
type AnyStepContext = StepContext<unknown>;
type AnyConditionContext = ConditionContext<unknown>;

const initData = step({
	id: "init-data",
	input: z.object({}),
	output: z.object({}),
	execute: ({ engine }: AnyStepContext) =>
		engine.run("data.fetch", {
			userId: "user_456",
		}),
});

const check1 = step({
	id: "check-1",
	input: z.object({}),
	output: mathResultSchema,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("math.add", {
			a: 5,
			b: 7,
		}),
});

const check2 = step({
	id: "check-2",
	input: z.object({}),
	output: mathResultSchema,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("math.multiply", {
			a: 3,
			b: 4,
		}),
});

const parallelChecks = parallel({
	id: "parallel-checks",
	branches: [check1, check2],
	waitForAll: true,
	input: z.object({}),
	output: z.object({
		check1: mathResultSchema,
		check2: mathResultSchema,
	}),
});

const premiumBranch = step({
	id: "premium-branch",
	input: mathResultSchema,
	output: z.object({}),
	execute: ({ engine }: AnyStepContext) =>
		engine.run("data.process", {
			mode: "premium",
		}),
});

const basicBranch = step({
	id: "basic-branch",
	input: mathResultSchema,
	output: z.object({}),
	execute: ({ engine }: AnyStepContext) =>
		engine.run("data.process", {
			mode: "basic",
		}),
});

const evaluateResults = condition({
	id: "evaluate-results",
	input: parallelChecks.output,
	whenTrue: premiumBranch,
	whenFalse: basicBranch,
	predicate: (ctx: AnyConditionContext) => {
		const first = ctx.outputs.get("check-1") as { result?: number } | undefined;
		const second = ctx.outputs.get("check-2") as { result?: number } | undefined;
		return (first?.result ?? 0) > (second?.result ?? 0);
	},
});

const finalize = step({
	id: "finalize",
	input: z.object({}),
	output: z.object({}),
	execute: ({ engine }: AnyStepContext) => engine.run("data.save", {}),
});

export const complexWorkflow = workflow("complex-workflow")
	.name("Complex Multi-Pattern Workflow")
	.description("Demonstrates sequential, conditional, and parallel patterns")
	.version("1.0.0")
	.metadata({ tags: ["complex", "demo"] })
	.variables({ userId: "user_456" })
	.step(initData)
	.step(parallelChecks)
	.step(evaluateResults)
	.step(finalize)
	.commit();
