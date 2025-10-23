# @c4c/workflow

Workflow orchestration engine with fluent builder API and OpenTelemetry tracing.

## Installation

```bash
pnpm add @c4c/workflow
```

## Overview

`@c4c/workflow` provides:

- Fluent builder API for defining workflows
- Sequential and parallel execution
- Conditional branching
- Context sharing between steps
- OpenTelemetry tracing

## Quick Example

```typescript
import { workflow, step } from "@c4c/workflow";

export default workflow("my-workflow")
  .name("My Workflow")
  .version("1.0.0")
  .step(step({
    id: "step1",
    execute: ({ engine }) => engine.run("myProcedure"),
  }))
  .commit();
```

## API Reference

See the [Workflows Guide](/guide/workflows) for complete documentation.

## Next Steps

- [Learn about Workflows](/guide/workflows)
- [View Examples](/examples/basic)
