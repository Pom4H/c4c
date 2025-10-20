import type { Handler, Policy } from "@c4c/core";

interface RateLimiter {
	tokens: number;
	lastRefill: number;
}

const limiters = new Map<string, RateLimiter>();

export interface RateLimitOptions {
	maxTokens?: number;
	refillRate?: number; // tokens per second
	key?: (input: unknown) => string;
}

/**
 * Rate limiting policy using token bucket algorithm
 */
export function withRateLimit(options: RateLimitOptions = {}): Policy {
	const { maxTokens = 10, refillRate = 1, key = () => "default" } = options;

	return <TInput, TOutput>(handler: Handler<TInput, TOutput>): Handler<TInput, TOutput> => {
		return async (input, context) => {
			const limitKey = key(input);
			const limiter = getOrCreateLimiter(limitKey, maxTokens);

			// Refill tokens based on time passed
			const now = Date.now();
			const timePassed = (now - limiter.lastRefill) / 1000; // seconds
			const tokensToAdd = timePassed * refillRate;

			limiter.tokens = Math.min(maxTokens, limiter.tokens + tokensToAdd);
			limiter.lastRefill = now;

			// Check if we have tokens available
			if (limiter.tokens < 1) {
				throw new Error("Rate limit exceeded");
			}

			// Consume a token
			limiter.tokens -= 1;

			return handler(input, context);
		};
	};
}

function getOrCreateLimiter(key: string, maxTokens: number): RateLimiter {
	let limiter = limiters.get(key);
	if (!limiter) {
		limiter = { tokens: maxTokens, lastRefill: Date.now() };
		limiters.set(key, limiter);
	}
	return limiter;
}
