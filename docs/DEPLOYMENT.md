# Deploying Documentation to GitHub Pages

This guide explains how to deploy the c4c documentation to GitHub Pages.

## Quick Setup

### 1. Enable GitHub Pages

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Pages**
3. Under **Build and deployment**:
   - Source: Select **GitHub Actions**
   - (This option should appear automatically when the workflow file is present)

### 2. Configure Base Path

The repository is configured for:
- Repository: `https://github.com/Pom4H/c4c`
- Documentation URL: `https://Pom4H.github.io/c4c/`
- Base path is already set to: `base: '/c4c/'`

If you're using a custom domain:
- Update `docs/.vitepress/config.ts`:
  ```typescript
  base: '/',  // For custom domain, use root
  ```

### 3. Deploy

The documentation will automatically deploy when you push to the `main` branch.

Or manually trigger:
1. Go to **Actions** tab
2. Select **Deploy Documentation to GitHub Pages**
3. Click **Run workflow**
4. Select `main` branch
5. Click **Run workflow**

### 4. Access Documentation

After successful deployment (usually 1-2 minutes):
- Visit: `https://Pom4H.github.io/c4c/`

## Workflow Details

### Triggers

The workflow runs on:
- **Push to main** when these files change:
  - `docs/**` - Any documentation files
  - `package.json` - Dependencies
  - `pnpm-lock.yaml` - Lock file
  - `.github/workflows/deploy-docs.yml` - Workflow itself

- **Manual trigger** via GitHub Actions UI

### Build Process

1. **Checkout code** - Gets the latest code
2. **Setup pnpm** - Installs pnpm package manager
3. **Setup Node.js** - Installs Node.js 20 with pnpm cache
4. **Install dependencies** - Runs `pnpm install --frozen-lockfile`
5. **Build docs** - Runs `pnpm docs:build`
6. **Upload artifact** - Prepares built files for deployment
7. **Deploy** - Deploys to GitHub Pages

## Custom Domain (Optional)

To use a custom domain:

1. **Add CNAME file:**
   ```bash
   echo "docs.yourdomain.com" > docs/public/CNAME
   ```

2. **Configure DNS:**
   - Add CNAME record pointing to `Pom4H.github.io`
   - Or A records pointing to GitHub Pages IPs

3. **Update GitHub Settings:**
   - Go to Settings → Pages
   - Enter your custom domain
   - Enable "Enforce HTTPS"

4. **Update base path:**
   ```typescript
   // docs/.vitepress/config.ts
   base: '/',  // For custom domain, use root
   ```

## Local Preview

Preview the production build locally:

```bash
# Build docs
pnpm docs:build

# Preview
pnpm docs:preview
```

Visit `http://localhost:4173` to see the production build.

## Troubleshooting

### Build Fails

**Check local build:**
```bash
pnpm docs:build
```

If it fails locally, fix the errors before pushing.

**Common issues:**
- Dead links - Update or remove broken links
- Missing files - Ensure all referenced files exist
- Syntax errors - Check markdown syntax

### Wrong Base Path

**Symptom:** Assets (CSS, JS, images) return 404

**Solution:** Update base path in `docs/.vitepress/config.ts`
```typescript
base: '/your-repo-name/',
```

### Permissions Error

**Symptom:** Workflow fails with permissions error

**Solution:** 
1. Go to Settings → Actions → General
2. Under "Workflow permissions"
3. Select "Read and write permissions"
4. Save

### GitHub Pages Not Enabled

**Symptom:** Deploy job fails with "Pages not enabled"

**Solution:**
1. Go to Settings → Pages
2. Under "Build and deployment"
3. Select "GitHub Actions" as source

## Branch Protection

If you have branch protection on `main`:

1. Allow GitHub Actions to bypass protection:
   - Settings → Branches → Branch protection rules
   - Edit `main` branch rule
   - Under "Allow specified actors to bypass required pull requests"
   - Add `github-actions[bot]`

## Environment Variables

You can set the base path via environment variable:

```yaml
# In .github/workflows/deploy-docs.yml
- name: Build with VitePress
  run: pnpm docs:build
  env:
    BASE_PATH: '/your-repo-name/'
```

Then use it in config:

```typescript
// docs/.vitepress/config.ts
base: process.env.BASE_PATH || '/',
```

## Monitoring Deployments

### View Workflow Status

1. Go to **Actions** tab
2. Click on the latest workflow run
3. View logs for each step

### Check Deployment

1. After successful build
2. Go to Settings → Pages
3. See "Your site is live at [URL]"
4. Click to visit

### Rollback

If you need to rollback:

1. **Via Git:**
   ```bash
   git revert <commit-hash>
   git push
   ```

2. **Via GitHub:**
   - Revert the problematic commit
   - Workflow will automatically redeploy

## Advanced Configuration

### Multiple Branches

Deploy from different branches:

```yaml
on:
  push:
    branches: [main, develop]  # Deploy from multiple branches
```

### Custom Build Command

If you have a custom build process:

```yaml
- name: Build with VitePress
  run: |
    pnpm build:packages
    pnpm docs:build
```

### Deploy to Different Path

Deploy docs to a subdirectory:

```yaml
- name: Upload artifact
  uses: actions/upload-pages-artifact@v3
  with:
    path: docs/.vitepress/dist
    # Optional: deploy to subdirectory
```

## Resources

- [VitePress Documentation](https://vitepress.dev/)
- [GitHub Pages Documentation](https://docs.github.com/pages)
- [GitHub Actions Documentation](https://docs.github.com/actions)
