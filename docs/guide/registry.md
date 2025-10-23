# Registry

The registry is the heart of c4c's introspection system, automatically discovering procedures and workflows.

## What is the Registry?

The registry is a data structure that maps procedure names to their implementations:

```typescript
interface Registry {
  [procedureName: string]: Procedure;
}
```

## Automatic Discovery

c4c automatically discovers procedures by scanning your codebase:

```typescript
import { collectRegistry } from "@c4c/core";

const registry = await collectRegistry("./src/procedures");
```

### How It Works

1. **Scans files** - Recursively scans directories
2. **Loads modules** - Imports TypeScript/JavaScript files
3. **Detects procedures** - Finds exported objects with `contract` and `handler`
4. **Indexes by name** - Maps procedure names to implementations

## Manual Registry

You can also create registries manually:

```typescript
import type { Registry } from "@c4c/core";

const registry: Registry = {
  "users.create": {
    contract: { ... },
    handler: async (input) => { ... },
  },
  "users.get": {
    contract: { ... },
    handler: async (input) => { ... },
  },
};
```

## Registry Operations

### List Procedures

```typescript
import { listProcedures } from "@c4c/core";

const names = listProcedures(registry);
// ["users.create", "users.get", ...]
```

### Get Procedure

```typescript
import { getProcedure } from "@c4c/core";

const procedure = getProcedure(registry, "users.create");
if (procedure) {
  // Use procedure
}
```

### Describe Registry

```typescript
import { describeRegistry } from "@c4c/core";

const stats = describeRegistry(registry);
console.log(`Total procedures: ${stats.count}`);
console.log(`External: ${stats.external}`);
console.log(`Internal: ${stats.internal}`);
```

## Filtering

Filter procedures by metadata:

```typescript
import { collectRegistry } from "@c4c/core";

const registry = await collectRegistry("./src", {
  filter: (procedure) => {
    const metadata = getContractMetadata(procedure.contract);
    return metadata.exposure === "external";
  }
});
```

## Zero Configuration

The registry requires no configuration:

```
✅ Works with any structure
src/procedures.ts
src/procedures/users.ts
src/modules/users/procedures.ts
domains/auth/commands/

✅ Discovers all exports
export const myProc: Procedure = { ... };
export default { contract: ..., handler: ... };

✅ Handles TypeScript and JavaScript
procedures.ts
procedures.js
```

## Best Practices

1. **Let the registry discover** - Don't manually maintain lists
2. **Organize logically** - Structure makes sense for your project
3. **Use metadata** - Tag procedures for filtering
4. **Cache in production** - Generate registry once, reuse

## Next Steps

- [Learn about Procedures](/guide/procedures)
- [Understand Auto-Naming](/guide/auto-naming)
- [Explore Organization Patterns](/guide/organization)
