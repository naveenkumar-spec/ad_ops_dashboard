# Deploy BigQuery Fix to Render

## What Was Fixed
The dashboard was calling Google Sheets directly instead of reading from BigQuery. This has been fixed in the code.

## Files Changed
1. `backend/routes/overview.js` - Now uses BigQuery instead of Google Sheets
2. `backend/services/bigQuerySyncService.js` - Added clear logging
3. `backend/.env` - Updated comments

## How to Deploy to Render

### Option 1: Git Push (Recommended)
```bash
# Commit the changes
git add backend/routes/overview.js backend/services/bigQuerySyncService.js backend/.env
git commit -m "Fix: Dashboard now reads from BigQuery instead of Google Sheets"
git push origin main
```

Render will automatically detect the push and redeploy (takes 2-3 minutes).

### Option 2: Manual Deploy
1. Go to Render Dashboard
2. Click your backend service
3. Click "Manual Deploy" → "Deploy latest commit"

## How to Verify the Fix

### 1. Check Logs After Deployment
Look for these NEW log messages:

**During Dashboard Use (Good - No Google Sheets):**
```
[withLegacyOverviewTrend] ✅ USING BIGQUERY (not Google Sheets) for metric=revenue
[withLegacyOverviewTrend] ✅ BigQuery returned 73 months (NO Google Sheets API call)
```

**During Hourly Sync (Expected - Google Sheets OK):**
```
[BigQuery Sync] 📊 SYNC PROCESS: Reading Google Sheets for legacy trend data (this is expected)
[getOverviewLegacyTrend] Found headers at row 0: ...
[getOverviewLegacyTrend] Total rows to parse: 16138
[BigQuery Sync] ✅ Legacy trend rows: revenue=73, margin=73, cpm=73
```

### 2. Test the Dashboard
1. Open the dashboard in your browser
2. Navigate to Overview page
3. Change filters (region, year, etc.)
4. Check Render logs - you should see:
   - ✅ `USING BIGQUERY` messages
   - ❌ NO `[getOverviewLegacyTrend]` messages (unless sync is running)

### 3. Monitor Quota Usage
- Before fix: Hundreds of Google Sheets API calls per hour
- After fix: Only 10-20 calls per hour (from hourly sync only)

## Expected Behavior After Fix

### Dashboard Users
- All data comes from BigQuery
- No Google Sheets API calls
- Fast response times
- No quota impact

### Hourly Sync (Every hour at :00)
- Reads Google Sheets (expected)
- Updates BigQuery
- Uses ~10-20 API calls
- Logs show `[BigQuery Sync] 📊 SYNC PROCESS`

### Manual Sync (Admin Panel)
- Reads Google Sheets (expected)
- Updates BigQuery immediately
- Logs show `[BigQuery Sync] 📊 SYNC PROCESS`

## Troubleshooting

### Still Seeing Google Sheets Calls?
1. **Check timestamp**: Are logs from sync time (every hour at :00)?
   - If YES: This is expected behavior
   - If NO: The fix may not be deployed yet

2. **Check log message**: Does it say `SYNC PROCESS`?
   - If YES: This is the hourly sync (expected)
   - If NO: Dashboard may still be calling Sheets (redeploy needed)

3. **Verify deployment**: 
   ```bash
   # Check latest commit on Render
   git log -1 --oneline
   ```
   Should show: "Fix: Dashboard now reads from BigQuery instead of Google Sheets"

### Quota Still Being Hit?
- Check if you have multiple Render instances running
- Verify `DATA_SOURCE=bigquery` in Render environment variables
- Check if other services are calling Google Sheets API

## Summary

**Before Fix:**
- Dashboard: Google Sheets ❌
- Sync: Google Sheets ❌
- Total: Hundreds of API calls/hour

**After Fix:**
- Dashboard: BigQuery ✅
- Sync: Google Sheets ✅ (expected)
- Total: 10-20 API calls/hour

The fix ensures dashboard users never hit Google Sheets API, only the hourly sync process does.
