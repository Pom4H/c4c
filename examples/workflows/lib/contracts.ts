import { z } from 'zod';

export const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const integrationSchema = z.string().regex(/^[a-z][a-z0-9-]{0,62}$/);
export const changeSchema = z.object({
  path: z.string().max(4000), kind: z.enum(['added', 'removed', 'changed']),
}).strict();
// c4c check reports include extra informational fields; validate those we use
// and strip the others rather than promoting provider data into executable code.
export const reportSchema = z.object({
  previousHash: hashSchema, candidateHash: hashSchema,
  changes: z.array(changeSchema).max(200), truncated: z.boolean(), generatorChanged: z.boolean(),
});
export const reviewInputSchema = z.object({ integration: integrationSchema, report: reportSchema }).strict();
export const preparedReviewSchema = z.object({
  integration: integrationSchema, previousHash: hashSchema, candidateHash: hashSchema,
  needsReview: z.boolean(), truncated: z.boolean(),
  changes: z.object({ added: z.number().int().nonnegative(), removed: z.number().int().nonnegative(), changed: z.number().int().nonnegative() }).strict(),
}).strict();
export const approvalSchema = z.object({ candidateHash: hashSchema, approved: z.boolean() }).strict();
export const decisionSchema = z.object({
  integration: integrationSchema, candidateHash: hashSchema, decision: z.enum(['approved', 'rejected']),
}).strict();
