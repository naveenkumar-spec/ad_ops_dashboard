# ✅ Dev Environment Setup - COMPLETE

## 🎉 What's Been Set Up

### 1. Git Branches ✅
- **main**: Production branch
- **dev**: Development branch (currently active)
- All future changes go to `dev` first

### 2. Vercel (Frontend) ✅
- **Production**: Deploys from `main` branch
  - URL: `https://ad-ops-dashboard.vercel.app`
- **Preview**: Auto-deploys from `dev` branch
  - URL: `https://ad-ops-dashboard-git-dev-[...].vercel.app`
- **Environment Variables**: Set for Preview environment

### 3. Render (Backend) ✅
- **Production**: Deploys from `main` branch
  - URL: `https://adops-dashboard-backend.onrender.com`
  - Dataset: `adops_dashboard`
- **Dev**: Deploys from `dev` branch
  - URL: `https://adops-dashboard-backend-dev.onrender.com`
  - Dataset: `adops_dashboard_dev`

### 4. BigQuery (Database) ✅
- **Production Dataset**: `adops_dashboard`
  - Used by production backend only
  - Contains live data
- **Dev Dataset**: `adops_dashboard_dev`
  - Used by local and dev backend
  - Safe for testing and experimentation

### 5. Local Environment ✅
- **Default Dataset**: `adops_dashboard_dev` (safe)
- **Easy Switching**: Change `BIGQUERY_DATASET_ID` in `.env`
- **Branch**: `dev` (all commits go here)

## 🔄 Complete Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT WORKFLOW                      │
└─────────────────────────────────────────────────────────────┘

1. LOCAL DEVELOPMENT
   ├─ Branch: dev
   ├─ Dataset: adops_dashboard_dev
   ├─ Test: localhost:3000 + localhost:5000
   └─ Commit: git commit -m "feature: ..."

2. PUSH TO DEV
   ├─ Command: git push origin dev
   ├─ Auto-deploys to:
   │  ├─ Vercel Preview (frontend)
   │  └─ Render Dev (backend)
   └─ Dataset: adops_dashboard_dev

3. TEST ON DEV URLS
   ├─ Frontend: https://ad-ops-dashboard-git-dev-[...].vercel.app
   ├─ Backend: https://adops-dashboard-backend-dev.onrender.com
   └─ Verify everything works

4. MERGE TO PRODUCTION (When Ready)
   ├─ Command: git checkout main && git merge dev
   ├─ Push: git push origin main
   ├─ Auto-deploys to:
   │  ├─ Vercel Production (frontend)
   │  └─ Render Production (backend)
   └─ Dataset: adops_dashboard
```

## 📋 Environment Summary

| Environment | Branch | Frontend URL | Backend URL | BigQuery Dataset |
|------------|--------|--------------|-------------|------------------|
| **Local** | dev | localhost:3000 | localhost:5000 | adops_dashboard_dev |
| **Dev/Staging** | dev | ad-ops-dashboard-git-dev-[...].vercel.app | adops-dashboard-backend-dev.onrender.com | adops_dashboard_dev |
| **Production** | main | ad-ops-dashboard.vercel.app | adops-dashboard-backend.onrender.com | adops_dashboard |

## 🛡️ Safety Features

1. ✅ **Separate Datasets**: Dev and prod data are completely isolated
2. ✅ **Branch Protection**: Changes must go through dev first
3. ✅ **Auto-Deployment**: Push to dev = auto-deploy to staging
4. ✅ **Easy Testing**: Test on real URLs before production
5. ✅ **Quick Rollback**: Just don't merge to main if something breaks

## 🚀 Quick Commands

### Daily Development
```bash
# Make changes
git add .
git commit -m "feat: your feature"
git push origin dev

# Test on dev URLs (auto-deployed)
# When ready, merge to main
```

### Switch Dataset Locally
```bash
# Use dev dataset (default - safe)
# In backend/.env: BIGQUERY_DATASET_ID=adops_dashboard_dev

# Use prod dataset (when needed)
# In backend/.env: BIGQUERY_DATASET_ID=adops_dashboard

# Restart server
npm start
```

### Deploy to Production
```bash
git checkout main
git merge dev
git push origin main
# Auto-deploys to production!
```

## 📚 Documentation Created

1. **DEV_BRANCH_SETUP_GUIDE.md** - Git branch workflow
2. **DEV_ENVIRONMENT_SETUP.md** - Vercel/Render setup
3. **BIGQUERY_DEV_PROD_SETUP.md** - BigQuery configuration
4. **QUICK_DATASET_SWITCH.md** - Quick reference for switching
5. **DEV_ENVIRONMENT_COMPLETE.md** - This summary (you are here!)

## ✅ Verification Checklist

- [x] Dev branch created and active
- [x] Vercel preview deployments working
- [x] Render dev backend deployed
- [x] BigQuery dev dataset created
- [x] Local .env configured for dev dataset
- [x] All documentation created
- [x] Changes committed and pushed to dev

## 🎯 Next Steps

You're all set! Here's what to do next:

1. **Continue developing** on the `dev` branch
2. **Test locally** with dev dataset (safe to break)
3. **Push to dev** to test on staging URLs
4. **Merge to main** when ready for production

## 🆘 Need Help?

**Check which environment you're in:**
```bash
# Check git branch
git branch --show-current

# Check dataset
findstr BIGQUERY_DATASET_ID backend\.env
```

**Common Issues:**
- Preview not deploying? Check Vercel dashboard → Deployments
- Backend not working? Check Render logs
- Wrong dataset? Check .env file and restart server

---

**Setup Date**: 2026-04-07
**Status**: ✅ COMPLETE
**Current Branch**: dev
**Ready for**: Development and testing
