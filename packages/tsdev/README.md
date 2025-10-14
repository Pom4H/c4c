# tsdev

Contracts-first framework for transport-agnostic applications.

## Philosophy

> **Write once — describe forever.**

By defining system behavior through contracts, we transform code into a self-documenting, self-generating application model.

## Installation

```bash
pnpm add tsdev
```

## Quick Start

See [examples/tsdev-example](../../examples/tsdev-example) for complete usage examples.

## Package Structure

```
tsdev/
├── core/           # Core framework (types, registry, executor, workflow)
├── policies/       # Composable policies (retry, logging, tracing)
├── adapters/       # Transport adapters (HTTP, CLI)
└── generators/     # Code generators (OpenAPI)
```

## Exports

| Import | Module |
|--------|--------|
| `tsdev` | Main entry point |
| `tsdev/core` | Core types and registry |
| `tsdev/core/workflow` | Workflow runtime with OpenTelemetry |
| `tsdev/policies` | Composable policies |

## Key Principles

1. **Contracts-first** - Contracts are the source of truth
2. **Transport-agnostic** - One handler, multiple adapters
3. **Self-describing** - Automatic introspection for SDKs and agents
4. **Telemetry by default** - Every call is observable
5. **Composable** - Behavior extends via functions, not framework
6. **Convention-driven** - Structure → introspection → automation

## Related Packages

- [`tsdev-react`](../tsdev-react) - React hooks for workflow execution

## Documentation

- [PHILOSOPHY.md](../../PHILOSOPHY.md) - Framework philosophy
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - Technical architecture

## License

MIT
