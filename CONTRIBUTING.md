# Contributing to c4c

Thank you for your interest in contributing to c4c!

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/c4c/c4c.git
   cd c4c
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Build packages:**
   ```bash
   pnpm build
   ```

## Documentation

### Local Development

Start the documentation dev server:

```bash
pnpm docs:dev
```

Visit `http://localhost:5173` to see the docs.

### Building

Build the documentation:

```bash
pnpm docs:build
```

Preview the built documentation:

```bash
pnpm docs:preview
```

### Adding Documentation

1. **Create a new page:**
   - Add a `.md` file in the appropriate directory:
     - `docs/guide/` - User guides
     - `docs/packages/` - Package documentation
     - `docs/examples/` - Examples

2. **Update navigation:**
   - Edit `docs/.vitepress/config.ts`
   - Add your page to the sidebar configuration

3. **Test locally:**
   ```bash
   pnpm docs:dev
   ```

4. **Build and verify:**
   ```bash
   pnpm docs:build
   ```

### Documentation Guidelines

- Use clear, concise language
- Include code examples
- Add links to related pages
- Test all code examples
- Use proper markdown formatting

## Submitting Changes

1. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make your changes**

3. **Test locally:**
   ```bash
   pnpm build
   pnpm docs:build
   ```

4. **Commit:**
   ```bash
   git add .
   git commit -m "feat: description of changes"
   ```

5. **Push:**
   ```bash
   git push origin feature/your-feature
   ```

6. **Create Pull Request:**
   - Go to GitHub
   - Create a pull request from your branch
   - Describe your changes

## Questions?

Open an issue on GitHub if you have questions!
