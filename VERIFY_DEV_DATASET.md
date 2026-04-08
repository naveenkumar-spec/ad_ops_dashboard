# Verify Dev Environment Uses Dev Dataset

## How to Check Which Dataset Dev Environment Is Using

### Method 1: Check Render Environment Variables (Recommended)

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Select the dev service**: `adops-dashboard-backend-dev`
3. **Click "Environment" tab**
4. **Look for**: `BIGQUERY_DATASET_ID`
   - Should be: `adops_dashboard_dev` ✅
   - Should NOT be: `adops_dashboard` ❌

### Method 2: Check Server Logs on Render

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Select**: `adops-dashboard-backend-dev`
3. **Click "Logs" tab**
4. **Look for startup logs**:
   ```
   Data source: bigquery
   [BigQuery] Using dataset: adops_dashboard_dev
   ```

### Method 3: Add Diagnostic Endpoint (Do This Now)

Let me add a diagnostic endpoint to verify which dataset is being used.

## Code Changes to Verify Dataset

### Add Diagnostic Endpoint to `backend/routes/overview.js`

Add this endpoint to check which dataset is being queried:

```javascript
// Diagnostic endpoint to verify which dataset is being used
router.get("/debug/dataset-info", async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    const { BigQuery } = require("@google-cloud/bigquery");
    const projectId = process.env.GCP_PROJECT_ID;
    const datasetId = process.env.BIGQUERY_DATASET_ID || "adops_dashboard";
    const tableId = process.env.BIGQUERY_TABLE_ID || "campaign_tracker_consolidated";
    
    // Get row count from current dataset
    const bigquery = new BigQuery();
    const [rows] = await bigquery.query({
      query: `
        SELECT 
          '${datasetId}' as dataset_id,
          COUNT(*) as total_rows,
          COUNT(DISTINCT sync_id) as sync_count,
          MAX(synced_at) as last_sync,
          MIN(synced_at) as first_sync
        FROM \`${projectId}.${datasetId}.${tableId}\`
      `,
      location: process.env.BIGQUERY_LOCATION || "US"
    });
    
    return res.json({
      environment: process.env.NODE_ENV || "development",
      configuration: {
        projectId,
        datasetId,
        tableId,
        location: process.env.BIGQUERY_LOCATION || "US"
      },
      datasetStats: rows[0],
      expectedDataset: {
        development: "adops_dashboard_dev",
        production: "adops_dashboard"
      },
      isCorrect: datasetId === (process.env.NODE_ENV === "production" ? "adops_dashboard" : "adops_dashboard_dev")
    });
  } catch (error) {
    return res.status(500).json({ 
      error: "Failed to fetch dataset info", 
      message: error.message 
    });
  }
});
```

### Test the Endpoint

After deploying, call:

```bash
# Dev environment
curl https://adops-dashboard-backend-dev.onrender.com/api/overview/debug/dataset-info

# Expected response:
{
  "environment": "development",
  "configuration": {
    "projectId": "tactile-petal-820",
    "datasetId": "adops_dashboard_dev",  ← Should be DEV
    "tableId": "campaign_tracker_consolidated"
  },
  "datasetStats": {
    "dataset_id": "adops_dashboard_dev",
    "total_rows": 3012,
    "sync_count": 1,
    "last_sync": "2024-01-15T10:30:00.000Z"
  },
  "isCorrect": true  ← Should be true
}
```

```bash
# Production environment (for comparison)
curl https://adops-dashboard-backend.onrender.com/api/overview/debug/dataset-info

# Expected response:
{
  "environment": "production",
  "configuration": {
    "projectId": "tactile-petal-820",
    "datasetId": "adops_dashboard",  ← Should be PROD
    "tableId": "campaign_tracker_consolidated"
  },
  "datasetStats": {
    "dataset_id": "adops_dashboard",
    "total_rows": 8907,
    "sync_count": 5,
    "last_sync": "2024-01-15T12:00:00.000Z"
  },
  "isCorrect": true  ← Should be true
}
```

## Method 4: Check BigQuery Directly

### Query Dev Dataset:
```sql
SELECT 
  'adops_dashboard_dev' as dataset,
  COUNT(*) as row_count,
  MAX(synced_at) as last_sync
FROM `tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated`
```

### Query Prod Dataset:
```sql
SELECT 
  'adops_dashboard' as dataset,
  COUNT(*) as row_count,
  MAX(synced_at) as last_sync
FROM `tactile-petal-820.adops_dashboard.campaign_tracker_consolidated`
```

Different row counts = different datasets = proper isolation ✓

## Method 5: Check Render Service Configuration

### For Dev Service:
1. Go to: https://dashboard.render.com
2. Select: `adops-dashboard-backend-dev`
3. Check:
   - **Branch**: Should be `dev`
   - **Environment Variables**:
     - `NODE_ENV`: `development`
     - `BIGQUERY_DATASET_ID`: `adops_dashboard_dev`

### For Prod Service:
1. Go to: https://dashboard.render.com
2. Select: `adops-dashboard-backend`
3. Check:
   - **Branch**: Should be `main`
   - **Environment Variables**:
     - `NODE_ENV`: `production`
     - `BIGQUERY_DATASET_ID`: `adops_dashboard`

## Common Issues and Solutions

### Issue 1: Dev Using Prod Dataset

**Symptom**: Dev shows 8,907 rows (same as prod)

**Cause**: `BIGQUERY_DATASET_ID` not set on Render dev service

**Solution**:
1. Go to Render dev service settings
2. Add environment variable:
   - Key: `BIGQUERY_DATASET_ID`
   - Value: `adops_dashboard_dev`
3. Save and redeploy

### Issue 2: Both Environments Using Same Dataset

**Symptom**: Dev and prod show identical data

**Cause**: Environment variables not properly configured

**Solution**:
1. Check Render environment variables for both services
2. Ensure dev has: `BIGQUERY_DATASET_ID=adops_dashboard_dev`
3. Ensure prod has: `BIGQUERY_DATASET_ID=adops_dashboard`
4. Redeploy both services

### Issue 3: Local Dev Using Prod Dataset

**Symptom**: Local development shows production data

**Cause**: `backend/.env` has wrong dataset

**Solution**:
1. Edit `backend/.env`
2. Change to: `BIGQUERY_DATASET_ID=adops_dashboard_dev`
3. Restart local server

## Verification Checklist

- [ ] Render dev service has `BIGQUERY_DATASET_ID=adops_dashboard_dev`
- [ ] Render prod service has `BIGQUERY_DATASET_ID=adops_dashboard`
- [ ] Local `.env` has `BIGQUERY_DATASET_ID=adops_dashboard_dev`
- [ ] Dev dataset has different row count than prod
- [ ] Diagnostic endpoint returns correct dataset
- [ ] Server logs show correct dataset on startup

## Expected Results

### Development Environment:
```
✅ Dataset: adops_dashboard_dev
✅ Row count: ~3,012 (test data)
✅ Branch: dev
✅ NODE_ENV: development
```

### Production Environment:
```
✅ Dataset: adops_dashboard
✅ Row count: ~8,907 (real data)
✅ Branch: main
✅ NODE_ENV: production
```

## Next Steps

1. **Add the diagnostic endpoint** (code above)
2. **Deploy to dev branch**
3. **Call the endpoint** to verify dataset
4. **Check Render environment variables**
5. **Verify row counts match expectations**

If the diagnostic endpoint shows dev is using prod dataset, we need to fix the Render environment variables immediately!
