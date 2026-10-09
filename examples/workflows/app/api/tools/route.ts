import { describeTools, prepareReview, recordDecision } from '../../../lib/tools';
import { authorize, readJSON, json, failure } from '../../../lib/http';
import { z } from 'zod';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { authorize(request); return json({ tools: describeTools() }); } catch (error) { return failure(error); }
}
const invocation = z.discriminatedUnion('name', [
  z.object({ name: z.literal('prepareReview'), input: prepareReview.contract.input }).strict(),
  z.object({ name: z.literal('recordDecision'), input: recordDecision.contract.input }).strict(),
]);
export async function POST(request: Request) {
  try {
    authorize(request);
    const call = invocation.parse(await readJSON(request));
    // Both are pure tools. Arbitrary modules, URLs, eval or function names are not accepted.
    const value = call.name === 'prepareReview' ? await prepareReview(call.input) : await recordDecision(call.input);
    return json(value);
  } catch (error) { return failure(error); }
}
