# C4C CLI Tests

This package contains tests for all c4c CLI commands using Vitest.

## Structure

The test directory structure mirrors the CLI command hierarchy:

```
tests/
├── serve/           # Tests for 'c4c serve' command
│   ├── all.test.ts      # Tests for 'serve all' mode
│   ├── rest.test.ts     # Tests for 'serve rest' mode
│   ├── workflow.test.ts # Tests for 'serve workflow' mode
│   ├── rpc.test.ts      # Tests for 'serve rpc' mode
│   └── ui.test.ts       # Tests for 'serve ui' mode
├── generate/        # Tests for 'c4c generate' command
│   └── client.test.ts   # Tests for 'generate client' command
└── helpers/         # Test utilities and helpers
    └── test-utils.ts
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm vitest run serve/all.test.ts

# Run tests for a specific command
pnpm vitest run serve/
pnpm vitest run generate/
```

## Test Utilities

The `helpers/test-utils.ts` file provides utility functions for testing:

- `createTempDir()` - Creates a temporary directory for testing
- `removeTempDir()` - Cleans up temporary directories
- `createMockHandlers()` - Creates mock handlers directory with sample files
- `createMockWorkflows()` - Creates mock workflows directory with sample files
- `waitFor()` - Waits for a condition to be true with timeout
- `withEnv()` - Temporarily sets environment variables
- `isPortAvailable()` - Checks if a port is available
- `findAvailablePort()` - Finds an available port

## Writing Tests

When writing new tests:

1. Follow the existing directory structure that mirrors CLI commands
2. Use the test utilities from `helpers/test-utils.ts`
3. Clean up resources (temp dirs, servers) in `afterEach` hooks
4. Use descriptive test names that explain what is being tested
5. Test both success and error cases

## CLI Commands Tested

### serve command
- `c4c serve all` - Starts server with all features enabled
- `c4c serve rest` - Starts server in REST API mode
- `c4c serve workflow` - Starts server in workflow mode
- `c4c serve rpc` - Starts server in RPC mode
- `c4c serve ui` - Starts workflow UI

### generate command
- `c4c generate client` - Generates typed client from contracts

## Coverage

To view test coverage, run:

```bash
pnpm test:coverage
```

Coverage reports will be generated in the `coverage/` directory.
