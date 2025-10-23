# @c4c/cli

Command-line interface for c4c development and operations.

## Installation

```bash
pnpm add -D @c4c/cli
```

Or globally:

```bash
pnpm add -g @c4c/cli
```

## Overview

`@c4c/cli` provides:

- Development server with hot reload
- Production server
- Procedure execution
- Code generation (OpenAPI, TypeScript clients)
- Integration tools

## Commands

### Development

```bash
c4c dev              # Start dev server with hot reload
```

### Production

```bash
c4c serve            # Start production server
```

### Execution

```bash
c4c exec <name>      # Execute procedure or workflow
```

### Generation

```bash
c4c generate openapi # Generate OpenAPI spec
c4c generate client  # Generate TypeScript client
```

### Integration

```bash
c4c integrate <url>  # Integrate external API
```

### Utilities

```bash
c4c list             # List procedures and workflows
```

## Next Steps

- [Learn about CLI Commands](/guide/cli)
- [View Quick Start](/guide/quick-start)
- [Explore Examples](/examples/basic)
