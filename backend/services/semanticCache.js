/**
 * Semantic Cache Service - Power BI Style In-Memory Cache
 * 
 * This service implements a multi-layer caching strategy similar to Power BI:
 * 1. Full dataset cache (semantic model)
 * 2. Aggregated results cache (pre-computed)
 * 3. Background refresh without blocking users
 * 4. Smart invalidation
 */

const EventEmitter = require("events");

class SemanticCache extends EventEmitter {
  constructor() {
    super();
    
    // Main data cache (semantic model)
    this.dataCache = {
      fullDataset: null,
      lastSync: null,
      syncId: null,
      rowCount: 0
    };
    
    // Aggregated results cache (pre-computed queries)
    this.aggregationCache = new Map();
    
    // Filter combinations cache
    this.filterCache = new Map();
    
    // Cache metadata
    this.metadata = {
      isRefreshing: false,
      lastRefreshStart: null,
      lastRefreshEnd: null,
      refreshDuration: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalQueries: 0
    };
    
    // Configuration
    this.config = {
      maxCacheSize: 1000, // Max cached filter combinations
      maxAggregationSize: 100, // Max pre-computed aggregations
      ttl: 5 * 60 * 1000, // 5 minutes TTL for filter cache
      autoRefreshInterval: 2 * 60 * 60 * 1000, // 2 hours auto-refresh
      enableBackgroundRefresh: true
    };
    
    // Auto-refresh timer
    this.refreshTimer = null;
    
    console.log("[SemanticCache] Initialized");
  }
  
  /**
   * Load full dataset into memory (like Power BI import)
   */
  async loadFullDataset(queryFn) {
    console.log("[SemanticCache] Loading full dataset into memory...");
    const startTime = Date.now();
    
    try {
      this.metadata.isRefreshing = true;
      this.metadata.lastRefreshStart = new Date();
      
      // Load all data
      const data = await queryFn();
      
      // Store in cache
      this.dataCache.fullDataset = data;
      this.dataCache.lastSync = new Date();
      this.dataCache.syncId = data.syncId || Date.now();
      this.dataCache.rowCount = Array.isArray(data.rows) ? data.rows.length : 0;
      
      // Clear dependent caches
      this.aggregationCache.clear();
      this.filterCache.clear();
      
      this.metadata.isRefreshing = false;
      this.metadata.lastRefreshEnd = new Date();
      this.metadata.refreshDuration = Date.now() - startTime;
      
      console.log(`[SemanticCache] Dataset loaded: ${this.dataCache.rowCount} rows in ${this.metadata.refreshDuration}ms`);
      
      // Emit event
      this.emit("refreshComplete", {
        rowCount: this.dataCache.rowCount,
        duration: this.metadata.refreshDuration
      });
      
      return true;
    } catch (error) {
      this.metadata.isRefreshing = false;
      console.error("[SemanticCache] Error loading dataset:", error);
      throw error;
    }
  }
  
  /**
   * Background refresh without blocking current requests
   */
  async refreshInBackground(queryFn) {
    if (this.metadata.isRefreshing) {
      console.log("[SemanticCache] Refresh already in progress, skipping");
      return false;
    }
    
    console.log("[SemanticCache] Starting background refresh...");
    
    // Don't await - let it run in background
    this.loadFullDataset(queryFn).catch(error => {
      console.error("[SemanticCache] Background refresh failed:", error);
    });
    
    return true;
  }
  
  /**
   * Get cached data or compute and cache
   */
  async getOrCompute(cacheKey, computeFn, options = {}) {
    this.metadata.totalQueries++;
    
    const { ttl = this.config.ttl, skipCache = false } = options;
    
    // Check if cache exists and is valid
    if (!skipCache && this.filterCache.has(cacheKey)) {
      const cached = this.filterCache.get(cacheKey);
      const age = Date.now() - cached.timestamp;
      
      if (age < ttl) {
        this.metadata.cacheHits++;
        console.log(`[SemanticCache] Cache HIT: ${cacheKey} (age: ${age}ms)`);
        return cached.data;
      }
    }
    
    // Cache miss - compute
    this.metadata.cacheMisses++;
    console.log(`[SemanticCache] Cache MISS: ${cacheKey}`);
    
    const data = await computeFn();
    
    // Store in cache
    this.filterCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    // Enforce cache size limit (LRU)
    if (this.filterCache.size > this.config.maxCacheSize) {
      const firstKey = this.filterCache.keys().next().value;
      this.filterCache.delete(firstKey);
    }
    
    return data;
  }
  
  /**
   * Pre-compute common aggregations
   */
  async preComputeAggregations(aggregationFns) {
    console.log("[SemanticCache] Pre-computing aggregations...");
    
    for (const [key, fn] of Object.entries(aggregationFns)) {
      try {
        const result = await fn();
        this.aggregationCache.set(key, {
          data: result,
          timestamp: Date.now()
        });
        console.log(`[SemanticCache] Pre-computed: ${key}`);
      } catch (error) {
        console.error(`[SemanticCache] Error pre-computing ${key}:`, error);
      }
    }
  }
  
  /**
   * Get pre-computed aggregation
   */
  getAggregation(key) {
    if (this.aggregationCache.has(key)) {
      return this.aggregationCache.get(key).data;
    }
    return null;
  }
  
  /**
   * Generate cache key from filters
   */
  generateCacheKey(endpoint, filters) {
    const filterStr = JSON.stringify(filters, Object.keys(filters).sort());
    return `${endpoint}:${filterStr}`;
  }
  
  /**
   * Clear all caches
   */
  clearAll() {
    this.dataCache.fullDataset = null;
    this.aggregationCache.clear();
    this.filterCache.clear();
    console.log("[SemanticCache] All caches cleared");
  }
  
  /**
   * Clear specific cache
   */
  clearCache(cacheKey) {
    if (cacheKey) {
      this.filterCache.delete(cacheKey);
    }
  }
  
  /**
   * Start auto-refresh
   */
  startAutoRefresh(queryFn) {
    if (!this.config.enableBackgroundRefresh) {
      console.log("[SemanticCache] Auto-refresh disabled");
      return;
    }
    
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    this.refreshTimer = setInterval(() => {
      console.log("[SemanticCache] Auto-refresh triggered");
      this.refreshInBackground(queryFn);
    }, this.config.autoRefreshInterval);
    
    console.log(`[SemanticCache] Auto-refresh started (interval: ${this.config.autoRefreshInterval}ms)`);
  }
  
  /**
   * Stop auto-refresh
   */
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      console.log("[SemanticCache] Auto-refresh stopped");
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.metadata.totalQueries > 0
      ? ((this.metadata.cacheHits / this.metadata.totalQueries) * 100).toFixed(2)
      : 0;
    
    return {
      dataCache: {
        loaded: !!this.dataCache.fullDataset,
        rowCount: this.dataCache.rowCount,
        lastSync: this.dataCache.lastSync,
        syncId: this.dataCache.syncId
      },
      performance: {
        totalQueries: this.metadata.totalQueries,
        cacheHits: this.metadata.cacheHits,
        cacheMisses: this.metadata.cacheMisses,
        hitRate: `${hitRate}%`,
        lastRefreshDuration: `${this.metadata.refreshDuration}ms`
      },
      caches: {
        filterCacheSize: this.filterCache.size,
        aggregationCacheSize: this.aggregationCache.size,
        maxCacheSize: this.config.maxCacheSize
      },
      refresh: {
        isRefreshing: this.metadata.isRefreshing,
        lastRefreshStart: this.metadata.lastRefreshStart,
        lastRefreshEnd: this.metadata.lastRefreshEnd,
        autoRefreshEnabled: this.config.enableBackgroundRefresh,
        autoRefreshInterval: `${this.config.autoRefreshInterval / 1000}s`
      }
    };
  }
  
  /**
   * Check if cache is healthy
   */
  isHealthy() {
    return {
      healthy: !!this.dataCache.fullDataset && !this.metadata.isRefreshing,
      dataLoaded: !!this.dataCache.fullDataset,
      isRefreshing: this.metadata.isRefreshing,
      lastSync: this.dataCache.lastSync,
      rowCount: this.dataCache.rowCount
    };
  }
}

// Singleton instance
const semanticCache = new SemanticCache();

module.exports = semanticCache;
