# Integrations

Integrate external APIs and other c4c applications.

## Integrate External API

```bash
c4c integrate https://api.example.com/openapi.json --name my-api
```

This generates:
- TypeScript SDK from OpenAPI spec
- Typed procedures for all endpoints
- Authentication configuration

## Using Integrated API

```typescript
// Generated procedures are available
const result = await engine.run("my-api.users.list", {
  limit: 10
});
```

## Integrate c4c Apps

```bash
c4c integrate http://localhost:3001/openapi.json --name other-app
```

Call procedures from another c4c app:

```typescript
const result = await engine.run("other-app.tasks.create", {
  title: "New task"
});
```

## Webhooks

Webhooks are automatically enabled when you start the server:

```bash
c4c serve
# Webhook endpoints available at /webhooks/{provider}
```

## Next Steps

- [Learn about CLI](/guide/cli)
- [View Integration Examples](/examples/integrations)
- [Explore Triggers](/guide/triggers)
