/**
 * Durable sleep primitive
 *
 * Suspends the workflow for a specified duration.
 * Unlike setTimeout, this is tracked by the workflow runtime
 * and survives process restarts.
 */

import { parseDuration } from "./duration.js";

/**
 * Sleep for a specified duration within a workflow.
 *
 * @param duration - Duration as string ("5s", "1m", "2h") or number (milliseconds)
 * @returns Promise that resolves after the specified duration
 *
 * @example
 * ```ts
 * export async function myWorkflow() {
 *   "use workflow";
 *   await doStep1();
 *   await sleep("5s");    // Wait 5 seconds
 *   await doStep2();
 *   await sleep("1m");    // Wait 1 minute
 *   await doStep3();
 * }
 * ```
 */
export async function sleep(duration: string | number): Promise<void> {
	const ms = parseDuration(duration);
	return new Promise((resolve) => setTimeout(resolve, ms));
}
