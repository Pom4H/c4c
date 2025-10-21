# Modules Example

This example demonstrates how to organize procedures into modular components and generate a typed TypeScript client to interact with the API.

## 🎯 What This Demonstrates

- **Modular Architecture**: Separation of concerns with dedicated modules for different domains
- **Business Logic Separation**: Database, validation, and procedure logic in separate files
- **Cross-Module Operations**: Analytics procedures that aggregate data from multiple modules
- **Type-Safe Client Generation**: Using c4c CLI to automatically generate a fully-typed TypeScript client
- **c4c CLI Usage**: Development server, client generation, and OpenAPI spec generation
- **End-to-End Testing**: Complete test suite using the generated client

## 📁 Project Structure

```
examples/modules/
├── procedures/
│   ├── users/
│   │   ├── database.ts        # User data storage
│   │   ├── validators.ts      # User validation logic
│   │   └── procedures.ts      # User procedures (CRUD)
│   ├── products/
│   │   ├── database.ts        # Product data storage
│   │   └── procedures.ts      # Product procedures (CRUD)
│   └── analytics/
│       └── procedures.ts      # Cross-module analytics
├── scripts/
│   └── test-client.ts         # Test suite
├── generated/
│   └── client.ts              # Auto-generated typed client
└── package.json
```

## 🚀 Quick Start

### 1. Install Dependencies

From the repository root:

```bash
pnpm install
```

### 2. Start the Server

Using the c4c CLI:

```bash
cd examples/modules
pnpm dev
# or directly: c4c serve --root .
```

The server will start on `http://localhost:3000` with the following endpoints:

- `GET /procedures` - List all available procedures
- `GET /docs` - Interactive Swagger documentation
- `GET /openapi.json` - OpenAPI specification
- `POST /rpc/:procedureName` - Call any procedure via RPC

### 3. Generate the Client

In a new terminal, use the c4c CLI to generate a typed client:

```bash
cd examples/modules
pnpm generate:client
# or directly: c4c generate client --root . --out ./generated/client.ts
```

This will create a fully-typed TypeScript client at `generated/client.ts`.

### 4. Test the API

```bash
pnpm test:client
```

This will run a comprehensive test suite that:
- Creates users with different roles
- Lists and filters users
- Creates and manages products
- Updates inventory
- Retrieves analytics
- Performs health checks

## 📚 Available Procedures

### Users Module

- `users.create` - Create a new user
- `users.get` - Get user by ID
- `users.list` - List all users
- `users.update` - Update user information
- `users.delete` - Delete a user

### Products Module

- `products.list` - List products with optional filters (category, price range)
- `products.get` - Get product by ID
- `products.create` - Create a new product
- `products.updateStock` - Update product stock quantity

### Analytics Module

- `analytics.stats` - Get system-wide statistics (users, products, inventory value)
- `analytics.health` - System health check

## 💡 Key Concepts Demonstrated

### 1. Modular Organization

Each domain (users, products, analytics) is organized in its own directory with:
- **Database layer**: Simulated data storage
- **Validators**: Business rules and data validation
- **Procedures**: API contracts and handlers

All procedures are automatically discovered by the c4c CLI from the `procedures/` directory.

### 2. Type Safety

The generated client provides:
- Full TypeScript type inference
- Compile-time validation
- Auto-complete in IDE
- Type-safe procedure calls

Example:

```typescript
import { createc4cClient } from "./generated/client";

const client = createc4cClient({
  baseUrl: "http://localhost:3000"
});

// Fully typed - IDE will provide autocomplete and type checking
const user = await client.procedures["users.create"]({
  name: "John Doe",
  email: "john@example.com",
  role: "admin"  // Type-checked against valid roles
});

// user.id is typed as string
console.log(user.id);
```

### 3. Cross-Module Operations

The analytics module demonstrates how to combine data from multiple modules:

```typescript
// Analytics procedure accesses both user and product databases
import { userDatabase } from "../users/database.js";
import { productDatabase } from "../products/database.js";

export const getSystemStats: Procedure = {
  handler: async () => {
    const users = await userDatabase.list();
    const products = await productDatabase.list();
    
    // Aggregate data from multiple sources
    return {
      users: { total: users.length, ... },
      products: { total: products.length, ... }
    };
  }
};
```

### 4. Validation and Business Logic

Separation of validation logic from procedures:

```typescript
// validators.ts
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// procedures.ts
export const createUser: Procedure = {
  handler: async ({ email, ...data }) => {
    if (!validateEmail(email)) {
      throw new Error("Invalid email format");
    }
    // ... rest of the logic
  }
};
```

## 🔧 c4c CLI Commands

### Development Server

```bash
# Start the server with all procedures (using npm script)
pnpm dev

# Or directly with c4c CLI:
# c4c serve --root .
```

The c4c CLI automatically:
- Discovers all procedures from the `procedures/` directory
- Starts HTTP server with RPC, REST, and Workflow endpoints
- Provides interactive Swagger documentation
- Enables OpenAPI spec generation

### Client Generation

```bash
# Generate a typed TypeScript client (using npm script)
pnpm generate:client

# Or directly with c4c CLI:
# c4c generate client --root . --out ./generated/client.ts
```

### Other CLI Commands

```bash
# Generate OpenAPI specification
c4c generate openapi --root . --out ./openapi.json

# Start only workflow transport
c4c serve workflow --root . --port 4000

# Run in development mode (alternative)
c4c dev --root .
```

## 🔧 Using the Generated Client

### Basic Usage

```typescript
import { createc4cClient } from "./generated/client";

const client = createc4cClient({
  baseUrl: "http://localhost:3000"
});

// Create a user
const user = await client.procedures["users.create"]({
  name: "Alice",
  email: "alice@example.com",
  role: "admin"
});

// List products in a category
const products = await client.procedures["products.list"]({
  category: "electronics",
  minPrice: 50,
  maxPrice: 500
});

// Get analytics
const stats = await client.procedures["analytics.stats"]({});
console.log("Total users:", stats.users.total);
console.log("Inventory value:", stats.products.totalValue);
```

### Error Handling

```typescript
try {
  const user = await client.procedures["users.get"]({
    id: "nonexistent-id"
  });
} catch (error) {
  console.error("Failed to fetch user:", error.message);
}
```

### Custom Fetch Options

```typescript
const client = createc4cClient({
  baseUrl: "http://localhost:3000",
  headers: {
    "X-Custom-Header": "value"
  },
  // Use custom fetch implementation
  fetch: customFetch
});
```

## 🧪 Testing

The example includes a comprehensive test suite in `scripts/test-client.ts` that demonstrates:

1. **User Management**: Create, read, update, delete operations
2. **Product Management**: Inventory operations and filtering
3. **Cross-Module Operations**: Analytics and health checks
4. **Error Handling**: Validation and not-found scenarios

Run the tests:

```bash
# Make sure the server is running first
pnpm dev

# In another terminal
pnpm test:client
```

## 📖 Learning Path

1. **Start with the procedures**: Explore `procedures/users/procedures.ts` to see how procedures are defined
2. **Check the modules**: Look at `database.ts` and `validators.ts` to see separation of concerns
3. **Run the server**: Use `c4c serve --root .` and explore the Swagger docs at http://localhost:3000/docs
4. **Generate the client**: Use `c4c generate client --root . --out ./generated/client.ts` and examine the output
5. **Test it out**: Run the test suite and modify it to try different scenarios

## 🌟 Best Practices Demonstrated

- ✅ **Modular architecture** - Each domain in its own directory
- ✅ **Separation of concerns** - Database, validation, and procedures separated
- ✅ **Type safety** - Full TypeScript types throughout
- ✅ **Error handling** - Proper validation and error messages
- ✅ **Documentation** - Clear contracts with descriptions
- ✅ **Testing** - Comprehensive test coverage
- ✅ **Code generation** - Automated client generation for type safety

## 🔗 Related Examples

- `examples/basic` - Simple getting started example
- `examples/integrations` - Third-party API integrations
- `packages/generators` - Client generation source code

## 📝 Next Steps

Try these exercises to deepen your understanding:

1. Add a new module (e.g., `orders`) that uses both `users` and `products`
2. Add authentication using `@c4c/policies`
3. Add input validation using Zod refinements
4. Create a workflow that orchestrates multiple procedures
5. Add rate limiting or retry policies to procedures
6. Implement pagination for list operations

## 🤝 Contributing

Feel free to extend this example with additional features and submit a PR!
