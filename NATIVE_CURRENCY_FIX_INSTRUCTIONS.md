# Native Currency Fix - Full Refresh Required

## Problem
After adding native currency columns to BigQuery, the existing data shows 0 values because:
1. Schema was updated to add `revenue_local`, `spend_local`, `gross_profit_local`, `net_margin_local` columns
2. Existing rows in BigQuery have NULL/0 for these new columns
3. Incremental sync only adds new rows, doesn't update existing data

## Solution: Run Full Refresh Sync

### Step 1: Trigger Full Refresh from Admin Panel
1. Go to Admin Setup page
2. Find the "BigQuery Sync" section
3. Click "Full Refresh" button (NOT "Manual Sync")
4. Wait for sync to complete

### Step 2: Verify the Sync
Check backend console for these logs:

```
[normalizeRow] Australia sample: {
  country: 'Australia',
  currencyCode: 'AUD',
  localToUsd: 0.69,
  revenueLocal: 1074186.04,  // ← Should be non-zero
  revenue: 741188.37,
  spendLocal: 850000,
  spend: 586500,
  ...
}
```

```
[toBigQueryRows] First row sample: {
  country: 'Australia',
  currencyCode: 'AUD',
  revenue: 741188.37,
  revenueLocal: 1074186.04,  // ← Should be non-zero
  spend: 586500,
  spendLocal: 850000,
  ...
}
```

### Step 3: Verify in Dashboard
1. Refresh the dashboard page
2. Toggle to "Native Currency"
3. Check Australia data in Campaign Wise table
4. Should show: ~1.07M AUD (not 741K)

## Why Full Refresh is Needed

### Incremental Sync (what you did)
- Only adds NEW rows to BigQuery
- Doesn't truncate existing data
- Faster but doesn't update schema-changed columns

### Full Refresh (what you need)
- Truncates ALL data in BigQuery
- Re-reads ALL data from Google Sheets
- Recalculates ALL values including native currency
- Repopulates BigQuery with complete data

## Alternative: Check if Full Refresh Was Already Done

If you're sure you ran a Full Refresh and still see 0s, check:

1. **Backend Console Logs**: Look for the `[normalizeRow] Australia sample:` log
   - If `revenueLocal` is 0 in the log → Problem is in Google Sheets parsing
   - If `revenueLocal` is correct in log → Problem is in BigQuery write or read

2. **BigQuery Console**: Run this query to check actual stored values:
```sql
SELECT 
  country,
  currency_code,
  revenue,
  revenue_local,
  spend,
  spend_local
FROM `your-project-id.adops_dashboard.campaign_tracker_consolidated`
WHERE country = 'Australia'
  AND sync_id = (
    SELECT sync_id 
    FROM `your-project-id.adops_dashboard.campaign_tracker_consolidated` 
    ORDER BY synced_at DESC 
    LIMIT 1
  )
LIMIT 5;
```

3. **Network Tab**: Check if frontend is sending `currencyMode=native`
   - Open DevTools → Network tab
   - Toggle to Native Currency
   - Look for `/api/overview/campaign-wise` request
   - Check Query String Parameters for `currencyMode=native`

## Expected Results After Full Refresh

### Australia Data (Example)
- **USD Mode**: Revenue = 741K, Spend = 587K
- **Native Mode**: Revenue = 1.07M AUD, Spend = 850K AUD

### Backend Logs
```
[BigQuery Sync] 🗑️ FULL REFRESH: Truncating tables
[BigQuery Sync] ✅ FULL REFRESH completed: 1234 rows, 567 transition rows
```

### Frontend Display
- Native Currency toggle ON → Shows AUD values
- Native Currency toggle OFF → Shows USD values
- No more 0 values for Australia

## If Problem Persists

If after Full Refresh you still see 0 values:

1. Share the backend console output (especially `[normalizeRow] Australia sample:` log)
2. Share the BigQuery query results
3. Share the Network tab screenshot showing the API request parameters

This will help identify if the issue is in:
- Data parsing from Google Sheets
- Data writing to BigQuery
- Data reading from BigQuery
- Frontend parameter passing
