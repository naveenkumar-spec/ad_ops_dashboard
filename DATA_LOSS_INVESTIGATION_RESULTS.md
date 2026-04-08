# Data Loss Investigation Results

## Current State

### Production Dataset (`adops_dashboard`)
- Total rows: 16,219
- Unique campaigns: 602
- Last sync at 6:30 PM (18:00 UTC): 2,970 rows (incremental mode)
- Issue: Daily sync is not syncing all data

### Development Dataset (`adops_dashboard_dev`)
- Total rows: 3,011
- Unique campaigns: 627
- Last sync: 3,011 rows (but read 19,009 rows from sheets)
- Issue: Recent-only filtering is active even in full refresh mode

## Root Cause Confirmed

The sync service has a logic issue where `recentOnly` filtering is applied even when not explicitly set to `false`. Looking at the sync state history:

```
sync_1775653523429 | full_refresh | Rows: 19009 | Sync completed (optimized)
```

The state table shows 19,009 rows were read from sheets, but only 3,011 rows ended up in BigQuery. This means:

1. ✅ Sheets are being read correctly (19,009 rows)
2. ❌ Recent-only filtering is being applied (reducing to 3,011 rows)
3. ❌ Full refresh truncates all data, then inserts only recent data
4. ❌ Result: Data loss

## The Fix Applied

Added explicit `recentOnly: false` to the daily sync configuration in `bigQueryScheduler.js`:

```javascript
const result = await bigQuerySyncService.syncToBigQuery({
  fullRefresh: true,     // Truncate entire table
  recentOnly: false,     // ✅ CRITICAL: Sync ALL data, not just recent
  forceRefresh: true,    // Force refresh for daily update
  skipIfUnchanged: false,
  batchSize: 100
});
```

## Expected Behavior After Fix

### Hourly Sync (Every Hour)
- Mode: `recentOnly: true, monthsToSync: 2`
- Reads: ~19,000 rows from sheets
- Filters: Only last 2 months (~1,500 rows)
- Deletes: Only recent data from BigQuery
- Inserts: ~1,500 rows
- Result: Fast, efficient, keeps historical data intact

### Daily Sync (6:30 PM UTC / 12:00 AM IST)
- Mode: `fullRefresh: true, recentOnly: false`
- Reads: ~19,000 rows from sheets
- Filters: NONE (all data)
- Deletes: TRUNCATE entire table
- Inserts: ALL ~19,000 rows
- Result: Complete data refresh, no data loss

## Verification Steps

### 1. Check Logs After Next Daily Sync
Look for these log messages:
```
[BigQuery Scheduler] Starting daily transition table refresh (12:00 AM IST)...
[BigQuery Sync] 🗑️ FULL REFRESH: Truncating tables
[BigQuery Sync] ✅ FULL_REFRESH completed: 19000+ rows, X transition rows
```

### 2. Check Row Count in BigQuery
```sql
-- Dev dataset
SELECT COUNT(*) as total, COUNT(DISTINCT campaign_id) as campaigns
FROM `tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated`

-- Expected: ~19,000 rows, 627 campaigns
```

### 3. Check Sync State Table
```sql
SELECT sync_id, synced_at, status, mode, row_count, message
FROM `tactile-petal-820.adops_dashboard_dev.campaign_tracker_sync_state`
WHERE mode = 'full_refresh'
ORDER BY synced_at DESC
LIMIT 5
```

Look for:
- `mode: "full_refresh"`
- `row_count: 19000+`
- `message: "Sync completed (optimized)"`

### 4. Monitor Dashboard
- Check KPI cards show correct campaign count (627)
- Check all countries have data
- Check historical data is present

## Timeline

1. ✅ **Now**: Fix committed to dev branch
2. ✅ **Now**: Fix pushed to GitHub
3. ⏳ **Next**: Deploy to dev environment (Render auto-deploys from dev branch)
4. ⏳ **6:30 PM UTC Today**: Monitor daily sync
5. ⏳ **After Daily Sync**: Verify row count is ~19,000
6. ⏳ **If Successful**: Merge to main for production

## Deployment Status

- ✅ Committed to dev branch: `b728553`
- ✅ Pushed to GitHub: `dev` branch
- ⏳ Render dev environment: Will auto-deploy from dev branch
- ⏳ Production: Pending verification in dev

## Files Changed

1. `backend/services/bigQueryScheduler.js` - Added `recentOnly: false` to daily sync
2. `DAILY_SYNC_DATA_LOSS_FIX.md` - Detailed fix documentation
3. `SYNC_FIX_SUMMARY.md` - Quick summary
4. `DATA_LOSS_INVESTIGATION_RESULTS.md` - This file

## Next Actions

1. Wait for Render to deploy the fix to dev environment
2. Monitor the next daily sync at 6:30 PM UTC (12:00 AM IST)
3. Run diagnostic script after sync: `node backend/scripts/diagnoseDevData.js`
4. If successful, merge to main for production deployment
5. Monitor production daily sync the following day

## Manual Sync Option

If you want to test the fix immediately without waiting for the scheduled sync:

1. Go to dashboard: http://localhost:5000 (or dev URL)
2. Navigate to sync management page
3. Click "Manual Sync" button
4. Check logs and row count

Or via API:
```bash
curl -X POST http://localhost:5000/api/overview/sync/start \
  -H "Content-Type: application/json" \
  -d '{"fullRefresh": true, "recentOnly": false}'
```
