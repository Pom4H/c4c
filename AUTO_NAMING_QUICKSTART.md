# Auto-Naming Quick Start

## 🎯 TL;DR

`contract.name` теперь **опциональное**! Если не указано → используется **имя экспорта**.

## Before & After

### ❌ Before (hardcoded name)

```typescript
export const createUser: Procedure = {
  contract: {
    name: "users.create",  // ❌ IDE won't update on F2 rename
    input: z.object(...),
    output: z.object(...),
  },
  handler: ...
};
```

**Проблемы:**
- IDE refactoring не работает
- Дублирование имени
- Легко забыть обновить

### ✅ After (auto-naming)

```typescript
export const createUser: Procedure = {
  contract: {
    // name не указан → автоматически "createUser"
    input: z.object(...),
    output: z.object(...),
  },
  handler: ...
};
```

**Преимущества:**
- ✅ IDE refactoring работает (F2 rename)
- ✅ Меньше boilerplate
- ✅ Single source of truth

---

## Quick Examples

### 1. Simple procedure (auto-naming)

```typescript
export const greet: Procedure = {
  contract: {
    input: z.object({ name: z.string() }),
    output: z.object({ message: z.string() }),
  },
  handler: async ({ name }) => ({ 
    message: `Hello, ${name}!` 
  }),
};

// Usage: c4c exec greet --input '{"name":"Alice"}'
```

### 2. Namespaced procedure (explicit naming)

```typescript
export const create: Procedure = {
  contract: {
    name: "users.create",  // ← Explicit for public API
    input: z.object({
      name: z.string(),
      email: z.string().email(),
    }),
    output: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    }),
  },
  handler: async (input) => ({
    id: generateId(),
    ...input,
  }),
};

// Usage: c4c exec users.create --input '{"name":"Alice","email":"alice@example.com"}'
```

---

## When to use what?

| Use Case | Recommendation |
|----------|---------------|
| 🚀 Rapid development | **Auto-naming** |
| 🔒 Public API | **Explicit naming** |
| 🧪 Testing/helpers | **Auto-naming** |
| 📦 Versioned API | **Explicit naming** (`api.v2.users.create`) |
| 🏗️ Internal procedures | **Auto-naming** |
| 🌐 REST endpoints | **Explicit naming** (for mapping) |

---

## Migration

### No breaking changes! 🎉

```typescript
// ✅ Old code still works
export const createUser: Procedure = {
  contract: {
    name: "users.create",  // Explicit name
    input: ...,
    output: ...,
  },
  handler: ...
};

// ✅ New code can use auto-naming
export const deleteUser: Procedure = {
  contract: {
    // Auto-naming: "deleteUser"
    input: ...,
    output: ...,
  },
  handler: ...
};
```

---

## API Generators

### Client Generator

```bash
c4c generate client --out ./client.ts
```

**Works with both:**
```typescript
// Auto-named procedure
await client.procedures.createUser({ name: "Alice" });

// Explicitly named procedure  
await client.procedures["users.create"]({ name: "Alice" });
```

### OpenAPI Generator

```bash
c4c generate openapi --out ./openapi.json
```

**Both styles included:**
```json
{
  "paths": {
    "/rpc/createUser": { ... },      // Auto-named
    "/rpc/users.create": { ... }     // Explicit
  }
}
```

---

## Best Practices

### ✅ Do

```typescript
// Clear, descriptive names
export const createUser: Procedure = { ... };
export const validateEmail: Procedure = { ... };
export const calculateDiscount: Procedure = { ... };

// Grouped by domain
export const usersCreate: Procedure = { ... };
export const usersGet: Procedure = { ... };
export const usersUpdate: Procedure = { ... };
```

### ❌ Don't

```typescript
// Unclear abbreviations
export const crUsr: Procedure = { ... };

// Verbose names
export const handleUserCreationRequest: Procedure = { ... };

// Generic names
export const handler: Procedure = { ... };
export const process: Procedure = { ... };
```

---

## Examples

Проверьте примеры:
- `examples/basic/procedures/auto-naming-demo.ts` - auto-naming примеры
- `examples/basic/procedures/explicit-naming-demo.ts` - explicit naming примеры

---

## Full Documentation

📖 **Подробная документация:** [AUTO_NAMING.md](./AUTO_NAMING.md)

---

## Summary

**Golden Rule:** Start with auto-naming, add explicit names when needed.

✅ **Auto-naming for:**
- Internal procedures
- Rapid development
- Testing helpers
- Simple use cases

✅ **Explicit naming for:**
- Public APIs
- Versioned endpoints
- REST mapping
- Documentation clarity

**Try it now!**
```typescript
export const myProcedure: Procedure = {
  contract: {
    // Just remove the name field!
    input: z.object(...),
    output: z.object(...),
  },
  handler: ...
};
```
