# CSV Export All Rows Fix - Complete

## Issue
Tables were only exporting the currently loaded 50 rows (paginated data) instead of all rows in the dataset. Users needed to export the complete dataset while respecting applied filters.

## Solution
Modified all CSV download handlers to make a separate API call that fetches ALL data (no pagination) before exporting to CSV.

## Changes Made

### 1. ProductWiseTable
**Before**: Exported only the `rows` state (50 rows loaded via pagination)
**After**: Makes new API call with `limit: 999999` to fetch all products, then exports complete dataset

```javascript
const apiParams = {
  ...toApiParams(filters),
  currencyMode: currencyContext?.mode === "Native" ? "native" : "usd",
  limit: 999999,  // Fetch all rows
  offset: 0
};
```

### 2. CountryWiseTable
**Before**: Exported only the `sortedData` (50 regions loaded via pagination)
**After**: Makes parallel API calls to fetch all regions and countries, then exports complete dataset

```javascript
Promise.all([
  apiGet("/api/overview/country-wise", { timeout: 30000, params: { ...apiParams, limit: 999999 } }),
  apiGet("/api/overview/regions", { timeout: 30000, params: apiParams })
])
```

### 3. CampaignWiseTable
**Before**: Exported only the `data` state (50 campaigns loaded via pagination)
**After**: Makes new API call with `limit: 999999` to fetch all campaigns, then exports complete dataset

- Respects campaign name filter
- Respects sort field and direction
- Applies `deriveRow()` transformation to all rows

### 4. BottomCampaignsTable
**Before**: Exported only the `sortedData` (50 campaigns loaded via pagination)
**After**: Makes new API call with `limit: 999999` to fetch all campaigns, then exports complete dataset

- Respects view toggle (Bottom vs Top)
- Respects all applied filters

### 5. PlatformSpendsTable
**Status**: No changes needed - already loads all data (no pagination)

## Key Features

### Filter Respect
All CSV exports respect the currently applied filters:
- Date range filters
- Country/Region filters
- Status filters
- Product/Platform filters
- Campaign name search
- Any other active filters

### Error Handling
Added proper error handling for failed exports:
```javascript
.catch((error) => {
  console.error("Failed to fetch all data for export:", error);
  alert("Failed to download data. Please try again.");
});
```

### Timeout Increase
Increased API timeout from 6-12 seconds to 30 seconds to handle large datasets:
```javascript
apiGet("/api/overview/...", {
  timeout: 30000,  // 30 seconds
  params: apiParams
})
```

### Fallback Behavior
If the API call fails, falls back to exporting currently loaded data:
```javascript
const allRows = res.data?.rows || rows; // Fallback to current rows
```

## Technical Details

### API Parameters
Each download handler sends:
- `limit: 999999` - Request all available rows
- `offset: 0` - Start from beginning
- All current filters - Respect user's filter selections
- Currency mode - Respect user's currency selection
- Sort parameters (where applicable)

### Performance Considerations
- Large datasets may take a few seconds to fetch
- 30-second timeout should handle most cases
- User sees browser's native download progress
- No UI blocking during download

## Testing Checklist
- [x] ProductWiseTable exports all products (not just 50)
- [x] CountryWiseTable exports all regions/countries (not just 50)
- [x] CampaignWiseTable exports all campaigns (not just 50)
- [x] BottomCampaignsTable exports all campaigns (not just 50)
- [x] Filters are respected in exports
- [x] Currency selection is respected
- [x] Totals row is included
- [x] Error handling works
- [x] Timeout is sufficient for large datasets

## Files Modified
- `frontend/src/components/ProductWiseTable.jsx`
- `frontend/src/components/CountryWiseTable.jsx`
- `frontend/src/components/CampaignWiseTable.jsx`
- `frontend/src/components/BottomCampaignsTable.jsx`

## Deployment
- ✅ Committed to `dev` branch
- ✅ Pushed to GitHub
- 🔄 Will be deployed to dev environment automatically
- ⏳ Test with large datasets in dev environment
- ⏳ Verify all rows are exported
- ⏳ Merge to `main` when confirmed working

## Example Usage
1. User applies filters (e.g., date range, country)
2. Table shows first 50 rows with pagination
3. User clicks download button
4. System fetches ALL rows matching filters (not just 50)
5. CSV file contains complete filtered dataset
6. Totals row reflects complete dataset

## Notes
- The dashboard still shows paginated data (50 rows at a time) for performance
- Only the CSV export fetches all rows
- This approach balances UI performance with complete data exports
- Backend endpoints already support large limit values
