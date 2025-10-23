# Integrations Example

Example demonstrating integration with external APIs.

## Overview

This example shows:
- Integrating Google Calendar API
- Integrating Avito API
- Using generated SDKs
- Calling external procedures

## Location

```
examples/integrations/
├── generated/
│   ├── google/      # Generated Google Calendar SDK
│   └── avito/       # Generated Avito SDK
├── procedures/      # Custom procedures using integrations
├── scripts/         # Generation scripts
└── package.json
```

## Integrating APIs

```bash
# Integrate Google Calendar
c4c integrate \
  https://api.apis.guru/v2/specs/googleapis.com/calendar/v3/openapi.json \
  --name google-calendar

# Integrate Avito
c4c integrate \
  https://api.avito.ru/openapi.json \
  --name avito
```

## Using Integrated Procedures

```typescript
// Call Google Calendar API
const event = await engine.run("google-calendar.events.insert", {
  calendarId: "primary",
  summary: "Meeting",
  start: { dateTime: "2024-01-01T10:00:00Z" }
});

// Call Avito API
const items = await engine.run("avito.items.list", {
  limit: 10
});
```

## Next Steps

- [View Cross-Integration Example](/examples/cross-integration)
- [Learn about Integrations](/guide/integrations)
