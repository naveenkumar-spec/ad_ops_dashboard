# Smart Sync Strategy Implementation

## Overview
Implemented intelligent sync strategy that automatically detects if this is the first sync after deployment and adjusts behavior accordingly.

## Strategy

### First Sync (After Deployment)
- **Detection**: Table is empty OR has < 500 rows OR no data older than 3 months
- **Behavior**: Syncs ALL historical data from Google Sheets
- **Mode**: `first_sync`
- **Options**: `{ fullRefresh: false, recentOnly: false }`
- **Result**: Complete historical dataset in BigQuery

### Subsequent Syncs (Hourly)
- **Detection**: Table has data AND historical data exists (>3 months old)
- **Behavior**: Syncs ONLY last 2 months (current + previous month)
- **Mode**: `recent_only`
- **Options**: `{ fullRefresh: false, recentOnly: true, monthsToSync: 2 }`
- **Result**: Recent data refreshed, historical data preserved

## Implementation Details

### 1. Detection Function (`isFirstSyncNeeded`)
Located in: `backend/services/bigQuerySyncService.js`

```javascript
async function isFirstSyncNeeded() {
  // Check 1: Is table empty or has minimal data?
  const rowCount = await getTableRowCount();
  if (rowCount < 500) return true;
  
  // Check 2: Do we have historical data (>3 months old)?
  const oldDataCount = await getOldDataCount();
  if (oldDataCount === 0) return true;
  
  // Historical data exists - use recent-only mode
  return false;
}
```

### 2. Scheduler Integration
Located in: `backend/services/bigQueryScheduler.js`

```javascript
scheduledTask = cron.schedule(cronExpr, async () => {
  const isFirstSync = await bigQuerySyncService.isFirstSyncNeeded();
  
  if (isFirstSync) {
    // Sync ALL data
    await syncToBigQuery({ recentOnly: false });
  } else {
    // Sync recent 2 months only
    await syncToBigQuery({ recentOnly: true, monthsToSync: 2 });
  }
});
```

### 3. Sync Modes

#### First Sync Mode
- **DELETE**: Truncates entire table (fresh start)
- **INSERT**: All rows from Google Sheets (complete history)
- **Log**: "🚀 FIRST SYNC: Syncing ALL X rows (complete historical data)"

#### Recent-Only Mode
- **DELETE**: Only deletes rows for months being synced (e.g., March + April 2026)
- **INSERT**: Only rows from last 2 months
- **Log**: "📅 RECENT ONLY: Syncing last 2 months: March 2026, April 2026"
- **Preservation**: All other months remain untouched

## Benefits

1. **Automatic Recovery**: After data loss, first sync automatically restores all historical data
2. **Performance**: Hourly syncs are fast (only 2 months of data)
3. **Data Preservation**: Historical data is never deleted by hourly syncs
4. **No Manual Intervention**: System self-heals after deployment or data issues

## Example Scenarios

### Scenario 1: Fresh Deployment
```
Hour 0: isFirstSyncNeeded() → true (table empty)
        → Syncs ALL data (Jan 2020 - April 2026)
        → BigQuery: 3,041 rows

Hour 1: isFirstSyncNeeded() → false (historical data exists)
        → Syncs recent 2 months (March + April 2026)
        → BigQuery: 3,041 rows (914 refreshed, 2,127 preserved)

Hour 2: isFirstSyncNeeded() → false
        → Syncs recent 2 months
        → BigQuery: 3,041 rows (914 refreshed, 2,127 preserved)
```

### Scenario 2: After Data Loss
```
Before: BigQuery has 3,041 rows (all historical data)
Event:  Manual DELETE or data corruption
After:  BigQuery has 0 rows

Hour 0: isFirstSyncNeeded() → true (table empty)
        → Syncs ALL data
        → BigQuery: 3,041 rows (RESTORED)

Hour 1: isFirstSyncNeeded() → false
        → Syncs recent 2 months
        → Normal operation resumed
```

### Scenario 3: Normal Operation
```
Hour 0: isFirstSyncNeeded() → false
        → Syncs March + April 2026 (914 rows)
        → Deletes old March + April data
        → Inserts new March + April data
        → Jan 2020 - Feb 2026 untouched (2,127 rows)

Hour 1: isFirstSyncNeeded() → false
        → Same behavior
```

## Configuration

### Environment Variables
- `BIGQUERY_SYNC_CRON=0 * * * *` - Hourly sync at :00 minutes
- `BIGQUERY_SYNC_ENABLED=true` - Enable automatic syncs

### Thresholds
- **Minimal data threshold**: 500 rows
- **Historical data check**: 3 months ago
- **Recent sync window**: 2 months (current + previous)

## Monitoring

### Logs to Watch
```
[isFirstSyncNeeded] Current table row count: X
[isFirstSyncNeeded] Old data (>3 months) row count: Y
[isFirstSyncNeeded] FIRST SYNC NEEDED / SUBSEQUENT SYNC

[BigQuery Scheduler] 🚀 FIRST SYNC DETECTED: Syncing ALL historical data
[BigQuery Scheduler] 📅 SUBSEQUENT SYNC: Syncing recent 2 months only

[BigQuery Sync] 🚀 FIRST SYNC: Syncing ALL X rows (complete historical data)
[BigQuery Sync] 📅 RECENT ONLY: Syncing last 2 months: March 2026, April 2026
```

### BigQuery State Table
```sql
SELECT sync_id, synced_at, status, mode, row_count, message
FROM `tactile-petal-820.adops_dashboard_dev.campaign_tracker_sync_state`
ORDER BY synced_at DESC
LIMIT 10
```

Expected modes:
- `first_sync` - Initial sync after deployment
- `recent_only` - Normal hourly sync
- `full_refresh` - Manual full refresh (includes transition table)

## Testing

### Test First Sync Detection
```javascript
// Simulate empty table
await bigquery.query(`TRUNCATE TABLE campaign_tracker_consolidated`);

// Next hourly sync will detect first sync needed
// Check logs for: "🚀 FIRST SYNC DETECTED"
```

### Test Recent-Only Mode
```javascript
// After first sync completes, wait for next hour
// Check logs for: "📅 SUBSEQUENT SYNC: Syncing recent 2 months only"
```

## Rollback Plan

If issues occur, revert to previous behavior:

```javascript
// In bigQueryScheduler.js, replace smart logic with:
const result = await bigQuerySyncService.syncToBigQuery({
  fullRefresh: false,
  recentOnly: true,
  monthsToSync: 2
});
```

## Next Steps

1. ✅ Deploy to dev environment
2. ⏳ Monitor first sync (should sync all data)
3. ⏳ Monitor subsequent syncs (should sync recent 2 months only)
4. ⏳ Verify historical data preservation
5. ⏳ Deploy to production after validation

## Files Modified

1. `backend/services/bigQueryScheduler.js` - Smart sync detection
2. `backend/services/bigQuerySyncService.js` - Added `isFirstSyncNeeded()` function
3. `backend/services/bigQuerySyncService.js` - Updated sync modes and DELETE logic
