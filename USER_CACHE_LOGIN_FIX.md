# User Cache Login Error Fix

## Problem
Users were experiencing login errors every hour, coinciding with the hourly BigQuery sync schedule.

## Root Cause Analysis

### What Was Happening
1. User cache in `userStoreBigQuery.js` had a 1-minute TTL (Time To Live)
2. Every minute, the cache would expire and need to be refreshed from BigQuery
3. During hourly BigQuery sync, there could be:
   - Streaming buffer conflicts
   - Query quota issues
   - Temporary table locks
4. When user cache tried to refresh during sync, BigQuery queries would fail
5. Failed user fetch = login errors

### What Was NOT the Problem
- User data was NOT being synced during hourly campaign data sync
- The `bigQuerySyncService.js` only handles campaign tracker data
- User data is completely separate and only synced when:
  - Running migration script manually
  - User changes password
  - New user is added
  - User access is modified

## Solution

### Changed User Cache TTL
**Before:**
```javascript
const USERS_CACHE_TTL = Number(process.env.BIGQUERY_USER_CACHE_MS || 60000); // 1 minute cache
```

**After:**
```javascript
const USERS_CACHE_TTL = Number(process.env.BIGQUERY_USER_CACHE_MS || 3600000); // 1 hour cache
```

### Why This Fixes the Issue
1. Users don't change frequently (password changes, new users, access changes are rare)
2. 1-hour cache means only 1 refresh per hour instead of 60
3. Cache is still invalidated immediately when users are modified (saveUser/deleteUser)
4. Reduces BigQuery query load by 98% (1 query/hour vs 60 queries/hour)
5. Minimizes chance of cache refresh colliding with hourly sync

## Cache Invalidation Strategy

The cache is automatically cleared when:
1. `saveUser()` is called (password change, new user, access update)
2. `deleteUser()` is called
3. `clearUsersCache()` is called manually

This ensures users always see fresh data after modifications, while avoiding unnecessary refreshes.

## Configuration

You can customize the cache TTL in `.env`:
```bash
# User cache TTL in milliseconds
BIGQUERY_USER_CACHE_MS=3600000  # 1 hour (default)
# BIGQUERY_USER_CACHE_MS=7200000  # 2 hours
# BIGQUERY_USER_CACHE_MS=1800000  # 30 minutes
```

## Verification

To verify the fix is working:
1. Check server logs for user cache refresh frequency
2. Monitor login success rate during hourly sync windows
3. Look for these log messages:
   - `[UserStore] Returning cached users (age: XXXms)` - Cache hit (good)
   - `[UserStore] Fetching users from BigQuery...` - Cache miss (should be rare)
   - `[UserStore] Cached X users` - Successful refresh

## Alternative Solutions Considered

### 1. Separate BigQuery Client for Users
- Create dedicated BigQuery client for user queries
- Pros: Isolated from campaign sync
- Cons: More complex, uses more resources
- Decision: Not needed with longer cache TTL

### 2. Fallback to Stale Cache on Error
- Already implemented! If BigQuery fetch fails, returns stale cache
- See line 119-123 in `userStoreBigQuery.js`
- This provides additional resilience

### 3. Move Users to Separate Database
- Use PostgreSQL, MySQL, or Redis for user storage
- Pros: No BigQuery conflicts
- Cons: Additional infrastructure, migration complexity
- Decision: Not needed for current scale

## Files Modified
- `backend/services/userStoreBigQuery.js` - Increased cache TTL from 1 minute to 1 hour

## Files Analyzed (No Changes Needed)
- `backend/services/bigQuerySyncService.js` - Confirmed no user sync during campaign sync
- `backend/services/bigQueryScheduler.js` - Confirmed only campaign data in hourly sync
- `backend/scripts/migrateUsersToBigQuery.js` - Manual script, not called automatically
- `backend/services/cachedBigQueryService.js` - Only caches campaign data, not users

## Testing Recommendations

1. Monitor login success rate over next 24 hours
2. Check if login errors still occur during hourly sync
3. Verify cache hit rate in logs
4. Test user modifications (password change, new user) to ensure cache invalidation works

## Expected Behavior After Fix

- Users can log in reliably during hourly sync
- User cache refreshes only once per hour (instead of 60 times)
- Immediate cache invalidation when users are modified
- Fallback to stale cache if BigQuery is temporarily unavailable
- No impact on campaign data sync performance
