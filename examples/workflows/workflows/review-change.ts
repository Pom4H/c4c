import { getWorkflowMetadata, sleep } from 'workflow';
import { approvalToken, type ReviewInput } from '../lib/review';
import { approvalHook } from './hooks';
import { prepareReviewStep, recordDecisionStep } from './steps';

export async function reviewChange(input: ReviewInput) {
  'use workflow';
  const review = await prepareReviewStep(input);
  if (!review.needsReview) return { decision: 'unchanged' as const, review };

  using approval = approvalHook.create({
    token: approvalToken(getWorkflowMetadata().workflowRunId, review.candidateHash),
  });
  // Durable waiting, not setTimeout, an HTTP connection or our own database queue.
  const result = await Promise.race([
    Promise.resolve(approval).then(value => ({ kind: 'decision' as const, value })),
    sleep('7 days').then(() => ({ kind: 'timeout' as const })),
  ]);
  if (result.kind === 'timeout') return { decision: 'expired' as const, review };
  const decision = await recordDecisionStep(review, result.value);
  return { ...decision, review };
}
