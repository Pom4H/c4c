# Integrations Example

This package demonstrates how to turn OpenAPI-generated clients into tsdev contracts and procedures.

## Generating Contracts & Procedures

The `generate` script scans `examples/integrations/generated/**` and emits procedure files into `examples/integrations/src/**`.

```bash
pnpm --filter integrations generate
```

Each generated file:
- creates `Contract` objects backed by the auto-generated Zod schemas,
- wraps the SDK call in a tsdev `Procedure`,
- applies the `withOAuth` policy so tokens are injected automatically.

## Supplying OAuth Tokens

`withOAuth` resolves tokens in the following order:
1. `context.metadata[<provider>Token]`
2. the optional `tokenProvider` you pass to the policy
3. environment variable (e.g. `GOOGLE_OAUTH`)

Set the right env var before executing a procedure or attach the token to the execution context metadata when driving procedures from workflows.

## Running the Runtime

The runtime script loads `.env` automatically, discovers all generated procedures via `src/handlers/generated.ts`, and exposes them through the HTTP adapter.

```bash
pnpm --filter integrations dev
```

By default the server listens on `http://localhost:3100`. Override `PORT` or set provider tokens (e.g. `GOOGLE_OAUTH`, `AVITO__OAUTH`) in `.env` or the shell before starting.
