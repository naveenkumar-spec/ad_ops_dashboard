# Deployment Checklist - Hybrid Sync Strategy

## ✅ Already Done (In Dev Branch)

1. ✅ Implemented hybrid sync strategy
2. ✅ Updated sync service with recent-only mode
3. ✅ Updated scheduler to use recent-only for hourly syncs
4. ✅ Updated admin endpoint to support both modes
5. ✅ Committed to dev branch
6. ✅ Pushed to GitHub

## Current Status

**Branch:** `dev`
**Latest Commit:** `7259e90 - Implement hybrid sync strategy`

**Changes:**
- `backend/services/bigQuerySyncService.js` - Added recent-only logic
- `backend/services/bigQueryScheduler.js` - Hourly sync uses recent-only
- `backend/routes/overview.js` - Admin endpoint supports both modes

## What's Active in Dev

### Hourly Automatic Sync
```javascript
{
  fullRefresh: false,
  recentOnly: true,      // ✅ Only sync last 2 months
  monthsToSync: 2,
  skipIfUnchanged: true
}
```

### Manual Admin Sync
```javascript
{
  fullRefresh: true,     // ✅ Full refresh by default
  recentOnly: false,
  skipIfUnchanged: false
}
```

## Testing on Dev Environment

### 1. Test Automatic Sync

The dev backend should already be running with the new code. Check logs:

```bash
# Check Render dev backend logs
# Look for:
[BigQuery Scheduler] Starting scheduled sync (recent 2 months only)...
[BigQuery Sync] 📅 RECENT ONLY: XXX rows (last 2 months, cutoff: YYYY-MM-DD)
[BigQuery Sync] 📊 Filtered out XXX older rows
```

### 2. Test Manual Full Refresh

Via dev admin panel:
1. Go to: https://ad-ops-dashboard-git-dev-[...].vercel.app/admin-setup
2. Login as admin
3. Click "Manual Data Refresh"
4. Should see full refresh logs

Or via API:
```bash
# Get token
curl -X POST https://adops-dashboard-backend-dev.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@silverpush.local","password":"Admin@123"}'

# Trigger full refresh
curl -X POST "https://adops-dashboard-backend-dev.onrender.com/api/overview/sync/bigquery?fullRefresh=true&async=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Verify Data

Check BigQuery dev dataset:
```sql
-- Check recent syncs
SELECT 
  sync_id,
  synced_at,
  COUNT(*) as row_count,
  MIN(start_date) as oldest_campaign,
  MAX(start_date) as newest_campaign
FROM `tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated`
GROUP BY sync_id, synced_at
ORDER BY synced_at DESC
LIMIT 5;
```

Expected:
- Recent-only syncs: ~800 rows
- Full refresh syncs: ~2,969 rows

## Production Deployment Steps

### Step 1: Clean Production Data First

**IMPORTANT:** Production currently has duplicates (10,840 rows). Clean it first:

```bash
# Option A: Via Admin Panel (Easiest)
1. Go to: https://ad-ops-dashboard.vercel.app/admin-setup
2. Login as admin
3. Click "Manual Data Refresh"
4. Wait for completion

# Option B: Via API
curl -X POST "https://adops-dashboard-backend.onrender.com/api/overview/sync/bigquery?fullRefresh=true&async=true" \
  -H "Authorization: Bearer YOUR_PROD_TOKEN"
```

This will:
- Truncate production table
- Remove all duplicates
- Insert clean data (~2,969 rows)

### Step 2: Merge Dev to Main

```bash
# Switch to main branch
git checkout main

# Merge dev branch
git merge dev

# Push to GitHub
git push origin main
```

### Step 3: Deploy to Production

**Render Backend:**
- Automatically deploys from `main` branch
- Wait for deployment to complete
- Check logs for new sync behavior

**Vercel Frontend:**
- Automatically deploys from `main` branch
- No changes needed (backend handles sync)

### Step 4: Verify Production

After deployment, check:

1. **Render Logs:**
```
[BigQuery Scheduler] Starting scheduled sync (recent 2 months only)...
[BigQuery Sync] RECENT ONLY: XXX rows (last 2 months)
```

2. **BigQuery Production:**
```sql
SELECT 
  sync_id,
  synced_at,
  COUNT(*) as row_count
FROM `tactile-petal-820.adops_dashboard.campaign_tracker_consolidated`
GROUP BY sync_id, synced_at
ORDER BY synced_at DESC
LIMIT 5;
```

Expected:
- Total rows: ~2,969 (after cleanup)
- Recent syncs: ~800 rows each
- No more duplicates accumulating

3. **Dashboard:**
- Open production dashboard
- Check metrics are accurate
- Verify no inflated numbers

## Rollback Plan

If issues occur in production:

### Quick Rollback (Revert Commit)

```bash
# On main branch
git revert 7259e90

# Push to GitHub
git push origin main
```

This will:
- Revert to previous full refresh mode
- Render auto-deploys
- Back to known working state

### Manual Rollback (Edit Scheduler)

If you need immediate rollback without deployment:

1. Go to Render dashboard
2. Open Shell for backend service
3. Edit scheduler temporarily:
```bash
# This is temporary until next deployment
sed -i 's/recentOnly: true/recentOnly: false/g' services/bigQueryScheduler.js
sed -i 's/fullRefresh: false/fullRefresh: true/g' services/bigQueryScheduler.js
pm2 restart all
```

## Monitoring After Deployment

### First 24 Hours

Watch for:
- ✅ Hourly syncs completing successfully
- ✅ Row counts staying stable (~2,969 total)
- ✅ Recent syncs processing ~800 rows
- ✅ No error logs
- ✅ Dashboard loading fast

### First Week

Monitor:
- ✅ No duplicates accumulating
- ✅ Historical data preserved
- ✅ Manual full refresh works
- ✅ Performance improvement visible

### Metrics to Track

```
Sync Performance:
- Before: 4-6 seconds per hourly sync
- After: 3-5 seconds per hourly sync
- Improvement: 20-30% faster

Data Integrity:
- Before: 10,840 rows (duplicates)
- After: ~2,969 rows (clean)
- Improvement: Accurate data

Dashboard Speed:
- Before: 50-200ms (cache hit)
- After: 50-200ms (cache hit)
- Impact: No change (as expected)
```

## Success Criteria

✅ Hourly syncs complete in 3-5 seconds
✅ Row count stays around 2,969
✅ No duplicates accumulating
✅ Historical data preserved
✅ Manual full refresh works
✅ Dashboard remains fast
✅ No errors in logs

## Support

If issues arise:
1. Check Render logs for errors
2. Run diagnostic script: `node backend/scripts/diagnoseProdData.js`
3. Trigger manual full refresh if needed
4. Rollback if critical issues

## Documentation

Created:
- ✅ `HYBRID_SYNC_STRATEGY.md` - Strategy explanation
- ✅ `HYBRID_SYNC_IMPLEMENTATION.md` - Implementation details
- ✅ `INCREMENTAL_SYNC_FEASIBILITY.md` - Why true incremental doesn't work
- ✅ `SYNC_MODE_RECOMMENDATION.md` - Why hybrid is best
- ✅ `DEPLOYMENT_CHECKLIST.md` - This file

## Timeline

- **Now:** Changes in dev branch, ready to test
- **Today:** Test on dev environment
- **Today:** Clean production data (manual full refresh)
- **Today/Tomorrow:** Deploy to production (merge dev to main)
- **This Week:** Monitor and verify

## Quick Commands

```bash
# Test on dev
curl -X GET "https://adops-dashboard-backend-dev.onrender.com/api/overview/sync/bigquery/status"

# Clean production
curl -X POST "https://adops-dashboard-backend.onrender.com/api/overview/sync/bigquery?fullRefresh=true&async=true" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Deploy to production
git checkout main
git merge dev
git push origin main

# Check production status
curl -X GET "https://adops-dashboard-backend.onrender.com/api/overview/sync/bigquery/status"
```

---

## Summary

✅ **Implementation:** Complete in dev branch
⏳ **Testing:** Test on dev environment
⏳ **Production Cleanup:** Trigger manual full refresh
⏳ **Deployment:** Merge dev to main
⏳ **Verification:** Monitor first 24 hours

Everything is ready to go! 🚀
