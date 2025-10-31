import { workflowRouter } from "@/server/useworkflow-router";

export const dynamic = "force-dynamic";

export const GET = (request: Request) => workflowRouter.fetch(request);
