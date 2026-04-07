# Japan Zero Values Issue - Root Cause and Fix

## Problem Summary
Japan campaigns show in BigQuery with correct campaign names but ALL financial values are 0:
- revenue: 0.0
- spend: 0.0
- net_margin: 0.0
- gross_profit: 0.0

But Google Sheets has real values (e.g., $555,378 revenue for Microsoft_Skippable 15s).

## Root Cause
The sync is reading campaign names correctly but NOT reading the Revenue and Spend column values. This suggests:

1. **Column Header Mismatch**: The actual column headers in the Japan sheet don't match the expected aliases
2. **Column Position Issue**: The Revenue/Spend columns might be in different positions
3. **Data Format Issue**: The values might be formatted in a way that parseNumber() returns 0

## Expected Column Headers
The code expects these exact column names (case-insensitive):
- Revenue: `["Revenue"]`![alt text](image.png)
- Spend: `["Spends"]` (note the 'S' at the end)

## Debug Changes Made
Added logging to `backend/services/privateSheetsService.js`:

1. Log Japan sheet headers when parsing
2. Log Revenue and Spends column indices
3. Log when Japan campaigns have zero values with raw cell values

## Next Steps

### Step 1: Check Backend Logs
After deploying the debug changes, trigger a sync and check backend logs for:

```
[parseSheetData] Japan sheet headers: [...]
[parseSheetData] Revenue column index: X
[parseSheetData] Spends column index: Y
[normalizeRow] Japan campaign with zero values: {...}
```

### Step 2: Verify Column Headers in Google Sheets
Check the exact spelling of column headers in the Japan Campaign Tracker sheet:
- Is it "Revenue" or "Revenues"?
- Is it "Spends" or "Spend"?
- Are there extra spaces or special characters?

### Step 3: Fix Column Aliases
If the headers are different, update FIELD_ALIASES in `backend/services/privateSheetsService.js`:

```javascript
const FIELD_ALIASES = {
  // ... other fields ...
  revenue: ["Revenue", "Revenues"],  // Add alternative spellings
  spend: ["Spends", "Spend"],        // Add alternative spellings
  // ... other fields ...
};
```

### Step 4: Check Data Format
If headers are correct, check if the values in Google Sheets are:
- Formatted as numbers (not text)
- Not using formulas that return errors
- Not using currency symbols that aren't being parsed

## Quick Test
To verify the fix works:

1. Deploy the debug changes
2. Go to Admin panel → Sync Now (Full Refresh)
3. Check backend logs for the debug output
4. Check BigQuery to see if values are now non-zero:

```sql
SELECT campaign_name, revenue, spend, net_margin
FROM (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY campaign_id, month, year ORDER BY synced_at DESC) AS rn
  FROM `tactile-petal-820.adops_dashboard.campaign_tracker_consolidated`
)
WHERE rn = 1
  AND LOWER(TRIM(COALESCE(country, ''))) = 'japan'
  AND year = 2026
  AND LOWER(TRIM(month)) = 'march'
LIMIT 5;
```

## Files Modified
- `backend/services/privateSheetsService.js` - Added debug logging
- `backend/services/bigQueryReadService.js` - Added KPI query logging

## Commit These Changes
```bash
git add backend/services/privateSheetsService.js backend/services/bigQueryReadService.js
git commit -m "Add debug logging for Japan zero values issue"
git push origin main
```

Then trigger a sync and check the logs.
