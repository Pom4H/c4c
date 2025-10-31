import { workflowRouter } from "@/server/useworkflow-router";

export const POST = (request: Request) => workflowRouter.fetch(request);
