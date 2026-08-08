import { workflowRouter } from "@/server/useworkflow-router";

export const GET = (request: Request) => workflowRouter.fetch(request);
