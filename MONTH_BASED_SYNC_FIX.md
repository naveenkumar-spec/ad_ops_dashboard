# Month-Based Sync Fix

## Changes Made

### 1. Use Month/Year Columns Instead of Start/End Dates

**Problem:** The hourly sync was using `start_date` and `end_date` columns to determine which campaigns are recent. This caused issues because:
- Some campaigns don't have these date fields
- The logic was complex and error-prone

**Solution:** Now using `month` and `year` columns which are always present and more reliable.

### 2. Added Dataset Safety Warning

**Problem:** The code defaults to production dataset `"adops_dashboard"` if `BIGQUERY_DATASET_ID` is not set in `.env`. This is dangerous - someone could accidentally write to production.

**Solution:** Added a warning that logs on startup if the environment variable is not set.

## Technical Details

### Filter Logic (Recent-Only Mode)

**Before:**
```javascript
// Include if start_date or end_date is recent
const startDate = row.start_date ? new Date(row.start_date) : null;
const endDate = row.end_date ? new Date(row.end_date) : null;

if (!startDate && !endDate) return true; // Include if no dates
if (startDate && startDate >= cutoffDate) return true;
if (endDate && endDate >= cutoffDate) return true;
```

**After:**
```javascript
// Skip rows without month or year
if (!row.month || !row.year) return false;

// Compare year and month
if (rowYear > cutoffYear) return true;
if (rowYear === cutoffYear && rowMonth >= cutoffMonth) return true;
```

### DELETE Query (Recent-Only Mode)

**Before:**
```sql
DELETE FROM table
WHERE (start_date >= '2026-02-08' OR end_date >= '2026-02-08')
```

**After:**
```sql
DELETE FROM table
WHERE year >= 2026
  AND month IN ('February', 'March', 'April', ...)
```

## Benefits

1. **More Reliable:** Month/year columns are always present
2. **Clearer Logic:** Easier to understand and debug
3. **No NULL Issues:** Rows without month/year are explicitly excluded
4. **Better Performance:** Simpler SQL query

## Dataset Configuration

### Your Current Setup
```env
# backend/.env
BIGQUERY_DATASET_ID=adops_dashboard_dev  ✅ Correct for development
```

### Production Setup
```env
# Production .env (or not set)
BIGQUERY_DATASET_ID=adops_dashboard  ✅ Correct for production
```

### Safety Warning
If `BIGQUERY_DATASET_ID` is not set, you'll see:
```
⚠️  WARNING: BIGQUERY_DATASET_ID not set in .env, defaulting to PRODUCTION dataset 'adops_dashboard'
⚠️  Set BIGQUERY_DATASET_ID=adops_dashboard_dev in .env for development
```

## Example: How Recent-Only Filtering Works

### Scenario
- Current date: April 2026
- `monthsToSync: 2` (last 2 months)
- Cutoff: February 2026

### Campaigns
| Campaign | Month | Year | Included? |
|----------|-------|------|-----------|
| A | March | 2026 | ✅ Yes (recent) |
| B | February | 2026 | ✅ Yes (at cutoff) |
| C | January | 2026 | ❌ No (too old) |
| D | NULL | 2026 | ❌ No (no month) |
| E | March | 2025 | ❌ No (too old) |

### DELETE Query
```sql
DELETE FROM campaign_tracker_consolidated
WHERE year >= 2026
  AND month IN ('February', 'March', 'April')
```

This deletes only campaigns from Feb 2026 onwards, preserving all historical data.

## Testing

### 1. Check Startup Logs
```bash
cd backend
npm start
```

Look for:
```
✅ Using BigQuery dataset: adops_dashboard_dev
```

### 2. Trigger Manual Sync
```bash
curl -X POST http://localhost:5000/api/overview/sync/start
```

### 3. Check Logs
```
[BigQuery Sync] 📅 RECENT ONLY: 1500 rows (last 2 months, cutoff: February 2026)
[BigQuery Sync] 📊 Filtered out 1500 older rows
[BigQuery Sync] 🗑️ RECENT ONLY: Deleting data from February 2026 onwards
[BigQuery Sync] ✅ Deleted recent data (months >= February 2026)
```

### 4. Verify Data Integrity
```bash
cd backend
node scripts/diagnoseDevData.js
```

Should show consistent row counts across syncs.

## Files Changed
- `backend/services/bigQuerySyncService.js`
  - Changed filter logic to use month/year
  - Changed DELETE query to use month/year
  - Added dataset safety warning

## Deployment
1. ✅ Changes made in dev branch
2. ⏳ Commit and push
3. ⏳ Deploy to dev environment
4. ⏳ Monitor next hourly sync
5. ⏳ Verify data integrity
6. ⏳ If successful, merge to main
