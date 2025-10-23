# CLI Commands

The c4c CLI provides commands for development, execution, and code generation.

## Installation

The CLI is available as `@c4c/cli`:

```bash
pnpm add -D @c4c/cli

# Or globally
pnpm add -g @c4c/cli
```

Add to package.json scripts:

```json
{
  "scripts": {
    "c4c": "c4c",
    "dev": "c4c dev",
    "serve": "c4c serve"
  }
}
```

## Commands Overview

| Command | Description |
|---------|-------------|
| `c4c dev` | Start development server with hot reload |
| `c4c serve` | Start production server |
| `c4c exec` | Execute procedure or workflow |
| `c4c generate` | Generate OpenAPI spec or TypeScript client |
| `c4c integrate` | Integrate external APIs |
| `c4c list` | List all procedures and workflows |

## Development Server

Start a development server with hot reload:

```bash
c4c dev
```

Options:

```bash
c4c dev [options]

Options:
  --root <path>        Root directory to scan (default: current directory)
  --port <number>      Port to listen on (default: 3000)
  --host <string>      Host to bind to (default: localhost)
  --watch              Enable file watching (default: true)
  --open               Open browser automatically
```

Examples:

```bash
# Start on port 8080
c4c dev --port 8080

# Scan specific directory
c4c dev --root ./src/procedures

# Disable file watching
c4c dev --watch false
```

### What it does:

- Scans project for procedures and workflows
- Starts HTTP server with RPC and REST endpoints
- Enables hot reload for instant updates
- Provides OpenAPI documentation
- Shows colored logs

## Production Server

Start a production server:

```bash
c4c serve
```

Options:

```bash
c4c serve [options]

Options:
  --root <path>        Root directory to scan (default: current directory)
  --port <number>      Port to listen on (default: 3000)
  --host <string>      Host to bind to (default: 0.0.0.0)
```

Examples:

```bash
# Start on port 8080
c4c serve --port 8080

# Listen on all interfaces
c4c serve --host 0.0.0.0

# Scan specific directory
c4c serve --root /app/procedures
```

## Execute Procedures

Execute a procedure:

```bash
c4c exec <procedure-name> [options]
```

Options:

```bash
c4c exec <name> [options]

Options:
  --input <json>       Input data as JSON string
  --json               Output as JSON (for scripting)
  --root <path>        Root directory to scan
```

Examples:

```bash
# Execute with input
c4c exec createUser --input '{"name":"Alice","email":"alice@example.com"}'

# Execute without input
c4c exec getUsers

# JSON output for scripts
c4c exec mathAdd --input '{"a":5,"b":3}' --json

# Use specific root
c4c exec createUser --root ./src --input '{"name":"Bob"}'
```

### Input Format

Input must be valid JSON:

```bash
# Simple object
c4c exec myProc --input '{"key":"value"}'

# Complex object
c4c exec myProc --input '{
  "name": "Alice",
  "tags": ["admin", "user"],
  "metadata": {"role": "admin"}
}'

# From file
c4c exec myProc --input "$(cat input.json)"
```

### Output

Default output is formatted:

```
✓ Executed: createUser
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Result:
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Alice",
  "email": "alice@example.com"
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Duration: 45ms
```

JSON output (for scripting):

```bash
c4c exec createUser --input '{"name":"Alice"}' --json
# {"id":"123...","name":"Alice","email":"alice@example.com"}
```

## Execute Workflows

Execute workflows the same way as procedures:

```bash
c4c exec user-onboarding --input '{"name":"Alice","email":"alice@example.com"}'
```

Workflows and procedures share the same execution command. The CLI automatically detects which one to execute.

### Priority

If a procedure and workflow have the same name, the procedure takes priority.

## Generate OpenAPI Spec

Generate OpenAPI 3.0 specification:

```bash
c4c generate openapi [options]
```

Options:

```bash
c4c generate openapi [options]

Options:
  --root <path>        Root directory to scan
  --out <path>         Output file path (default: ./openapi.json)
  --title <string>     API title
  --version <string>   API version
  --description <str>  API description
```

Examples:

```bash
# Basic generation
c4c generate openapi --out ./openapi.json

# With metadata
c4c generate openapi \
  --out ./api-spec.json \
  --title "My API" \
  --version "1.0.0" \
  --description "API documentation"

# Scan specific directory
c4c generate openapi --root ./src/procedures --out ./openapi.json
```

## Generate TypeScript Client

Generate type-safe TypeScript client:

```bash
c4c generate client [options]
```

Options:

```bash
c4c generate client [options]

Options:
  --root <path>        Root directory to scan
  --out <path>         Output file path (default: ./client.ts)
  --base-url <url>     Base URL for API (default: http://localhost:3000)
```

Examples:

```bash
# Basic generation
c4c generate client --out ./src/client.ts

# With custom base URL
c4c generate client \
  --out ./src/api-client.ts \
  --base-url "https://api.example.com"

# Scan specific directory
c4c generate client --root ./procedures --out ./client.ts
```

### Using Generated Client

```typescript
import { createClient } from "./client";

const client = createClient({
  baseUrl: "http://localhost:3000"
});

const user = await client.createUser({
  name: "Alice",
  email: "alice@example.com"
});
```

## Integrate External APIs

Integrate external APIs using OpenAPI specs:

```bash
c4c integrate <url> [options]
```

Options:

```bash
c4c integrate <url> [options]

Options:
  --name <string>      Integration name (required)
  --out <path>         Output directory (default: ./procedures/integrations)
```

Examples:

```bash
# Integrate external API
c4c integrate \
  https://api.apis.guru/v2/specs/googleapis.com/calendar/v3/openapi.json \
  --name google-calendar

# Integrate another c4c app
c4c integrate \
  http://localhost:3001/openapi.json \
  --name task-manager

# Custom output directory
c4c integrate \
  https://api.example.com/openapi.json \
  --name my-service \
  --out ./src/integrations
```

This generates:
- TypeScript SDK from OpenAPI spec
- Typed procedures for all endpoints
- Authentication configuration
- Base URL configuration

## List Procedures and Workflows

List all available procedures and workflows:

```bash
c4c list [options]
```

Options:

```bash
c4c list [options]

Options:
  --root <path>        Root directory to scan
  --filter <string>    Filter by name pattern
  --type <type>        Filter by type (procedure|workflow)
```

Examples:

```bash
# List everything
c4c list

# Filter by name
c4c list --filter user

# Only procedures
c4c list --type procedure

# Only workflows
c4c list --type workflow

# Scan specific directory
c4c list --root ./src/procedures
```

Output:

```
Procedures:
  • users.create - Create a new user
  • users.get - Get user by ID
  • users.update - Update user
  • users.delete - Delete user
  
Workflows:
  • user-onboarding (v1.0.0) - User Onboarding Flow
  • user-offboarding (v1.0.0) - User Offboarding Flow
```

## Global Options

These options work with all commands:

```bash
--help               Show help
--version            Show version
--verbose            Verbose output
--quiet              Quiet mode (errors only)
--no-color           Disable colored output
```

Examples:

```bash
# Show help
c4c --help
c4c dev --help
c4c exec --help

# Show version
c4c --version

# Verbose mode
c4c dev --verbose

# Quiet mode
c4c serve --quiet

# Disable colors
c4c list --no-color
```

## Environment Variables

Configure c4c with environment variables:

```bash
# Default port
C4C_PORT=8080

# Default host
C4C_HOST=0.0.0.0

# Default root
C4C_ROOT=./src/procedures

# Log level
C4C_LOG_LEVEL=debug

# Disable colors
NO_COLOR=1
```

Usage:

```bash
# Set port via environment
C4C_PORT=8080 c4c dev

# Multiple variables
C4C_PORT=8080 C4C_HOST=0.0.0.0 c4c serve
```

## Scripting

Use c4c in scripts:

```bash
#!/bin/bash

# Execute and capture output
result=$(c4c exec createUser --input '{"name":"Alice"}' --json)
userId=$(echo "$result" | jq -r '.id')

echo "Created user: $userId"

# Execute workflow
c4c exec user-onboarding --input "{\"userId\":\"$userId\"}" --json
```

## Package.json Scripts

Common scripts to add:

```json
{
  "scripts": {
    "dev": "c4c dev",
    "serve": "c4c serve",
    "generate:client": "c4c generate client --out ./src/client.ts",
    "generate:openapi": "c4c generate openapi --out ./openapi.json",
    "list": "c4c list",
    "exec": "c4c exec"
  }
}
```

Usage:

```bash
pnpm dev
pnpm generate:client
pnpm list
pnpm exec createUser -- --input '{"name":"Alice"}'
```

## Next Steps

- [Explore HTTP API](/guide/http-api)
- [Generate Clients](/guide/client-generation)
- [Set up Integrations](/guide/integrations)
- [View Examples](/examples/basic)
