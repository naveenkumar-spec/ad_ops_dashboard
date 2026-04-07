# BigQuery Dev/Prod Environment Setup

## 📊 Dataset Structure

```
GCP Project: tactile-petal-820
├── adops_dashboard (Production)
│   ├── campaign_tracker_consolidated
│   ├── overview_transition_metrics
│   ├── campaign_tracker_sync_state
│   └── users
└── adops_dashboard_dev (Development)
    ├── campaign_tracker_consolidated
    ├── overview_transition_metrics
    ├── campaign_tracker_sync_state
    └── users
```

## 🔧 Environment Configuration

### Local Development (.env)
```bash
BIGQUERY_DATASET_ID=adops_dashboard_dev
```

### Render Dev Backend
```bash
BIGQUERY_DATASET_ID=adops_dashboard_dev
```

### Render Production Backend
```bash
BIGQUERY_DATASET_ID=adops_dashboard
```

## 🚀 Setup Steps

### Step 1: Create Dev Dataset in BigQuery

1. Go to [BigQuery Console](https://console.cloud.google.com/bigquery)
2. Select project: `tactile-petal-820`
3. Click three dots next to project → **"Create dataset"**
4. Configure:
   - **Dataset ID**: `adops_dashboard_dev`
   - **Location**: `US` (same as production)
   - **Default table expiration**: Never
5. Click **"Create dataset"**

### Step 2: Update Local Environment

Your local `.env` is now configured to use `adops_dashboard_dev` by default.

### Step 3: Update Render Environments

**Dev Backend:**
1. Go to Render → adops-dashboard-backend-dev
2. Environment → Edit `BIGQUERY_DATASET_ID`
3. Set to: `adops_dashboard_dev`
4. Save

**Production Backend:**
1. Go to Render → adops-dashboard-backend
2. Environment → Verify `BIGQUERY_DATASET_ID`
3. Should be: `adops_dashboard`
4. Save if changed

### Step 4: Initial Sync

The tables will be created automatically on first sync. To trigger:

**For Dev:**
```bash
# Local
npm start

# Or via Render dev backend
# Visit: https://your-dev-backend.onrender.com/api/admin/sync
```

**For Production:**
```bash
# Only sync to production when ready!
# Via Render production backend
# Visit: https://your-prod-backend.onrender.com/api/admin/sync
```

## 🔄 Switching Between Datasets

### Quick Switch (Local Development)

**To use DEV dataset (default):**
```bash
# In backend/.env
BIGQUERY_DATASET_ID=adops_dashboard_dev
```

**To use PROD dataset (when needed):**
```bash
# In backend/.env
BIGQUERY_DATASET_ID=adops_dashboard
```

Then restart your server:
```bash
npm start
```

### Environment-Based Auto-Selection

The system automatically uses the correct dataset based on `BIGQUERY_DATASET_ID` environment variable:
- Local: `adops_dashboard_dev` (safe testing)
- Dev deployment: `adops_dashboard_dev` (staging)
- Production deployment: `adops_dashboard` (live data)

## 📋 Workflow

```
Development Flow:
1. Make changes locally
2. Test with dev dataset (adops_dashboard_dev)
3. Push to dev branch
4. Auto-deploy to Render dev (uses dev dataset)
5. Test on dev URL
6. When ready, merge to main
7. Deploy to production (uses prod dataset)
```

## ⚠️ Important Notes

1. **Never sync to production accidentally**: Always check `BIGQUERY_DATASET_ID` before syncing
2. **Dev dataset is safe**: Feel free to test, break, and reset dev data
3. **Production dataset is protected**: Only production backend should write to it
4. **Same schema**: Both datasets use identical table schemas
5. **Independent data**: Changes in dev don't affect production

## 🛡️ Safety Checklist

Before syncing to production:
- [ ] Verified `BIGQUERY_DATASET_ID=adops_dashboard` in production backend
- [ ] Tested changes thoroughly in dev environment
- [ ] Reviewed sync logs in dev for errors
- [ ] Confirmed data quality in dev dataset
- [ ] Got approval for production deployment

## 🔍 Verify Current Dataset

To check which dataset you're using:

**Local:**
```bash
# Check .env file
cat backend/.env | grep BIGQUERY_DATASET_ID
```

**Render:**
1. Go to service → Environment tab
2. Find `BIGQUERY_DATASET_ID` variable
3. Verify the value

## 📊 Monitor Data

**BigQuery Console:**
- Dev: `tactile-petal-820.adops_dashboard_dev`
- Prod: `tactile-petal-820.adops_dashboard`

**Query to check data:**
```sql
-- Check dev dataset
SELECT COUNT(*) as row_count, MAX(synced_at) as last_sync
FROM `tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated`;

-- Check prod dataset
SELECT COUNT(*) as row_count, MAX(synced_at) as last_sync
FROM `tactile-petal-820.adops_dashboard.campaign_tracker_consolidated`;
```

---

**Created**: 2026-04-07
**Status**: Dev dataset ready for use
**Default**: Local and dev deployments use `adops_dashboard_dev`
