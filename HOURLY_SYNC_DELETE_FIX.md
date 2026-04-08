# Hourly Sync Data Loss Fix

## Problem
Data dropped from 525 campaigns to 15 after an hourly sync at 6:30 PM IST (1:00 PM UTC).

## Root Cause
The hourly sync DELETE query was too aggressive:

```sql
DELETE FROM campaign_tracker_consolidated
WHERE start_date >= '2026-02-08'  -- Last 2 months
   OR end_date >= '2026-02-08'
   OR start_date IS NULL  -- ⚠️ PROBLEM: Deletes ALL campaigns without start_date
```

The `OR start_date IS NULL` clause was deleting ALL campaigns that don't have a start date field, which could be hundreds of campaigns.

## The Fix

**Before:**
```sql
DELETE FROM table
WHERE start_date >= cutoff
   OR end_date >= cutoff
   OR start_date IS NULL  -- ❌ Too aggressive
```

**After:**
```sql
DELETE FROM table
WHERE (start_date >= cutoff OR end_date >= cutoff)  -- ✅ Only delete recent campaigns
```

## What Changed

### File: `backend/services/bigQuerySyncService.js`

Removed the `OR start_date IS NULL` condition from the DELETE query. Now the hourly sync only deletes campaigns that have dates within the last 2 months, preserving all other campaigns.

## How It Works Now

### Hourly Sync (Every Hour)
1. Reads all campaigns from Google Sheets
2. Filters to keep only last 2 months (based on start_date or end_date)
3. **Deletes only campaigns with dates >= cutoff** (not campaigns with NULL dates)
4. Inserts the filtered recent campaigns
5. Result: Historical campaigns remain intact

### Example
- Cutoff date: 2026-02-08 (2 months ago)
- Campaign A: start_date = 2026-03-01 → **Deleted and re-inserted** ✅
- Campaign B: start_date = 2025-12-01 → **Preserved** ✅
- Campaign C: start_date = NULL → **Preserved** ✅ (was being deleted before)

## Impact

### Before Fix
- Hourly sync deleted ~510 campaigns (those with NULL start_date)
- Only 15 recent campaigns remained
- Data loss every hour

### After Fix
- Hourly sync only deletes/updates recent campaigns
- Historical campaigns preserved
- No data loss

## Testing

### Check Current Data
```bash
cd backend
node scripts/diagnoseProdData.js
```

### Trigger Manual Sync to Test
```bash
curl -X POST http://localhost:5000/api/overview/sync/start
```

### Verify After Next Hourly Sync
```sql
SELECT COUNT(*) as total, COUNT(DISTINCT campaign_id) as campaigns
FROM `tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated`
```

Should maintain ~3,000 rows and 627 campaigns.

## Files Changed
- `backend/services/bigQuerySyncService.js` - Fixed DELETE query
- `backend/services/bigQueryScheduler.js` - Reverted unnecessary daily sync change

## Deployment
1. ✅ Fixed in dev branch
2. ⏳ Commit and push
3. ⏳ Deploy to dev environment
4. ⏳ Monitor next hourly sync
5. ⏳ If successful, merge to main
