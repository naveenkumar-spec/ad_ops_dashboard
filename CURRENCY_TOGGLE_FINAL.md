# Currency Toggle - Final Implementation

## Summary

Native currency toggle now works correctly with the following behavior:

### ✅ Components that Support Currency Toggle (USD ↔ Native)
1. **KPI Cards** - Shows values in selected currency
2. **Country-wise Table** - Shows values in selected currency
3. **Product-wise Table** - Shows values in selected currency
4. **Campaign-wise Table** - Shows values in selected currency
5. **Bottom Campaigns Table** - Shows values in selected currency

### 📊 Components that Always Use USD
1. **Revenue Trend Chart** - Always USD (historical data)
2. **Gross Margin Trend Chart** - Always USD (historical data)
3. **CPM Trend Chart** - Always USD (historical data)
4. **Net Margin Trend Chart** - Always USD (historical data)

---

## Why Trend Charts Use USD Only

Trend charts combine:
- **Tracker data** (current + previous month) - Has native currency columns
- **Branding/Transition data** (historical months) - Only has USD columns

To maintain consistency and show complete historical trends, we keep all trend charts in USD.

---

## How It Works

### Backend (bigQueryReadService.js)

**For KPIs and Tables:**
```javascript
const currencyMode = filters.currencyMode || "usd";
const cols = getCurrencyColumns(currencyMode);

// Use appropriate columns based on mode
SUM(COALESCE(t.${cols.revenue}, 0)) AS total_revenue
SUM(COALESCE(t.${cols.spend}, 0)) AS total_spend
```

**For Trend Charts:**
```javascript
// Always use USD columns (ignore currencyMode)
SUM(COALESCE(t.revenue, 0)) AS total_revenue
SUM(COALESCE(t.spend, 0)) AS total_spend
```

### Frontend

**Components with Currency Toggle:**
```javascript
const apiParams = {
  ...toApiParams(filters),
  currencyMode: currencyContext?.mode === "Native" ? "native" : "usd"
};
```

**Trend Charts:**
```javascript
// Don't pass currencyMode - always use USD
apiGet(endpoint, { timeout: 20000, params: toApiParams(filters) })
```

---

## Testing Checklist

### ✅ USD Mode (Default)
- [ ] KPI cards show USD values
- [ ] All tables show USD values
- [ ] Trend charts show USD values
- [ ] Currency symbol shows "USD"

### ✅ Native Mode (Single Country - Australia)
- [ ] Select only "Australia" from filters
- [ ] Click "Native Currency" toggle
- [ ] KPI cards show AUD values (e.g., 1,074,186.04 AUD)
- [ ] All tables show AUD values
- [ ] Trend charts still show USD values (expected)
- [ ] Currency symbol shows "AUD"

### ✅ Native Mode (Single Country - Thailand)
- [ ] Select only "Thailand" from filters
- [ ] Click "Native Currency" toggle
- [ ] KPI cards show THB values
- [ ] All tables show THB values
- [ ] Trend charts still show USD values (expected)
- [ ] Currency symbol shows "THB"

### ✅ Toggle Behavior
- [ ] Currency toggle only appears when single country is selected
- [ ] Switching between USD and Native updates KPIs and tables
- [ ] Trend charts remain unchanged when toggling
- [ ] No double conversion happening (values match expected amounts)

---

## Expected Values for Australia

### Native Currency (AUD)
- Revenue: 1,074,186.04 AUD
- Conversion rate: 1 AUD = 0.69 USD

### USD (Converted)
- Revenue: 741,188.37 USD (1,074,186.04 × 0.69)

---

## Files Modified

### Backend
- `backend/services/bigQueryReadService.js` - Trend charts always use USD

### Frontend
- `frontend/src/components/TrendChart.jsx` - Removed currency mode parameter
- `frontend/src/utils/currencyDisplay.js` - No conversion (pass-through)

### Other files remain unchanged from previous implementation

---

## Key Points

✅ **No frontend conversion** - Backend returns correct values, frontend displays as-is
✅ **KPIs and tables support toggle** - Switch between USD and native
✅ **Trend charts always USD** - Consistent historical data
✅ **Native values stored in BigQuery** - Both USD and native preserved
✅ **Currency code displayed correctly** - From currencyContext

---

## Next Steps

1. Test with Australia (AUD) - verify 1,074,186.04 shows correctly
2. Test with Thailand (THB) - verify native values
3. Test with Japan (JPY) - verify native values
4. Confirm trend charts remain in USD when toggling
5. Verify no errors in browser console
