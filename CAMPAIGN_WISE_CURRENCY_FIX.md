# Campaign Wise Table - Currency Mode Fix

## Issue
Campaign Wise Data table was showing USD values even when Native Currency toggle was ON, while all other tables worked correctly.

## Root Cause
In `frontend/src/pages/Overview.jsx`, the `CampaignWiseTable` component was NOT receiving the `currencyContext` prop.

### Before (Line 136):
```javascript
<CampaignWiseTable key={`cpg-${refreshTick}`} filters={filters} />
```

### After (Fixed):
```javascript
<CampaignWiseTable key={`cpg-${refreshTick}`} filters={filters} currencyContext={currencyContext} />
```

## Why This Happened
When the native currency feature was implemented, all table components were updated to receive `currencyContext`, but `CampaignWiseTable` was accidentally missed.

Without `currencyContext`, the component defaulted to:
```javascript
currencyMode: currencyContext?.mode === "Native" ? "native" : "usd"
// When currencyContext is undefined: undefined?.mode === "Native" → false → "usd"
```

## Fix Applied
Added `currencyContext={currencyContext}` prop to `CampaignWiseTable` in `Overview.jsx`.

## Testing
1. Save the file
2. Refresh the browser (the frontend should auto-reload if using dev server)
3. Toggle Native Currency to ON
4. Check Campaign Wise Data table
5. Australia should now show ~1.07M AUD (not 741K USD)

## Additional Debugging Added
Also added console logging to help debug similar issues in the future:

### Frontend (CampaignWiseTable.jsx):
```javascript
console.log(`[CampaignWiseTable] API call params:`, {
  currencyMode: apiParams.currencyMode,
  currencyContextMode: currencyContext?.mode,
  offset: currentOffset,
  sortBy: apiParams.sortBy
});
```

### Backend (overview.js):
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

These logs can be removed later if not needed.

## Verification
After the fix, when you toggle Native Currency:

### Native Currency ON:
- Campaign Wise table shows native values (e.g., 1.07M AUD for Australia)
- Browser console shows: `currencyMode: "native"`
- Backend console shows: `currencyMode: native`

### Native Currency OFF:
- Campaign Wise table shows USD values (e.g., 741K USD for Australia)
- Browser console shows: `currencyMode: "usd"`
- Backend console shows: `currencyMode: usd`

## Status
✅ Fixed - Campaign Wise Data table now correctly responds to Native Currency toggle
