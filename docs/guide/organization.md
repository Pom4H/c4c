# Project Organization

c4c is completely flexible - organize your code any way that makes sense for your project.

## Zero Configuration

c4c discovers procedures and workflows automatically. No configuration files needed!

## Common Structures

### Flat Structure

Simple projects can use a flat structure:

```
src/
├── procedures.ts
└── workflows.ts
```

**Good for:**
- Small projects
- Rapid prototyping
- Simple APIs

### Modular Structure

Organize by feature/domain:

```
src/
├── modules/
│   ├── users/
│   │   ├── procedures.ts
│   │   └── workflows.ts
│   ├── products/
│   │   └── procedures.ts
│   └── analytics/
│       └── procedures.ts
```

**Good for:**
- Medium to large projects
- Clear separation of concerns
- Team collaboration

### Domain-Driven Design

Organize by domain:

```
domains/
├── billing/
│   ├── commands/
│   ├── queries/
│   └── events/
├── auth/
│   └── flows/
└── notifications/
    └── handlers/
```

**Good for:**
- Complex business domains
- Event-driven systems
- Microservices architecture

### Monorepo

Multiple packages in one repository:

```
packages/
├── core/
│   └── procedures/
├── api/
│   └── procedures/
└── integrations/
    ├── stripe/
    └── sendgrid/
```

**Good for:**
- Multiple applications
- Shared code
- Independent deployments

## File Organization

### Single File

All procedures in one file:

```typescript
// procedures.ts
export const createUser: Procedure = { ... };
export const getUser: Procedure = { ... };
export const updateUser: Procedure = { ... };
export const deleteUser: Procedure = { ... };
```

### Multiple Files

Split by resource:

```typescript
// procedures/users.ts
export const createUser: Procedure = { ... };
export const getUser: Procedure = { ... };

// procedures/products.ts
export const createProduct: Procedure = { ... };
export const getProduct: Procedure = { ... };
```

### Grouped by Type

Separate commands, queries, events:

```
procedures/
├── commands/
│   ├── createUser.ts
│   └── updateUser.ts
├── queries/
│   ├── getUser.ts
│   └── listUsers.ts
└── events/
    └── userCreated.ts
```

## Naming Conventions

### Explicit Naming

Use namespaced names for clarity:

```typescript
export const create: Procedure = {
  contract: {
    name: "users.create",
    ...
  },
  ...
};

export const get: Procedure = {
  contract: {
    name: "users.get",
    ...
  },
  ...
};
```

### Auto-Naming

Let export names become procedure names:

```typescript
// Auto-named as "createUser"
export const createUser: Procedure = { ... };

// Auto-named as "getUser"
export const getUser: Procedure = { ... };
```

## Shared Code

### Shared Schemas

```typescript
// shared/schemas.ts
export const userSchema = z.object({ ... });

// procedures/users.ts
import { userSchema } from "../shared/schemas";
```

### Shared Types

```typescript
// shared/types.ts
export interface User { ... }

// procedures/users.ts
import type { User } from "../shared/types";
```

### Shared Utilities

```typescript
// shared/utils.ts
export function generateId() { ... }

// procedures/users.ts
import { generateId } from "../shared/utils";
```

## Example Structures

### Small API

```
my-api/
├── src/
│   ├── procedures.ts
│   └── workflows.ts
├── package.json
└── tsconfig.json
```

### Medium Project

```
my-project/
├── src/
│   ├── modules/
│   │   ├── users/
│   │   ├── products/
│   │   └── orders/
│   ├── shared/
│   │   ├── schemas.ts
│   │   └── utils.ts
│   └── workflows/
├── package.json
└── tsconfig.json
```

### Large Monorepo

```
my-monorepo/
├── packages/
│   ├── core/
│   │   ├── src/procedures/
│   │   └── package.json
│   ├── api/
│   │   ├── src/procedures/
│   │   └── package.json
│   └── shared/
│       └── package.json
├── pnpm-workspace.yaml
└── package.json
```

## Best Practices

1. **Start simple** - Begin with flat structure, refactor as needed
2. **Be consistent** - Choose one structure and stick to it
3. **Group related code** - Keep related procedures together
4. **Share common code** - Don't duplicate schemas and types
5. **Document structure** - Add README files to explain organization

## Migration

### From Flat to Modular

```bash
# Before
src/procedures.ts

# After
mkdir -p src/modules/users src/modules/products
mv procedures.ts src/modules/users/procedures.ts
# Split into modules
```

### From Modular to DDD

```bash
# Before
src/modules/users/

# After
mkdir -p domains/user-management/commands
mv src/modules/users/ domains/user-management/commands/
```

## Next Steps

- [Learn about the Registry](/guide/registry)
- [Understand Auto-Naming](/guide/auto-naming)
- [View Examples](/examples/modules)
