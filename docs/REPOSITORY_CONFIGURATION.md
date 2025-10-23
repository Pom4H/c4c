# Repository Configuration

This document outlines the GitHub repository configuration for the c4c documentation.

## Repository Information

- **GitHub Repository:** `https://github.com/Pom4H/c4c`
- **Documentation URL:** `https://Pom4H.github.io/c4c/`
- **Base Path:** `/c4c/`

## Files Updated

The following files have been configured with the correct repository URLs:

### 1. VitePress Configuration
- **File:** `docs/.vitepress/config.ts`
- **Changes:**
  - Base path: `/c4c/`
  - GitHub links point to `https://github.com/Pom4H/c4c`
  - Edit links point to `https://github.com/Pom4H/c4c/edit/main/docs/:path`

### 2. Homepage
- **File:** `docs/index.md`
- **Changes:**
  - GitHub button links to `https://github.com/Pom4H/c4c`

### 3. Main README
- **File:** `README.md`
- **Changes:**
  - Documentation badge links to `https://github.com/Pom4H/c4c/tree/main/docs`
  - Deploy Docs badge links to `https://github.com/Pom4H/c4c/actions/workflows/deploy-docs.yml`

### 4. Contributing Guide
- **File:** `CONTRIBUTING.md`
- **Changes:**
  - Clone URL: `git clone https://github.com/Pom4H/c4c.git`

### 5. Deployment Guide
- **File:** `docs/DEPLOYMENT.md`
- **Changes:**
  - Documentation URL: `https://Pom4H.github.io/c4c/`
  - Repository references updated

### 6. Setup Documentation
- **File:** `DOCUMENTATION_SETUP.md`
- **Changes:**
  - Documentation URL: `https://Pom4H.github.io/c4c/`
  - Base path configuration updated

## GitHub Pages Setup

### Current Configuration

The documentation is configured to deploy to:
```
https://Pom4H.github.io/c4c/
```

### Required GitHub Settings

1. **Enable GitHub Pages:**
   - Go to: Settings → Pages
   - Source: GitHub Actions

2. **Base Path:**
   - Already configured in `docs/.vitepress/config.ts`
   - No changes needed

3. **Deployment:**
   - Automatic on push to `main` branch
   - Manual trigger available via Actions tab

## Verification

Build verified successfully:
```bash
pnpm docs:build
# ✓ Build complete
```

## Custom Domain (Optional)

If you want to use a custom domain in the future:

1. **Update Base Path:**
   ```typescript
   // docs/.vitepress/config.ts
   base: '/',  // Change from '/c4c/' to '/'
   ```

2. **Add CNAME:**
   ```bash
   echo "docs.yourdomain.com" > docs/public/CNAME
   ```

3. **Configure DNS:**
   - Point CNAME to `Pom4H.github.io`

4. **Update GitHub Settings:**
   - Settings → Pages → Custom domain

## Testing Locally

Test the production build locally:

```bash
# Build with production base path
pnpm docs:build

# Preview (will use /c4c/ base path)
pnpm docs:preview
```

Visit: `http://localhost:4173/c4c/`

## Links Summary

All links have been updated to use the correct repository:

| Type | URL |
|------|-----|
| Repository | `https://github.com/Pom4H/c4c` |
| Documentation | `https://Pom4H.github.io/c4c/` |
| Edit on GitHub | `https://github.com/Pom4H/c4c/edit/main/docs/:path` |
| Actions Badge | `https://github.com/Pom4H/c4c/actions/workflows/deploy-docs.yml` |
| Clone URL | `git clone https://github.com/Pom4H/c4c.git` |

## Next Steps

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "docs: setup VitePress documentation with GitHub Pages"
   git push origin main
   ```

2. **Enable GitHub Pages:**
   - Go to Settings → Pages
   - Select "GitHub Actions" as source

3. **Wait for Deployment:**
   - Check Actions tab for progress
   - Usually takes 1-2 minutes

4. **Access Documentation:**
   - Visit: `https://Pom4H.github.io/c4c/`

## Support

If you encounter any issues:
1. Check the workflow logs in Actions tab
2. Verify GitHub Pages is enabled
3. Ensure base path matches repository name
4. Test build locally first
