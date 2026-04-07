# India March 2026 Zero Values - Diagnostic Guide

## Issue
India's data for March 2026 is showing 0 values in the dashboard.

## Possible Causes

### 1. Missing Month Column Data
**Most Likely Cause**: The "Month" column in the India tracker sheet might be empty for March 2026 rows.

**Why**: The code filters out rows where `!normalized.month`:
```javascript
if (
  !normalized.month ||
  normalized.campaignName === "Unknown Campaign" &&
  normalized.revenue === 0 &&
  normalized.spend === 0 &&
  normalized.plannedImpressions === 0 &&
  normalized.deliveredImpressions === 0
) {
  return null;
}
```

**Check**:
1. Open India tracker sheet: https://docs.google.com/spreadsheets/d/1kKwtLGn9jUQjvz_6UY3HcrTppU-wG4-I_hPp5_JJypE
2. Look for the "Month" column
3. Check if March 2026 rows have "March" in the Month column
4. Verify the column header is exactly "Month" (case-insensitive, but must match)

### 2. All Financial Values Are Zero
**Less Likely**: If all these are true for March 2026 rows:
- Campaign Name = "Unknown Campaign"
- Revenue = 0
- Spend = 0
- Planned Impressions = 0
- Delivered Impressions = 0

Then the row is filtered out.

**Check**:
1. Look at March 2026 rows in India sheet
2. Verify at least one of these has a value:
   - Revenue > 0
   - Spend > 0
   - Planned Impressions > 0
   - Delivered Impressions > 0
3. Or Campaign Name is not "Unknown Campaign"

### 3. Year Validation Issue
**Unlikely**: Year validation allows 2023-2028 (current year + 2).

Current date: April 7, 2026
Valid range: 2023 to 2028 ✓

March 2026 should pass validation.

### 4. Month Name Parsing Issue
**Possible**: The month name might not be recognized.

**Accepted formats**:
- Full name: "March"
- Short name: "Mar"
- Case-insensitive

**Check**:
1. Verify Month column has "March" or "Mar"
2. Check for typos: "Mrch", "March ", " March" (extra spaces)
3. Check for special characters

### 5. Header Row Detection Issue
**Possible**: The header row might not be detected correctly.

**How it works**:
- Scans first 120 rows
- Looks for row with most matching column names
- Uses that as header row

**Check**:
1. Verify header row is within first 120 rows
2. Check if "Month" column header is spelled correctly
3. Look for duplicate header rows

### 6. Sheet Tab Name Issue
**Unlikely**: Configuration shows `"tabName": "India"` which should work.

**Check**:
1. Verify the tab is named exactly "India" (case-insensitive)
2. Check if there are multiple tabs with similar names

## Diagnostic Steps

### Step 1: Check Backend Logs
Look for India-specific logs during sync:

```bash
# Look for these patterns in backend logs
[normalizeRow] India sample:
[fetchSourceRows] India: X rows parsed
```

If you don't see India logs, the sheet might not be syncing.

### Step 2: Check BigQuery Data
Run this query in BigQuery console:

```sql
SELECT 
  country,
  month,
  year,
  COUNT(*) as row_count,
  SUM(revenue) as total_revenue,
  SUM(spend) as total_spend
FROM `your-project.adops_dashboard.campaign_tracker_consolidated`
WHERE country = 'India'
  AND year = 2026
  AND sync_id = (
    SELECT sync_id 
    FROM `your-project.adops_dashboard.campaign_tracker_consolidated` 
    ORDER BY synced_at DESC 
    LIMIT 1
  )
GROUP BY country, month, year
ORDER BY year, 
  CASE month
    WHEN 'January' THEN 1
    WHEN 'February' THEN 2
    WHEN 'March' THEN 3
    WHEN 'April' THEN 4
    ELSE 99
  END;
```

**Expected**: Should show March 2026 with non-zero values
**If missing**: Data is not being synced from Google Sheets

### Step 3: Check Google Sheet Directly
1. Open: https://docs.google.com/spreadsheets/d/1kKwtLGn9jUQjvz_6UY3HcrTppU-wG4-I_hPp5_JJypE
2. Find the "India" tab
3. Look for March 2026 data
4. Check these columns:
   - Month: Should have "March"
   - Year: Should have "2026"
   - Revenue: Should have values > 0
   - Campaign Name: Should not be empty

### Step 4: Manual Sync Test
1. Go to Admin Setup
2. Click "Manual Sync"
3. Watch backend console for India-specific logs
4. Check if March 2026 data appears after sync

### Step 5: Add Debug Logging
Temporarily add logging to see what's happening:

In `backend/services/privateSheetsService.js`, add after line 595:

```javascript
// Debug logging for India March 2026
if (country === "India" && month === "March" && year === 2026) {
  console.log(`[normalizeRow] India March 2026:`, {
    month,
    year,
    campaignName,
    revenue,
    spend,
    plannedImpressions,
    deliveredImpressions,
    willBeFiltered: !month || (campaignName === "Unknown Campaign" && revenue === 0 && spend === 0 && plannedImpressions === 0 && deliveredImpressions === 0)
  });
}
```

Then run manual sync and check logs.

## Common Issues & Solutions

### Issue 1: Month Column is Empty
**Solution**: Fill in "March" in the Month column for all March 2026 rows

### Issue 2: Month Column Header Misspelled
**Solution**: Rename column header to exactly "Month"

### Issue 3: Month Value Has Typo
**Solution**: Change "Mrch" or "March " to "March"

### Issue 4: All Values Are Zero
**Solution**: Add actual revenue/spend/impression data

### Issue 5: Campaign Name is "Unknown Campaign" with Zero Values
**Solution**: Either:
- Add proper campaign names, OR
- Add non-zero values for revenue/spend/impressions

### Issue 6: Data Not in BigQuery Yet
**Solution**: Run Full Refresh sync from Admin Panel

## Quick Checklist

Use this checklist to diagnose the issue:

- [ ] India sheet exists and is accessible
- [ ] "India" tab exists in the sheet
- [ ] Header row contains "Month" column
- [ ] March 2026 rows have "March" in Month column
- [ ] March 2026 rows have "2026" in Year column
- [ ] March 2026 rows have non-zero revenue OR spend OR impressions
- [ ] Campaign names are not all "Unknown Campaign"
- [ ] Manual sync completes without errors
- [ ] BigQuery shows March 2026 data for India
- [ ] Dashboard filters include India (not filtered out)

## Expected Data Flow

1. **Google Sheets** → India tab has March 2026 data
2. **normalizeRow()** → Parses and validates the data
3. **Filter Check** → Passes if month exists and has values
4. **BigQuery Sync** → Stores in `campaign_tracker_consolidated`
5. **API Query** → Retrieves data based on filters
6. **Dashboard** → Displays the data

## Next Steps

1. Check Google Sheet for March 2026 data
2. Verify Month column has "March"
3. Run manual sync
4. Check BigQuery for the data
5. If still showing 0, add debug logging
6. Share findings for further investigation

## Contact Points

If issue persists after checking:
1. Share screenshot of India sheet March 2026 rows
2. Share BigQuery query results
3. Share backend console logs during sync
4. Share dashboard screenshot showing 0 values

This will help identify the exact cause of the issue.
