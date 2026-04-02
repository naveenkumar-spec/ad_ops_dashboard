# BigQuery Sync & Google Sheets Quota Management

## Understanding the System (CORRECTED)

### How It Works
1. **Dashboard Reads**: All dashboard data comes from BigQuery (NO Google Sheets API calls)
2. **Hourly Sync**: Background job reads Google Sheets → Updates BigQuery
3. **Manual Sync**: Admin can trigger sync from Admin panel

### The Previous Issue (NOW FIXED!)
- The dashboard was calling `privateSheetsService.getOverviewLegacyTrend()` directly
- This was reading from Google Sheets on EVERY page load
- This caused quota issues even though BigQuery sync was working

### The Fix
- Changed `backend/routes/overview.js` to use `bigQueryReadService.getMergedOverviewSeries()`
- Now ALL dashboard reads come from BigQuery (transition table)
- Only the hourly sync process reads Google Sheets
- Dashboard users never hit Google Sheets API!

---

## Current Configuration

### Sync Schedule
```env
BIGQUERY_SYNC_ENABLED=true
BIGQUERY_SYNC_CRON=0 * * * *  # Every hour
BIGQUERY_SYNC_FULL_REFRESH=true
BIGQUERY_SKIP_IF_UNCHANGED=true
```

### What This Means
- Sync runs every hour (reads Google Sheets → Updates BigQuery)
- Dashboard ALWAYS reads from BigQuery (fast, no quota impact)
- Users can have fresh data every hour
- Only the sync process uses Google Sheets API quota

---

## Why Hourly Sync is Now Safe

### Before the Fix
- Dashboard: Read Google Sheets directly ❌
- Sync: Read Google Sheets hourly ❌
- **Total**: Hundreds of Google Sheets API calls per hour

### After the Fix
- Dashboard: Read BigQuery only ✅
- Sync: Read Google Sheets hourly ✅
- **Total**: ~10-20 Google Sheets API calls per hour (only from sync)

### Quota Math
- Google Sheets API: 100 requests per 100 seconds
- Your sheets: ~10 sheets
- Hourly sync: 10 requests per hour
- **Usage**: 10% of quota limit ✅

---

## Sync Frequency Options

### Option 1: Every 6 Hours (Current - Recommended)
```env
BIGQUERY_SYNC_CRON=0 */6 * * *
```
- **Runs**: 4 times per day
- **Quota Impact**: Low
- **Data Freshness**: Max 6 hours old
- **Best for**: Most teams

### Option 2: Every 12 Hours
```env
BIGQUERY_SYNC_CRON=0 */12 * * *
```
- **Runs**: 2 times per day (00:00, 12:00)
- **Quota Impact**: Very Low
- **Data Freshness**: Max 12 hours old
- **Best for**: Teams with stable data

### Option 3: Daily
```env
BIGQUERY_SYNC_CRON=0 0 * * *
```
- **Runs**: Once per day at midnight
- **Quota Impact**: Minimal
- **Data Freshness**: Max 24 hours old
- **Best for**: Historical reporting

### Option 4: Manual Only (Disable Auto-Sync)
```env
BIGQUERY_SYNC_ENABLED=false
```
- **Runs**: Only when admin clicks "Run Manual Sync"
- **Quota Impact**: Controlled by admin
- **Data Freshness**: Depends on manual syncs
- **Best for**: Development/testing

---

## Cron Expression Guide

Format: `minute hour day month weekday`

### Common Patterns
```bash
# Every hour
0 * * * *

# Every 2 hours
0 */2 * * *

# Every 6 hours
0 */6 * * *

# Every 12 hours
0 */12 * * *

# Daily at midnight
0 0 * * *

# Daily at 9 AM
0 9 * * *

# Twice daily (9 AM and 9 PM)
0 9,21 * * *

# Every weekday at 8 AM
0 8 * * 1-5

# Every Monday at 6 AM
0 6 * * 1
```

---

## Google Sheets API Quota Limits

### Default Quotas (Free Tier)
- **Read requests**: 100 per 100 seconds per user
- **Write requests**: 100 per 100 seconds per user
- **Daily limit**: 500 requests per day per project

### How Many Sheets Can You Sync?
Assuming you have 10 Google Sheets configured:
- **Hourly sync**: 10 sheets × 24 hours = 240 requests/day ✅
- **Every 6 hours**: 10 sheets × 4 syncs = 40 requests/day ✅
- **Every 12 hours**: 10 sheets × 2 syncs = 20 requests/day ✅

### If You Hit Quota Limits
Error message: `Quota exceeded for quota metric 'Read requests' and limit 'Read requests per minute per user'`

**Solutions:**
1. Reduce sync frequency (recommended)
2. Request quota increase from Google Cloud Console
3. Use manual sync only when needed
4. Optimize sheet count (combine sheets if possible)

---

## Monitoring Sync Status

### Check Sync Status
1. Go to Admin Setup page
2. Scroll to "BigQuery Manual Sync" section
3. View:
   - Current status (idle/running/completed)
   - Last sync time
   - Row counts
   - Any errors

### Check Render Logs
```bash
# In Render dashboard
1. Go to your backend service
2. Click "Logs" tab
3. Search for: "[BigQuery Sync]"
```

### Common Log Messages
```
[BigQuery Scheduler] Sync success: 1234 rows
[BigQuery Scheduler] No change detected. Sync skipped.
[BigQuery Sync] Failed to read legacy branding sheet
```

---

## Optimization Tips

### 1. Skip Unchanged Data (Already Enabled)
```env
BIGQUERY_SKIP_IF_UNCHANGED=true
```
- Compares data checksum before writing to BigQuery
- Skips BigQuery write if data unchanged
- **Note**: Still reads Google Sheets to compute checksum

### 2. Increase Read Cache
```env
BIGQUERY_READ_CACHE_MS=120000  # 2 minutes
```
- Dashboard caches BigQuery reads
- Reduces BigQuery API calls
- Doesn't affect Google Sheets quota

### 3. Manual Sync for Updates
- Disable auto-sync: `BIGQUERY_SYNC_ENABLED=false`
- Use "Run Manual Sync" button when you update sheets
- Full control over when quota is used

---

## Recommended Setup by Team Size

### Small Team (1-10 users)
```env
BIGQUERY_SYNC_ENABLED=true
BIGQUERY_SYNC_CRON=0 */6 * * *  # Every 6 hours
BIGQUERY_SYNC_FULL_REFRESH=true
BIGQUERY_SKIP_IF_UNCHANGED=true
```
**Why**: Balances freshness with quota usage

### Medium Team (10-50 users)
```env
BIGQUERY_SYNC_ENABLED=true
BIGQUERY_SYNC_CRON=0 */12 * * *  # Every 12 hours
BIGQUERY_SYNC_FULL_REFRESH=true
BIGQUERY_SKIP_IF_UNCHANGED=true
```
**Why**: Reduces quota usage, data still fresh enough

### Large Team (50+ users)
```env
BIGQUERY_SYNC_ENABLED=true
BIGQUERY_SYNC_CRON=0 0 * * *  # Daily at midnight
BIGQUERY_SYNC_FULL_REFRESH=true
BIGQUERY_SKIP_IF_UNCHANGED=true
```
**Why**: Minimal quota usage, suitable for reporting

### Development/Testing
```env
BIGQUERY_SYNC_ENABLED=false
```
**Why**: Use manual sync only, save quota

---

## Troubleshooting

### Error: "Quota exceeded for quota metric 'Read requests'"

**Cause**: Too many Google Sheets API calls

**Solutions:**
1. Reduce sync frequency:
   ```env
   BIGQUERY_SYNC_CRON=0 */12 * * *  # Change to every 12 hours
   ```

2. Temporarily disable auto-sync:
   ```env
   BIGQUERY_SYNC_ENABLED=false
   ```

3. Wait 100 seconds for quota to reset

4. Request quota increase:
   - Go to Google Cloud Console
   - Navigate to APIs & Services → Quotas
   - Search for "Google Sheets API"
   - Request increase

### Error: "Sync failed: No data change detected"

**This is NOT an error!** It means:
- Sync successfully read Google Sheets
- Data hasn't changed since last sync
- BigQuery write was skipped (optimization)
- Everything is working correctly

### Dashboard Shows Old Data

**Check:**
1. When was last successful sync?
   - Go to Admin Setup → BigQuery Manual Sync
   - Check "Status" and "Message"

2. Is auto-sync enabled?
   ```env
   BIGQUERY_SYNC_ENABLED=true
   ```

3. Run manual sync:
   - Go to Admin Setup
   - Click "Run Manual Sync"
   - Wait for completion

---

## FAQ

### Q: Why does sync still read Google Sheets if data hasn't changed?
**A**: The system needs to read sheets to know if data changed. It computes a checksum and compares with previous sync. If unchanged, it skips the BigQuery write.

### Q: Can I sync only specific sheets?
**A**: Not currently. All configured sheets in `googleSheetsSources.json` are synced together.

### Q: Does the dashboard read from Google Sheets?
**A**: NO! Dashboard always reads from BigQuery. Only the sync process reads Google Sheets.

### Q: How do I know if I'm hitting quota limits?
**A**: Check Render logs for errors containing "Quota exceeded" or "rate limit".

### Q: Can I increase Google Sheets API quota?
**A**: Yes, request increase in Google Cloud Console → APIs & Services → Quotas.

### Q: What happens if sync fails?
**A**: Dashboard continues showing last successfully synced data from BigQuery. No downtime.

### Q: Should I use manual sync only?
**A**: Good for development. For production, use auto-sync with appropriate frequency (6-12 hours).

---

## Summary

✅ **Dashboard reads**: Always from BigQuery (fast, no quota impact)  
✅ **Sync process**: Reads Google Sheets → Updates BigQuery  
✅ **Current setting**: Every 6 hours (4 times/day)  
✅ **Quota friendly**: Much better than hourly  
✅ **Manual sync**: Available anytime in Admin panel  

**Recommendation**: Keep current 6-hour sync. If you still hit quota limits, change to 12-hour or daily sync.
