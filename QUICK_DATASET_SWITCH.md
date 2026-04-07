# Quick Dataset Switch Guide

## 🎯 Current Setup

✅ **Local (.env)**: `adops_dashboard_dev` (safe for testing)
✅ **Render Dev**: `adops_dashboard_dev` (staging environment)
✅ **Render Prod**: `adops_dashboard` (production data)

## 🔄 How to Switch Datasets Locally

### Use DEV Dataset (Default - Safe)
```bash
# In backend/.env
BIGQUERY_DATASET_ID=adops_dashboard_dev
```

### Use PROD Dataset (When Needed)
```bash
# In backend/.env
BIGQUERY_DATASET_ID=adops_dashboard
```

**Then restart your server:**
```bash
cd backend
npm start
```

## ⚡ Quick Commands

### Check Current Dataset
```bash
# Windows
findstr BIGQUERY_DATASET_ID backend\.env

# Mac/Linux
grep BIGQUERY_DATASET_ID backend/.env
```

### Switch to Dev (Safe)
```bash
# Manually edit backend/.env and change:
BIGQUERY_DATASET_ID=adops_dashboard_dev
```

### Switch to Prod (Careful!)
```bash
# Manually edit backend/.env and change:
BIGQUERY_DATASET_ID=adops_dashboard
```

## 🛡️ Safety Rules

1. ✅ **Always use DEV for testing** - It's safe to break
2. ⚠️ **Only use PROD when deploying** - Production data is live
3. 🔍 **Double-check before syncing** - Verify dataset before running sync
4. 📊 **Monitor BigQuery console** - Watch which dataset is being updated

## 📋 Typical Workflow

```
1. Develop locally with DEV dataset
   └─ BIGQUERY_DATASET_ID=adops_dashboard_dev

2. Test changes locally
   └─ Safe to experiment, break, reset

3. Push to dev branch
   └─ Auto-deploys to Render dev (uses dev dataset)

4. Test on dev URL
   └─ https://your-dev-backend.onrender.com

5. Merge to main when ready
   └─ Deploys to production (uses prod dataset)
```

## 🔍 Verify Dataset in BigQuery

**Check which dataset has data:**
```sql
-- Dev dataset
SELECT 
  'DEV' as environment,
  COUNT(*) as rows,
  MAX(synced_at) as last_sync
FROM `tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated`;

-- Prod dataset
SELECT 
  'PROD' as environment,
  COUNT(*) as rows,
  MAX(synced_at) as last_sync
FROM `tactile-petal-820.adops_dashboard.campaign_tracker_consolidated`;
```

## ⚠️ Before Syncing to Production

Checklist:
- [ ] Tested in dev environment
- [ ] Verified `BIGQUERY_DATASET_ID=adops_dashboard` in production
- [ ] Reviewed sync logs for errors
- [ ] Confirmed data quality
- [ ] Got approval if needed

---

**Remember**: When in doubt, use DEV! It's always safe to test there.
