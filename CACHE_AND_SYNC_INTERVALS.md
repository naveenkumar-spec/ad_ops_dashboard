# Cache and Sync Intervals Configuration

## The Two Different Intervals

Your dashboard has **TWO separate refresh mechanisms** that work together:

### 1. BigQuery Sync (Google Sheets → BigQuery)
- **What it does**: Syncs data from Google Sheets to BigQuery database
- **Setting**: `BIGQUERY_SYNC_CRON`
- **Current**: `0 * * * *` (every hour)

### 2. Semantic Cache Refresh (BigQuery → Memory)
- **What it does**: Refreshes the in-memory cache from BigQuery
- **Setting**: `SEMANTIC_CACHE_REFRESH_INTERVAL`
- **Was**: `7200000` (2 hours)
- **Now**: `3600000` (1 hour)

## Why You Were Seeing 2-Hour Updates

Even though BigQuery was syncing every hour, the **cache was only refreshing every 2 hours**, so the dashboard showed stale data!

### The Flow:
```
Google Sheets → [BigQuery Sync: 1 hour] → BigQuery Database → [Cache Refresh: 2 hours] → Dashboard
                     ✅ Every hour                                  ❌ Every 2 hours
```

After the fix:
```
Google Sheets → [BigQuery Sync: 1 hour] → BigQuery Database → [Cache Refresh: 1 hour] → Dashboard
                     ✅ Every hour                                  ✅ Every hour
```

## Configuration Settings

### For Hourly Updates (Current)

```env
# BigQuery Sync - Every hour
BIGQUERY_SYNC_CRON=0 * * * *

# Cache Refresh - Every hour (3600000ms)
SEMANTIC_CACHE_REFRESH_INTERVAL=3600000
```

### For 30-Minute Updates

```env
# BigQuery Sync - Every 30 minutes
BIGQUERY_SYNC_CRON=*/30 * * * *

# Cache Refresh - Every 30 minutes (1800000ms)
SEMANTIC_CACHE_REFRESH_INTERVAL=1800000
```

### For 2-Hour Updates (Previous)

```env
# BigQuery Sync - Every 2 hours
BIGQUERY_SYNC_CRON=0 */2 * * *

# Cache Refresh - Every 2 hours (7200000ms)
SEMANTIC_CACHE_REFRESH_INTERVAL=7200000
```

## Common Interval Values (Milliseconds)

| Interval | Milliseconds | Setting |
|----------|-------------|---------|
| 15 minutes | 900000 | `SEMANTIC_CACHE_REFRESH_INTERVAL=900000` |
| 30 minutes | 1800000 | `SEMANTIC_CACHE_REFRESH_INTERVAL=1800000` |
| 1 hour | 3600000 | `SEMANTIC_CACHE_REFRESH_INTERVAL=3600000` |
| 2 hours | 7200000 | `SEMANTIC_CACHE_REFRESH_INTERVAL=7200000` |
| 3 hours | 10800000 | `SEMANTIC_CACHE_REFRESH_INTERVAL=10800000` |
| 6 hours | 21600000 | `SEMANTIC_CACHE_REFRESH_INTERVAL=21600000` |

## How to Update on Render

### Step 1: Update BigQuery Sync Schedule
1. Go to Render Dashboard
2. Select your backend service
3. Go to "Environment" tab
4. Find `BIGQUERY_SYNC_CRON`
5. Ensure it's set to: `0 * * * *` (NO COMMENTS!)
6. **Important**: Remove any comments like `# Every hour` from the value

### Step 2: Update Cache Refresh Interval
1. In the same Environment tab
2. Find `SEMANTIC_CACHE_REFRESH_INTERVAL`
3. Change from: `7200000` to `3600000`
4. Click "Save Changes"

### Step 3: Verify
After the service restarts, check the logs for:
```
[BigQuery Scheduler] Tracker sync: 0 * * * * (recent 2 months only, hourly)
[Semantic Cache] Auto-refresh enabled: every 3600000ms (1 hour)
```

## Important Notes

1. **Both settings must match** for consistent updates
2. **Remove comments** from environment variable values (e.g., `# Every hour`)
3. **Restart required** after changing environment variables
4. **Cache also refreshes after each BigQuery sync** automatically
5. The background refresh is a safety net to ensure cache stays fresh

## Monitoring

After updating both settings, monitor:
- Check dashboard updates every hour
- Look for sync logs in Render logs
- Verify cache refresh logs
- Confirm data freshness matches expectations

## Recommendations

- **Production**: 1 hour (good balance)
- **Development**: 30 minutes or 1 hour
- **High-frequency needs**: 30 minutes (increases API usage)
- **Low-frequency needs**: 2-3 hours (reduces costs)

## Current Setup (After Fix)

- **BigQuery Sync**: Every hour (`0 * * * *`)
- **Cache Refresh**: Every hour (`3600000ms`)
- **Daily Full Refresh**: 12:00 AM IST (full data consistency check)
- **Cache also refreshes**: After each successful BigQuery sync

This ensures your dashboard shows fresh data every hour!
