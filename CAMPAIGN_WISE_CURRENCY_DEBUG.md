# Campaign Wise Table - Currency Mode Debug

## Issue
All tables show native currency correctly EXCEPT Campaign Wise Data table, which still shows USD values when Native Currency toggle is ON.

## Changes Made
Added logging to both frontend and backend to trace the currency mode parameter.

### Frontend Logging (CampaignWiseTable.jsx)
```javascript
console.log(`[CampaignWiseTable] API call params:`, {
  currencyMode: apiParams.currencyMode,
  currencyContextMode: currencyContext?.mode,
  offset: currentOffset,
  sortBy: apiParams.sortBy
});
```

### Backend Logging (overview.js)
```javascript
console.log(`[campaign-wise route] Raw query params:`, {
  currencyMode: _req.query.currencyMode,
  region: _req.query.region,
  sortBy: _req.query.sortBy
});

console.log(`[campaign-wise route] Parsed filters:`, {
  currencyMode: filters.currencyMode,
  region: filters.region,
  sortBy: filters.sortBy
});
```

## Testing Steps

### Step 1: Clear Browser Cache
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"
4. Or use Ctrl+Shift+Delete to clear cache

### Step 2: Test Native Currency Toggle
1. Refresh the dashboard page
2. Open browser console (F12 → Console tab)
3. Toggle Native Currency switch to ON
4. Look for these logs in browser console:

**Expected Frontend Log:**
```
[CampaignWiseTable] API call params: {
  currencyMode: "native",
  currencyContextMode: "Native",
  offset: 0,
  sortBy: "name"
}
```

**If you see `currencyMode: "usd"` instead:**
- The currencyContext is not being passed correctly to CampaignWiseTable
- Check if other tables show the correct log

### Step 3: Check Backend Logs
Look at your backend console (where you ran `npm start` in the backend folder):

**Expected Backend Logs:**
```
[campaign-wise route] Raw query params: {
  currencyMode: "native",
  region: "all",
  sortBy: "name"
}

[campaign-wise route] Parsed filters: {
  currencyMode: "native",
  region: "all",
  sortBy: "name"
}

[getCampaignWiseTable] currencyMode: native, cols: {
  revenue: 'revenue_local',
  spend: 'spend_local',
  grossProfit: 'gross_profit_local',
  netMargin: 'net_margin_local'
}
```

**If you see `currencyMode: "usd"` in backend:**
- The parameter is not being sent from frontend
- Check Network tab (see Step 4)

### Step 4: Check Network Request
1. Open DevTools → Network tab
2. Toggle Native Currency to ON
3. Look for the `/api/overview/campaign-wise` request
4. Click on it
5. Check "Query String Parameters" section

**Expected Parameters:**
```
currencyMode: native
region: all
year: all
month: all
status: all
product: all
platform: all
limit: 50
offset: 0
sortBy: name
sortOrder: desc
```

**If `currencyMode` is missing or shows "usd":**
- There's a frontend issue with parameter passing
- Check if currencyContext prop is being passed to CampaignWiseTable

### Step 5: Check Other Tables
Compare with a working table (e.g., Country Wise Table):

1. Toggle Native Currency to ON
2. Check browser console for Country Wise Table logs
3. Check Network tab for `/api/overview/country-wise` request
4. Compare the `currencyMode` parameter

## Possible Issues & Solutions

### Issue 1: Browser Cache
**Symptom:** Old code is running, logs don't appear
**Solution:** Hard refresh (Ctrl+Shift+R) or clear cache

### Issue 2: currencyContext Not Passed to Component
**Symptom:** Frontend log shows `currencyMode: "usd"` even when toggle is ON
**Solution:** Check if CampaignWiseTable is receiving currencyContext prop in Overview.jsx

### Issue 3: API Client Not Sending Parameter
**Symptom:** Frontend log shows correct value, but Network tab doesn't show the parameter
**Solution:** Check apiClient.js to ensure params are being serialized correctly

### Issue 4: Backend Not Reading Parameter
**Symptom:** Network tab shows parameter, but backend log shows "usd"
**Solution:** Check parseFilters function in overview.js

### Issue 5: BigQuery Query Using Wrong Columns
**Symptom:** Backend logs show correct currencyMode, but data is still in USD
**Solution:** Check getCampaignWiseTable query to ensure it's using `cols.revenue` not hardcoded `revenue`

## Expected Results

### When Native Currency is ON:
- Frontend log: `currencyMode: "native"`
- Network tab: `currencyMode=native`
- Backend log: `currencyMode: native`
- Backend log: `cols: { revenue: 'revenue_local', ... }`
- Display: Australia shows ~1.07M AUD

### When Native Currency is OFF:
- Frontend log: `currencyMode: "usd"`
- Network tab: `currencyMode=usd`
- Backend log: `currencyMode: usd`
- Backend log: `cols: { revenue: 'revenue', ... }`
- Display: Australia shows ~741K USD

## Next Steps

1. Restart backend server (to load new logging code)
2. Hard refresh browser (Ctrl+Shift+R)
3. Toggle Native Currency to ON
4. Check all logs (browser console, backend console, Network tab)
5. Report findings:
   - What does frontend log show?
   - What does backend log show?
   - What does Network tab show?
   - What values are displayed in the table?

This will help identify exactly where the currency mode parameter is being lost.
