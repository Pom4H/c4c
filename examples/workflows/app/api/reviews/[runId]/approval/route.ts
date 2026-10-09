import { getRun } from 'workflow/api';
import { approvalHook } from '../../../../../workflows/hooks';
import { approvalSchema } from '../../../../../lib/contracts';
import { approvalToken } from '../../../../../lib/review';
import { authorize, readJSON, runIdSchema, json, failure, HttpError } from '../../../../../lib/http';

type Context = { params: Promise<{ runId: string }> };
export const runtime = 'nodejs';
export async function POST(request: Request, context: Context) {
  try {
    authorize(request);
    const id = runIdSchema.parse((await context.params).runId);
    const payload = approvalSchema.parse(await readJSON(request));
    const status = await getRun(id).status;
    if (['completed', 'failed', 'cancelled'].includes(status)) throw new HttpError(409, 'Run is already terminal');
    // A decision for another hash cannot wake this run's hook.
    await approvalHook.resume(approvalToken(id, payload.candidateHash), payload);
    return json({ runId: id, accepted: true }, 202);
  } catch (error) { return failure(error); }
}
