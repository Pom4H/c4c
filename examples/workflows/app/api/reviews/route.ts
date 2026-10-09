import { start } from 'workflow/api';
import { reviewChange } from '../../../workflows/review-change';
import { reviewInputSchema } from '../../../lib/contracts';
import { authorize, readJSON, json, failure } from '../../../lib/http';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    authorize(request);
    const input = reviewInputSchema.parse(await readJSON(request));
    const run = await start(reviewChange, [input]);
    // Return promptly; awaiting the human decision here would keep HTTP open.
    return json({ runId: run.runId, statusUrl: `/api/reviews/${run.runId}` }, 202);
  } catch (error) { return failure(error); }
}
