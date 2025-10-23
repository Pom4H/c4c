# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the c4c project.

## Available Workflows

### Deploy Documentation (`deploy-docs.yml`)

Builds and deploys the VitePress documentation to GitHub Pages.

**Triggers:**
- Push to `main` branch (when docs files change)
- Manual trigger via GitHub Actions UI

**What it does:**
1. Checks out the repository
2. Sets up pnpm and Node.js
3. Installs dependencies
4. Builds VitePress documentation
5. Deploys to GitHub Pages

**Configuration Required:**

1. **Enable GitHub Pages:**
   - Go to Settings → Pages
   - Under "Build and deployment", select "GitHub Actions"

2. **Set Base Path (if needed):**
   - If your repo is at `https://username.github.io/repo-name/`
   - Update `docs/.vitepress/config.ts`:
     ```typescript
     base: '/repo-name/'
     ```
   - Or set the `BASE_PATH` environment variable in the workflow

3. **Permissions:**
   - The workflow has the necessary permissions defined
   - No additional configuration needed

**Manual Deployment:**

To manually trigger deployment:
1. Go to Actions tab
2. Select "Deploy Documentation to GitHub Pages"
3. Click "Run workflow"
4. Select branch (usually `main`)
5. Click "Run workflow"

**Monitoring:**

- Check workflow status in the Actions tab
- Deployment URL will be shown in the deploy job output
- Typically: `https://username.github.io/` or `https://username.github.io/repo-name/`

**Troubleshooting:**

If deployment fails:
1. Check that GitHub Pages is enabled in Settings
2. Verify the base path is correct
3. Ensure all documentation files build locally: `pnpm docs:build`
4. Check workflow logs for specific errors
