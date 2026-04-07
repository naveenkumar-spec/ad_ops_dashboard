# ✅ Dev Environment - READY TO USE

## 🎉 Setup Complete!

Your complete dev/prod environment is now ready. All changes will be tested in dev before going to production.

---

## 📊 Your Environments

### 🔧 Development Environment

**Local Development:**
- Branch: `dev`
- Backend: `http://localhost:5000`
- Frontend: `http://localhost:3000`
- Database: `adops_dashboard_dev` (8,907 rows copied from prod)

**Dev Staging (Auto-deployed):**
- Branch: `dev` (auto-deploys on push)
- Backend: `https://adops-dashboard-backend-dev.onrender.com`
- Frontend: `https://ad-ops-dashboard-git-dev-[...].vercel.app`
- Database: `adops_dashboard_dev`

### 🚀 Production Environment

**Live Production:**
- Branch: `main` (manual merge only)
- Backend: `https://adops-dashboard-backend.onrender.com`
- Frontend: `https://ad-ops-dashboard.vercel.app`
- Database: `adops_dashboard`

---

## 🔄 Your Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT WORKFLOW                      │
└─────────────────────────────────────────────────────────────┘

1. DEVELOP LOCALLY (Safe Testing)
   ├─ Make changes on dev branch
   ├─ Test with dev database (8,907 rows)
   ├─ Backend: npm start (uses adops_dashboard_dev)
   └─ Frontend: npm run dev

2. COMMIT & PUSH TO DEV
   ├─ git add .
   ├─ git commit -m "feat: your feature"
   └─ git push origin dev

3. AUTO-DEPLOY TO STAGING
   ├─ Vercel: Builds preview deployment
   ├─ Render: Deploys dev backend
   └─ Both use adops_dashboard_dev

4. TEST ON STAGING URLS
   ├─ Frontend: https://ad-ops-dashboard-git-dev-[...].vercel.app
   ├─ Backend: https://adops-dashboard-backend-dev.onrender.com
   └─ Verify everything works with real URLs

5. DEPLOY TO PRODUCTION (When Ready)
   ├─ git checkout main
   ├─ git merge dev
   ├─ git push origin main
   └─ Auto-deploys to production!
```

---

## 🎯 Current Status

✅ **Git Branches**
- `dev` branch active and pushed
- `main` branch protected (production)

✅ **Vercel (Frontend)**
- Production: Deploys from `main`
- Preview: Auto-deploys from `dev`
- Environment variables configured

✅ **Render (Backend)**
- Production: Deploys from `main` → uses `adops_dashboard`
- Dev: Deploys from `dev` → uses `adops_dashboard_dev`

✅ **BigQuery (Database)**
- Production dataset: `adops_dashboard` (protected)
- Dev dataset: `adops_dashboard_dev` (8,907 rows copied)
- Tables: campaign_tracker_consolidated, overview_transition_metrics, campaign_tracker_sync_state

✅ **Local Environment**
- `.env` configured for dev dataset
- Service account credentials working
- Ready to run locally

---

## 🚀 Quick Start Commands

### Start Local Development
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm run dev

# Visit: http://localhost:3000
```

### Make Changes and Deploy to Dev
```bash
# Make your changes
git add .
git commit -m "feat: your feature description"
git push origin dev

# Auto-deploys to staging!
# Check: https://ad-ops-dashboard-git-dev-[...].vercel.app
```

### Deploy to Production (When Ready)
```bash
git checkout main
git merge dev
git push origin main

# Auto-deploys to production!
```

---

## 🛡️ Safety Features

1. ✅ **Isolated Datasets**: Dev and prod data are completely separate
2. ✅ **Branch Protection**: Changes must go through dev first
3. ✅ **Auto-Deployment**: Push to dev = instant staging deployment
4. ✅ **Real Testing**: Test on actual URLs before production
5. ✅ **Easy Rollback**: Don't merge to main if something breaks

---

## 📋 Environment Variables

### Local (.env)
```bash
BIGQUERY_DATASET_ID=adops_dashboard_dev  # Safe for testing
```

### Render Dev Backend
```bash
BIGQUERY_DATASET_ID=adops_dashboard_dev
FRONTEND_URL=https://ad-ops-dashboard-git-dev-[...].vercel.app
```

### Render Production Backend
```bash
BIGQUERY_DATASET_ID=adops_dashboard
FRONTEND_URL=https://ad-ops-dashboard.vercel.app
```

### Vercel Preview Environment
```bash
VITE_API_BASE_URL=https://adops-dashboard-backend-dev.onrender.com
```

---

## 🔍 Verify Your Setup

### Check Current Branch
```bash
git branch --show-current
# Should show: dev
```

### Check Dataset Configuration
```bash
# Windows
findstr BIGQUERY_DATASET_ID backend\.env

# Should show: BIGQUERY_DATASET_ID=adops_dashboard_dev
```

### Check Dev Data
```sql
-- Run in BigQuery console
SELECT COUNT(*) as rows, MAX(synced_at) as last_sync
FROM `tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated`;

-- Should show: 8,907 rows
```

---

## 📚 Documentation Reference

- `DEV_ENVIRONMENT_COMPLETE.md` - Complete setup overview
- `BIGQUERY_DEV_PROD_SETUP.md` - BigQuery configuration
- `QUICK_DATASET_SWITCH.md` - Switch between datasets
- `COPY_PROD_TO_DEV_GUIDE.md` - Copy production data
- `DEV_ENVIRONMENT_READY.md` - This file (quick reference)

---

## 🎯 What to Do Next

You're ready to start developing! Here's what you can do:

1. **Start coding** - Make changes on the `dev` branch
2. **Test locally** - Use localhost with dev database
3. **Push to dev** - Auto-deploys to staging for testing
4. **Merge to main** - Deploy to production when ready

---

## 🆘 Need Help?

**Check which environment you're in:**
```bash
git branch --show-current  # Should be: dev
findstr BIGQUERY_DATASET_ID backend\.env  # Should be: adops_dashboard_dev
```

**Common Commands:**
```bash
# Switch to dev branch
git checkout dev

# See recent commits
git log --oneline -5

# Check remote branches
git branch -r

# Pull latest changes
git pull origin dev
```

---

**Setup Date**: 2026-04-07  
**Status**: ✅ READY FOR DEVELOPMENT  
**Current Branch**: dev  
**Dataset**: adops_dashboard_dev (8,907 rows)  
**Next Step**: Start developing! 🚀
