# Product/Platform CSV Export Fix

## Issue
ProductWiseTable CSV export was showing rounded impression values (e.g., `3000000000` instead of precise values like `3,142,857,123`). This was because the table was using hardcoded mock data (`mockProductChildren`) for platform breakdowns instead of fetching real data from BigQuery.

## Root Cause
- CountryWiseTable fetches real hierarchical data from `/api/overview/regions` endpoint → shows precise values
- ProductWiseTable was using `mockProductChildren` from mockData.js → shows rounded approximations
- Mock data contains values like `3000000000` (exactly 3 billion) which are rounded for simplicity

## Solution
Created a new API endpoint `/api/overview/platforms` that returns real platform data grouped by product from BigQuery, similar to how the regions endpoint works.

### Backend Changes

1. **bigQueryReadService.js** - Added `getPlatformTable()` method:
   - Groups data by `product` and `platform`
   - Returns precise impression values from BigQuery
   - Includes all metrics: campaigns, budget groups, revenue, spend, impressions, margins

2. **cachedBigQueryService.js** - Added caching wrapper:
   - `getPlatformTable()` with semantic cache support
   - Cache key: `platformTable` + filters

3. **overview.js** - Added new route:
   - `GET /api/overview/platforms`
   - Returns platform data grouped by parent product
   - Supports same filters as other endpoints

### Frontend Changes

1. **ProductWiseTable.jsx** - Updated to fetch real data:
   - Added `platformsByProduct` state to store platform data
   - Fetches from `/api/overview/platforms` endpoint (parallel with product-wise call)
   - Builds platform map grouped by product (similar to CountryWiseTable)
   - Updated CSV export to use real platform data
   - Updated table rendering to use `platformsByProduct` instead of `mockProductChildren`
   - Fixed field name: `platform.platform` instead of `platform.product`

## Data Flow

```
BigQuery Table (product + platform columns)
  ↓
getPlatformTable() - Groups by product & platform
  ↓
/api/overview/platforms endpoint
  ↓
ProductWiseTable - Builds platformsByProduct map
  ↓
CSV Export - Uses precise values from BigQuery
```

## Result
- ProductWiseTable now shows precise impression values in CSV export
- Values like `3,142,857,123` instead of `3000000000`
- Consistent with CountryWiseTable behavior
- All numeric values are rounded to whole numbers (no decimals except percentages)

## Testing
1. Load the dashboard and expand a product to see platforms
2. Click download button on ProductWiseTable
3. Verify CSV contains precise impression values (not rounded to billions)
4. Compare with CountryWiseTable CSV to ensure consistency

## Files Modified
- `backend/services/bigQueryReadService.js` - Added getPlatformTable()
- `backend/services/cachedBigQueryService.js` - Added caching wrapper
- `backend/routes/overview.js` - Added /platforms endpoint
- `frontend/src/components/ProductWiseTable.jsx` - Fetch real platform data
