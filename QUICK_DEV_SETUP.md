# Quick Dev Branch Setup - Run These Commands

## Step 1: Create Dev Branch (Run Now)

```bash
# Make sure you're on main and up to date
git checkout main
git pull origin main

# Create dev branch from current main
git checkout -b dev

# Push dev branch to GitHub
git push -u origin dev
```

## Step 2: Verify Branch Created

```bash
# Check current branch (should show "dev")
git branch

# Check remote branches (should show "origin/dev")
git branch -r
```

## Step 3: Set Default Branch for Development

From now on, always work on `dev` branch:

```bash
# Switch to dev branch
git checkout dev

# Make your changes
# ... edit files ...

# Commit to dev
git add .
git commit -m "your message"
git push origin dev
```

## Step 4: When Ready for Production

```bash
# Option A: Merge dev to main locally
git checkout main
git pull origin main
git merge dev
git push origin main

# Option B: Create Pull Request on GitHub (Recommended)
# 1. Go to: https://github.com/naveenkumar-spec/ad_ops_dashboard
# 2. Click "Pull Requests" → "New Pull Request"
# 3. Base: main ← Compare: dev
# 4. Review changes and merge
```

## Current Status

Your repository now has:
- ✅ `main` branch (production) - deploys to live site
- ✅ `dev` branch (development) - for testing changes

## Going Forward

### For New Features:
```bash
# Always start from dev
git checkout dev
git pull origin dev

# Make changes
# ... edit files ...

# Commit and push to dev
git add .
git commit -m "feat: your feature"
git push origin dev

# Test on dev environment
# When ready, merge to main
```

### Emergency Hotfix:
```bash
# For urgent production fixes
git checkout main
git pull origin main

# Make fix
# ... edit files ...

# Commit and push directly to main
git add .
git commit -m "hotfix: urgent fix"
git push origin main

# Then sync back to dev
git checkout dev
git merge main
git push origin dev
```

## Vercel Setup (Frontend)

Vercel automatically creates preview deployments for all branches!

**After pushing to dev branch:**
1. Go to https://vercel.com/dashboard
2. Click on your project
3. Go to "Deployments" tab
4. Find deployment from `dev` branch
5. Copy the preview URL

**URLs:**
- Production (main): `https://your-domain.vercel.app`
- Dev branch: `https://ad-ops-dashboard-dev-[hash].vercel.app`

## Render Setup (Backend)

**Option 1: Create Separate Dev Service (Recommended)**

1. Go to https://dashboard.render.com
2. Click "New" → "Web Service"
3. Connect same repository
4. Settings:
   - Name: `adops-dashboard-backend-dev`
   - Branch: `dev`
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Environment: Copy from production service
6. Add these dev-specific variables:
   ```
   BIGQUERY_DATASET_ID=adops_dashboard_dev
   BIGQUERY_SYNC_ENABLED=false
   ```
7. Click "Create Web Service"

**Option 2: Use Same Service (Simpler)**

Keep using the same Render service, just test locally before pushing to main.

## Summary

✅ **Created**: `dev` branch for development
✅ **Production**: `main` branch (unchanged)
✅ **Workflow**: dev → test → main
✅ **Deployments**: Automatic on both branches

**Next**: Run the commands in Step 1 to create the dev branch!
