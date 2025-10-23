# Auto-Naming

Auto-naming allows you to omit explicit procedure names, using export names instead.

## Overview

With auto-naming, the export name becomes the procedure name:

```typescript
// Auto-named as "createUser"
export const createUser: Procedure = {
  contract: {
    // No name field needed
    input: z.object({ ... }),
    output: z.object({ ... }),
  },
  handler: async (input) => { ... }
};
```

## Benefits

### 1. IDE Refactoring Support

Auto-naming enables full IDE refactoring. Press F2 to rename:

```typescript
// Before
export const createUser: Procedure = { ... };

// After F2 rename to "addUser"
export const addUser: Procedure = { ... };
```

The procedure name automatically updates everywhere!

### 2. Less Boilerplate

No need to specify names twice:

```typescript
// With explicit naming
export const createUser: Procedure = {
  contract: {
    name: "createUser",  // Duplicate!
    ...
  },
  ...
};

// With auto-naming
export const createUser: Procedure = {
  contract: {
    // No duplication
    ...
  },
  ...
};
```

### 3. Single Source of Truth

The export name is the single source of truth for the procedure name.

## When to Use Auto-Naming

**Good for:**
- Internal procedures
- Rapid development
- Projects with frequent refactoring
- Teams using TypeScript exclusively

**Not ideal for:**
- Public APIs with versioning
- Procedures called from external systems
- When you need namespacing (use `users.create` instead)

## Explicit Naming

For public APIs, use explicit names:

```typescript
export const create: Procedure = {
  contract: {
    name: "users.create",  // Explicit, stable name
    ...
  },
  ...
};
```

## Best Practices

1. **Be consistent** - Choose one style per module
2. **Document your choice** - Make it clear to your team
3. **Use explicit names for public APIs** - More stable
4. **Use auto-naming for internal procedures** - More flexible

## Next Steps

- [Learn about Procedures](/guide/procedures)
- [Explore Type Safety](/guide/type-safety)
- [View Examples](/examples/basic)
