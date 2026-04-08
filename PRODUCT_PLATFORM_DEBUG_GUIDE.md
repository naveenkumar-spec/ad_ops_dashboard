# Product/Platform Table Debug Guide

## Expected Behavior

The ProductWiseTable should work exactly like CountryWiseTable:
- **Parent rows**: Products (Product, Crafters, Mirrors, Open, Others, Parallels, Self serve, TIKTOK, Zimmer)
- **Child rows**: Platforms (Youtube, OpenWeb, Meta, Tiktok, CTV, YT Mirrors, etc.)
- **Hierarchy**: Product → Platform (similar to Region → Country)

## Data Flow

1. **Product-wise endpoint** (`/api/overview/product-wise`):
   - Groups by `product` only
   - Returns parent rows (products with aggregated totals)
   
2. **Platforms endpoint** (`/api/overview/platforms`):
   - Groups by `product` AND `platform`
   - Returns child rows (platforms grouped by parent product)
   - Each row has: `parentProduct`, `platform`, and all metrics

3. **Frontend**:
   - Fetches both endpoints in parallel
   - Builds `platformsByProduct` map: `{ "Product": [...platforms], "Mirrors": [...platforms], ... }`
   - When user clicks expand button, shows platforms under that product

## Debug Steps

### 1. Check Browser Console
Open Developer Tools (F12) and look for these logs:

```
[ProductWiseTable] Platform response: [...]
[ProductWiseTable] Platform row: { parent: "Product", platform: "Youtube", ... }
[ProductWiseTable] Platform row: { parent: "Product", platform: "OpenWeb", ... }
...
[ProductWiseTable] Platform map: { "Product": [...], "Mirrors": [...], ... }
```

### 2. Check Network Tab
- Look for request to `/api/overview/platforms`
- Check the response - should return array of objects with `parentProduct` and `platform` fields

### 3. Expected Platform Response Format
```json
[
  {
    "parentProduct": "Product",
    "platform": "Youtube",
    "totalCampaigns": 324,
    "budgetGroups": 1677,
    "bookedRevenue": 15150000,
    "spend": 6940000,
    "plannedImpressions": 3000000000,
    "deliveredImpressions": 2110630000,
    "deliveredPct": 70.41,
    "grossProfitLoss": 8210000,
    "grossMargin": 54.15,
    "netMargin": ...,
    "netMarginPct": ...
  },
  {
    "parentProduct": "Product",
    "platform": "OpenWeb",
    ...
  },
  ...
]
```

## Common Issues

### Issue 1: "Product" not showing platforms
- **Symptom**: Click expand button on "Product" row, no platforms appear
- **Cause**: `platformsByProduct["Product"]` is empty or undefined
- **Debug**: Check console log for platform map - does it have "Product" key?

### Issue 2: Platforms showing wrong data
- **Symptom**: Platforms show rounded values like 3000000000
- **Cause**: Still using mock data fallback
- **Debug**: Check if `/api/overview/platforms` request succeeded or failed

### Issue 3: No expand buttons
- **Symptom**: All products show disabled expand buttons
- **Cause**: `platformsByProduct` is empty for all products
- **Debug**: Check if platforms endpoint returned data

## SQL Query (for reference)

The platforms endpoint runs this query:

```sql
SELECT
  COALESCE(NULLIF(TRIM(t.product), ''), 'Unknown') AS parentProduct,
  COALESCE(NULLIF(TRIM(t.platform), ''), 'Unknown') AS platform,
  COUNT(DISTINCT ...) AS totalCampaigns,
  SUM(...) AS budgetGroups,
  ...
FROM adops_dashboard_dev.tracker_data t
WHERE ...
GROUP BY parentProduct, platform
ORDER BY bookedRevenue DESC
```

This groups all campaigns by their product AND platform, creating one row for each product-platform combination.

## Next Steps

1. Share browser console logs (especially the platform map)
2. Share network response from `/api/overview/platforms`
3. I'll identify the issue and fix it
