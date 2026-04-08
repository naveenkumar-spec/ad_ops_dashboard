/**
 * Cached BigQuery Service
 * 
 * Wraps bigQueryReadService with semantic caching for instant responses
 */

const bigQueryReadService = require("./bigQueryReadService");
const semanticCache = require("./semanticCache");

// Initialize cache on startup
let isInitialized = false;

/**
 * Initialize the semantic cache with full dataset
 */
async function initialize() {
  if (isInitialized) {
    console.log("[CachedBigQueryService] Already initialized");
    return;
  }
  
  console.log("[CachedBigQueryService] Initializing semantic cache...");
  
  try {
    // Load full dataset into memory
    await semanticCache.loadFullDataset(async () => {
      const rows = await bigQueryReadService.loadAllRows(true);
      return { rows, syncId: Date.now() };
    });
    
    // Pre-compute common aggregations
    await semanticCache.preComputeAggregations({
      filterOptions: () => bigQueryReadService.getFilterOptions({}),
    });
    
    // Start auto-refresh (every 2 hours)
    semanticCache.startAutoRefresh(async () => {
      const rows = await bigQueryReadService.loadAllRows(true);
      return { rows, syncId: Date.now() };
    });
    
    isInitialized = true;
    console.log("[CachedBigQueryService] Initialization complete");
  } catch (error) {
    console.error("[CachedBigQueryService] Initialization failed:", error);
    throw error;
  }
}

/**
 * Wrapped service methods with caching
 */

async function getKpis(filters = {}) {
  const cacheKey = semanticCache.generateCacheKey("kpis", filters);
  return semanticCache.getOrCompute(cacheKey, () => bigQueryReadService.getKpis(filters));
}

async function getRevenueTrend(filters = {}) {
  const cacheKey = semanticCache.generateCacheKey("revenueTrend", filters);
  return semanticCache.getOrCompute(cacheKey, () => bigQueryReadService.getRevenueTrend(filters));
}

async function getMarginTrend(filters = {}) {
  const cacheKey = semanticCache.generateCacheKey("marginTrend", filters);
  return semanticCache.getOrCompute(cacheKey, () => bigQueryReadService.getMarginTrend(filters));
}

async function getNetMarginTrend(filters = {}) {
  const cacheKey = semanticCache.generateCacheKey("netMarginTrend", filters);
  return semanticCache.getOrCompute(cacheKey, () => bigQueryReadService.getNetMarginTrend(filters));
}

async function getCpmTrend(filters = {}) {
  const cacheKey = semanticCache.generateCacheKey("cpmTrend", filters);
  return semanticCache.getOrCompute(cacheKey, () => bigQueryReadService.getCpmTrend(filters));
}

async function getCountryWiseTable(limit, offset, filters = {}) {
  const cacheKey = semanticCache.generateCacheKey("countryWise", { limit, offset, ...filters });
  return semanticCache.getOrCompute(cacheKey, () => bigQueryReadService.getCountryWiseTable(limit, offset, filters));
}

async function getProductWiseTable(limit, offset, filters = {}) {
  const cacheKey = semanticCache.generateCacheKey("productWise", { limit, offset, ...filters });
  return semanticCache.getOrCompute(cacheKey, () => bigQueryReadService.getProductWiseTable(limit, offset, filters));
}

async function getCampaignWiseTable(limit, offset, filters = {}) {
  const cacheKey = semanticCache.generateCacheKey("campaignWise", { limit, offset, ...filters });
  return semanticCache.getOrCompute(cacheKey, () => bigQueryReadService.getCampaignWiseTable(limit, offset, filters));
}

async function getCampaignsDetailed(limit, offset, filters = {}, view = "bottom") {
  const cacheKey = semanticCache.generateCacheKey("campaignsDetailed", { limit, offset, view, ...filters });
  return semanticCache.getOrCompute(cacheKey, () => bigQueryReadService.getCampaignsDetailed(limit, offset, filters, view));
}

async function getFilterOptions(filters = {}) {
  // Check pre-computed aggregation first
  if (Object.keys(filters).length === 0) {
    const cached = semanticCache.getAggregation("filterOptions");
    if (cached) {
      return cached;
    }
  }
  
  const cacheKey = semanticCache.generateCacheKey("filterOptions", filters);
  return semanticCache.getOrCompute(cacheKey, () => bigQueryReadService.getFilterOptions(filters));
}

async function getOwnerPerformance(ownerType, filters = {}) {
  const cacheKey = semanticCache.generateCacheKey("ownerPerformance", { ownerType, ...filters });
  return semanticCache.getOrCompute(cacheKey, () => bigQueryReadService.getOwnerPerformance(ownerType, filters));
}

async function getPlatformSpends(filters = {}) {
  const cacheKey = semanticCache.generateCacheKey("platformSpends", filters);
  return semanticCache.getOrCompute(cacheKey, () => bigQueryReadService.getPlatformSpends(filters));
}

async function getManagementRegionTable(filters = {}) {
  const cacheKey = semanticCache.generateCacheKey("managementRegion", filters);
  return semanticCache.getOrCompute(cacheKey, () => bigQueryReadService.getManagementRegionTable(filters));
}

async function getRegionTable(filters = {}) {
  const cacheKey = semanticCache.generateCacheKey("regionTable", filters);
  return semanticCache.getOrCompute(cacheKey, () => bigQueryReadService.getRegionTable(filters));
}

async function getBottomCampaignsSimple(limit, filters = {}) {
  const cacheKey = semanticCache.generateCacheKey("bottomCampaigns", { limit, ...filters });
  return semanticCache.getOrCompute(cacheKey, () => bigQueryReadService.getBottomCampaignsSimple(limit, filters));
}

async function getAdminOptions() {
  const cached = semanticCache.getAggregation("adminOptions");
  if (cached) {
    return cached;
  }
  return bigQueryReadService.getAdminOptions();
}

/**
 * Manual refresh trigger
 */
async function refreshCache() {
  console.log("[CachedBigQueryService] Manual cache refresh triggered");
  return semanticCache.refreshInBackground(async () => {
    const rows = await bigQueryReadService.loadAllRows(true);
    return { rows, syncId: Date.now() };
  });
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return semanticCache.getStats();
}

/**
 * Clear all caches
 */
function clearCache() {
  semanticCache.clearAll();
}

/**
 * Health check
 */
function healthCheck() {
  return semanticCache.isHealthy();
}

module.exports = {
  initialize,
  getKpis,
  getRevenueTrend,
  getMarginTrend,
  getNetMarginTrend,
  getCpmTrend,
  getCountryWiseTable,
  getProductWiseTable,
  getCampaignWiseTable,
  getCampaignsDetailed,
  getFilterOptions,
  getOwnerPerformance,
  getPlatformSpends,
  getManagementRegionTable,
  getRegionTable,
  getBottomCampaignsSimple,
  getAdminOptions,
  refreshCache,
  getCacheStats,
  clearCache,
  healthCheck
};
