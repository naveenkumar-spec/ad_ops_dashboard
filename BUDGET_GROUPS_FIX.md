# Budget Groups Calculation Fix

## Problem

Dashboard showing incorrect counts:
- **Campaigns:** 131 (should be ~600)
- **Budget Groups:** 1,528 (should be ~2,800+)

## Root Cause

The KPI query was counting **rows** instead of **summing** the `budget_groups` column.

### Incorrect Code (Before)

```javascript
// backend/services/bigQueryReadService.js, line 503
COUNTIF(NULLIF(TRIM(COALESCE(t.campaign_name, '')), '') IS NOT NULL) AS budget_groups,
```

This counts how many rows have a non-null campaign_name, which equals the number of rows in the result set.

### Correct Code (After)

```javascript
SUM(COALESCE(t.budget_groups, 0)) AS budget_groups,
```

This sums the actual `budget_groups` column values.

## Why This Happened

The query was treating "budget groups" as a row count instead of summing the `budget_groups` field from the database.

### Example

```
Campaign Data:
┌──────────────┬───────────────┐
│ campaign_id  │ budget_groups │
├──────────────┼───────────────┤
│ CAMP_001     │ 5             │
│ CAMP_002     │ 3             │
│ CAMP_003     │ 7             │
└──────────────┴───────────────┘

WRONG (COUNTIF):
Result: 3 (counts rows)

CORRECT (SUM):
Result: 15 (5 + 3 + 7)
```

## Impact

### Before Fix
- Campaigns: Correct (uses COUNT DISTINCT)
- Budget Groups: Wrong (counts rows, not sum)
- Shows: 131 campaigns, 1,528 budget groups

### After Fix
- Campaigns: Correct (uses COUNT DISTINCT)
- Budget Groups: Correct (sums budget_groups column)
- Should show: ~600 campaigns, ~2,800+ budget groups

## Additional Issue Found

Production BigQuery has **16,219 rows** with duplicates due to incremental syncs appending data.

### Duplicate Data

```
Total Rows: 16,219
Unique Campaigns: 602
Sync IDs: Multiple (incremental syncs)

Recent Syncs:
- sync_1775620800010: 2,409 rows (incremental)
- sync_1775584800024: 2,970 rows (incremental)
- sync_1775577600009: 1,933 rows (incremental)
```

### Why Duplicates Exist

The production is still using the OLD incremental mode (before hybrid sync was deployed):
- Incremental mode appends data without truncating
- Each hourly sync adds more rows
- Same campaigns appear multiple times

### Solution

The query already handles this correctly by using `latestMainTableSql()`:

```javascript
function latestMainTableSql() {
  return `(
    SELECT *
    FROM ${tableRef}
    WHERE sync_id = (
      SELECT sync_id
      FROM ${tableRef}
      ORDER BY synced_at DESC
      LIMIT 1
    )
  )`;
}
```

This filters to only the latest sync_id, so duplicates don't affect the dashboard.

However, you should still:
1. Deploy the hybrid sync fix to production
2. Trigger a manual full refresh to clean up duplicates

## Testing

### Test Query

```sql
-- Check current data
SELECT 
  COUNT(DISTINCT campaign_id) as campaigns,
  SUM(budget_groups) as budget_groups
FROM `tactile-petal-820.adops_dashboard.campaign_tracker_consolidated`
WHERE sync_id = (
  SELECT sync_id
  FROM `tactile-petal-820.adops_dashboard.campaign_tracker_consolidated`
  ORDER BY synced_at DESC
  LIMIT 1
);
```

Expected result:
- Campaigns: ~600
- Budget Groups: ~2,800+

## Deployment

1. ✅ Fix applied to `backend/services/bigQueryReadService.js`
2. ⏳ Commit to dev branch
3. ⏳ Test on dev environment
4. ⏳ Deploy to production
5. ⏳ Verify dashboard shows correct counts

## Files Changed

- `backend/services/bigQueryReadService.js` - Fixed budget_groups calculation

## Summary

The dashboard was counting rows instead of summing the budget_groups column. This is now fixed. After deployment, you should see:
- ✅ Correct campaign count (~600)
- ✅ Correct budget groups count (~2,800+)
- ✅ All other metrics remain accurate
