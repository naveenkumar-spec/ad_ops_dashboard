# Cache Refresh Fix - Testing Guide

## What Was Fixed
The dashboard was showing stale data after manual BigQuery sync because the semantic cache wasn't refreshing. Now the cache automatically refreshes immediately after any sync completes.

## How to Test

### 1. Start the Backend Server
```bash
cd backend
node server.js
```

You should see:
```
[SemanticCache] Initialized
[CachedBigQueryService] Initializing semantic cache...
[SemanticCache] Dataset loaded: XXXX rows in XXXms
✅ Semantic cache ready - dashboard will be fast!
```

### 2. Check Current Data
Open your browser and check the dashboard KPIs:
```
http://localhost:3000
```

Or use curl:
```bash
curl http://localhost:5000/api/overview/kpis
```

Note the current values (campaigns, budget groups, etc.)

### 3. Trigger Manual Sync
Use the admin panel or curl:

```bash
curl -X POST "http://localhost:5000/api/overview/sync/bigquery?fullRefresh=true" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 4. Watch the Logs
You should see these messages in the backend logs:

```
[BigQuery Sync] Starting sync...
[BigQuery Sync] ✅ FULL_REFRESH completed: XXXX rows
[Overview] Sync complete callback triggered
[Overview] Refreshing semantic cache after successful sync...
[SemanticCache] Starting background refresh...
[SemanticCache] Dataset loaded: XXXX rows in XXXms
```

### 5. Check Updated Data
Immediately refresh the dashboard or call the API again:

```bash
curl http://localhost:5000/api/overview/kpis
```

The data should now show the updated values from BigQuery!

### 6. Test Scheduled Sync
Wait for the next scheduled sync (runs every 2 hours by default) or modify the cron schedule in `.env`:

```env
BIGQUERY_SYNC_CRON=*/5 * * * *  # Every 5 minutes for testing
```

Restart the server and watch the logs for:
```
[BigQuery Scheduler] Scheduled sync complete, refreshing cache...
[SemanticCache] Starting background refresh...
```

## Expected Behavior

### ✅ Success Cases
1. **Manual Full Refresh**: Cache refreshes immediately after sync
2. **Manual Recent-Only Sync**: Cache refreshes after recent data sync
3. **Scheduled Hourly Sync**: Cache refreshes after hourly sync
4. **Scheduled Daily Sync**: Cache refreshes after daily transition table sync

### ⏭️ Skip Cases (No Cache Refresh)
1. **No Data Change**: Sync skipped, cache not refreshed (no need)
2. **Sync Already Running**: New sync rejected, no cache refresh

### ❌ Error Cases
1. **Sync Failed**: Cache not refreshed (keeps old data)
2. **Sync Stopped**: Cache not refreshed (partial data)

## Verification Checklist

- [ ] Server starts without errors
- [ ] Semantic cache initializes on startup
- [ ] Manual sync triggers cache refresh
- [ ] Dashboard shows updated data immediately after sync
- [ ] Scheduled sync triggers cache refresh
- [ ] Logs show cache refresh messages
- [ ] No errors in console or logs
- [ ] Cache stats show updated timestamp

## Cache Statistics
Check cache stats via admin endpoint:

```bash
curl http://localhost:5000/api/cache/stats
```

Response should show:
```json
{
  "dataCache": {
    "loaded": true,
    "rowCount": 3012,
    "lastSync": "2024-01-15T10:30:00.000Z",
    "syncId": 1705318200000
  },
  "performance": {
    "totalQueries": 150,
    "cacheHits": 145,
    "cacheMisses": 5,
    "hitRate": "96.67%",
    "lastRefreshDuration": "12715ms"
  }
}
```

## Troubleshooting

### Cache Not Refreshing
1. Check if `USE_SEMANTIC_CACHE=true` in `.env`
2. Check logs for callback registration messages
3. Verify sync completed successfully (not skipped or failed)
4. Check for errors in cache refresh

### Stale Data After Sync
1. Wait 2-5 seconds for background refresh to complete
2. Check cache stats to see last refresh time
3. Manually refresh cache: `curl -X POST http://localhost:5000/api/cache/refresh`
4. Check BigQuery data directly to verify sync worked

### Performance Issues
1. Cache refresh runs in background (non-blocking)
2. Old cache serves requests during refresh
3. Refresh takes 2-5 seconds for ~3000 rows
4. No impact on user experience

## Deployment Checklist

- [ ] Test locally with manual sync
- [ ] Test scheduled sync (modify cron for quick test)
- [ ] Verify logs show cache refresh messages
- [ ] Check dashboard shows updated data
- [ ] Push to dev branch
- [ ] Deploy to dev environment
- [ ] Test on dev environment
- [ ] Monitor logs for 24 hours
- [ ] Merge to main and deploy to production

## Related Documentation
- `CACHE_REFRESH_FIX.md` - Technical implementation details
- `SEMANTIC_CACHE_IMPLEMENTATION.md` - Cache architecture
- `HYBRID_SYNC_IMPLEMENTATION.md` - Sync strategy

## Support
If you encounter issues:
1. Check server logs for error messages
2. Verify BigQuery sync completed successfully
3. Check cache stats endpoint
4. Try manual cache refresh
5. Restart server if needed
