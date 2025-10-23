# HTTP API

c4c automatically exposes procedures via HTTP endpoints.

## Start Server

```bash
# Development server
c4c dev

# Production server
c4c serve
```

Server starts on `http://localhost:3000` by default.

## RPC Endpoints

Execute procedures via RPC:

```bash
POST /rpc/{procedureName}
Content-Type: application/json

{
  "input": "data"
}
```

Example:

```bash
curl -X POST http://localhost:3000/rpc/users.create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice",
    "email": "alice@example.com"
  }'
```

Response:

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Alice",
  "email": "alice@example.com"
}
```

## Introspection

### List Procedures

```bash
GET /procedures
```

Returns:

```json
{
  "procedures": [
    {
      "name": "users.create",
      "description": "Create a new user",
      "exposure": "external",
      "roles": ["api-endpoint"]
    }
  ]
}
```

### OpenAPI Specification

```bash
GET /openapi.json
```

Returns OpenAPI 3.0 specification.

## Error Handling

Errors are returned with appropriate status codes:

```bash
# 400 - Validation Error
{
  "error": "Validation failed",
  "details": [
    {
      "path": ["email"],
      "message": "Invalid email"
    }
  ]
}

# 404 - Procedure Not Found
{
  "error": "Procedure not found: unknown.procedure"
}

# 500 - Internal Error
{
  "error": "Internal server error",
  "message": "Database connection failed"
}
```

## Configuration

Configure server via environment variables:

```bash
# Port
C4C_PORT=8080

# Host
C4C_HOST=0.0.0.0

# Root directory
C4C_ROOT=./src/procedures
```

Or via CLI options:

```bash
c4c serve --port 8080 --host 0.0.0.0
```

## CORS

CORS is enabled by default for development:

```javascript
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Authentication

Add authentication headers:

```bash
curl -X POST http://localhost:3000/rpc/users.delete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"id": "123"}'
```

See [Authentication Guide](/guide/authentication) for details.

## Next Steps

- [Learn about CLI Commands](/guide/cli)
- [Set up Authentication](/guide/authentication)
- [Generate Clients](/guide/client-generation)
