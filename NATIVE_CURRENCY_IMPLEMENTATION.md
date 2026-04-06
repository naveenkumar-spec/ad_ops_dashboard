# Native Currency Implementation - Complete

## Problem
Native currency values were showing incorrect amounts (e.g., Australia showing 1.12M instead of 1,074,186.04) because:
1. Frontend was doing double conversion (USD → Native)
2. Backend wasn't returning the correct native values from BigQuery

## Solution
Store BOTH native and USD values in BigQuery, then backend returns appropriate values based on currency mode. Frontend displays values as-is (NO conversion).

---

## Backend Changes

### 1. `backend/services/privateSheetsService.js`
**Changes:**
- Modified `normalizeRow()` to calculate and return both native and USD values
- Added fields: `revenueLocal`, `spendLocal`, `grossProfitLocal`, `netMarginLocal`, `currencyCode`
- Native values are parsed directly from sheets (no conversion)
- USD values are calculated: `native * localToUsd` rate

**Key Logic:**
```javascript
// Parse native currency values from sheets
const revenueLocal = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.revenue));
const spendLocal = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.spend));

// Convert to USD
const revenue = revenueLocal * localToUsd;
const spend = spendLocal * localToUsd;

// Calculate in both currencies
const grossProfit = revenue - spend;
const grossProfitLocal = revenueLocal - spendLocal;
const netMargin = grossProfit - rebate;
const netMarginLocal = grossProfitLocal - rebateLocal;
```

### 2. `backend/services/bigQuerySyncService.js`
**Changes:**
- Schema already includes native currency columns (added earlier)
- Updated `toBigQueryRows()` to map native currency fields:
  - `currency_code`: Currency code for the row
  - `revenue_local`: Native revenue value
  - `spend_local`: Native spend value
  - `gross_profit_local`: Native gross profit
  - `net_margin_local`: Native net margin

### 3. `backend/services/bigQueryReadService.js`
**Changes:**
- Added `getCurrencyColumns()` helper function:
  ```javascript
  function getCurrencyColumns(currencyMode = "usd") {
    const isNative = currencyMode === "native";
    return {
      revenue: isNative ? "revenue_local" : "revenue",
      spend: isNative ? "spend_local" : "spend",
      grossProfit: isNative ? "gross_profit_local" : "gross_profit",
      netMargin: isNative ? "net_margin_local" : "net_margin"
    };
  }
  ```

- Updated query functions to use appropriate columns:
  - `getKpis()` - KPI cards
  - `getOverviewSeries()` - Trend charts (revenue, margin, CPM)
  - `getRegionTable()` - Region table
  - `getCountryWiseTable()` - Country-wise table

**Example:**
```javascript
const currencyMode = filters.currencyMode || "usd";
const cols = getCurrencyColumns(currencyMode);

// Use cols.revenue, cols.spend, cols.grossProfit, cols.netMargin in queries
SUM(COALESCE(t.${cols.revenue}, 0)) AS total_revenue
```

### 4. `backend/routes/overview.js`
**Changes:**
- Modified `parseFilters()` to extract `currencyMode` from query parameters:
  ```javascript
  currencyMode: query.currencyMode === "native" ? "native" : "usd"
  ```

---

## Frontend Changes

### 1. `frontend/src/utils/currencyDisplay.js`
**CRITICAL CHANGE:**
- Removed conversion logic from `convertUsdToDisplay()`
- Function now just passes through values (backend already returns correct values)

```javascript
/**
 * NO CONVERSION - Backend already returns the correct values based on currency mode.
 */
export function convertUsdToDisplay(value, context) {
  const n = toNumber(value);
  if (n === null) return null;
  
  // Backend already returns the correct values based on currency mode
  // No conversion needed on frontend
  return n;
}
```

### 2. Updated Components to Pass Currency Mode

Components that support currency toggle (KPIs and Tables):

```javascript
const apiParams = {
  ...toApiParams(filters),
  currencyMode: currencyContext?.mode === "Native" ? "native" : "usd"
};
```

**Updated Components:**
- ✅ `frontend/src/components/KPICards.jsx` - Supports currency toggle
- ✅ `frontend/src/components/CountryWiseTable.jsx` - Supports currency toggle
- ✅ `frontend/src/components/ProductWiseTable.jsx` - Supports currency toggle
- ✅ `frontend/src/components/CampaignWiseTable.jsx` - Supports currency toggle
- ✅ `frontend/src/components/BottomCampaignsTable.jsx` - Supports currency toggle
- ❌ `frontend/src/components/TrendChart.jsx` - Always uses USD (no currency mode parameter)

**Also updated useEffect dependencies to include `currencyContext?.mode` for components that support currency toggle**

---

## Data Flow

### USD Mode (Default)
1. User selects "USD" toggle
2. Frontend passes `currencyMode: "usd"` to backend (for KPIs and tables only)
3. Backend queries `revenue`, `spend`, `gross_profit`, `net_margin` columns
4. Frontend displays values as-is (no conversion)
5. Trend charts always use USD (no currency mode parameter)

### Native Mode (Single Country Selected)
1. User selects single country (e.g., Australia)
2. User clicks "Native Currency" toggle
3. Frontend passes `currencyMode: "native"` to backend (for KPIs and tables only)
4. Backend queries `revenue_local`, `spend_local`, `gross_profit_local`, `net_margin_local` columns
5. Frontend displays values as-is (no conversion)
6. Currency code shown is from `currencyContext.currencyCode` (e.g., "AUD")
7. **Trend charts remain in USD** (always show historical data)

---

## Currency Mapping

From `backend/services/privateSheetsService.js`:

```javascript
const COUNTRY_DEFAULT_CURRENCY = {
  Thailand: "THB",
  Australia: "AUD",
  Japan: "JPY",
  India: "INR",
  Canada: "CAD",
  Singapore: "SGD",
  "New Zealand": "NZD",
  Indonesia: "IDR",
  Malaysia: "RM",
  // ... others default to USD
};

const LOCAL_TO_USD_BY_CURRENCY = {
  USD: 1,
  THB: 0.03155,
  AUD: 0.69,
  JPY: 0.0064,
  INR: 0.011,
  CAD: 0.72,
  SGD: 0.76564,
  NZD: 0.6,
  IDR: 0.00006,
  RM: 0.25,
  GBP: 1.35
};
```

---

## Testing Steps

1. **Run Full Sync from Admin Panel**
   - This populates the new native currency columns in BigQuery
   - Wait for sync to complete

2. **Test USD Mode (Default)**
   - Select "All" or multiple countries
   - Verify USD values are displayed correctly
   - Check KPI cards, trend charts, and tables

3. **Test Native Mode - Australia (AUD)**
   - Select only "Australia" from filters
   - Click "Native Currency" toggle
   - Expected: Revenue = 1,074,186.04 AUD (not 1.12M)
   - Verify all components show AUD values

4. **Test Native Mode - Thailand (THB)**
   - Select only "Thailand"
   - Click "Native Currency" toggle
   - Verify THB values are displayed

5. **Test Native Mode - Japan (JPY)**
   - Select only "Japan"
   - Click "Native Currency" toggle
   - Verify JPY values are displayed

6. **Test Toggle Behavior**
   - Currency toggle should only appear when single country is selected
   - Switching between USD and Native should update all components
   - Values should NOT be converted on frontend (just displayed as-is)

---

## Key Points

✅ **Native values stored in BigQuery** - No data loss, both USD and native preserved
✅ **Backend returns correct values** - Based on currency mode parameter
✅ **Frontend does NO conversion** - Just displays what backend sends
✅ **Currency code displayed correctly** - From currencyContext
✅ **KPIs and Tables support currency toggle** - Switch between USD and native
✅ **Trend charts always use USD** - Show historical data consistently

📊 **Currency Mode Behavior:**
- **KPI Cards**: Support both USD and native currency
- **Tables** (Country, Product, Campaign, Bottom Campaigns): Support both USD and native currency
- **Trend Charts** (Revenue, Margin, CPM, Net Margin): Always show USD (for historical consistency)

---

## Next Steps

1. Run full sync from Admin Panel
2. Test with Australia, Thailand, Japan
3. Verify native values match expected amounts
4. Check that USD mode still works correctly
5. Confirm no double conversion is happening

---

## Files Modified

### Backend
- `backend/services/privateSheetsService.js`
- `backend/services/bigQuerySyncService.js`
- `backend/services/bigQueryReadService.js`
- `backend/routes/overview.js`

### Frontend
- `frontend/src/utils/currencyDisplay.js`
- `frontend/src/components/KPICards.jsx`
- `frontend/src/components/TrendChart.jsx`
- `frontend/src/components/CountryWiseTable.jsx`
- `frontend/src/components/ProductWiseTable.jsx`
- `frontend/src/components/CampaignWiseTable.jsx`
- `frontend/src/components/BottomCampaignsTable.jsx`
