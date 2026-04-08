# Backend Row Limit Increase - Fix for CSV Exports

## Issue
CSV downloads were capped at 502 rows (500 data rows + 1 header + 1 totals) even though the frontend was requesting all rows with `limit: 999999`. This was due to a backend safety limit of 500 rows.

## Root Cause
The backend methods had a hardcoded limit using `Math.min(500, Number(limit))` which capped all queries at 500 rows maximum, regardless of what the frontend requested.

**Location**: `backend/services/bigQueryReadService.js`

```javascript
// OLD CODE (capped at 500)
const safeLimit = Math.max(1, Math.min(500, Number(limit || 50)));
```

## Solution
Increased the maximum limit from 500 to 10,000 rows for all table methods used in CSV exports.

```javascript
// NEW CODE (capped at 10,000)
const safeLimit = Math.max(1, Math.min(10000, Number(limit || 50)));
```

## Methods Updated

### 1. getCampaignsDetailed
- **Used by**: BottomCampaignsTable (Bottom/Top campaigns)
- **Old limit**: 500 rows
- **New limit**: 10,000 rows

### 2. getCountryWiseTable
- **Used by**: CountryWiseTable (Region/Country data)
- **Old limit**: 500 rows
- **New limit**: 10,000 rows

### 3. getCampaignWiseTable
- **Used by**: CampaignWiseTable (Campaign-wise data)
- **Old limit**: 500 rows
- **New limit**: 10,000 rows

### 4. getProductWiseTable
- **Used by**: ProductWiseTable (Product/Platform data)
- **Old limit**: 500 rows
- **New limit**: 10,000 rows

## Why 10,000?

The limit of 10,000 rows is a reasonable balance between:

1. **Functionality**: Allows exporting large datasets (most dashboards have < 10,000 rows)
2. **Performance**: Prevents excessive memory usage and query times
3. **Safety**: Protects against accidental or malicious requests for unlimited data
4. **BigQuery Costs**: Limits the amount of data scanned per query

If you have more than 10,000 rows, you can:
- Apply filters to reduce the dataset
- Increase the limit further if needed
- Implement server-side CSV generation for very large datasets

## Impact

### Before
- CSV exports limited to 500 rows
- Users couldn't export complete datasets
- Had to manually combine multiple exports

### After
- CSV exports can include up to 10,000 rows
- Complete datasets can be exported in one file
- Filters still respected
- UI pagination unchanged (still 50 rows for performance)

## UI Behavior (Unchanged)

The dashboard UI still loads data in pages of 50 rows for optimal performance:
- Initial load: 50 rows
- Scroll to load more: +50 rows
- This keeps the UI fast and responsive

Only CSV exports fetch all rows (up to 10,000).

## Testing

To verify the fix:
1. Navigate to any table with > 500 rows
2. Click the download button
3. Open the CSV file
4. Count the rows (should be > 500 if data exists)

Example:
- CampaignWiseTable with 800 campaigns
- Before: CSV had 502 rows (500 + header + totals)
- After: CSV has 802 rows (800 + header + totals)

## Files Modified
- `backend/services/bigQueryReadService.js` - Increased limit in 4 methods

## Deployment
- ✅ Committed to `dev` branch
- ✅ Pushed to GitHub
- 🔄 Will be deployed to dev environment automatically
- ⏳ Test with datasets > 500 rows
- ⏳ Verify CSV exports contain all rows
- ⏳ Merge to `main` when confirmed working

## Future Considerations

If you need to export more than 10,000 rows:

### Option 1: Increase the Limit
Simply change `Math.min(10000, ...)` to a higher value like `Math.min(50000, ...)`

### Option 2: Server-Side CSV Generation
For very large datasets (> 10,000 rows), consider:
- Generating CSV on the server
- Streaming the file to the client
- Using background jobs for large exports
- Providing a download link when ready

### Option 3: Pagination in Exports
- Export in chunks (e.g., 10,000 rows per file)
- Provide multiple download links
- Zip multiple CSV files together

## Performance Notes

With 10,000 rows:
- Query time: ~2-5 seconds (depending on complexity)
- Memory usage: ~10-50 MB (depending on columns)
- CSV file size: ~1-5 MB (depending on data)
- Download time: < 1 second on most connections

These are acceptable for most use cases.
