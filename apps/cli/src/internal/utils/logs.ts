/**
 * Split a string into log lines while trimming the trailing empty entry.
 */
export function splitLines(text: string): string[] {
	if (!text) return [];
	const lines = text.split(/\r?\n/);
	if (lines.length > 0 && lines[lines.length - 1] === "") {
		lines.pop();
	}
	return lines;
}

/**
 * Return the last N lines from the provided list.
 */
export function tailLines(lines: string[], count: number): string[] {
	if (count <= 0) return [];
	return lines.slice(Math.max(lines.length - count, 0));
}

