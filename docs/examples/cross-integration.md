# Cross-Integration Example

Example demonstrating integration between multiple c4c applications.

## Overview

This example shows:
- Running multiple c4c apps
- Integrating apps with each other
- Cross-app procedure calls
- Distributed workflows

## Structure

```
examples/cross-integration/
├── app-a/
│   ├── procedures/
│   └── workflows/
├── app-b/
│   ├── procedures/
│   └── workflows/
├── scripts/
│   ├── start-apps.sh
│   ├── integrate-apps.sh
│   └── test-integration.sh
└── README.md
```

## Running the Example

```bash
cd examples/cross-integration

# Start both apps
./scripts/start-apps.sh

# Integrate apps
./scripts/integrate-apps.sh

# Test integration
./scripts/test-integration.sh
```

## Cross-App Calls

App A can call procedures from App B:

```typescript
// In App A
const result = await engine.run("app-b.tasks.create", {
  title: "New task"
});
```

## Next Steps

- [View Basic Example](/examples/basic)
- [Learn about Integrations](/guide/integrations)
