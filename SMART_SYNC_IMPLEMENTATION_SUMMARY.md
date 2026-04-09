# Smart Sync Strategy - Implementation Summary

## Problem Statement
After deploying the recent-only sync mode (last 2 months), historical data (Jan, Feb, etc.) was being deleted from BigQuery. The dashboard showed incomplete data because hourly syncs only refreshed March + April 2026.

## Solution Implemented
Smart sync strategy that automatically detects if this is the first sync after deployment and adjusts behavior:

### First Sync (After Deployment)
- Syncs ALL historical data from Google Sheets
- Populates BigQuery with complete dataset (Jan 2020 - April 2026)
- Mode: `first_sync`

### Subsequent Syncs (Hourly)
- Syncs ONLY last 2 months (current + previous)
- Preserves all historical data
- Mode: `recent_only`

## How It Works

### Detection Logic
```javascript
async function isFirstSyncNeeded() {
  // Check 1: Is table empty or has minimal data?
  const rowCount = await getTableRowCount();
  if (rowCount < 500) return true;
  
  // Check 2: Do we have historical data (>3 months old)?
  const oldDataCount = await getOldDataCount();
  if (oldDataCount === 0) return true;
  
  return false; // Historical data exists
}
```

### Scheduler Behavior
```javascript
// Every hour at :00 minutes
scheduledTask = cron.schedule("0 * * * *", async () => {
  const isFirstSync = await isFirstSyncNeeded();
  
  if (isFirstSync) {
    // Sync ALL data (complete history)
    await syncToBigQuery({ recentOnly: false });
  } else {
    // Sync recent 2 months only
    await syncToBigQuery({ recentOnly: true, monthsToSync: 2 });
  }
});
```

## Benefits

1. **Automatic Recovery**: System self-heals after data loss
2. **Performance**: Hourly syncs are fast (only 2 months)
3. **Data Preservation**: Historical data never deleted
4. **No Manual Intervention**: Works automatically

## Example Timeline

### After Deployment
```
Hour 0 (First Sync):
  - Detects: Table empty or no historical data
  - Action: Syncs ALL data (Jan 2020 - April 2026)
  - Result: 3,041 rows in BigQuery
  - Log: "🚀 FIRST SYNC DETECTED: Syncing ALL historical data"

Hour 1 (Subsequent Sync):
  - Detects: Historical data exists
  - Action: Syncs March + April 2026 only (914 rows)
  - Result: 3,041 rows (914 refreshed, 2,127 preserved)
  - Log: "📅 SUBSEQUENT SYNC: Syncing recent 2 months only"

Hour 2 (Subsequent Sync):
  - Same as Hour 1
  - Historical data remains intact
```

## Data Flow

### First Sync Mode
```
Google Sheets (ALL data)
    ↓
Filter: NONE (all months)
    ↓
BigQuery DELETE: TRUNCATE TABLE (fresh start)
    ↓
BigQuery INSERT: ALL rows (3,041 rows)
    ↓
Result: Complete historical dataset
```

### Recent-Only Mode
```
Google Sheets (ALL data)
    ↓
Filter: Last 2 months only (March + April 2026)
    ↓
BigQuery DELETE: Only March + April rows
    ↓
BigQuery INSERT: Only March + April rows (914 rows)
    ↓
Result: Recent data refreshed, historical data preserved
```

## Monitoring

### Check Sync Mode
```sql
SELECT sync_id, synced_at, status, mode, row_count, message
FROM `tactile-petal-820.adops_dashboard_dev.campaign_tracker_sync_state`
ORDER BY synced_at DESC
LIMIT 10
```

Expected modes:
- `first_sync` - Initial sync after deployment (should see once)
- `recent_only` - Normal hourly sync (should see every hour)

### Check Data Preservation
```sql
-- Should have data for all months (Jan 2020 - April 2026)
SELECT 
  year, 
  month, 
  COUNT(*) as row_count
FROM `tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated`
GROUP BY year, month
ORDER BY year DESC, 
  CASE month
    WHEN 'January' THEN 1
    WHEN 'February' THEN 2
    WHEN 'March' THEN 3
    WHEN 'April' THEN 4
    WHEN 'May' THEN 5
    WHEN 'June' THEN 6
    WHEN 'July' THEN 7
    WHEN 'August' THEN 8
    WHEN 'September' THEN 9
    WHEN 'October' THEN 10
    WHEN 'November' THEN 11
    WHEN 'December' THEN 12
  END DESC
```

### Check Logs (Render)
```
[isFirstSyncNeeded] Current table row count: X
[isFirstSyncNeeded] Old data (>3 months) row count: Y
[BigQuery Scheduler] 🚀 FIRST SYNC DETECTED / 📅 SUBSEQUENT SYNC
[BigQuery Sync] 🚀 FIRST SYNC / 📅 RECENT ONLY
```

## Files Modified

1. **backend/services/bigQueryScheduler.js**
   - Added smart sync detection logic
   - Calls `isFirstSyncNeeded()` before each sync
   - Adjusts sync options based on result

2. **backend/services/bigQuerySyncService.js**
   - Added `isFirstSyncNeeded()` function
   - Updated sync modes: `first_sync`, `recent_only`, `full_refresh`
   - Updated DELETE logic to handle first sync
   - Updated logging and status messages

3. **SMART_SYNC_STRATEGY.md**
   - Complete documentation of the strategy

## Testing Plan

### Step 1: Verify Current State
```sql
-- Check current row count
SELECT COUNT(*) FROM campaign_tracker_consolidated;

-- Check data distribution
SELECT year, month, COUNT(*) 
FROM campaign_tracker_consolidated
GROUP BY year, month
ORDER BY year DESC, month DESC;
```

### Step 2: Trigger First Sync (if needed)
If table is missing historical data:
```sql
-- Clear table to trigger first sync
TRUNCATE TABLE campaign_tracker_consolidated;
```

Wait for next hourly sync (at :00 minutes) and check logs for:
```
[BigQuery Scheduler] 🚀 FIRST SYNC DETECTED: Syncing ALL historical data
```

### Step 3: Verify First Sync Result
```sql
-- Should have ~3,041 rows (all historical data)
SELECT COUNT(*) FROM campaign_tracker_consolidated;

-- Should have data from Jan 2020 to April 2026
SELECT MIN(year), MAX(year), COUNT(DISTINCT month)
FROM campaign_tracker_consolidated;
```

### Step 4: Verify Subsequent Syncs
Wait for next hourly sync and check logs for:
```
[BigQuery Scheduler] 📅 SUBSEQUENT SYNC: Syncing recent 2 months only
```

Verify data preservation:
```sql
-- Row count should remain stable (~3,041)
SELECT COUNT(*) FROM campaign_tracker_consolidated;

-- Historical data should still exist
SELECT COUNT(*) FROM campaign_tracker_consolidated
WHERE year < 2026 OR (year = 2026 AND month NOT IN ('March', 'April'));
```

## Rollback Plan

If issues occur, revert to manual sync mode:

1. Disable automatic sync:
   ```env
   BIGQUERY_SYNC_ENABLED=false
   ```

2. Trigger manual full refresh via API:
   ```bash
   curl -X POST http://localhost:5000/api/overview/sync/bigquery \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"fullRefresh": true}'
   ```

3. Or revert code changes:
   ```bash
   git revert e82f7b9
   git push origin dev
   ```

## Next Steps

1. ✅ Code committed to dev branch
2. ✅ Pushed to GitHub
3. ⏳ Deploy to Render (dev environment)
4. ⏳ Monitor first sync (should sync all data)
5. ⏳ Monitor subsequent syncs (should sync recent 2 months only)
6. ⏳ Verify dashboard shows complete historical data
7. ⏳ Deploy to production after validation

## Expected Outcome

After deployment:
- First hourly sync: Restores ALL historical data (Jan 2020 - April 2026)
- Subsequent hourly syncs: Refresh only March + April 2026
- Dashboard: Shows complete historical data at all times
- Performance: Fast hourly syncs (only 2 months)
- Reliability: Automatic recovery from data loss

## Commit Details

**Branch**: dev  
**Commit**: e82f7b9  
**Message**: Implement smart sync strategy: first sync = full data, subsequent = recent-only

**Changes**:
- Added isFirstSyncNeeded() to detect if table is empty or lacks historical data
- First sync after deployment: syncs ALL historical data (all months)
- Subsequent hourly syncs: sync only last 2 months (preserves historical data)
- Automatic recovery: system self-heals after data loss
- Performance: hourly syncs are fast (only 2 months)
- Data preservation: historical data never deleted by hourly syncs
