# Region Table Filter Issue - Debug Analysis

## Problem
The Region/Country wise data table is not responding to filter changes. When you select filters like year, month, status, etc., the table continues to show all data instead of filtered results.

## Investigation

### Frontend Analysis
1. **Component**: `CountryWiseTable.jsx` (used in Overview page)
2. **API Call**: Line 70 calls `/api/overview/regions` with filters
3. **Filters Passed**: ✅ Correctly passing filters via `apiParams`

```javascript
const apiParams = {
  ...toApiParams(filters),
  currencyMode: currencyContext?.mode === "Native" ? "native" : "usd"
};

apiGet("/api/overview/regions", {
  timeout: 12000,
  params: apiParams
})
```

### Backend Analysis
1. **Route**: `/api/overview/regions` in `backend/routes/overview.js`
2. **Filter Parsing**: ✅ Correctly parsing filters with `parseFilters(_req.query)`
3. **Service Call**: ✅ Passing filters to `provider.getRegionTable(filters)`

```javascript
router.get("/regions", async (_req, res) => {
  const filters = withUserScope(parseFilters(_req.query), _req.user);
  const regions = await provider.getRegionTable(filters);
  res.json(regions);
});
```

### Service Analysis
1. **Function**: `getRegionTable()` in `backend/services/bigQueryReadService.js`
2. **WHERE Clause**: ✅ Building WHERE clause with `buildWhereClause(filters, "t")`
3. **SQL Query**: ✅ Applying WHERE clause to query

```javascript
async function getRegionTable(filters = {}) {
  const { whereSql, params } = buildWhereClause(filters, "t");
  const rows = await runQuery(`
    SELECT ...
    FROM ${latestMainTableSql()} t
    ${whereSql}  // ← WHERE clause applied here
    GROUP BY parentRegion, country
    ORDER BY bookedRevenue DESC
  `, params);
  return rows.map(...);
}
```

## Possible Causes

### 1. Semantic Cache Issue (Most Likely)
The semantic cache might be serving cached data that doesn't respect filters:

**Evidence**:
- Cache was implemented in Task 4
- Cache serves pre-computed aggregations
- `getRegionTable` might be cached without filter keys

**Solution**:
Check if `cachedBigQueryService` is caching region data without including filter parameters in the cache key.

### 2. WHERE Clause Not Building Correctly
The `buildWhereClause` function might not be generating correct SQL for certain filters.

**Solution**:
Add debug logging to see what WHERE clause is being generated.

### 3. Frontend Not Sending Filters
The filters might not be reaching the backend API.

**Solution**:
Check browser Network tab to see what parameters are being sent.

## Debug Logging Added

### Backend Route (`backend/routes/overview.js`)
```javascript
router.get("/regions", async (_req, res) => {
  const filters = withUserScope(parseFilters(_req.query), _req.user);
  console.log("[/regions] Received filters:", JSON.stringify(filters));
  const regions = await provider.getRegionTable(filters);
  console.log("[/regions] Returned", regions.length, "regions");
  res.json(regions);
});
```

### Service (`backend/services/bigQueryReadService.js`)
```javascript
async function getRegionTable(filters = {}) {
  console.log("[getRegionTable] Received filters:", JSON.stringify(filters));
  const { whereSql, params } = buildWhereClause(filters, "t");
  console.log("[getRegionTable] WHERE clause:", whereSql);
  console.log("[getRegionTable] Params:", JSON.stringify(params));
  // ... rest of function
}
```

## How to Debug

### 1. Check Browser Network Tab
1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by "regions"
4. Select a filter (e.g., year=2024)
5. Check the request URL - should include `?year=2024&...`

### 2. Check Backend Logs
1. Look at server console output
2. Should see:
   ```
   [/regions] Received filters: {"year":"2024","month":"all",...}
   [getRegionTable] Received filters: {"year":"2024",...}
   [getRegionTable] WHERE clause: WHERE t.year = @year
   [getRegionTable] Params: {"year":"2024"}
   [getRegionTable] Returned 8 regions
   ```

### 3. Check if Cache is Interfering
1. Check if `USE_SEMANTIC_CACHE=true` in `.env`
2. If yes, the issue might be cache-related
3. Try disabling cache temporarily: `USE_SEMANTIC_CACHE=false`
4. Restart server and test filters

## Expected Behavior

### Without Filters
```
Request: GET /api/overview/regions
Response: All regions (8 regions, 417 campaigns, 2,643 budget groups)
```

### With Year Filter
```
Request: GET /api/overview/regions?year=2024
Response: Only 2024 data (fewer regions/campaigns)
```

### With Multiple Filters
```
Request: GET /api/overview/regions?year=2024&status=Active&product=Mirrors
Response: Only 2024 Active Mirrors campaigns
```

## Next Steps

1. **Test with debug logging**:
   - Deploy changes to dev
   - Check logs when applying filters
   - Identify where filters are being lost

2. **Check cache implementation**:
   - Review `cachedBigQueryService.js`
   - Verify cache keys include filter parameters
   - Ensure `getRegionTable` is not using pre-computed cache

3. **Test without cache**:
   - Temporarily disable semantic cache
   - Test if filters work
   - If yes, fix cache key generation

4. **Fix and verify**:
   - Apply fix based on findings
   - Test all filter combinations
   - Verify totals update correctly

## Files Modified
- `backend/routes/overview.js` - Added debug logging
- `backend/services/bigQueryReadService.js` - Added debug logging

## Status
- ✅ Debug logging added
- ⏳ Waiting for testing with logs
- ⏳ Root cause identification pending
- ⏳ Fix pending

---

**Next**: Deploy to dev and check logs to identify root cause
