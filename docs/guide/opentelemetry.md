# OpenTelemetry

c4c provides automatic distributed tracing with OpenTelemetry.

## Overview

Every procedure and workflow execution creates detailed traces:

- Span hierarchy
- Timing information
- Input/output data
- Error details
- Custom attributes

## Automatic Tracing

Tracing is automatic - no configuration needed:

```typescript
export const createUser: Procedure = {
  contract: { ... },
  handler: async (input) => {
    // Automatically traced
    return { ... };
  },
};
```

## Viewing Traces

Export traces to your favorite backend:

- Jaeger
- Honeycomb
- Datadog
- New Relic
- Zipkin

## Manual Spans

Add custom spans with policies:

```typescript
import { applyPolicies } from "@c4c/core";
import { withSpan } from "@c4c/policies";

export const myProcedure: Procedure = {
  contract: { ... },
  handler: applyPolicies(
    async (input) => { ... },
    withSpan("myProcedure")
  ),
};
```

## Configuration

Configure OpenTelemetry via environment variables:

```bash
# Enable tracing
OTEL_ENABLED=true

# Exporter endpoint
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Service name
OTEL_SERVICE_NAME=my-c4c-app
```

## Next Steps

- [Learn about Policies](/guide/policies)
- [Explore Workflows](/guide/workflows)
