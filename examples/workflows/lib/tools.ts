import { define } from '@c4c/core';
import { z } from 'zod';
import { reviewInputSchema, preparedReviewSchema, approvalSchema, decisionSchema } from './contracts';
import { prepare, conclude } from './review';

export const prepareReview = define({
  description: 'Summarize the reviewed API change without changing any integration.',
  input: reviewInputSchema, output: preparedReviewSchema,
}, prepare);
export const recordDecision = define({
  description: 'Return a decision bound to the exact candidate hash; never deploy code.',
  input: z.object({ review: preparedReviewSchema, approval: approvalSchema }).strict(),
  output: decisionSchema,
}, ({ review, approval }) => conclude(review, approval));

// Explicit tool set, not module scanning or a string-based execution engine.
// The same callable contracts are used directly, by steps, and by introspection.
export const tools = { prepareReview, recordDecision };
export function describeTools() {
  return Object.entries(tools).map(([name, tool]) => ({
    name, description: tool.contract.description,
    inputSchema: z.toJSONSchema(tool.contract.input),
    outputSchema: z.toJSONSchema(tool.contract.output),
  }));
}
