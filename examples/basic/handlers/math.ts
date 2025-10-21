import { z } from "zod";
import type { Procedure } from "@c4c/core";

const mathInput = z.object({
  a: z.number(),
  b: z.number(),
});

const addOutput = z.object({ result: z.number() });
const multiplyOutput = z.object({ result: z.number() });
const subtractOutput = z.object({ result: z.number() });

export const mathAdd: Procedure<
  z.infer<typeof mathInput>,
  z.infer<typeof addOutput>
> = {
  contract: {
    name: "math.add",
    description: "Adds two numbers together.",
    input: mathInput,
    output: addOutput,
    metadata: {
      exposure: "internal",
      roles: ["workflow-node"],
      category: "demo",
      tags: ["math"],
    },
  },
  handler: async ({ a, b = 0 }) => ({
    result: a + b,
  }),
};

export const mathMultiply: Procedure<
  z.infer<typeof mathInput>,
  z.infer<typeof multiplyOutput>
> = {
  contract: {
    name: "math.multiply",
    description: "Multiplies two numbers.",
    input: mathInput,
    output: multiplyOutput,
    metadata: {
      exposure: "internal",
      roles: ["workflow-node"],
      category: "demo",
      tags: ["math"],
    },
  },
  handler: async ({ a, b = 1 }) => ({
    result: a * b,
  }),
};

export const mathSubtract: Procedure<
  z.infer<typeof mathInput>,
  z.infer<typeof subtractOutput>
> = {
  contract: {
    name: "math.subtract",
    description: "Subtracts the second number from the first.",
    input: mathInput,
    output: subtractOutput,
    metadata: {
      exposure: "internal",
      roles: ["workflow-node"],
      category: "demo",
      tags: ["math"],
    },
  },
  handler: async ({ a, b = 0 }) => ({
    result: a - b,
  }),
};
