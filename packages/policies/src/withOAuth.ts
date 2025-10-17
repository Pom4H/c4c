import type { ExecutionContext, Handler, Policy } from "@tsdev/core";

export interface OAuthPolicyOptions {
	/**
	 * Unique provider name used to store OAuth metadata in the execution context.
	 */
	provider: string;
	/**
	 * Custom header name. Defaults to `Authorization`.
	 */
	headerName?: string;
	/**
	 * Header scheme, e.g. `Bearer`. Pass empty string to send the raw token.
	 */
	scheme?: string | ((token: string) => string);
	/**
	 * Optional key in the execution context metadata where a token may already exist.
	 * Falls back to `${provider}Token` when omitted.
	 */
	metadataTokenKey?: string | null;
	/**
	 * Environment variable used as a fallback source for the OAuth token.
	 */
	envVar?: string;
	/**
	 * Provide a token programmatically. This takes precedence over other sources.
	 */
	token?: string | (() => string | undefined | Promise<string | undefined>);
	/**
	 * Resolve the token dynamically based on the execution context.
	 */
	tokenProvider?: (
		context: ExecutionContext
	) => string | undefined | Promise<string | undefined>;
	/**
	 * Store resolved OAuth metadata back onto the execution context.
	 * Enabled by default to let handlers reuse computed headers.
	 */
	storeMetadata?: boolean;
}

export interface OAuthMetadataEntry {
	token: string;
	headerName: string;
	headerValue: string;
}

export type OAuthMetadata = Record<string, OAuthMetadataEntry>;

const OAUTH_METADATA_KEY = "oauth";

/**
 * Helper to extract prepared OAuth headers from the execution context.
 */
export function getOAuthHeaders(
	context: ExecutionContext,
	provider: string
): Record<string, string> | null {
	const metadata = context.metadata[OAUTH_METADATA_KEY] as OAuthMetadata | undefined;
	const entry = metadata?.[provider];
	if (!entry) {
		return null;
	}

	return { [entry.headerName]: entry.headerValue };
}

/**
 * Helper to extract the raw OAuth token from execution metadata.
 */
export function getOAuthToken(context: ExecutionContext, provider: string): string | null {
	const metadata = context.metadata[OAUTH_METADATA_KEY] as OAuthMetadata | undefined;
	const entry = metadata?.[provider];
	return entry?.token ?? null;
}

/**
 * Policy that resolves OAuth tokens and prepares Authorization headers for handlers.
 *
 * Token resolution order:
 * 1. Explicit `token` option (string or factory)
 * 2. `tokenProvider` callback (async supported)
 * 3. `metadataTokenKey` from context metadata (default: `${provider}Token`)
 * 4. `envVar` environment variable
 *
 * When `storeMetadata` is true (default), the resolved token and header details are saved under
 * `context.metadata.oauth[provider]`, so handlers can fetch them via {@link getOAuthHeaders}.
 */
export function withOAuth(options: OAuthPolicyOptions): Policy {
	const {
		provider,
		headerName = "Authorization",
		scheme = "Bearer",
		metadataTokenKey = `${options.provider}Token`,
		envVar,
		token,
		tokenProvider,
		storeMetadata = true,
	} = options;

	if (!provider) {
		throw new Error("withOAuth: `provider` option is required");
	}

	return <TInput, TOutput>(handler: Handler<TInput, TOutput>): Handler<TInput, TOutput> => {
		return async (input, context) => {
		const resolvedToken = await resolveToken({
			context,
			provider,
			metadataTokenKey,
			envVar,
			token,
			tokenProvider,
		});

			if (!resolvedToken) {
				throw new Error(
					`withOAuth: Unable to resolve OAuth token for provider "${provider}". ` +
						"Provide a token via metadata, envVar, token option, or tokenProvider."
				);
			}

		const headerValue =
			typeof scheme === "function"
				? scheme(resolvedToken)
				: scheme
				? normalizeSchemeHeader(scheme, resolvedToken)
				: resolvedToken;

			const nextContext: ExecutionContext = storeMetadata
				? enrichContext(context, provider, headerName, headerValue, resolvedToken, metadataTokenKey)
				: context;

			return handler(input, nextContext);
		};
	};
}

interface ResolveTokenArgs {
	context: ExecutionContext;
	provider: string;
	metadataTokenKey?: string | null;
	envVar?: string;
	token?: string | (() => string | undefined | Promise<string | undefined>);
	tokenProvider?: (
		context: ExecutionContext
	) => string | undefined | Promise<string | undefined>;
}

async function resolveToken({
	context,
	metadataTokenKey,
	envVar,
	token,
	tokenProvider,
}: ResolveTokenArgs): Promise<string | undefined> {
	if (typeof token === "string") {
		return token;
	}

	if (typeof token === "function") {
		const directToken = await token();
		if (directToken) return directToken;
	}

	if (tokenProvider) {
		const provided = await tokenProvider(context);
		if (provided) return provided;
	}

	if (metadataTokenKey) {
		const metadataToken = context.metadata[metadataTokenKey];
		if (typeof metadataToken === "string" && metadataToken.length > 0) {
			return metadataToken;
		}
	}

	if (envVar) {
		const envToken = process.env[envVar];
		if (envToken) {
			return envToken;
		}
	}

	return undefined;
}

function enrichContext(
	context: ExecutionContext,
	provider: string,
	headerName: string,
	headerValue: string,
	token: string,
	metadataTokenKey?: string | null
): ExecutionContext {
	const metadata: Record<string, unknown> = {
		...context.metadata,
		[OAUTH_METADATA_KEY]: {
			...((context.metadata[OAUTH_METADATA_KEY] as OAuthMetadata | undefined) ?? {}),
			[provider]: {
				token,
				headerName,
				headerValue,
			},
		},
	};

	if (metadataTokenKey) {
		metadata[metadataTokenKey] = token;
	}

	return {
		...context,
		metadata,
	};
}

function normalizeSchemeHeader(scheme: string, token: string): string {
	const trimmedToken = token.trim();
	const lowerScheme = scheme.trim().toLowerCase();
	if (trimmedToken.toLowerCase().startsWith(`${lowerScheme} `)) {
		return trimmedToken;
	}
	return `${scheme.trim()} ${trimmedToken}`.trim();
}
