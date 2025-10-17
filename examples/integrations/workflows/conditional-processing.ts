import { workflow, step, condition } from "@tsdev/workflow";
import type { StepContext, ConditionContext } from "@tsdev/workflow";
import { z } from "zod";

type AnyStepContext = StepContext<unknown>;
type AnyConditionContext = ConditionContext<unknown>;

const fetchUser = step({
	id: "fetch-user",
	input: z.object({}),
	output: z.object({}),
	execute: ({ engine }: AnyStepContext) =>
		engine.run("data.fetch", {
			userId: "user_123",
		}),
});

const premiumProcessing = step({
	id: "premium-processing",
	input: z.object({}),
	output: z.object({}),
	execute: ({ engine }: AnyStepContext) =>
		engine.run("data.process", {
			mode: "premium",
		}),
});

const basicProcessing = step({
	id: "basic-processing",
	input: z.object({}),
	output: z.object({}),
	execute: ({ engine }: AnyStepContext) =>
		engine.run("data.process", {
			mode: "basic",
		}),
});

const saveResults = step({
	id: "save-results",
	input: z.object({}),
	output: z.object({}),
	execute: ({ engine }: AnyStepContext) => engine.run("data.save", {}),
});

const checkPremium = condition({
	id: "check-premium",
	input: fetchUser.output,
	whenTrue: premiumProcessing,
	whenFalse: basicProcessing,
	predicate: (ctx: AnyConditionContext) => ctx.variables.isPremium === true,
});

export const conditionalProcessingWorkflow = workflow("conditional-processing")
	.name("Conditional Data Processing")
	.description("Processes data differently based on user tier")
	.version("1.0.0")
	.metadata({ tags: ["data", "conditional"] })
	.variables({ userId: "user_123" })
	.step(fetchUser)
	.step(checkPremium)
	.step(saveResults)
	.commit();
