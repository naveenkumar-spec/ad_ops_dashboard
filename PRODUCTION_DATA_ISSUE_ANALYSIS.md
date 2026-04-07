# Production Data Issue Analysis

## Problem Identified

Production BigQuery has **10,840 rows** but recent syncs are only processing **1,933-2,969 rows**. This is causing data discrepancy.

## Root Cause

The system is running in **INCREMENTAL mode** which:
1. Does NOT truncate the table before inserting
2. APPENDS new data on each sync
3. Results in DUPLICATE data accumulating over time

## Evidence from Diagnostic

```
📊 Total rows: 10,840

🕐 Recent Sync History:
sync_1775577600009 | 2026-04-07T16:00:00.009Z | Rows: 1933 | Countries: 19
sync_1775574000010 | 2026-04-07T15:00:00.010Z | Rows: 2969 | Countries: 26
sync_1775572200214 | 2026-04-07T14:30:00.214Z | Rows: 2969 | Countries: 26
sync_1775570571395 | 2026-04-07T14:02:51.395Z | Rows: 2969 | Countries: 26

📝 Sync State History:
sync_1775577600009 | success | incremental | Rows: 1933
sync_1775574000010 | success | incremental | Rows: 2969
sync_1775572200214 | success | incremental | Rows: 2969
sync_1775570571395 | success | full_refresh | Rows: 18967  ← Last full refresh
```

## Why This Happened

1. **Incremental mode is the default** (`BIGQUERY_SYNC_FULL_REFRESH=false` in .env)
2. Incremental mode was designed to reduce resource usage
3. However, it doesn't handle data updates properly - it just keeps appending
4. This causes the same campaigns to appear multiple times with different sync_ids

## Impact

- Dashboard shows incorrect totals (inflated numbers due to duplicates)
- Campaign counts are wrong
- Historical data is duplicated across multiple sync_ids
- Production has 10,840 rows but should have ~2,969 rows (based on current data)

## Solution Options

### Option 1: Run Full Refresh (Recommended)
Trigger a manual full refresh to clean up production data:
- This will truncate the table and reload all data fresh
- Will remove all duplicates
- Should result in ~2,969 rows (current actual data)

### Option 2: Change Incremental Mode Logic
Modify the sync service to:
- Delete rows with old sync_ids before inserting new ones
- Use MERGE/UPSERT instead of INSERT
- This is more complex and requires code changes

### Option 3: Change Default to Full Refresh
Update production .env to use full refresh by default:
- Set `BIGQUERY_SYNC_FULL_REFRESH=true`
- This ensures clean data on every sync
- May use more resources but guarantees data accuracy

## Recommended Action

**Immediate:** Run a manual full refresh on production to clean up the data

**Long-term:** Consider changing the default sync mode to full refresh, or implement proper UPSERT logic for incremental syncs

## How to Fix Now

1. Go to production admin panel
2. Click "Manual Data Refresh"
3. Select "Full Refresh" option
4. This will truncate and reload all data cleanly

OR

Run this command on production backend:
```bash
# Trigger full refresh via API
curl -X POST https://your-production-backend.onrender.com/api/admin/sync \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{"fullRefresh": true}'
```
