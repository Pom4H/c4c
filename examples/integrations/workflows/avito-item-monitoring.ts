import { workflow, step, condition, sequence } from "@tsdev/workflow";
import type { StepContext, ConditionContext } from "@tsdev/workflow";
import { z } from "zod";
import {
	zGetItemInfoResponse,
	zPostCallsStatsResponse,
	zVasPricesResponse,
} from "../generated/avito/items/zod.gen.js";

const emptyInput = z.object({});
type AnyStepContext = StepContext<unknown>;
type AnyConditionContext = ConditionContext<unknown>;

const loadItem = step({
	id: "load-item",
	input: emptyInput,
	output: zGetItemInfoResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("avitoItems.get.item.info", {
			path: {
				user_id: 1234567890,
				item_id: 9876543210,
			},
			headers: {
				Authorization: "",
			},
		}),
});

const fetchVasPrices = step({
	id: "fetch-vas-prices",
	input: zGetItemInfoResponse,
	output: zVasPricesResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("avitoItems.vas.prices", {
			path: {
				user_id: 1234567890,
			},
			body: {
				itemIds: [9876543210, 9876543209],
			},
			headers: {
				Authorization: "",
			},
		}),
});

const loadCallsStats = step({
	id: "load-calls-stats",
	input: zGetItemInfoResponse,
	output: zPostCallsStatsResponse,
	execute: ({ engine }: AnyStepContext) =>
		engine.run("avitoItems.post.calls.stats", {
			path: {
				user_id: 1234567890,
			},
			body: {
				dateFrom: "2024-01-01",
				dateTo: "2024-01-31",
				itemIds: [9876543210],
			},
			headers: {
				Authorization: "",
				"Content-Type": "application/json",
			},
		}),
});

const decideVas = condition({
	id: "decide-vas",
	input: loadItem.output,
	whenTrue: fetchVasPrices,
	whenFalse: loadCallsStats,
	predicate: (ctx: AnyConditionContext) => ctx.variables.status === "active",
});

const finalize = sequence({ id: "complete" });

export const avitoItemMonitoringWorkflow = workflow("avito-item-monitoring")
	.name("Avito Item Monitoring")
	.description("Chooses the follow-up action for an Avito listing based on its status.")
	.version("1.0.0")
	.metadata({ tags: ["avito", "conditional"] })
	.step(loadItem)
	.step(decideVas)
	.step(finalize)
	.commit();
