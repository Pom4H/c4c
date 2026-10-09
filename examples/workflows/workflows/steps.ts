import { ContractError } from '@c4c/core';
import { FatalError } from 'workflow';
import { ReviewMismatchError, type ReviewInput, type PreparedReview, type Approval } from '../lib/review';
import { prepareReview, recordDecision } from '../lib/tools';

function rethrow(error: unknown): never {
  if (error instanceof ContractError || error instanceof ReviewMismatchError) {
    // Deterministic invalid input/output must not consume retries or repeat side effects.
    throw new FatalError(error instanceof ContractError ? `Tool contract failed: ${error.stage}` : error.message);
  }
  // SDK owns retries. A real adapter must also map permission/business errors
  // to FatalError, and use RetryableError for its known transient failures.
  throw error;
}
export async function prepareReviewStep(input: ReviewInput): Promise<PreparedReview> {
  'use step';
  try { return await prepareReview(input); } catch (error) { rethrow(error); }
}
export async function recordDecisionStep(review: PreparedReview, approval: Approval) {
  'use step';
  try { return await recordDecision({ review, approval }); } catch (error) { rethrow(error); }
}
// The directive stays in each exported function for static SDK discovery.
// Do not replace these with durable(tool) or a generic string dispatcher.
