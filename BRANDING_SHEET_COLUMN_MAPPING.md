# Branding Sheet Column Mapping for BigQuery Table

## 📊 CURRENT COLUMN MAPPINGS

Here are all the columns I'm referencing from the branding sheet to create the `overview_transition_metrics` BigQuery table:

### 1. **Date Columns**
```javascript
// Primary date columns (separate)
month: ["Month"]                    // Expected: "January", "February", etc.
year: ["Year"]                      // Expected: 2020, 2021, 2022, etc.

// Alternative combined date columns (fallback)
monthYear: ["Month-Year", "Month Year", "Date", "Period"]  // Expected: "Jan-20", "March 2020", etc.
```

### 2. **Location Columns**
```javascript
country: ["Country", "Region", "Market"]  // Expected: "Thailand", "Philippines", "USA", etc.
```

### 3. **Financial Columns**
```javascript
salesValueUsd: ["Sales Value in USD"]     // Expected: 1819, 2195, 5.5, 396.37, etc.
mediaSpendUsd: ["Media Spend in USD"]     // Expected: Spend amounts in USD
ecpm: ["eCPM."]                          // Expected: eCPM values (note the period!)
```

---

## 🔍 HOW DATA IS PROCESSED

### Input (from Branding Sheet)
```
Row example:
- Month: "September"
- Year: 2020
- Country: "Thailand" 
- Sales Value in USD: 1819
- Media Spend in USD: 0
- eCPM.: 0
```

### Output (to BigQuery table)
```javascript
{
  sync_id: "sync_1234567890",
  synced_at: "2024-01-01T12:00:00Z",
  month: "September",              // from Month column
  year: 2020,                      // from Year column  
  country: "Thailand",             // from Country column
  region: "India+SEA",             // calculated from country
  revenue: 1819,                   // from "Sales Value in USD"
  spend: 0,                        // from "Media Spend in USD"
  gross_profit: 1819,             // calculated: revenue - spend
  gross_margin_pct: 100,          // calculated: (gross_profit / revenue) * 100
  net_margin: 1819,               // same as gross_profit for legacy data
  net_margin_pct: 100,            // same as gross_margin_pct for legacy data
  cpm: 0,                         // from "eCPM." column
  source_sheet_id: "1MwWqMLj5b4FwIS6wD3FugfwgbWlyJD0xaQJLpmlRlQs",
  source_tab: "Raw Spends Data",
  source_country: "Thailand"
}
```

---

## ⚠️ POTENTIAL COLUMN NAME ISSUES

Based on your logs showing 16,138 rows being parsed but only 12 making it to BigQuery, here are the most likely column name mismatches:

### 1. **eCPM Column** (Most Likely Issue)
```javascript
// Current mapping:
ecpm: ["eCPM."]  // Note the period at the end!

// Possible actual column names in your sheet:
// "eCPM" (without period)
// "ECPM" 
// "eCPM " (with space)
// "Average eCPM"
// "Buying CPM"
```

### 2. **Sales Value Column**
```javascript
// Current mapping:
salesValueUsd: ["Sales Value in USD"]

// Possible actual column names:
// "Sales Value USD"
// "Sales Value (USD)"
// "Revenue USD"
// "Sales Value"
```

### 3. **Media Spend Column**
```javascript
// Current mapping:
mediaSpendUsd: ["Media Spend in USD"]

// Possible actual column names:
// "Media Spend USD"
// "Media Spend (USD)"
// "Spend USD"
// "Media Spend"
```

### 4. **Country Column**
```javascript
// Current mapping:
country: ["Country", "Region", "Market"]

// Should be fine, but possible alternatives:
// "Countries"
// "Market"
// "Geography"
```

---

## 🔧 HOW TO FIX COLUMN MAPPINGS

If you want to manually correct the column name mappings, update the `OVERVIEW_RAW_ALIASES` object in `backend/services/privateSheetsService.js`:

```javascript
const OVERVIEW_RAW_ALIASES = {
  month: ["Month"],
  year: ["Year"],
  country: ["Country", "Region", "Market"],
  
  // UPDATE THESE BASED ON YOUR ACTUAL COLUMN NAMES:
  salesValueUsd: [
    "Sales Value in USD",
    "Sales Value USD",        // Add alternative names
    "Sales Value (USD)",      // Add more alternatives
    "Revenue USD"             // Add more alternatives
  ],
  mediaSpendUsd: [
    "Media Spend in USD",
    "Media Spend USD",        // Add alternative names
    "Media Spend (USD)",      // Add more alternatives
    "Spend USD"               // Add more alternatives
  ],
  ecpm: [
    "eCPM.",                  // Current (with period)
    "eCPM",                   // Without period
    "ECPM",                   // All caps
    "Average eCPM",           // With prefix
    "Buying CPM"              // Alternative name
  ],
  
  monthYear: ["Month-Year", "Month Year", "Date", "Period"]
};
```

---

## 🕵️ DEBUGGING STEPS

### 1. Check Actual Column Names
From your logs, you can see the actual headers:
```
[getBrandingSheetParsedData] Found headers at row 0: ID, Year, Month, Campaign Name, Country, Brand Name, New Brand, Parent Brand, Agency, New Agency, Parent Agency, New Parent Agency, IO Agency Name, Industry/Category, New Industry Column
```

**I notice the issue!** The headers shown in your logs are:
- `Year` ✅ (matches)
- `Month` ✅ (matches) 
- `Country` ✅ (matches)

But I don't see:
- `Sales Value in USD` ❌ (missing!)
- `Media Spend in USD` ❌ (missing!)
- `eCPM.` ❌ (missing!)

### 2. Find the Correct Financial Column Names
You need to identify which columns in your branding sheet contain:
- **Revenue/Sales data** (currently looking for "Sales Value in USD")
- **Spend data** (currently looking for "Media Spend in USD") 
- **CPM data** (currently looking for "eCPM.")

### 3. Update the Mappings
Once you identify the correct column names, update the `OVERVIEW_RAW_ALIASES` and I'll deploy the fix.

---

## 🚨 IMMEDIATE ACTION NEEDED

Based on your log headers, the financial columns are missing from the mapping. Can you tell me:

1. **What is the exact name of the revenue/sales column?**
2. **What is the exact name of the spend column?**  
3. **What is the exact name of the CPM column?**

Once I have these, I can update the mappings and fix the data parsing issue!