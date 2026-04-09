# CRITICAL FIX: Incremental Sync DELETE Query Data Loss

## Problem
The hourly incremental sync was causing progressive data loss with each run. The number of campaigns and budget groups kept decreasing instead of staying stable or increasing.

## Root Cause
The DELETE query in the incremental sync (`recentOnly: true` mode) had a critical flaw:

### Original Broken Logic (Lines 806-813)
```javascript
await bigquery.query({
  query: `
    DELETE FROM \`${projectId}.${datasetId}.${tableId}\`
    WHERE year >= ${cutoffYear}
      AND month IN (${monthsToDelete.join(', ')})
  `,
  location: process.env.BIGQUERY_LOCATION || "US"
});
```

### Why This Was Wrong
The query used `year >= cutoffYear AND month IN (...)` which means:
- If cutoffYear = 2024 and monthsToDelete = ['February', 'March', 'April']
- It would delete February, March, April for year 2024 ✅
- BUT ALSO delete February, March, April for year 2025, 2026, 2027... ❌
- This deleted future data that shouldn't be touched!

### Example Scenario
- Current date: April 8, 2026
- Cutoff: 2 months ago = February 2026
- monthsToDelete: ['February', 'March', 'April']
- Broken query deletes: February/March/April for ALL years >= 2026
- This means it deletes data from 2026, 2027, 2028, etc. if they exist

## Solution
Changed the DELETE query to use specific year-month pairs:

### New Correct Logic
```javascript
// Build WHERE clause for specific year-month combinations
const deleteConditions = [];
for (let y = cutoffYear; y <= currentYear; y++) {
  const startMonth = (y === cutoffYear) ? cutoffMonth : 1;
  const endMonth = (y === currentYear) ? currentMonth : 12;
  
  const monthsForYear = [];
  for (let m = startMonth; m <= endMonth; m++) {
    monthsForYear.push(`'${monthNames[m - 1]}'`);
  }
  
  if (monthsForYear.length > 0) {
    deleteConditions.push(`(year = ${y} AND month IN (${monthsForYear.join(', ')}))`);
  }
}

const deleteQuery = `
  DELETE FROM \`${projectId}.${datasetId}.${tableId}\`
  WHERE ${deleteConditions.join(' OR ')}
`;
```

### Example Output
For cutoff = February 2026, current = April 2026:
```sql
DELETE FROM `project.dataset.table`
WHERE (year = 2026 AND month IN ('February', 'March', 'April'))
```

This ONLY deletes the specific months we're about to re-sync, not all future data!

## Impact

### Before Fix (Broken Behavior)
- Hourly sync deletes: All data for recent months across ALL years
- Result: Progressive data loss with each sync
- Campaigns/budget groups decrease over time
- Historical data gets wiped out

### After Fix (Correct Behavior)
- Hourly sync deletes: Only the specific 2 months being re-synced
- Result: Stable data, only recent months get refreshed
- Campaigns/budget groups stay stable or increase
- Historical data remains intact

## Incremental Sync Strategy

### Hourly Sync (Recent Only)
- Syncs last 2 months of data
- Deletes ONLY those 2 months (specific year-month pairs)
- Keeps all older data intact
- Fast and efficient

### Daily Sync (Full Refresh)
- Runs at 12:00 AM IST (6:30 PM UTC previous day)
- Full table truncate and reload
- Updates transition table
- Ensures data consistency

### Manual Sync
- Full refresh with all historical data
- Use when you need to rebuild everything

## Testing Recommendations

1. **Monitor row counts** - Should stay stable or increase, never decrease
2. **Check historical data** - Verify old months remain intact after hourly sync
3. **Verify recent data** - Confirm last 2 months are being updated correctly
4. **Watch for patterns** - If counts decrease, the DELETE query is still wrong

## Files Changed
- `backend/services/bigQuerySyncService.js` - Fixed DELETE query logic (lines 796-830)

## Deployment
- Committed to `dev` branch: `049d225`
- Pushed to GitHub
- Will deploy via Render dev service

## Next Steps
1. Deploy to dev environment
2. Wait for next hourly sync
3. Verify row counts remain stable
4. Monitor for 24 hours to confirm fix
5. If stable, merge to main for production

## Important Notes
- This fix prevents data loss but doesn't restore already-deleted data
- You may need to run a manual full refresh to restore historical data
- After deploying, monitor the first few hourly syncs closely
- The daily full refresh will ensure complete data consistency
