/**
 * Next.js API Route handler for Hono app
 * This integrates Hono directly into Next.js without running a separate server
 */

import { handle } from "hono/vercel";
import app from "@/lib/workflow/hono-app";

// Export HTTP method handlers that Next.js expects
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
