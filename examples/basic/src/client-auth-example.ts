/**
 * Example demonstrating how to use the generated client with authentication
 * 
 * This example shows:
 * 1. How to create a client with an auth token
 * 2. How to use dynamic auth token retrieval
 * 3. How protected procedures automatically include auth headers
 */

// NOTE: This example assumes you have generated the client using:
// import { generateRpcClientModule } from "@c4c/generators";
// const clientCode = generateRpcClientModule(registry);

// For demonstration purposes, we'll show the usage pattern:

/**
 * Example 1: Client with static auth token
 */
export function example1_staticToken() {
	// When you generate the client, procedures with metadata.auth.requiresAuth = true
	// will automatically include the Authorization header
	
	/*
	const client = createTsdevClient({
		baseUrl: "http://localhost:3000",
		authToken: "your-jwt-token-here", // This token will be added to all protected procedures
	});

	// This procedure requires auth (has metadata.auth.requiresAuth = true)
	// The client will automatically add: Authorization: Bearer your-jwt-token-here
	const profile = await client.procedures.getUserProfile({ userId: "123" });
	console.log(profile);
	*/
}

/**
 * Example 2: Client with dynamic auth token retrieval
 * Useful when token can expire or needs to be fetched from storage
 */
export function example2_dynamicToken() {
	/*
	const client = createTsdevClient({
		baseUrl: "http://localhost:3000",
		getAuthToken: async () => {
			// Fetch token from localStorage, sessionStorage, or refresh it
			const token = localStorage.getItem("authToken");
			
			// Or fetch from secure storage
			// const token = await getTokenFromSecureStorage();
			
			// Or refresh if expired
			// if (isTokenExpired(token)) {
			//   token = await refreshToken();
			// }
			
			return token ?? undefined;
		},
	});

	// The getAuthToken function will be called for each protected procedure
	const users = await client.procedures.listUsers({ limit: 10 });
	console.log(users);
	*/
}

/**
 * Example 3: Client with custom headers and auth
 */
export function example3_customHeaders() {
	/*
	const client = createTsdevClient({
		baseUrl: "http://localhost:3000",
		authToken: "jwt-token",
		headers: {
			"X-API-Version": "1.0",
			"X-Client-ID": "web-app",
		},
	});

	// Protected procedures get: Authorization: Bearer jwt-token
	// Plus all custom headers
	await client.procedures.updateUserProfile({
		userId: "123",
		username: "new_username",
	});
	*/
}

/**
 * Example 4: Handling auth errors
 */
export async function example4_authErrors() {
	/*
	const client = createTsdevClient({
		baseUrl: "http://localhost:3000",
		// No auth token provided!
	});

	try {
		// This will log a warning: "Procedure requires authentication but no auth token was provided"
		// And the server will return 401 Unauthorized
		await client.procedures.deleteUser({ userId: "123" });
	} catch (error) {
		if (error.message.includes("401")) {
			console.error("Authentication required!");
			// Redirect to login, show auth modal, etc.
		}
	}
	*/
}

/**
 * Example 5: Real-world React usage
 */
export function example5_reactUsage() {
	/*
	// In your React app:
	import { createTsdevClient } from "./generated/client";
	import { useAuth } from "./hooks/useAuth";

	function App() {
		const { token } = useAuth();
		
		const client = useMemo(() => createTsdevClient({
			baseUrl: process.env.REACT_APP_API_URL,
			authToken: token,
		}), [token]);

		const handleLoadProfile = async () => {
			try {
				const profile = await client.procedures.getUserProfile({ 
					userId: "current" 
				});
				setProfile(profile);
			} catch (error) {
				console.error("Failed to load profile:", error);
			}
		};

		return <div>...</div>;
	}
	*/
}

/**
 * Example 6: Node.js backend usage
 */
export function example6_backendUsage() {
	/*
	// In your backend service:
	import { createTsdevClient } from "./generated/client";

	const client = createTsdevClient({
		baseUrl: "http://internal-api:3000",
		getAuthToken: async () => {
			// Use service account token or machine-to-machine auth
			return process.env.SERVICE_ACCOUNT_TOKEN;
		},
	});

	// Use in your routes
	app.get("/api/admin/users", async (req, res) => {
		try {
			const users = await client.procedures.listUsers({ 
				limit: 100 
			});
			res.json(users);
		} catch (error) {
			res.status(500).json({ error: error.message });
		}
	});
	*/
}

/**
 * Generated client structure (for reference):
 */
export const GENERATED_CLIENT_EXAMPLE = `
// This is what the generated client looks like:

export interface TsdevClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  /**
   * Authentication token for protected procedures
   * Will be automatically added as "Authorization: Bearer <token>" header
   */
  authToken?: string;
  /**
   * Custom function to get auth token dynamically
   */
  getAuthToken?: () => string | undefined | Promise<string | undefined>;
}

export interface ProcedureDefinitions {
  "getUserProfile": {
    input: GetUserProfileInput;
    output: GetUserProfileOutput;
    requiresAuth: true; // ← Marked as requiring auth
  };
  "deleteUser": {
    input: DeleteUserInput;
    output: DeleteUserOutput;
    requiresAuth: true; // ← Marked as requiring auth
  };
  // ... other procedures
}

export function createTsdevClient(options: TsdevClientOptions = {}) {
  const resolved = resolveOptions(options);
  
  const invoke = async <P extends keyof ProcedureDefinitions>(
    name: P,
    input: ProcedureDefinitions[P]["input"]
  ): Promise<ProcedureDefinitions[P]["output"]> => {
    const metadata = PROCEDURE_METADATA[name];
    const headers = { ...resolved.headers };

    // Automatically add Authorization header for protected procedures
    if (metadata.requiresAuth) {
      let token = resolved.authToken;
      if (!token && resolved.getAuthToken) {
        token = await resolved.getAuthToken();
      }
      if (token) {
        headers["Authorization"] = \`Bearer \${token}\`;
      } else {
        console.warn(\`Procedure "\${name}" requires auth but no token provided\`);
      }
    }

    const response = await resolved.fetch(\`\${resolved.baseUrl}/rpc/\${name}\`, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });
    
    if (!response.ok) {
      throw new Error(\`Request failed: \${response.status}\`);
    }
    
    return await response.json();
  };

  return {
    invoke,
    procedures: {
      getUserProfile: (input) => invoke("getUserProfile", input),
      deleteUser: (input) => invoke("deleteUser", input),
      // ... other procedures
    }
  };
}
`;

/**
 * How the metadata is embedded in the generated client:
 */
export const METADATA_EXAMPLE = `
const PROCEDURE_METADATA = {
  "getUserProfile": {
    requiresAuth: true,
    authScheme: "Bearer",
  },
  "updateUserProfile": {
    requiresAuth: true,
    requiredPermissions: ["write:users"],
    authScheme: "Bearer",
  },
  "deleteUser": {
    requiresAuth: true,
    requiredRoles: ["admin"],
    authScheme: "Bearer",
  },
  "listUsers": {
    requiresAuth: true,
    requiredRoles: ["moderator", "admin"],
    authScheme: "Bearer",
  },
} as const;
`;
