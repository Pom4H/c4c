# c4c Documentation

This directory contains the VitePress documentation for c4c.

## Structure

```
docs/
├── .vitepress/
│   └── config.ts          # VitePress configuration
├── guide/                 # User guides
│   ├── introduction.md
│   ├── quick-start.md
│   ├── installation.md
│   ├── procedures.md
│   ├── workflows.md
│   └── ...
├── packages/              # Package documentation
│   ├── overview.md
│   ├── core.md
│   ├── workflow.md
│   └── ...
├── examples/              # Example documentation
│   ├── basic.md
│   ├── modules.md
│   └── ...
└── index.md               # Home page
```

## Development

```bash
# Start dev server
pnpm docs:dev

# Build documentation
pnpm docs:build

# Preview build
pnpm docs:preview
```

## Adding Pages

1. Create a new `.md` file in the appropriate directory
2. Add it to the sidebar in `.vitepress/config.ts`
3. Link to it from other pages

## Deployment

The documentation can be deployed to any static hosting service:

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

Build the docs with `pnpm docs:build` and deploy the `docs/.vitepress/dist` directory.
