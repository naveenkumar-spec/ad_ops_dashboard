# Render Dev Environment Verification Steps

## What We Just Added

1. **Startup Logging**: Server now shows which dataset it's using on startup
2. **Diagnostic Endpoint**: `/api/overview/debug/dataset-info` to verify dataset
3. **Warning System**: Alerts if wrong dataset is configured

## Step-by-Step Verification

### Step 1: Check Render Dev Service Logs

1. Go to: https://dashboard.render.com
2. Select service: `adops-dashboard-backend-dev`
3. Click "Logs" tab
4. Look for these lines in the startup logs:

```
📊 BigQuery Configuration:
   Environment: development
   Dataset: adops_dashboard_dev
   Expected: adops_dashboard_dev
   Status: ✅ CORRECT
```

**Expected Result**: Status should be "✅ CORRECT"

**If you see "❌ WRONG DATASET!"**:
- The dev service is using the wrong dataset
- Continue to Step 2 to fix it

### Step 2: Check Render Environment Variables

1. Still in Render dashboard
2. Select: `adops-dashboard-backend-dev`
3. Click "Environment" tab
4. Look for: `BIGQUERY_DATASET_ID`

**Expected Value**: `adops_dashboard_dev`

**If missing or wrong**:
1. Click "Add Environment Variable"
2. Key: `BIGQUERY_DATASET_ID`
3. Value: `adops_dashboard_dev`
4. Click "Save Changes"
5. Service will auto-redeploy

### Step 3: Verify with Diagnostic Endpoint

Once the service is deployed, call the diagnostic endpoint:

```bash
curl https://adops-dashboard-backend-dev.onrender.com/api/overview/debug/dataset-info \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response**:
```json
{
  "status": "✅ CORRECT",
  "environment": "development",
  "configuration": {
    "projectId": "tactile-petal-820",
    "datasetId": "adops_dashboard_dev",
    "tableId": "campaign_tracker_consolidated",
    "location": "US"
  },
  "datasetStats": {
    "dataset_id": "adops_dashboard_dev",
    "total_rows": 3012,
    "sync_count": 1,
    "last_sync": "2024-01-15T10:30:00.000Z",
    "campaign_count": 131,
    "country_count": 8
  },
  "expectedDataset": {
    "development": "adops_dashboard_dev",
    "production": "adops_dashboard",
    "current": "adops_dashboard_dev"
  },
  "isCorrect": true,
  "warning": null
}
```

**Key Fields to Check**:
- `status`: Should be "✅ CORRECT"
- `configuration.datasetId`: Should be "adops_dashboard_dev"
- `isCorrect`: Should be `true`
- `warning`: Should be `null`

**If Wrong**:
```json
{
  "status": "❌ WRONG DATASET",
  "environment": "development",
  "configuration": {
    "datasetId": "adops_dashboard"  ← WRONG!
  },
  "isCorrect": false,
  "warning": "⚠️ DEVELOPMENT environment is using adops_dashboard but should use adops_dashboard_dev!"
}
```

### Step 4: Compare with Production

For comparison, check production:

```bash
curl https://adops-dashboard-backend.onrender.com/api/overview/debug/dataset-info \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response**:
```json
{
  "status": "✅ CORRECT",
  "environment": "production",
  "configuration": {
    "datasetId": "adops_dashboard"  ← Different from dev
  },
  "datasetStats": {
    "total_rows": 8907  ← Different row count
  },
  "isCorrect": true
}
```

**Key Differences**:
- Dev: `adops_dashboard_dev` with ~3,012 rows
- Prod: `adops_dashboard` with ~8,907 rows

### Step 5: Verify Data Isolation

Check that dev and prod have different data:

**Dev Dataset Row Count**:
```bash
# Should show ~3,012 rows
curl https://adops-dashboard-backend-dev.onrender.com/api/overview/debug/dataset-info | grep total_rows
```

**Prod Dataset Row Count**:
```bash
# Should show ~8,907 rows
curl https://adops-dashboard-backend.onrender.com/api/overview/debug/dataset-info | grep total_rows
```

Different row counts = proper isolation ✅

## Common Issues and Fixes

### Issue 1: Dev Service Using Prod Dataset

**Symptom**:
```
Status: ❌ WRONG DATASET
Dataset: adops_dashboard (should be adops_dashboard_dev)
```

**Fix**:
1. Go to Render dashboard
2. Select `adops-dashboard-backend-dev`
3. Environment tab
4. Add/Update: `BIGQUERY_DATASET_ID=adops_dashboard_dev`
5. Save and wait for redeploy
6. Check logs again

### Issue 2: Environment Variable Not Set

**Symptom**:
```
Dataset: adops_dashboard (default fallback)
```

**Fix**:
The code defaults to `adops_dashboard` if `BIGQUERY_DATASET_ID` is not set.
Add the environment variable as shown above.

### Issue 3: Both Services Using Same Dataset

**Symptom**:
Dev and prod show identical row counts and data.

**Fix**:
1. Check BOTH services' environment variables
2. Dev should have: `BIGQUERY_DATASET_ID=adops_dashboard_dev`
3. Prod should have: `BIGQUERY_DATASET_ID=adops_dashboard`
4. Redeploy both if needed

### Issue 4: Can't Access Diagnostic Endpoint

**Symptom**:
```
403 Forbidden: Admin access required
```

**Fix**:
You need to be logged in as admin. Get your auth token:
1. Login to dashboard
2. Open browser console
3. Run: `localStorage.getItem('token')`
4. Use that token in the Authorization header

## Verification Checklist

After deployment, verify:

- [ ] Dev service logs show "✅ CORRECT" status
- [ ] Dev service uses `adops_dashboard_dev` dataset
- [ ] Prod service uses `adops_dashboard` dataset
- [ ] Dev and prod have different row counts
- [ ] Diagnostic endpoint returns correct info
- [ ] No warnings in startup logs

## Expected Configuration

### Development Service (`adops-dashboard-backend-dev`)

```
Branch: dev
Environment Variables:
  NODE_ENV: development
  BIGQUERY_DATASET_ID: adops_dashboard_dev
  DATA_SOURCE: bigquery
  
Expected Logs:
  📊 BigQuery Configuration:
     Environment: development
     Dataset: adops_dashboard_dev
     Status: ✅ CORRECT
```

### Production Service (`adops-dashboard-backend`)

```
Branch: main
Environment Variables:
  NODE_ENV: production
  BIGQUERY_DATASET_ID: adops_dashboard
  DATA_SOURCE: bigquery
  
Expected Logs:
  📊 BigQuery Configuration:
     Environment: production
     Dataset: adops_dashboard
     Status: ✅ CORRECT
```

## What to Do If Dev Is Using Prod Dataset

**IMMEDIATE ACTION REQUIRED**:

1. **Stop any syncs on dev** (they might write to prod dataset)
2. **Fix environment variable** on Render
3. **Redeploy dev service**
4. **Verify with diagnostic endpoint**
5. **Check BigQuery** to ensure no accidental writes to prod

**To check for accidental writes**:
```sql
-- Check recent syncs in prod dataset
SELECT 
  sync_id,
  synced_at,
  COUNT(*) as rows
FROM `tactile-petal-820.adops_dashboard.campaign_tracker_consolidated`
GROUP BY sync_id, synced_at
ORDER BY synced_at DESC
LIMIT 10
```

If you see unexpected recent syncs, they might be from dev.

## Summary

After following these steps, you should have:

1. ✅ Dev service using `adops_dashboard_dev`
2. ✅ Prod service using `adops_dashboard`
3. ✅ Startup logs showing correct dataset
4. ✅ Diagnostic endpoint confirming configuration
5. ✅ Different row counts proving isolation

If all checks pass, your dev environment is properly isolated from production! 🎉

## Next Steps

Once verified:
1. Test the cache refresh fix on dev
2. Trigger a manual sync
3. Verify cache refreshes
4. Check that dashboard shows updated data
5. Monitor for 24 hours
6. Merge to main when satisfied
