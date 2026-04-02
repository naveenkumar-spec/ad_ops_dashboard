# Populate Transition Table with Legacy Data

## The Issue
The 3 bar charts (Revenue, Margin, CPM) are only showing 2025-2026 data because the `overview_transition_metrics` table in BigQuery doesn't have the historical data from 2020-2024 yet.

## The Solution
Run a manual sync to populate the transition table with legacy data from the branding sheet.

---

## Step 1: Trigger Manual Sync

### Option A: From Admin Panel (Recommended)
1. Log in to your dashboard as admin
2. Go to **Admin Setup** page
3. Scroll to **"BigQuery Manual Sync"** section
4. Click **"Run Manual Sync"** button
5. Wait for sync to complete (usually 2-5 minutes)
6. Check the status shows "completed"

### Option B: From Render Logs
If you can't access the admin panel:
1. Go to Render Dashboard
2. Click your backend service
3. Go to "Shell" tab
4. Run: `curl -X POST http://localhost:10000/api/overview/sync/bigquery?async=true&fullRefresh=true`

---

## Step 2: Verify Data Was Synced

### Check Sync Status
In Admin panel, look for:
- **Status**: completed
- **Transition Row Count**: Should be > 0 (e.g., 73 rows for 2020-2026 data)
- **Message**: "Sync completed"

### Check Render Logs
Look for these messages:
```
[BigQuery Sync] 📊 SYNC PROCESS: Reading Google Sheets for legacy trend data
[getOverviewLegacyTrend] Total rows to parse: 16138
[BigQuery Sync] ✅ Legacy trend rows: revenue=73, margin=73, cpm=73
[BigQuery Sync] Sync success: XXXX rows
```

---

## Step 3: Verify Charts Show Historical Data

1. Go to **Overview** page
2. Look at the 3 bar charts:
   - Booked Revenue Trend
   - Gross Margin Trend
   - Average Buying CPM Trend

3. Click the **"Select years"** dropdown
4. You should now see years from **2020 to 2026**
5. Select multiple years to verify data is showing

---

## What the Sync Does

### Reads from Google Sheets
- **Branding Sheet**: Historical data (2020-2024)
- **Tracker Sheets**: Recent data (2025-2026)

### Writes to BigQuery
- **Main Table** (`campaign_tracker_consolidated`): Tracker sheet data
- **Transition Table** (`overview_transition_metrics`): Legacy branding sheet data

### Merges for Display
- **Current & Previous Month**: Uses tracker sheet data
- **All Other Months**: Uses branding sheet data
- **Result**: Complete historical view from 2020 to present

---

## Troubleshooting

### Sync Fails
**Error**: "Failed to read legacy branding sheet"

**Causes**:
1. Branding sheet not accessible
2. Sheet structure changed
3. Google Sheets API quota exceeded

**Solution**:
- Check Render logs for specific error
- Verify branding sheet ID in `googleSheetsSources.json`
- Wait a few minutes if quota exceeded

### Transition Row Count is 0
**Cause**: Legacy data couldn't be read or processed

**Solution**:
1. Check if branding sheet has data
2. Verify sheet has columns: Year, Month, Sales Value USD, Media Spend USD, eCPM
3. Run sync again with "Force Refresh"

### Charts Still Show Only 2025-2026
**Causes**:
1. Sync hasn't completed yet
2. Browser cache
3. Deployment not finished

**Solutions**:
1. Wait for sync to complete (check Admin panel)
2. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
3. Wait for Render deployment to finish
4. Check Render logs for `✅ USING BIGQUERY` messages

---

## Expected Results After Sync

### Transition Table
- **Rows**: ~73 (12 months × 6 years + some months)
- **Years**: 2020, 2021, 2022, 2023, 2024, 2025, 2026
- **Metrics**: Revenue, Margin %, CPM

### Bar Charts
- **Year Dropdown**: Shows 2020-2026
- **Data Points**: All months from 2020 to present
- **Source Note**: "Current and previous month data is sourced from Trackers, all earlier data is sourced from the Branding Sheet"

---

## Automatic Sync

After the initial manual sync, the hourly sync will keep the transition table updated:
- **Frequency**: Every hour (at :00)
- **Updates**: New tracker data + refreshed branding data
- **No Action Needed**: Runs automatically

---

## Summary

1. ✅ Run manual sync from Admin panel
2. ✅ Wait for completion (2-5 minutes)
3. ✅ Verify transition row count > 0
4. ✅ Check charts show 2020-2026 data
5. ✅ Hourly sync keeps it updated

The historical data will now be available in all 3 bar charts!
