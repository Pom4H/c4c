/**
 * Duration parser
 *
 * Parses human-readable duration strings like "5s", "1m", "2h"
 * into milliseconds.
 */

const DURATION_REGEX = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/i;

const MULTIPLIERS: Record<string, number> = {
	ms: 1,
	s: 1_000,
	m: 60_000,
	h: 3_600_000,
	d: 86_400_000,
};

/**
 * Parse a duration string or number into milliseconds.
 *
 * @param duration - Duration as string ("5s", "1m", "2h") or number (milliseconds)
 * @returns Duration in milliseconds
 *
 * @example
 * ```ts
 * parseDuration("5s")   // 5000
 * parseDuration("1m")   // 60000
 * parseDuration("2h")   // 7200000
 * parseDuration(5000)   // 5000
 * ```
 */
export function parseDuration(duration: string | number): number {
	if (typeof duration === "number") {
		return duration;
	}

	const match = duration.match(DURATION_REGEX);
	if (!match) {
		const asNum = Number(duration);
		if (!Number.isNaN(asNum)) {
			return asNum;
		}
		throw new Error(
			`Invalid duration format: "${duration}". Use "5s", "1m", "2h", "1d" or a number (ms).`
		);
	}

	const value = Number.parseFloat(match[1]);
	const unit = match[2].toLowerCase();
	const multiplier = MULTIPLIERS[unit];

	if (multiplier === undefined) {
		throw new Error(`Unknown duration unit: "${unit}"`);
	}

	return Math.round(value * multiplier);
}
