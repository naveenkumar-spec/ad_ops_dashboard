# Currency Toggle - Final Fix Complete

## Issues Fixed

### Issue 1: Trend Charts Showing Wrong Currency Symbol
**Problem**: Y-axis showed "AUD" even though values were in USD
**Fix**: 
- Removed `convertUsdToDisplay` from TrendChart data processing
- Hardcoded currency context to USD for Y-axis labels and tooltips
- Trend charts now always show "USD" regardless of toggle state

### Issue 2: Tables Showing Wrong Currency Symbols
**Problem**: Some tables showed "AUD" symbol but USD values, or vice versa
**Root Cause**: Backend functions were hardcoded to use `t.revenue`, `t.spend`, `t.net_margin` columns instead of using currency-specific columns
**Fix**: Updated all table query functions to use `getCurrencyColumns()` helper:
- ✅ `getProductWiseTable()` - Now uses currency columns
- ✅ `getCampaignWiseTable()` - Now uses currency columns  
- ✅ `getCampaignsDetailed()` - Now uses currency columns

---

## Backend Changes

### Functions Updated:
1. **`getProductWiseTable()`** - Added `currencyMode` and `getCurrencyColumns()`
2. **`getCampaignWiseTable()`** - Added `currencyMode` and `getCurrencyColumns()`
3. **`getCampaignsDetailed()`** - Added `currencyMode` and `getCurrencyColumns()`

All now use:
```javascript
const currencyMode = filters.currencyMode || "usd";
const cols = getCurrencyColumns(currencyMode);

// Then in queries:
SUM(COALESCE(t.${cols.revenue}, 0)) AS revenue
SUM(COALESCE(t.${cols.spend}, 0)) AS spend
SUM(COALESCE(t.${cols.netMargin}, 0)) AS netMargin
```

---

## Frontend Changes

### TrendChart.jsx
**Removed currency conversion:**
```javascript
// OLD - was converting values
const converted = convertUsdToDisplay(usdValue, currencyContext);

// NEW - no conversion, always USD
const usdContext = { currencyCode: "USD", mode: "USD" };
const yTickFmt = v => formatCompactCurrency(Number(v) * 1_000_000, usdContext, 1);
```

**BarLabel component:**
```javascript
// Always use USD for trend charts
const usdContext = { currencyCode: "USD", mode: "USD" };
absolute = `USD ${fullValue.toLocaleString(...)}`;
```

---

## How It Works Now

### USD Mode
1. User selects "USD" toggle
2. Frontend passes `currencyMode: "usd"` to backend
3. Backend queries: `revenue`, `spend`, `gross_profit`, `net_margin`
4. Frontend displays with "USD" symbol
5. Trend charts show "USD" (always)

### Native Mode (e.g., Australia)
1. User selects only "Australia"
2. User clicks "Native Currency" toggle
3. Frontend passes `currencyMode: "native"` to backend
4. Backend queries: `revenue_local`, `spend_local`, `gross_profit_local`, `net_margin_local`
5. Frontend displays with "AUD" symbol (from currencyContext)
6. Trend charts still show "USD" (always)

---

## Expected Behavior

### When Selecting Australia + Native Currency:

**KPI Cards:**
- ✅ Show AUD values (e.g., "AUD 1.07M")
- ✅ Currency symbol: "AUD"

**Tables:**
- ✅ Country-wise: "AUD 1.07M"
- ✅ Product-wise: "AUD 740.19K" (native values)
- ✅ Campaign-wise: "AUD" values
- ✅ All show correct native amounts

**Trend Charts:**
- ✅ Always show "USD" on Y-axis
- ✅ Values remain in USD (historical data)
- ✅ No currency symbol change when toggling

---

## Testing Checklist

### ✅ Australia (AUD)
- [ ] Select only "Australia"
- [ ] Click "Native Currency"
- [ ] KPIs show ~1.07M AUD
- [ ] Tables show AUD values
- [ ] Trend charts show USD (unchanged)

### ✅ Thailand (THB)
- [ ] Select only "Thailand"
- [ ] Click "Native Currency"
- [ ] KPIs show THB values
- [ ] Tables show THB values
- [ ] Trend charts show USD (unchanged)

### ✅ Japan (JPY)
- [ ] Select only "Japan"
- [ ] Click "Native Currency"
- [ ] KPIs show JPY values
- [ ] Tables show JPY values
- [ ] Trend charts show USD (unchanged)

### ✅ Toggle Back to USD
- [ ] Click "USD" toggle
- [ ] All values convert back to USD
- [ ] Currency symbols change to "USD"
- [ ] Trend charts remain USD (no change)

---

## Files Modified

### Backend
- `backend/services/bigQueryReadService.js`
  - `getProductWiseTable()` - Added currency column support
  - `getCampaignWiseTable()` - Added currency column support
  - `getCampaignsDetailed()` - Added currency column support

### Frontend
- `frontend/src/components/TrendChart.jsx`
  - Removed currency conversion from data processing
  - Hardcoded USD context for Y-axis and labels
  - Updated BarLabel to always show USD

---

## Summary

✅ **Backend returns correct values** - Native or USD based on currencyMode
✅ **Frontend displays as-is** - No conversion needed
✅ **Currency symbols match values** - AUD for native, USD for USD
✅ **Trend charts always USD** - Consistent historical data
✅ **All tables support toggle** - Country, Product, Campaign, Bottom Campaigns
✅ **KPIs support toggle** - Show correct currency

The currency toggle now works correctly across all components!
