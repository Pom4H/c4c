/** Pure business logic. Schemas live on the tool boundary; no workflow runtime here. */
export type Report = {
  previousHash: string;
  candidateHash: string;
  changes: { path: string; kind: 'added' | 'removed' | 'changed' }[];
  truncated: boolean;
  generatorChanged: boolean;
};
export type ReviewInput = { integration: string; report: Report };
export type PreparedReview = {
  integration: string;
  previousHash: string;
  candidateHash: string;
  needsReview: boolean;
  truncated: boolean;
  changes: { added: number; removed: number; changed: number };
};
export type Approval = { candidateHash: string; approved: boolean };
export class ReviewMismatchError extends Error {
  constructor() { super('Approval does not match the reviewed candidate'); this.name = 'ReviewMismatchError'; }
}
export function prepare(input: ReviewInput): PreparedReview {
  const changes = { added: 0, removed: 0, changed: 0 };
  for (const change of input.report.changes) changes[change.kind]++;
  return {
    integration: input.integration, previousHash: input.report.previousHash,
    candidateHash: input.report.candidateHash, truncated: input.report.truncated,
    needsReview: input.report.previousHash !== input.report.candidateHash || input.report.generatorChanged,
    changes,
  };
}
export function conclude(review: PreparedReview, approval: Approval) {
  if (approval.candidateHash !== review.candidateHash) throw new ReviewMismatchError();
  // Approval is not a deployment or a guarantee of API compatibility.
  return { integration: review.integration, candidateHash: review.candidateHash,
    decision: approval.approved ? 'approved' as const : 'rejected' as const };
}
export function approvalToken(runId: string, candidateHash: string): string {
  return `c4c:review:${runId}:${candidateHash}`;
}
