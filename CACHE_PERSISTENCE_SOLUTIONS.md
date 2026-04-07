# Cache Persistence Solutions - Prevent Cache Loss on Restart

## Problem

Current in-memory cache is lost when server restarts:
- Deployments clear cache
- Server crashes clear cache
- First requests after restart are slow (2-3 seconds)

## Solutions (Ranked by Cost & Complexity)

### Solution 1: File-Based Cache Persistence (FREE) ✅

**Concept:** Save cache to disk, reload on startup

**Pros:**
- ✅ FREE (no additional cost)
- ✅ Simple implementation
- ✅ Works on Render free tier
- ✅ Survives restarts

**Cons:**
- ⚠️ Disk I/O slower than memory
- ⚠️ Limited disk space on free tier
- ⚠️ Not shared across instances

**Implementation:**

```javascript
// backend/services/semanticCache.js

const fs = require('fs').promises;
const path = require('path');

class SemanticCache extends EventEmitter {
  constructor() {
    super();
    this.cacheFilePath = path.join(__dirname, '../.cache/semantic-cache.json');
    // ... existing code ...
  }
  
  /**
   * Save cache to disk
   */
  async saveToDisk() {
    try {
      const cacheData = {
        dataCache: this.dataCache,
        aggregationCache: Array.from(this.aggregationCache.entries()),
        filterCache: Array.from(this.filterCache.entries()),
        metadata: this.metadata,
        savedAt: new Date().toISOString()
      };
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.cacheFilePath), { recursive: true });
      
      // Write to disk
      await fs.writeFile(
        this.cacheFilePath, 
        JSON.stringify(cacheData, null, 2)
      );
      
      console.log(`[SemanticCache] Saved to disk: ${this.cacheFilePath}`);
      return true;
    } catch (error) {
      console.error('[SemanticCache] Error saving to disk:', error);
      return false;
    }
  }
  
  /**
   * Load cache from disk
   */
  async loadFromDisk() {
    try {
      const data = await fs.readFile(this.cacheFilePath, 'utf8');
      const cacheData = JSON.parse(data);
      
      // Restore caches
      this.dataCache = cacheData.dataCache;
      this.aggregationCache = new Map(cacheData.aggregationCache);
      this.filterCache = new Map(cacheData.filterCache);
      this.metadata = cacheData.metadata;
      
      console.log(`[SemanticCache] Loaded from disk: ${this.dataCache.rowCount} rows`);
      console.log(`[SemanticCache] Cache age: ${Date.now() - new Date(cacheData.savedAt).getTime()}ms`);
      
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[SemanticCache] No cache file found, starting fresh');
      } else {
        console.error('[SemanticCache] Error loading from disk:', error);
      }
      return false;
    }
  }
  
  /**
   * Auto-save cache periodically
   */
  startAutoSave(intervalMs = 5 * 60 * 1000) {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
    
    this.saveTimer = setInterval(() => {
      console.log('[SemanticCache] Auto-saving to disk...');
      this.saveToDisk();
    }, intervalMs);
    
    console.log(`[SemanticCache] Auto-save started (interval: ${intervalMs}ms)`);
  }
  
  /**
   * Save on process exit
   */
  setupExitHandlers() {
    const saveAndExit = async (signal) => {
      console.log(`[SemanticCache] ${signal} received, saving cache...`);
      await this.saveToDisk();
      process.exit(0);
    };
    
    process.on('SIGTERM', () => saveAndExit('SIGTERM'));
    process.on('SIGINT', () => saveAndExit('SIGINT'));
    process.on('beforeExit', () => this.saveToDisk());
  }
}
```

**Usage in server.js:**

```javascript
// backend/server.js

const semanticCache = require('./services/semanticCache');
const cachedBigQueryService = require('./services/cachedBigQueryService');

async function initializeCache() {
  console.log('[Server] Initializing semantic cache...');
  
  // Try to load from disk first
  const loaded = await semanticCache.loadFromDisk();
  
  if (loaded) {
    console.log('[Server] ✅ Cache loaded from disk (instant startup!)');
  } else {
    console.log('[Server] Loading cache from BigQuery...');
    await cachedBigQueryService.initialize();
  }
  
  // Setup auto-save
  semanticCache.startAutoSave(5 * 60 * 1000); // Save every 5 minutes
  semanticCache.setupExitHandlers(); // Save on exit
}

// Initialize on startup
initializeCache().catch(console.error);
```

**Disk Space Requirements:**

```
Cache File Size:
├─ Dataset: ~5 MB
├─ Filter cache: ~50 MB
├─ Aggregation cache: ~10 MB
└─ Total: ~65 MB

Render Free Tier Disk:
├─ Ephemeral storage: Yes
├─ Persistent storage: No (lost on restart)
└─ Solution: Use /tmp directory (survives during runtime)
```

**Limitation on Render Free Tier:**
- ⚠️ Render free tier has ephemeral storage
- ⚠️ Files are lost on restart anyway
- ⚠️ Only helps during runtime (not across restarts)

**Verdict:** ❌ Not effective on Render free tier

---

### Solution 2: Redis Free Tier (BEST FREE OPTION) ✅

**Concept:** Use free Redis hosting for persistent cache

**Pros:**
- ✅ FREE (with limits)
- ✅ Persistent across restarts
- ✅ Shared across instances
- ✅ Fast (1-5ms)

**Cons:**
- ⚠️ Limited free tier (10K-30K requests/day)
- ⚠️ May need paid tier for production

**Free Redis Options:**

#### Option A: Upstash (RECOMMENDED) ✅

```
Upstash Free Tier:
├─ Storage: 256 MB
├─ Requests: 10,000/day
├─ Bandwidth: 200 MB/day
├─ Regions: Global
└─ Cost: FREE

Your Usage Estimate:
├─ Cache size: ~65 MB ✅ Fits
├─ Requests: ~2,000/day ✅ Fits
├─ Bandwidth: ~50 MB/day ✅ Fits
└─ Verdict: ✅ FREE TIER IS ENOUGH!

Paid Tier (if needed):
├─ Storage: 1 GB
├─ Requests: 100,000/day
├─ Cost: $10/month
```

**Setup:**

```bash
# 1. Sign up at https://upstash.com
# 2. Create Redis database
# 3. Get connection URL
```

```javascript
// backend/services/semanticCache.js

const Redis = require('ioredis');

class SemanticCache extends EventEmitter {
  constructor() {
    super();
    
    // Connect to Upstash Redis
    this.redis = new Redis(process.env.UPSTASH_REDIS_URL, {
      tls: {
        rejectUnauthorized: false
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true
    });
    
    this.redis.on('connect', () => {
      console.log('[SemanticCache] Connected to Upstash Redis');
    });
    
    this.redis.on('error', (err) => {
      console.error('[SemanticCache] Redis error:', err);
    });
  }
  
  /**
   * Save cache to Redis
   */
  async saveToRedis() {
    try {
      const cacheData = {
        dataCache: this.dataCache,
        aggregationCache: Array.from(this.aggregationCache.entries()),
        filterCache: Array.from(this.filterCache.entries()),
        metadata: this.metadata,
        savedAt: new Date().toISOString()
      };
      
      await this.redis.set(
        'semantic-cache',
        JSON.stringify(cacheData),
        'EX',
        24 * 60 * 60 // Expire after 24 hours
      );
      
      console.log('[SemanticCache] Saved to Redis');
      return true;
    } catch (error) {
      console.error('[SemanticCache] Error saving to Redis:', error);
      return false;
    }
  }
  
  /**
   * Load cache from Redis
   */
  async loadFromRedis() {
    try {
      const data = await this.redis.get('semantic-cache');
      
      if (!data) {
        console.log('[SemanticCache] No cache in Redis, starting fresh');
        return false;
      }
      
      const cacheData = JSON.parse(data);
      
      // Restore caches
      this.dataCache = cacheData.dataCache;
      this.aggregationCache = new Map(cacheData.aggregationCache);
      this.filterCache = new Map(cacheData.filterCache);
      this.metadata = cacheData.metadata;
      
      console.log(`[SemanticCache] Loaded from Redis: ${this.dataCache.rowCount} rows`);
      console.log(`[SemanticCache] Cache age: ${Date.now() - new Date(cacheData.savedAt).getTime()}ms`);
      
      return true;
    } catch (error) {
      console.error('[SemanticCache] Error loading from Redis:', error);
      return false;
    }
  }
}
```

**Environment Variables:**

```bash
# backend/.env
UPSTASH_REDIS_URL=rediss://default:xxxxx@xxxxx.upstash.io:6379
CACHE_PERSISTENCE=redis  # Options: none, redis, file
```

**Installation:**

```bash
npm install ioredis
```

**Verdict:** ✅ BEST FREE OPTION

---

#### Option B: Redis Cloud Free Tier

```
Redis Cloud Free Tier:
├─ Storage: 30 MB ❌ Too small (need 65 MB)
├─ Requests: Unlimited
├─ Cost: FREE

Verdict: ❌ Storage too small
```

---

#### Option C: Railway Redis

```
Railway Free Tier:
├─ Storage: 100 MB ✅ Fits
├─ Requests: Unlimited
├─ Cost: FREE (with $5 credit)
├─ Credit expires: Monthly

Verdict: ⚠️ Requires credit card, limited time
```

---

### Solution 3: BigQuery as Cache (CREATIVE) 💡

**Concept:** Store cache in BigQuery table

**Pros:**
- ✅ Already using BigQuery
- ✅ No additional service
- ✅ Persistent
- ✅ Scalable

**Cons:**
- ❌ Slower (100-500ms vs 1-5ms)
- ❌ Query costs
- ❌ Not designed for caching

**Implementation:**

```javascript
// Create cache table in BigQuery
CREATE TABLE `project.dataset.cache_store` (
  cache_key STRING,
  cache_value STRING,
  created_at TIMESTAMP,
  expires_at TIMESTAMP
);

// Save cache
async function saveCache(key, value, ttl) {
  await bigquery.query(`
    INSERT INTO cache_store (cache_key, cache_value, created_at, expires_at)
    VALUES (
      @key,
      @value,
      CURRENT_TIMESTAMP(),
      TIMESTAMP_ADD(CURRENT_TIMESTAMP(), INTERVAL @ttl SECOND)
    )
  `, { key, value: JSON.stringify(value), ttl });
}

// Load cache
async function loadCache(key) {
  const [rows] = await bigquery.query(`
    SELECT cache_value
    FROM cache_store
    WHERE cache_key = @key
      AND expires_at > CURRENT_TIMESTAMP()
    ORDER BY created_at DESC
    LIMIT 1
  `, { key });
  
  return rows[0] ? JSON.parse(rows[0].cache_value) : null;
}
```

**Cost:**
```
BigQuery Pricing:
├─ Storage: $0.02/GB/month
├─ Queries: $5/TB
├─ Cache size: 0.065 GB
├─ Storage cost: $0.0013/month
├─ Query cost: ~$0.01/month
└─ Total: ~$0.01/month ✅ Negligible
```

**Verdict:** ⚠️ Creative but slow (100-500ms)

---

### Solution 4: Hybrid Approach (RECOMMENDED) ✅

**Concept:** In-memory + Redis fallback

**Strategy:**
1. Primary: In-memory cache (fast)
2. Backup: Redis cache (persistent)
3. On startup: Load from Redis → In-memory
4. On update: Update both caches
5. On restart: Instant recovery from Redis

**Implementation:**

```javascript
class SemanticCache extends EventEmitter {
  constructor() {
    super();
    
    // In-memory cache (fast)
    this.dataCache = { fullDataset: null };
    this.filterCache = new Map();
    
    // Redis cache (persistent)
    this.redis = process.env.UPSTASH_REDIS_URL 
      ? new Redis(process.env.UPSTASH_REDIS_URL)
      : null;
  }
  
  /**
   * Get from cache (memory first, Redis fallback)
   */
  async get(key) {
    // Try memory first (fast)
    if (this.filterCache.has(key)) {
      return this.filterCache.get(key).data;
    }
    
    // Try Redis (persistent)
    if (this.redis) {
      const cached = await this.redis.get(`cache:${key}`);
      if (cached) {
        const data = JSON.parse(cached);
        // Restore to memory
        this.filterCache.set(key, { data, timestamp: Date.now() });
        return data;
      }
    }
    
    return null;
  }
  
  /**
   * Set cache (both memory and Redis)
   */
  async set(key, value, ttl = 300) {
    // Set in memory (fast)
    this.filterCache.set(key, {
      data: value,
      timestamp: Date.now()
    });
    
    // Set in Redis (persistent)
    if (this.redis) {
      await this.redis.setex(
        `cache:${key}`,
        ttl,
        JSON.stringify(value)
      );
    }
  }
  
  /**
   * Initialize on startup
   */
  async initialize() {
    // Try to load from Redis
    if (this.redis) {
      const loaded = await this.loadFromRedis();
      if (loaded) {
        console.log('[SemanticCache] ✅ Loaded from Redis (instant startup!)');
        return true;
      }
    }
    
    // Fallback: Load from BigQuery
    console.log('[SemanticCache] Loading from BigQuery...');
    await this.loadFullDataset();
    
    // Save to Redis for next restart
    if (this.redis) {
      await this.saveToRedis();
    }
  }
}
```

**Benefits:**
- ✅ Fast (in-memory for reads)
- ✅ Persistent (Redis for restarts)
- ✅ Resilient (fallback to BigQuery)
- ✅ FREE (Upstash free tier)

**Verdict:** ✅ BEST OVERALL SOLUTION

---

## Deployment Comparison

### Option 1: Render Free Tier (Current)

```
Render Free Tier:
├─ Backend: FREE
├─ RAM: 512 MB
├─ CPU: Shared
├─ Disk: Ephemeral (lost on restart)
├─ Uptime: 99% (sleeps after inactivity)
└─ Cost: $0/month

With Upstash Redis:
├─ Backend: FREE (Render)
├─ Redis: FREE (Upstash)
├─ Total: $0/month ✅

Pros:
✅ Completely FREE
✅ Easy setup
✅ Good for development/small scale

Cons:
❌ Sleeps after 15 min inactivity
❌ Cold starts (slow first request)
❌ Limited resources
```

**Verdict:** ✅ BEST for development, acceptable for small production

---

### Option 2: Render Paid Tier

```
Render Starter Plan:
├─ Backend: $7/month
├─ RAM: 512 MB
├─ CPU: Dedicated
├─ Disk: Persistent (25 GB)
├─ Uptime: 99.9%
└─ No sleep

With Upstash Redis:
├─ Backend: $7/month (Render)
├─ Redis: FREE (Upstash)
├─ Total: $7/month

Pros:
✅ No sleep
✅ Persistent disk
✅ Better performance
✅ Dedicated resources

Cons:
❌ $7/month cost
```

**Verdict:** ✅ BEST for production

---

### Option 3: Internal Server (Self-Hosted)

```
Internal Server Setup:
├─ Hardware: Your own server
├─ OS: Linux (Ubuntu/CentOS)
├─ RAM: 2-4 GB
├─ Storage: 50-100 GB
├─ Network: Static IP
└─ Cost: Hardware + electricity

Software Stack:
├─ Node.js: FREE
├─ Redis: FREE (self-hosted)
├─ PM2: FREE (process manager)
├─ Nginx: FREE (reverse proxy)
└─ Total software: $0

Pros:
✅ Full control
✅ No monthly fees
✅ Unlimited resources
✅ No sleep/cold starts
✅ Persistent storage

Cons:
❌ Hardware cost ($200-500 one-time)
❌ Electricity cost (~$5-10/month)
❌ Maintenance overhead
❌ Network setup (port forwarding, DNS)
❌ Security management
❌ No automatic scaling
❌ Single point of failure
```

**Setup Guide:**

```bash
# 1. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install Redis
sudo apt-get install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# 3. Install PM2
sudo npm install -g pm2

# 4. Clone your repo
git clone https://github.com/your-repo/adops-dashboard.git
cd adops-dashboard/backend

# 5. Install dependencies
npm install

# 6. Setup environment
cp .env.example .env
# Edit .env with your settings

# 7. Start with PM2
pm2 start server.js --name adops-backend
pm2 save
pm2 startup

# 8. Setup Nginx reverse proxy
sudo apt-get install nginx
# Configure nginx to proxy to localhost:5000
```

**Verdict:** ⚠️ Only if you have existing infrastructure

---

## Recommended Solution

### For Your Situation: Hybrid Approach on Render Free + Upstash Free ✅

**Setup:**

1. **Keep Render Free Tier** (backend)
2. **Add Upstash Redis Free** (cache persistence)
3. **Implement hybrid caching** (memory + Redis)

**Benefits:**
- ✅ Completely FREE ($0/month)
- ✅ Cache survives restarts
- ✅ Fast performance (in-memory)
- ✅ Persistent (Redis backup)
- ✅ Easy to implement

**Implementation Steps:**

1. Sign up for Upstash (free)
2. Create Redis database
3. Add Redis URL to .env
4. Install ioredis: `npm install ioredis`
5. Update semanticCache.js with hybrid logic
6. Deploy to Render

**Expected Results:**
- Cold start: <1 second (load from Redis)
- Warm requests: 50-200ms (in-memory)
- Restart impact: Minimal (Redis backup)
- Cost: $0/month

Would you like me to implement the hybrid caching solution with Upstash Redis?
