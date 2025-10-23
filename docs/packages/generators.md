# @c4c/generators

OpenAPI spec and TypeScript client generation.

## Installation

```bash
pnpm add @c4c/generators
```

## Overview

`@c4c/generators` provides:

- OpenAPI 3.0 generation from Zod schemas
- Type-safe TypeScript client generation
- Auth-aware clients
- Dynamic token support
- Zero runtime dependencies

## Generate OpenAPI

```bash
c4c generate openapi --out ./openapi.json
```

Or programmatically:

```typescript
import { generateOpenAPIJSON } from "@c4c/generators";
import { collectRegistry } from "@c4c/core";

const registry = await collectRegistry("./src");
const spec = generateOpenAPIJSON(registry, {
  title: "My API",
  version: "1.0.0"
});
```

## Generate Client

```bash
c4c generate client --out ./client.ts
```

Or programmatically:

```typescript
import { generateRpcClientModule } from "@c4c/generators";

const clientCode = generateRpcClientModule(registry, {
  baseUrl: "http://localhost:3000"
});
```

## Next Steps

- [Learn about Client Generation](/guide/client-generation)
- [View API Documentation](/guide/http-api)
- [See Examples](/examples/basic)
