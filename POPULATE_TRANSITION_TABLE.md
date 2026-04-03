# Populate Transition Table - Manual Sync Required

## Current Status
The frontend reorganization is complete:
- ✅ `NetMarginTrendChart` component created with dedicated filters
- ✅ `CombinedTrends` now has 3 charts (Revenue, Gross Margin, CPM)
- ✅ `Overview.jsx` updated to use new layout
- ✅ CSS styling added for visual separation

## Backend Status
- ✅ Data source logic fixed in `bigQueryReadService.js`
- ✅ Transition table schema simplified in `bigQuerySyncService.js`
- ✅ Column mappings corrected in `privateSheetsService.js`

## Next Step Required: Manual Sync
The transition table needs to be populated with data from the branding sheet. This requires triggering a manual BigQuery sync.

### How to Trigger Manual Sync

**Option 1: Via Admin Panel (Recommended)**
1. Go to the dashboard admin panel
2. Navigate to the BigQuery sync section
3. Click "Start Manual Sync" or "Full Refresh"

**Option 2: Via API Call**
```bash
curl -X POST "https://your-backend-url/api/overview/sync/bigquery?fullRefresh=true" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Option 3: Via Render Dashboard**
1. Go to your Render dashboard
2. Open the backend service logs
3. The hourly sync should populate the table automatically

### Expected Result
After sync completion:
- `overview_transition_metrics` table will have branding sheet data
- All 4 charts will display data correctly
- Filters will work across all charts
- Net Margin chart will show tracker data only
- Other 3 charts will show: current/last month from tracker + historical from branding

### Verification
Check that all 4 charts display data:
1. **Booked Revenue Trend** - should show historical + recent data
2. **Gross Margin Trend** - should show historical + recent data  
3. **Average Buying CPM Trend** - should show historical + recent data
4. **Net Margin Trend (Tracker Sheet)** - should show tracker data only

## Data Source Logic Summary
- **Net Margin**: Tracker sheet ONLY (all months)
- **Revenue/Margin/CPM**: Branding sheet (historical) + Tracker sheet (current & last month)
- **Column Mappings**: 
  - `"Sales Value in USD"` (branding) ↔ `"Revenue"` (tracker)
  - `"Media Spend in USD"` (branding) ↔ `"Spend"` (tracker)  
  - `"eCPM."` (branding) ↔ `"Buying CPM"` (tracker)