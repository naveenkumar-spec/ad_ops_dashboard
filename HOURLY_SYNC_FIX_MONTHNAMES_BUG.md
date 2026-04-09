# Hourly Sync Fix - monthNames Initialization Bug

## Problem

Hourly BigQuery syncs were failing with error:
```
Cannot access 'monthNames' before initialization
```

All sync attempts showed status = "failed" in BigQuery sync state table.

## Root Cause

In `backend/services/bigQuerySyncService.js`, the `monthNames` array was declared AFTER it was used:

```javascript
// Line 757 - USING monthNames (ERROR!)
monthsToInclude.push({
  month: monthNames[date.getMonth()],  // ❌ monthNames not defined yet
  year: date.getFullYear()
});

// Line 767 - DECLARING monthNames (TOO LATE!)
const monthNames = ['January', 'February', ...];
```

This is a JavaScript **Temporal Dead Zone** error - you cannot access a `const` variable before its declaration.

## Solution

Moved the `monthNames` declaration to the TOP of the block, before it's used:

```javascript
// CORRECT ORDER:
const monthNames = ['January', 'February', ...];  // ✅ Declare first

monthsToInclude.push({
  month: monthNames[date.getMonth()],  // ✅ Now it works
  year: date.getFullYear()
});
```

## How This Bug Was Introduced

This bug was introduced when I implemented the recent-only sync mode fix. I accidentally placed the `monthNames` declaration after the loop that uses it.

## Impact

- ❌ All hourly syncs failing since deployment
- ❌ Dashboard showing stale data (last successful sync: 6:50 PM IST)
- ❌ No data updates for 3+ hours

## Fix Applied

**File:** `backend/services/bigQuerySyncService.js`

**Change:** Moved `monthNames` array declaration from line 767 to line 750 (before the loop)

## Testing

After deploying this fix:

1. Wait for next hourly sync (at :00 minutes of next hour)
2. Check Render logs for: `[BigQuery Scheduler] Recent sync success`
3. Check BigQuery sync state table - status should be "success"
4. Dashboard should show updated "Last data sync" time

## Verification Query

Check if syncs are now succeeding:

```sql
SELECT 
  sync_id,
  synced_at,
  status,
  mode,
  row_count,
  message
FROM `tactile-petal-820.adops_dashboard_dev.campaign_tracker_sync_state`
WHERE synced_at > TIMESTAMP('2026-04-09 17:00:00')
ORDER BY synced_at DESC
LIMIT 5
```

Expected: Recent syncs should have `status = 'success'`

## Files Modified

- `backend/services/bigQuerySyncService.js` - Fixed monthNames initialization order

## Deployment Steps

1. Commit the fix
2. Push to repository
3. Render will auto-deploy
4. Wait for deployment to complete
5. Wait for next hourly sync (at :00 minutes)
6. Verify sync succeeds

## Prevention

To prevent similar issues in the future:
1. Use ESLint with `no-use-before-define` rule
2. Run tests before deploying
3. Monitor sync status after deployment
4. Set up alerts for failed syncs

## Related Issues

This fix also addresses:
- Historical data preservation (syncs only last 2 months)
- No data accumulation (deletes old sync_ids properly)
- User cache TTL increased to 1 hour (prevents login errors)
