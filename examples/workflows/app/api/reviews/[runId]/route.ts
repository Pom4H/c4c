import { getRun } from 'workflow/api';
import type { reviewChange } from '../../../../workflows/review-change';
import { authorize, runIdSchema, json, failure } from '../../../../lib/http';

type Context = { params: Promise<{ runId: string }> };
export const runtime = 'nodejs';
export async function GET(request: Request, context: Context) {
  try {
    authorize(request);
    const id = runIdSchema.parse((await context.params).runId);
    const run = getRun<Awaited<ReturnType<typeof reviewChange>>>(id);
    const status = await run.status;
    return json({ runId: id, status, result: status === 'completed' ? await run.returnValue : null });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request, context: Context) {
  try {
    authorize(request);
    const id = runIdSchema.parse((await context.params).runId);
    await getRun(id).cancel();
    return json({ runId: id, cancelled: true });
  } catch (error) { return failure(error); }
}
