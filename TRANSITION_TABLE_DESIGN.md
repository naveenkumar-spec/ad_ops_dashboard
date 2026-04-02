# Transition Table Design & Filter Behavior

## Current Design (Correct!)

The `overview_transition_metrics` table is designed to store **aggregated historical data** from the branding sheet without dimensional filters.

### Table Schema
```sql
- sync_id (STRING)
- synced_at (TIMESTAMP)
- month (STRING)
- year (INT64)
- quarter (STRING)
- booked_revenue_m (FLOAT)
- gross_margin_pct (FLOAT)
- average_buying_cpm (FLOAT)
- source_sheet_id (STRING)
- source_tab (STRING)
```

### Why No Filter Columns?

The transition table stores **legacy/historical baseline data** that:
1. Comes from the branding sheet (2020-2024)
2. Is aggregated globally (no product/platform/status breakdown)
3. Provides historical context for trend charts
4. Is NOT meant to be filtered by product/platform/status

---

## Filter Behavior (By Design)

### Scenario 1: No Filters Applied
**Result**: Shows ALL data
- **2025-2026**: From tracker sheets (campaign_tracker_consolidated)
- **2020-2024**: From branding sheet (overview_transition_metrics)
- **Years shown**: 2020, 2021, 2022, 2023, 2024, 2025, 2026

### Scenario 2: Region Filter Only
**Result**: Shows filtered data
- **2025-2026**: Filtered tracker data for selected region
- **2020-2024**: Filtered legacy data for selected region (if available)
- **Years shown**: 2020-2026 (filtered by region)

### Scenario 3: Any Other Filter (Product, Platform, Status, Ops, CS, Sales)
**Result**: Shows ONLY tracker data
- **2025-2026**: Filtered tracker data
- **2020-2024**: SKIPPED (legacy data doesn't have these dimensions)
- **Years shown**: 2025, 2026 only

**Why?** The branding sheet doesn't have product/platform/status breakdowns, so we can't filter legacy data by these dimensions.

---

## Code Implementation

### Filter Detection (backend/routes/overview.js)
```javascript
async function withLegacyOverviewTrend(metric, baseSeries, filters = {}) {
  // Skip legacy data if any non-region filters are active
  const filterKeys = ["year", "month", "status", "product", "platform", "ops", "cs", "sales"];
  const hasActiveFilters = filterKeys.some((key) => {
    const value = filters[key];
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim().toLowerCase() !== "all" && String(value).trim() !== "";
  });
  
  if (hasActiveFilters) {
    console.log(`[withLegacyOverviewTrend] Skipping legacy merge - active filters detected`);
    return baseSeries; // Return only tracker data
  }
  
  // Merge with legacy data
  const mergedSeries = await bigQueryReadService.getMergedOverviewSeries(baseSeries, metric);
  return mergedSeries;
}
```

### Data Merging Logic
```javascript
function mergeSeriesUseLegacyExceptRecentTrackerMonths(trackerSeries, legacySeries) {
  // Current month and previous month: Use tracker data
  // All other months: Use legacy data
  // Result: Complete historical view
}
```

---

## Why Only 12 Rows Instead of 73?

The logs show:
```
[getOverviewLegacyTrend] Parsed 16138 raw rows, aggregated to 73 month-year entries
[BigQuery Sync] ✅ Legacy trend rows: revenue=12, margin=12, cpm=12
```

**Possible causes:**

### 1. Data Filtering in toTransitionRows
The function skips rows where ALL metrics are zero:
```javascript
if (
  Math.abs(merged.booked_revenue_m) <= 0 &&
  Math.abs(merged.gross_margin_pct) <= 0 &&
  Math.abs(merged.average_buying_cpm) <= 0
) {
  return; // Skip this row
}
```

**Solution**: This is correct behavior - we shouldn't store empty rows.

### 2. Series Format Mismatch
The `getOverviewLegacyTrend` returns:
```javascript
[
  { month: "January", "2020": 123.45, "2021": 234.56, ... },
  { month: "February", "2020": 345.67, "2021": 456.78, ... },
  ...
]
```

But `toTransitionMapRow` might not be finding the values correctly.

### 3. Year Extraction Issue
The years might not be extracted correctly from the series data.

---

## Debugging Steps

### 1. Check Debug Logs
After the latest deployment, run manual sync and look for:
```
[toTransitionRows] Processing X years: [2020, 2021, 2022, ...]
[toTransitionMapRow] September 2020: { month: 'September', year: 2020, ... }
[toTransitionRows] Created X transition rows from Y years
```

### 2. Verify Series Data
The series should have data for each year:
```javascript
{
  month: "September",
  "2020": 1234.56,  // Should have values
  "2021": 2345.67,
  "2022": 3456.78,
  ...
}
```

### 3. Check Aggregation
The `getOverviewLegacyTrend` aggregates by month/year. Verify:
- All years are included (2020-2026)
- Values are non-zero
- Month names match exactly

---

## Expected Results After Fix

### Transition Table
- **Rows**: ~73 (12 months × 6 years + partial months)
- **Data**: Revenue, Margin %, CPM for each month/year
- **Years**: 2020, 2021, 2022, 2023, 2024, 2025, 2026

### Bar Charts (No Filters)
- **Year Dropdown**: 2020-2026
- **Data**: Complete historical trends
- **Source**: Tracker (recent) + Branding (historical)

### Bar Charts (With Product Filter)
- **Year Dropdown**: 2025-2026 only
- **Data**: Filtered tracker data only
- **Source**: Tracker sheets only (legacy skipped)

---

## Summary

✅ **Design is correct** - Transition table doesn't need filter columns  
✅ **Filter logic is correct** - Skips legacy when filters active  
❌ **Data population issue** - Only 12 rows instead of 73  

**Next step**: Debug why only 12 rows are being created from 73 aggregated entries.
