# Semantic Cache Auto-Refresh - Detailed Explanation

## What Is Semantic Cache?

The Semantic Cache is a **Power BI-style in-memory caching system** that keeps your entire dashboard data in RAM for instant responses. Think of it like Excel's data model - all data is loaded into memory once, then queries run against the cached data instead of hitting the database every time.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SEMANTIC CACHE LAYERS                     │
└─────────────────────────────────────────────────────────────┘

Layer 1: Full Dataset Cache (Semantic Model)
    ├─→ All 3,000+ rows loaded into RAM
    ├─→ Updated every 2 hours (auto-refresh)
    └─→ Used as source for all queries

Layer 2: Aggregation Cache (Pre-computed Results)
    ├─→ Common queries pre-calculated
    ├─→ Filter options, KPIs, etc.
    └─→ Instant response (no calculation needed)

Layer 3: Filter Cache (Query Results)
    ├─→ Specific filter combinations cached
    ├─→ 5-minute TTL
    └─→ LRU eviction (max 1000 entries)
```

---

## What Is Auto-Refresh?

**Auto-Refresh** is a background timer that automatically reloads the entire dataset from BigQuery into memory every 2 hours.

### Configuration

**Location**: `backend/services/semanticCache.js` line 50

```javascript
this.config = {
  autoRefreshInterval: 2 * 60 * 60 * 1000, // 2 hours = 7,200,000 milliseconds
  enableBackgroundRefresh: true
};
```

### How It Works

```
Server Starts
    │
    ├─→ Load full dataset into memory (3,000+ rows)
    │   Cache ready for instant queries
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Hour 0: Cache Loaded                                        │
│  └─→ All dashboard queries use cached data (instant)        │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Hour 2: Auto-Refresh Triggered (Timer)                      │
│  ├─→ Background process starts                               │
│  ├─→ Query BigQuery: SELECT * FROM table                    │
│  ├─→ Load all 3,000+ rows into memory                       │
│  ├─→ Replace old cache with new data                        │
│  └─→ Users still see old data (no interruption)             │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Hour 4: Auto-Refresh Triggered Again                        │
│  └─→ Same process repeats                                   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Hour 6: Auto-Refresh Triggered Again                        │
│  └─→ Same process repeats                                   │
└─────────────────────────────────────────────────────────────┘

REPEATS EVERY 2 HOURS INDEFINITELY
```

---

## The Problem: Two Independent Refresh Systems

You have **TWO separate systems** refreshing data, and they don't know about each other:

### System 1: BigQuery Hourly Sync (Your Main Sync)

**Purpose**: Sync Google Sheets → BigQuery  
**Frequency**: Every hour (0 * * * *)  
**What it does**:
1. Read data from Google Sheets
2. Write to BigQuery (streaming insert)
3. Trigger dashboard cache refresh

**Timeline**:
```
Hour 1:00 - Sync Google Sheets → BigQuery
Hour 2:00 - Sync Google Sheets → BigQuery
Hour 3:00 - Sync Google Sheets → BigQuery
Hour 4:00 - Sync Google Sheets → BigQuery
```

### System 2: Semantic Cache Auto-Refresh (Independent)

**Purpose**: Refresh in-memory cache from BigQuery  
**Frequency**: Every 2 hours  
**What it does**:
1. Query BigQuery: `SELECT * FROM table`
2. Load all rows into memory
3. Replace cached data

**Timeline**:
```
Hour 0:00 - Server starts, load cache
Hour 2:00 - Auto-refresh cache from BigQuery
Hour 4:00 - Auto-refresh cache from BigQuery
Hour 6:00 - Auto-refresh cache from BigQuery
```

### The Overlap Problem

```
┌─────────────────────────────────────────────────────────────┐
│                    TIMELINE COMPARISON                       │
└─────────────────────────────────────────────────────────────┘

Hour 1:00
    BigQuery Sync: ✅ Syncing Google Sheets → BigQuery
    Semantic Cache: 💤 Sleeping

Hour 2:00
    BigQuery Sync: ✅ Syncing Google Sheets → BigQuery
    Semantic Cache: ✅ Auto-refresh from BigQuery
    
    ⚠️  COLLISION! Both systems accessing BigQuery simultaneously

Hour 3:00
    BigQuery Sync: ✅ Syncing Google Sheets → BigQuery
    Semantic Cache: 💤 Sleeping

Hour 4:00
    BigQuery Sync: ✅ Syncing Google Sheets → BigQuery
    Semantic Cache: ✅ Auto-refresh from BigQuery
    
    ⚠️  COLLISION! Both systems accessing BigQuery simultaneously
```

---

## Potential Issues

### 1. Resource Contention (Minor)

**What Happens**:
```
Hour 2:00:00 - BigQuery Sync starts writing data
Hour 2:00:05 - Semantic Cache starts reading data
    ↓
Both operations compete for:
- BigQuery API quota
- Network bandwidth
- Server CPU/memory
```

**Impact**:
- Slightly slower sync operations
- Slightly slower cache refresh
- Increased BigQuery API usage

**Severity**: ⚠️ Low - BigQuery can handle concurrent operations

### 2. Streaming Buffer Collision (Moderate)

**What Happens**:
```
Hour 2:00:00 - BigQuery Sync writes data (streaming insert)
Hour 2:00:05 - Streaming buffer active (2-5 minutes)
Hour 2:00:10 - Semantic Cache tries to read
    ↓
ERROR: "Cannot query table in streaming buffer"
    ↓
Cache refresh fails, uses stale data
```

**Impact**:
- Cache refresh fails
- Dashboard shows slightly outdated data (up to 2 hours old)
- Error logged but users don't notice

**Severity**: ⚠️ Moderate - Graceful degradation, no user impact

### 3. Unnecessary BigQuery Queries (Cost)

**What Happens**:
```
Hour 2:00:00 - BigQuery Sync updates data
Hour 2:00:30 - Dashboard cache refreshed (triggered by sync)
Hour 2:00:35 - Semantic Cache auto-refresh runs
    ↓
Semantic Cache queries BigQuery again (redundant)
    ↓
Same data loaded twice within 5 seconds
```

**Impact**:
- Wasted BigQuery API quota
- Unnecessary network traffic
- Duplicate work

**Severity**: ⚠️ Low - Costs a few cents per month

### 4. Render Free Tier Sleep Disruption (Minor)

**What Happens**:
```
Hour 1:50 - Server idle for 15+ minutes
Hour 2:00 - Semantic Cache auto-refresh tries to run
    ↓
Server is asleep (Render free tier)
    ↓
Auto-refresh doesn't trigger
    ↓
Cache becomes stale
```

**Impact**:
- Auto-refresh skipped
- Cache not updated until next activity
- Dashboard shows outdated data

**Severity**: ⚠️ Low - Your hourly sync keeps server awake anyway

---

## Why It Won't Prevent Hourly Sync

**Good News**: The semantic cache auto-refresh runs in a **separate background process** and won't block your hourly sync.

### How Background Refresh Works

```javascript
// From semanticCache.js line 115
async refreshInBackground(queryFn) {
  if (this.metadata.isRefreshing) {
    console.log("[SemanticCache] Refresh already in progress, skipping");
    return false; // ← Skips if already running
  }
  
  console.log("[SemanticCache] Starting background refresh...");
  
  // Don't await - let it run in background
  this.loadFullDataset(queryFn).catch(error => {
    console.error("[SemanticCache] Background refresh failed:", error);
  });
  
  return true;
}
```

**Key Points**:
1. **Non-blocking**: Uses `catch()` instead of `await` - doesn't block main thread
2. **Fail-safe**: If it fails, error is logged but doesn't crash server
3. **Skip logic**: Won't run if already refreshing
4. **Independent**: Runs on separate timer from BigQuery sync

### Proof It Won't Block

```
Hour 2:00:00 - BigQuery Sync starts (cron job)
    ├─→ Main thread: Sync Google Sheets → BigQuery
    │
Hour 2:00:05 - Semantic Cache auto-refresh starts (timer)
    ├─→ Background thread: Query BigQuery
    │
Both run simultaneously without blocking each other ✅
```

---

## The Redundancy Problem

The real issue is **redundancy**, not blocking:

### Current Flow (Redundant)

```
Hour 2:00:00 - BigQuery Sync
    ├─→ Sync Google Sheets → BigQuery
    ├─→ Trigger dashboard cache refresh
    └─→ Dashboard cache updated with new data ✅

Hour 2:00:30 - Dashboard cache is fresh

Hour 2:00:35 - Semantic Cache auto-refresh
    ├─→ Query BigQuery again
    ├─→ Load same data into memory
    └─→ Replace cache with identical data ❌ (redundant)
```

**Result**: Same data loaded twice within 35 seconds

### Optimal Flow (No Redundancy)

```
Hour 2:00:00 - BigQuery Sync
    ├─→ Sync Google Sheets → BigQuery
    ├─→ Trigger dashboard cache refresh
    └─→ Dashboard cache updated with new data ✅

Hour 2:00:30 - Dashboard cache is fresh

Hour 2:00:35 - Semantic Cache auto-refresh
    ├─→ Check: Was cache just refreshed? Yes (30 seconds ago)
    ├─→ Skip auto-refresh (not needed)
    └─→ Save BigQuery query ✅
```

---

## Configuration Details

### Where It's Configured

**File**: `backend/services/semanticCache.js`

```javascript
// Line 50
this.config = {
  maxCacheSize: 1000,
  maxAggregationSize: 100,
  ttl: 5 * 60 * 1000, // 5 minutes
  autoRefreshInterval: 2 * 60 * 60 * 1000, // ← 2 HOURS
  enableBackgroundRefresh: true // ← ENABLED
};
```

### Where It's Started

**File**: `backend/services/cachedBigQueryService.js`

```javascript
// Line 37
semanticCache.startAutoRefresh(async () => {
  const rows = await bigQueryReadService.loadAllRows(true);
  return { rows, syncId: Date.now() };
});
```

### Environment Variable Control

**File**: `backend/.env`

```bash
SEMANTIC_CACHE_AUTO_REFRESH=true  # Controls enableBackgroundRefresh
SEMANTIC_CACHE_REFRESH_INTERVAL=3600000  # Controls autoRefreshInterval (1 hour)
```

**Current Status**: These variables exist but are NOT used in the code! The values are hardcoded.

---

## Real-World Impact Analysis

### Scenario 1: Normal Operation (No Collision)

```
Hour 2:00:00 - BigQuery Sync (30 seconds)
Hour 2:00:30 - Dashboard cache refreshed
Hour 2:00:35 - Semantic Cache auto-refresh (5 seconds)
    ↓
Result: 2 BigQuery queries, both succeed
Cost: ~$0.0001 (negligible)
Impact: None - users don't notice
```

### Scenario 2: Streaming Buffer Collision

```
Hour 2:00:00 - BigQuery Sync (30 seconds, streaming buffer active)
Hour 2:00:30 - Dashboard cache refreshed
Hour 2:00:35 - Semantic Cache auto-refresh tries to query
    ↓
ERROR: "Cannot query table in streaming buffer"
    ↓
Semantic Cache refresh fails
    ↓
Dashboard uses old cache (up to 2 hours old)
    ↓
Result: Dashboard shows slightly stale data
Impact: Low - data is only 30 seconds old anyway
```

### Scenario 3: Render Free Tier Sleep

```
Hour 1:50 - Server idle
Hour 2:00 - Server asleep (Render free tier)
    ↓
BigQuery Sync: Doesn't run (server asleep) ❌
Semantic Cache: Doesn't run (server asleep) ❌
    ↓
Result: No refresh at all
Impact: High - data becomes stale
```

**Note**: This is why you keep the server awake before sync times!

---

## Summary

### What Semantic Cache Auto-Refresh Is:
- A background timer that reloads all data from BigQuery every 2 hours
- Runs independently of your hourly BigQuery sync
- Non-blocking (won't prevent hourly sync from running)

### Potential Issues:
1. **Resource Contention**: Minor - both systems query BigQuery simultaneously
2. **Streaming Buffer Collision**: Moderate - cache refresh might fail during sync
3. **Redundancy**: Low - same data loaded twice (wastes quota)
4. **Cost**: Negligible - a few extra cents per month

### Why It Won't Block Hourly Sync:
- Runs in background (non-blocking)
- Has fail-safe error handling
- Independent timer system
- Skip logic prevents conflicts

### Recommendation:
**Option 1**: Leave it as is (low impact)  
**Option 2**: Disable auto-refresh, rely on sync-triggered refresh only (cleaner)  
**Option 3**: Coordinate the two systems (more complex)

The semantic cache auto-refresh is a **minor inefficiency**, not a critical problem. Your hourly sync will work fine regardless.
