# Daily Sync Data Loss Fix

## Issue
After the 6:30 PM (18:30 UTC / 12:00 AM IST) scheduled sync, data dropped from 525 campaigns to 15 campaigns.

## Root Cause
The daily sync task was configured with:
- `fullRefresh: true` - Truncates entire table before inserting
- `forceRefresh: true` - Forces sync even if no changes
- `skipIfUnchanged: false` - Always runs
- **MISSING**: `recentOnly: false` - This was not explicitly set!

Without explicitly setting `recentOnly: false`, the sync service might have been using default behavior or inheriting the recent-only mode from the hourly sync, causing it to:
1. TRUNCATE the entire table (delete all 525 campaigns)
2. Only sync recent 2 months of data (15 campaigns)
3. Result: Data loss of 510 campaigns

## The Fix
Added explicit `recentOnly: false` to the daily sync configuration:

```javascript
const result = await bigQuerySyncService.syncToBigQuery({
  fullRefresh: true,      // Full refresh for transition table
  recentOnly: false,      // ✅ CRITICAL: Sync ALL data, not just recent
  forceRefresh: true,     // Force refresh for daily update
  skipIfUnchanged: false,
  batchSize: 100
});
```

## Sync Strategy Overview

### 1. Hourly Sync (Every Hour)
- Mode: `recentOnly: true, monthsToSync: 2`
- Purpose: Keep recent data fresh
- Behavior: Only syncs last 2 months, deletes and re-inserts recent data
- Impact: Fast, low resource usage
- Data: ~15-50 campaigns (recent only)

### 2. Daily Sync (6:30 PM UTC / 12:00 AM IST)
- Mode: `fullRefresh: true, recentOnly: false`
- Purpose: Full data refresh including historical data
- Behavior: TRUNCATES entire table, syncs ALL data from sheets
- Impact: Slower, higher resource usage
- Data: ALL campaigns (525+)

### 3. Manual Sync
- Mode: User-controlled via dashboard
- Purpose: On-demand full refresh
- Behavior: Same as daily sync
- Data: ALL campaigns

## Why This Happened
The scheduler has two separate tasks:
1. Hourly task: Uses `recentOnly: true` for performance
2. Daily task: Uses `fullRefresh: true` but didn't explicitly set `recentOnly: false`

The sync service defaults or inherits behavior when parameters are not explicitly set, which caused the daily sync to behave like a recent-only sync while truncating all data.

## Verification Steps

### 1. Check Logs After Next Daily Sync
Look for these log messages:
```
[BigQuery Scheduler] Starting daily transition table refresh (12:00 AM IST)...
[BigQuery Sync] 🗑️ FULL REFRESH: Truncating tables
[BigQuery Sync] ✅ FULL_REFRESH completed: 525 rows, X transition rows
```

### 2. Check Row Count
```sql
SELECT COUNT(*) as total_campaigns
FROM `tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated`
```
Should show 525+ campaigns after daily sync.

### 3. Check Sync Status API
```bash
curl http://localhost:5000/api/overview/sync/status
```
Look for:
- `mode: "full_refresh"`
- `rowCount: 525+`
- `recentOnly: false` (if exposed in status)

## Files Changed
- `backend/services/bigQueryScheduler.js` - Added `recentOnly: false` to daily sync

## Deployment
1. Commit changes to `dev` branch
2. Test locally to verify fix
3. Push to dev environment
4. Monitor next daily sync at 6:30 PM UTC
5. If successful, merge to `main` for production

## Prevention
- Always explicitly set `recentOnly` parameter in sync configurations
- Add validation to ensure `fullRefresh: true` with `recentOnly: true` logs a warning
- Consider adding a safety check in sync service to prevent accidental data loss
