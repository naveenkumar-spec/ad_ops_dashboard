# Production Data Fix Guide

## Problem Summary

Production BigQuery has **10,840 rows** with duplicates because:
1. Scheduler runs **incremental syncs** every hour (`fullRefresh: false`)
2. Incremental mode **APPENDS** data without removing old records
3. Same campaigns appear multiple times with different `sync_id` values
4. This inflates all dashboard metrics

## Current State

```
Total Rows: 10,840 (should be ~2,969)
Unique Campaigns: 598
Recent Syncs: 1,933-2,969 rows per sync (incremental mode)
Last Full Refresh: 18,967 rows (2026-04-07T14:02:51.395Z)
```

## Root Cause

**Scheduler Configuration** (backend/services/bigQueryScheduler.js):
```javascript
// Line 33: Hourly sync uses incremental mode
const result = await bigQuerySyncService.syncToBigQuery({
  fullRefresh: false, // ❌ This causes duplicates!
  forceRefresh: false,
  skipIfUnchanged: true,
  batchSize: 100
});
```

**What Happens:**
1. Hour 1: Insert 2,969 rows with sync_id_1
2. Hour 2: Insert 2,969 rows with sync_id_2 (duplicates!)
3. Hour 3: Insert 2,969 rows with sync_id_3 (more duplicates!)
4. Result: 8,907 rows (3x duplication)

## Solution Options

### Option 1: Fix Scheduler to Use Full Refresh (Recommended)

Change the hourly sync to use full refresh mode. This will:
- Truncate table before each sync
- Remove all duplicates
- Ensure clean data every hour
- Slightly higher resource usage but guarantees accuracy

**Change Required:**
```javascript
// backend/services/bigQueryScheduler.js, line 33
const result = await bigQuerySyncService.syncToBigQuery({
  fullRefresh: true, // ✅ Changed from false to true
  forceRefresh: false,
  skipIfUnchanged: true,
  batchSize: 100
});
```

### Option 2: Implement Proper UPSERT Logic

Modify incremental sync to:
- Delete rows with old sync_ids before inserting
- Use BigQuery MERGE statement
- More complex but more efficient

**Requires Code Changes:**
- Modify `syncToBigQuery()` function
- Add DELETE query before INSERT
- Test thoroughly

### Option 3: Keep Incremental, Clean Up Manually

Keep current setup but:
- Run full refresh manually when duplicates accumulate
- Schedule weekly full refresh
- Not recommended (band-aid solution)

## Recommended Fix (Option 1)

### Step 1: Clean Up Production Data Now

Run a manual full refresh to remove duplicates:

**Via Admin Panel:**
1. Login to production dashboard as admin
2. Go to Admin Setup page
3. Click "Manual Data Refresh"
4. Wait for sync to complete

**Via API:**
```bash
# Get admin token first (login)
curl -X POST https://adops-dashboard-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@silverpush.local","password":"Admin@123"}'

# Use token to trigger full refresh
curl -X POST "https://adops-dashboard-backend.onrender.com/api/overview/sync/bigquery?fullRefresh=true&async=true" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Step 2: Fix Scheduler Configuration

Update the scheduler to use full refresh mode:

```javascript
// backend/services/bigQueryScheduler.js
// Change line 33 from:
fullRefresh: false,
// To:
fullRefresh: true,
```

### Step 3: Deploy Fix

1. Commit changes to `dev` branch
2. Test on dev environment
3. Merge to `main` branch
4. Deploy to production

### Step 4: Verify Fix

After deployment, check:
1. Next scheduled sync should show full refresh mode
2. Row count should stabilize at ~2,969 rows
3. No more duplicates accumulating

## Alternative: Hybrid Approach

If full refresh every hour is too resource-intensive:

1. **Hourly:** Incremental sync (fast, low resource)
2. **Daily:** Full refresh at midnight (clean up duplicates)
3. **Manual:** Full refresh on demand

**Scheduler Changes:**
```javascript
// Hourly: Incremental (keep as is)
scheduledTask = cron.schedule(cronExpr, async () => {
  const result = await bigQuerySyncService.syncToBigQuery({
    fullRefresh: false, // Incremental for speed
    skipIfUnchanged: true
  });
});

// Daily: Full refresh at midnight
const cleanupTask = cron.schedule("0 0 * * *", async () => {
  console.log("[Scheduler] Daily cleanup: Full refresh");
  const result = await bigQuerySyncService.syncToBigQuery({
    fullRefresh: true, // Clean up duplicates
    forceRefresh: true
  });
});
```

## Testing Plan

### On Dev Environment

1. Check current row count
2. Run incremental sync 3 times
3. Verify duplicates appear
4. Apply fix (change to fullRefresh: true)
5. Run sync again
6. Verify duplicates are removed

### On Production

1. Run diagnostic script to document current state
2. Trigger manual full refresh
3. Wait for completion
4. Run diagnostic again to verify cleanup
5. Monitor next few scheduled syncs
6. Confirm row count stays stable

## Monitoring

After fix is deployed, monitor:
- Row count should stay around 2,969 (varies with actual data)
- No sudden jumps in row count
- Sync logs should show "full_refresh" mode
- Dashboard metrics should be accurate

## Rollback Plan

If issues occur:
1. Revert scheduler changes
2. Run manual full refresh to clean data
3. Investigate root cause
4. Test fix more thoroughly on dev

## Long-Term Recommendation

Consider implementing proper UPSERT logic:
- Use BigQuery MERGE statement
- Update existing rows instead of duplicating
- More efficient than full refresh
- Requires more development time

## Files to Modify

1. `backend/services/bigQueryScheduler.js` - Change fullRefresh flag
2. `backend/services/bigQuerySyncService.js` - (Optional) Add UPSERT logic

## Expected Outcome

After fix:
- Production row count: ~2,969 (actual current data)
- No duplicates
- Accurate dashboard metrics
- Stable row count over time
- Clean data on every sync
