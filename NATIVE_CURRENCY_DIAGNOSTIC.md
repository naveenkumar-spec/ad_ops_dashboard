# Native Currency Diagnostic Steps

## Issue
After manual sync, native currency values show as 0 for Australia in the dashboard when Native Currency toggle is on.

## Root Cause Analysis

### Data Flow
1. **Google Sheets** → `normalizeRow()` → calculates both USD and native values
2. **normalizeRow()** → `toBigQueryRows()` → maps to BigQuery columns
3. **BigQuery** → `getCampaignWiseTable()` → selects appropriate columns based on currencyMode
4. **Frontend** → displays the values

### Potential Issues

#### Issue 1: BigQuery columns not populated
The `revenue_local`, `spend_local`, `gross_profit_local`, `net_margin_local` columns might be 0 in BigQuery.

**Check**: Run this query in BigQuery console:
```sql
SELECT 
  country,
  currency_code,
  revenue,
  revenue_local,
  spend,
  spend_local,
  gross_profit,
  gross_profit_local,
  net_margin,
  net_margin_local
FROM `your-project.adops_dashboard.campaign_tracker_consolidated`
WHERE country = 'Australia'
  AND sync_id = (SELECT sync_id FROM `your-project.adops_dashboard.campaign_tracker_consolidated` ORDER BY synced_at DESC LIMIT 1)
LIMIT 5;
```

#### Issue 2: Frontend not passing currencyMode correctly
The frontend might not be sending `currencyMode=native` in the API request.

**Check**: Open browser DevTools → Network tab → filter for `/api/overview/campaign-wise` → check Query String Parameters

#### Issue 3: Backend logging shows wrong currencyMode
The backend log shows `currencyMode: usd` even when Native toggle is on.

**Check**: Look at backend console output when you toggle to Native Currency

## Diagnostic Steps

### Step 1: Check if normalizeRow is calculating local values correctly
Look for this log in backend console after manual sync:
```
[normalizeRow] Australia sample: { country, currencyCode, localToUsd, revenueLocal, revenue, ... }
```

Expected values for Australia:
- `currencyCode`: "AUD"
- `localToUsd`: 0.69
- `revenueLocal`: ~1,074,186 (native AUD value)
- `revenue`: ~741,188 (USD value = revenueLocal * 0.69)

### Step 2: Check if toBigQueryRows is mapping correctly
Look for this log in backend console after manual sync:
```
[toBigQueryRows] First row sample: { country, currencyCode, revenue, revenueLocal, ... }
```

### Step 3: Check BigQuery data
Run the SQL query above in BigQuery console to see actual stored values.

### Step 4: Check frontend API call
1. Open dashboard
2. Toggle to Native Currency
3. Open DevTools → Network tab
4. Look for `/api/overview/campaign-wise` request
5. Check if `currencyMode=native` is in the query parameters

### Step 5: Check backend query
Look for this log in backend console when loading Campaign Wise table:
```
[getCampaignWiseTable] currencyMode: native, cols: { revenue: 'revenue_local', spend: 'spend_local', ... }
```

## Expected Behavior

When Native Currency toggle is ON:
- Frontend sends: `currencyMode=native`
- Backend selects: `revenue_local`, `spend_local`, `gross_profit_local`, `net_margin_local`
- Display shows: 1.07M AUD (not 741K USD)

When Native Currency toggle is OFF:
- Frontend sends: `currencyMode=usd`
- Backend selects: `revenue`, `spend`, `gross_profit`, `net_margin`
- Display shows: 741K USD

## Next Steps

1. Run manual sync from Admin Panel
2. Check backend console for `[normalizeRow] Australia sample:` log
3. Check backend console for `[toBigQueryRows] First row sample:` log
4. Run BigQuery diagnostic query
5. Toggle Native Currency in dashboard
6. Check Network tab for `currencyMode` parameter
7. Check backend console for `[getCampaignWiseTable] currencyMode:` log

Report findings to determine where the data is being lost.
