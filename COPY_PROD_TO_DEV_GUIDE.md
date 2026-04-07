# Copy Production Data to Dev Dataset

## 🎯 Purpose

This guide helps you copy production data to the dev dataset so you can test with realistic data without affecting production.

## 📋 Prerequisites

- [x] Dev dataset created in BigQuery (`adops_dashboard_dev`)
- [x] Google service account credentials configured
- [x] Node.js installed locally

## 🚀 Method 1: Using the Script (Recommended)

### Step 1: Run the Copy Script

```bash
cd backend
node scripts/copyProdToDev.js
```

This will:
1. Create `adops_dashboard_dev` dataset (if not exists)
2. Copy all tables from production to dev:
   - `campaign_tracker_consolidated`
   - `overview_transition_metrics`
   - `campaign_tracker_sync_state`
   - `users`

### Step 2: Verify the Copy

Check BigQuery console to confirm tables were copied:
- Go to: https://console.cloud.google.com/bigquery
- Navigate to: `tactile-petal-820` → `adops_dashboard_dev`
- You should see all tables with data

## 🔧 Method 2: Manual Copy via BigQuery Console

### Step 1: Create Dev Dataset

1. Go to [BigQuery Console](https://console.cloud.google.com/bigquery)
2. Click your project: `tactile-petal-820`
3. Click three dots → **"Create dataset"**
4. Configure:
   - **Dataset ID**: `adops_dashboard_dev`
   - **Location**: `US`
5. Click **"Create dataset"**

### Step 2: Copy Each Table

For each table, run this SQL query in BigQuery console:

**Copy campaign_tracker_consolidated:**
```sql
CREATE OR REPLACE TABLE `tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated`
AS SELECT * FROM `tactile-petal-820.adops_dashboard.campaign_tracker_consolidated`;
```

**Copy overview_transition_metrics:**
```sql
CREATE OR REPLACE TABLE `tactile-petal-820.adops_dashboard_dev.overview_transition_metrics`
AS SELECT * FROM `tactile-petal-820.adops_dashboard.overview_transition_metrics`;
```

**Copy campaign_tracker_sync_state:**
```sql
CREATE OR REPLACE TABLE `tactile-petal-820.adops_dashboard_dev.campaign_tracker_sync_state`
AS SELECT * FROM `tactile-petal-820.adops_dashboard.campaign_tracker_sync_state`;
```

**Copy users:**
```sql
CREATE OR REPLACE TABLE `tactile-petal-820.adops_dashboard_dev.users`
AS SELECT * FROM `tactile-petal-820.adops_dashboard.users`;
```

## 🔍 Verify the Copy

Run this query to check row counts:

```sql
-- Check production
SELECT 
  'PROD' as environment,
  'campaign_tracker_consolidated' as table_name,
  COUNT(*) as row_count,
  MAX(synced_at) as last_sync
FROM `tactile-petal-820.adops_dashboard.campaign_tracker_consolidated`

UNION ALL

-- Check dev
SELECT 
  'DEV' as environment,
  'campaign_tracker_consolidated' as table_name,
  COUNT(*) as row_count,
  MAX(synced_at) as last_sync
FROM `tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated`;
```

Expected result: Both should have the same row count.

## 🔄 When to Re-Copy

You might want to refresh dev data when:
- Production has significant new data
- You've broken dev data during testing
- You want to test with latest production data

Just re-run the script or SQL queries - they use `CREATE OR REPLACE` so they'll overwrite existing tables.

## ⚠️ Important Notes

1. **One-time copy**: This is a snapshot, not a sync. Dev won't auto-update when prod changes.
2. **Safe to modify**: Once copied, dev data is independent. Break it, test it, reset it!
3. **No reverse sync**: Changes in dev never affect production.
4. **Cost**: Copying data uses BigQuery storage and query quota (usually minimal).

## 🛡️ Safety Checklist

Before running:
- [ ] Confirmed you're copying TO dev (not FROM dev)
- [ ] Verified dev dataset name is `adops_dashboard_dev`
- [ ] Checked you have permissions to create tables
- [ ] Understood this is a one-time copy (not continuous sync)

## 🆘 Troubleshooting

**Error: "Dataset not found"**
- Solution: Create the dev dataset first (see Method 2, Step 1)

**Error: "Permission denied"**
- Solution: Check your service account has BigQuery Admin role

**Error: "Table already exists"**
- Solution: The script uses `CREATE OR REPLACE`, so this shouldn't happen. If it does, manually delete the table first.

**Script hangs or times out:**
- Solution: Large tables may take time. Check BigQuery console for job progress.

---

**After copying, you're ready to test with realistic data in dev!** 🚀
