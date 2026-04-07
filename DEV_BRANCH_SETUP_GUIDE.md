# Development Branch Setup Guide

## Overview
This guide sets up a proper development workflow using Git branches instead of separate repositories.

## Branch Strategy

### Branch Structure
```
main (production)
  └── dev (development/staging)
       └── feature/* (individual features)
```

### Branch Purposes
- **main**: Production branch (auto-deploys to production)
- **dev**: Development branch (auto-deploys to staging)
- **feature/***: Feature branches (for specific features)

## Step 1: Create Development Branch

Run these commands in your local repository:

```bash
# Make sure you're on main and up to date
git checkout main
git pull origin main

# Create and switch to dev branch
git checkout -b dev

# Push dev branch to GitHub
git push -u origin dev
```

## Step 2: Set Up Branch Protection (GitHub)

### Protect Main Branch
1. Go to GitHub: https://github.com/naveenkumar-spec/ad_ops_dashboard
2. Click **Settings** → **Branches**
3. Click **Add branch protection rule**
4. Branch name pattern: `main`
5. Enable:
   - ✅ Require pull request before merging
   - ✅ Require approvals (1)
   - ✅ Dismiss stale pull request approvals when new commits are pushed
6. Click **Create**

### Protect Dev Branch (Optional)
Repeat above for `dev` branch if you want PR reviews for dev too.

## Step 3: Configure Vercel for Branch Deployments

### Production Deployment (main branch)
1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Git**
4. **Production Branch**: `main` (should already be set)

### Preview Deployment (dev branch)
Vercel automatically creates preview deployments for all branches!

**Dev branch URL will be:**
```
https://ad-ops-dashboard-dev-[hash].vercel.app
```

### Get Dev Branch URL:
1. Push to dev branch
2. Go to Vercel Dashboard → Deployments
3. Find deployment from `dev` branch
4. Copy the URL

## Step 4: Configure Render for Branch Deployments

### Option A: Separate Service for Dev (Recommended)

1. Go to Render Dashboard: https://dashboard.render.com
2. Click **New** → **Web Service**
3. Connect same GitHub repository
4. Configure:
   - **Name**: `adops-dashboard-backend-dev`
   - **Branch**: `dev`
   - **Environment**: Copy from production
   - **Instance Type**: Free or Starter (cheaper for dev)
5. Click **Create Web Service**

### Option B: Use Same Service with Manual Deploys

Keep production service on `main`, manually deploy `dev` when needed.

## Step 5: Update Environment Variables

### Dev Environment Differences

Create separate environment variables for dev:

**Vercel (Frontend Dev):**
```bash
VITE_API_BASE_URL=https://adops-dashboard-backend-dev.onrender.com
VITE_ENABLE_MOCK_FALLBACK=true
```

**Render (Backend Dev):**
```bash
# Use separate BigQuery dataset for dev
BIGQUERY_DATASET_ID=adops_dashboard_dev

# Use separate sync state table
BIGQUERY_SYNC_STATE_TABLE_ID=campaign_tracker_sync_state_dev

# Disable scheduled syncs in dev (optional)
BIGQUERY_SYNC_ENABLED=false
```

## Step 6: Development Workflow

### Daily Development Workflow

```bash
# 1. Start your day - switch to dev branch
git checkout dev
git pull origin dev

# 2. Create feature branch for your work
git checkout -b feature/add-new-chart

# 3. Make your changes
# ... edit files ...

# 4. Commit changes
git add .
git commit -m "feat: Add new chart component"

# 5. Push feature branch
git push origin feature/add-new-chart

# 6. Test on dev environment
# Vercel will auto-deploy preview
# Check: https://ad-ops-dashboard-[branch]-[hash].vercel.app

# 7. Merge to dev branch (if working alone)
git checkout dev
git merge feature/add-new-chart
git push origin dev

# 8. Test on dev environment
# Wait for dev deployment to complete
# Test thoroughly on dev URLs

# 9. When ready for production - create Pull Request
# Go to GitHub → Pull Requests → New PR
# Base: main ← Compare: dev
# Add description, request review
# Merge after approval
```

### Using Pull Requests (Recommended)

Instead of direct merging, use PRs:

```bash
# After pushing feature branch
git push origin feature/add-new-chart

# Then on GitHub:
# 1. Go to repository
# 2. Click "Pull Requests" → "New Pull Request"
# 3. Base: dev ← Compare: feature/add-new-chart
# 4. Create PR, review, merge
```

## Step 7: Deployment URLs

### Production (main branch)
- **Frontend**: https://your-production-domain.vercel.app
- **Backend**: https://adops-dashboard-backend.onrender.com

### Development (dev branch)
- **Frontend**: https://ad-ops-dashboard-dev-[hash].vercel.app
- **Backend**: https://adops-dashboard-backend-dev.onrender.com

### Feature Branches
- **Frontend**: https://ad-ops-dashboard-[branch]-[hash].vercel.app
- **Backend**: Manual deploy or use dev backend

## Step 8: Git Commands Cheat Sheet

### Switching Branches
```bash
git checkout main          # Switch to production
git checkout dev           # Switch to development
git checkout -b feature/x  # Create and switch to new feature branch
```

### Updating Branches
```bash
git pull origin main       # Update main from GitHub
git pull origin dev        # Update dev from GitHub
```

### Merging Changes
```bash
# Merge dev into main (after testing)
git checkout main
git merge dev
git push origin main

# Merge feature into dev
git checkout dev
git merge feature/add-chart
git push origin dev
```

### Viewing Branches
```bash
git branch                 # List local branches
git branch -r              # List remote branches
git branch -a              # List all branches
```

### Deleting Branches
```bash
git branch -d feature/x    # Delete local branch
git push origin --delete feature/x  # Delete remote branch
```

## Step 9: Testing Checklist

### Before Merging to Main

- [ ] All features work on dev environment
- [ ] No console errors in browser
- [ ] No errors in backend logs
- [ ] Manual sync works correctly
- [ ] All tables display data correctly
- [ ] Currency toggle works
- [ ] Filters work correctly
- [ ] Performance is acceptable
- [ ] Code reviewed (if using PRs)

## Step 10: Emergency Rollback

If production breaks after deployment:

```bash
# Option 1: Revert last commit
git revert HEAD
git push origin main

# Option 2: Reset to previous commit
git reset --hard <previous-commit-hash>
git push origin main --force

# Option 3: Redeploy previous version on Vercel/Render
# Use platform UI to redeploy previous deployment
```

## Alternative: Separate Repository (Not Recommended)

If you still want a separate dev repository:

### Create New Repository
1. Go to GitHub: https://github.com/new
2. Repository name: `ad_ops_dashboard_dev`
3. Private repository
4. Don't initialize with README
5. Click **Create repository**

### Clone and Setup
```bash
# Clone production repo to new location
git clone https://github.com/naveenkumar-spec/ad_ops_dashboard.git ad_ops_dashboard_dev
cd ad_ops_dashboard_dev

# Change remote to new dev repo
git remote remove origin
git remote add origin https://github.com/naveenkumar-spec/ad_ops_dashboard_dev.git
git push -u origin main

# Now you have two separate repos
```

### Sync Between Repos
```bash
# In dev repo, add production as remote
git remote add production https://github.com/naveenkumar-spec/ad_ops_dashboard.git

# Pull changes from production
git pull production main

# Push tested changes to production
cd ../ad_ops_dashboard
git pull ../ad_ops_dashboard_dev main
git push origin main
```

**Downsides:**
- ❌ Manual syncing required
- ❌ Duplicate issues/PRs
- ❌ Split git history
- ❌ More complex workflow
- ❌ Easy to get out of sync

## Recommended Workflow Summary

**Best Practice: Use Branches**

```
Development Flow:
feature/x → dev → main

1. Create feature branch from dev
2. Develop and test locally
3. Push and test on dev environment
4. Merge to dev branch
5. Test thoroughly on dev
6. Create PR: dev → main
7. Review and merge to main
8. Auto-deploy to production
```

## Next Steps

1. ✅ Create `dev` branch
2. ✅ Set up branch protection on GitHub
3. ✅ Configure Vercel preview deployments
4. ✅ Create separate Render service for dev (optional)
5. ✅ Update environment variables
6. ✅ Test the workflow
7. ✅ Document your team's workflow

## Questions?

- **Q: Can I still push directly to main in emergencies?**
  - A: Yes, but disable branch protection temporarily

- **Q: How do I test before deploying?**
  - A: Push to dev branch, test on dev URLs, then merge to main

- **Q: What if dev and main diverge?**
  - A: Regularly merge main into dev to keep them in sync

- **Q: Can I have multiple feature branches?**
  - A: Yes! Create as many as needed: feature/chart, feature/table, etc.

---

**Created by**: Kiro AI Assistant
**Date**: 2026-04-07
**Purpose**: Set up proper development workflow with Git branches
