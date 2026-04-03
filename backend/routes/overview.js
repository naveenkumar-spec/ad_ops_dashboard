const express = require("express");
const router = express.Router();
const privateSheetsService = require("../services/privateSheetsService");
const bigQueryReadService = require("../services/bigQueryReadService");
const bigQuerySyncService = require("../services/bigQuerySyncService");

const DATA_SOURCE = (process.env.DATA_SOURCE || "bigquery").toLowerCase();
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
const MONTH_INDEX = Object.fromEntries(MONTHS.map((m, i) => [m, i]));

function parseFilters(query = {}) {
  const get = (key) => {
    const value = query[key];
    if (value === undefined || value === null) return "all";
    const parts = Array.isArray(value)
      ? value
      : String(value).split(",");
    const cleaned = parts
      .map((v) => String(v).trim())
      .filter((v) => v && v.toLowerCase() !== "all");
    if (!cleaned.length) return "all";
    return cleaned.length === 1 ? cleaned[0] : cleaned;
  };
  return {
    region: get("region"),
    year: get("year"),
    month: get("month"),
    status: get("status"),
    product: get("product"),
    platform: get("platform"),
    ops: get("ops"),
    cs: get("cs"),
    sales: get("sales")
  };
}

function withUserScope(filters, user) {
  const scoped = { ...(filters || {}) };
  if (user && user.role !== "admin" && !user.fullAccess) {
    scoped.scopeCountries = Array.isArray(user.allowedCountries) ? user.allowedCountries : [];
    scoped.scopeAdops = Array.isArray(user.allowedAdops) ? user.allowedAdops : [];
  }
  return scoped;
}

function getDataProvider() {
  if (DATA_SOURCE === "google_sheets") return privateSheetsService;
  return bigQueryReadService;
}

const provider = getDataProvider();
const RESPONSE_CACHE_MS = Number(process.env.OVERVIEW_CACHE_MS || 60000);
const responseCache = new Map();

function cacheKey(req, name, extra = "") {
  const user = req.user || {};
  const countries = Array.isArray(user.allowedCountries) ? user.allowedCountries.slice().sort().join(",") : "";
  const adops = Array.isArray(user.allowedAdops) ? user.allowedAdops.slice().sort().join(",") : "";
  return `${name}|${user.email || "anon"}|${user.role || "none"}|${countries}|${adops}|${extra}`;
}

function getCached(key) {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > RESPONSE_CACHE_MS) {
    responseCache.delete(key);
    return null;
  }
  return hit.data;
}

function setCached(key, data) {
  responseCache.set(key, { ts: Date.now(), data });
}

function parseMonthYearKeysFromSeries(series = []) {
  const keys = [];
  (series || []).forEach((row) => {
    const month = String(row?.month || "").trim();
    const monthIdx = MONTH_INDEX[month];
    if (monthIdx === undefined) return;
    Object.keys(row || {}).forEach((k) => {
      if (k === "month") return;
      const year = Number(k);
      const value = Number(row[k] || 0);
      if (!Number.isFinite(year) || !Number.isFinite(value)) return;
      if (Math.abs(value) <= 0) return;
      keys.push({ key: `${year}__${month}`, year, month, monthIdx });
    });
  });
  return keys.sort((a, b) => (a.year - b.year) || (a.monthIdx - b.monthIdx));
}

function mergeLegacySeries(baseSeries = [], legacySeries = []) {
  const base = (baseSeries || []).map((row) => ({ ...row }));
  if (!base.length || !legacySeries?.length) return base;

  // Determine current and previous month
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth(); // 0-11
  const currentMonth = MONTHS[currentMonthIndex];
  const previousMonthIndex = currentMonthIndex === 0 ? 11 : currentMonthIndex - 1;
  const previousMonth = MONTHS[previousMonthIndex];
  const previousMonthYear = currentMonthIndex === 0 ? currentYear - 1 : currentYear;

  // Preserve current month and previous month from tracker data
  const preserveRecent = new Set([
    `${currentYear}__${currentMonth}`,
    `${previousMonthYear}__${previousMonth}`
  ]);

  console.log(`[mergeLegacySeries] Preserving tracker data for: ${currentMonth} ${currentYear} and ${previousMonth} ${previousMonthYear}`);

  const allYears = new Set();
  base.forEach((row) => {
    Object.keys(row || {}).forEach((k) => {
      if (k !== "month") allYears.add(String(k));
    });
  });
  legacySeries.forEach((row) => {
    Object.keys(row || {}).forEach((k) => {
      if (k !== "month") allYears.add(String(k));
    });
  });

  base.forEach((row) => {
    allYears.forEach((year) => {
      if (row[year] === undefined) row[year] = 0;
    });
  });
  const monthMap = new Map(base.map((row) => [row.month, row]));
  legacySeries.forEach((legacyRow) => {
    const month = legacyRow?.month;
    const target = monthMap.get(month);
    if (!target) return;
    Object.keys(legacyRow || {}).forEach((year) => {
      if (year === "month") return;
      if (legacyRow[year] === undefined || legacyRow[year] === null) return;
      const key = `${Number(year)}__${month}`;
      if (preserveRecent.has(key)) {
        console.log(`[mergeLegacySeries] Skipping ${key} - using tracker data`);
        return;
      }
      const value = Number(legacyRow[year]);
      if (!Number.isFinite(value)) return;
      target[year] = value;
    });
  });
  return base;
}

function clampFutureMonths(series = []) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();

  return (series || []).map((row) => {
    const monthName = String(row?.month || "").trim();
    const monthIndex = MONTH_INDEX[monthName];
    if (monthIndex === undefined) return { ...row };

    const out = { ...row };
    Object.keys(out).forEach((key) => {
      if (key === "month") return;
      const year = Number(key);
      if (!Number.isFinite(year)) return;
      const isFutureYear = year > currentYear;
      const isFutureMonthInCurrentYear = year === currentYear && monthIndex > currentMonthIndex;
      if (isFutureYear || isFutureMonthInCurrentYear) {
        out[key] = 0;
      }
    });
    return out;
  });
}

async function withLegacyOverviewTrend(metric, baseSeries, filters = {}) {
  if (DATA_SOURCE !== "google_sheets") return baseSeries;
  const hasScopedAccess = Array.isArray(filters.scopeCountries) && filters.scopeCountries.length;
  const hasAdopsScope = Array.isArray(filters.scopeAdops) && filters.scopeAdops.length;
  if (hasScopedAccess || hasAdopsScope) {
    console.log(`[withLegacyOverviewTrend] Skipping legacy merge - scoped access detected`);
    return baseSeries;
  }
  // Exclude region from filterKeys since legacy sheet has country data
  const filterKeys = ["year", "month", "status", "product", "platform", "ops", "cs", "sales"];
  const hasActiveFilters = filterKeys.some((key) => {
    const value = filters[key];
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim().toLowerCase() !== "all" && String(value).trim() !== "";
  });
  if (hasActiveFilters) {
    console.log(`[withLegacyOverviewTrend] Skipping legacy merge - active filters detected:`, filters);
    return baseSeries;
  }
  console.log(`[withLegacyOverviewTrend] ✅ USING BIGQUERY (not Google Sheets) for metric=${metric}`);
  // Use BigQuery's getMergedOverviewSeries instead of reading from Google Sheets directly
  // This reads from the transition table that was populated during sync
  const mergedSeries = await bigQueryReadService.getMergedOverviewSeries(baseSeries, metric);
  console.log(`[withLegacyOverviewTrend] ✅ BigQuery returned ${mergedSeries.length} months (NO Google Sheets API call)`);
  return mergedSeries;
}

router.get("/kpis", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const key = cacheKey(_req, "kpis", JSON.stringify(filters || {}));
    const cached = getCached(key);
    if (cached) return res.json(cached);

    const kpis = await provider.getKpis(filters);

    const response = (kpis || []).slice(0, 4).map((kpi, idx) => {
      const fallbackTitles = ["No of Campaigns", "Gross Margin %", "Net Margin %", "Booked Revenue"];
      return {
        title: kpi?.title || fallbackTitles[idx] || `KPI ${idx + 1}`,
        value: kpi?.value ?? 0,
        subtitle: kpi?.subtitle ?? ""
      };
    });
    setCached(key, response);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch KPI data", message: error.message });
  }
});

router.get("/revenue-trend", async (_req, res) => {
  try {
    const trendFilters = withUserScope(parseFilters(_req.query), _req.user);
    // BigQuery now queries both tracker and transition tables automatically
    const trendData = clampFutureMonths(await provider.getRevenueTrend(trendFilters));
    res.json(trendData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch revenue trend", message: error.message });
  }
});

router.get("/margin-trend", async (_req, res) => {
  try {
    const trendFilters = withUserScope(parseFilters(_req.query), _req.user);
    // BigQuery now queries both tracker and transition tables automatically
    const trendData = clampFutureMonths(await provider.getMarginTrend(trendFilters));
    res.json(trendData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch margin trend", message: error.message });
  }
});

router.get("/campaigns", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const campaigns = await provider.getBottomCampaignsSimple(8, filters);
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch campaign data", message: error.message });
  }
});

router.get("/regions", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const regions = await provider.getRegionTable(filters);
    res.json(regions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch regional data", message: error.message });
  }
});

router.get("/summary", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const summary = (await provider.getKpis(filters)).map((k) => ({ title: k.title, value: k.value, subtitle: k.subtitle }));
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch summary data", message: error.message });
  }
});

router.get("/filter-options", async (_req, res) => {
  try {
    const key = cacheKey(_req, "filter-options", JSON.stringify(_req.query || {}));
    const cached = getCached(key);
    if (cached) return res.json(cached);
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const options = await provider.getFilterOptions(filters);
    setCached(key, options);
    return res.json(options);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch filter options", message: error.message });
  }
});

router.get("/trends", async (_req, res) => {
  try {
    const key = cacheKey(_req, "trends", "v1");
    const cached = getCached(key);
    if (cached) return res.json(cached);

    const trendFilters = {};
    const netMarginFilters = {};
    const revenueBase = await provider.getRevenueTrend(trendFilters);
    const marginBase = await provider.getMarginTrend(trendFilters);
    const cpmBase = await provider.getCpmTrend(trendFilters);
    const netMarginBase = await provider.getNetMarginTrend(netMarginFilters);

    const payload = {
      revenue: clampFutureMonths(await withLegacyOverviewTrend("revenue", revenueBase, trendFilters)),
      margin: clampFutureMonths(await withLegacyOverviewTrend("margin", marginBase, trendFilters)),
      cpm: clampFutureMonths(await withLegacyOverviewTrend("cpm", cpmBase, trendFilters)),
      netMargin: clampFutureMonths(netMarginBase)
    };
    setCached(key, payload);
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch trends", message: error.message });
  }
});

router.get("/campaigns-detailed", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const view = String(_req.query.view || "bottom").toLowerCase();
    const limit = Number(_req.query.limit) || 50;
    const offset = Number(_req.query.offset) || 0;
    const payload = await provider.getCampaignsDetailed(limit, offset, filters, view);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch campaigns-detailed", message: error.message });
  }
});

router.get("/country-wise", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const limit = Number(_req.query.limit) || 50;
    const offset = Number(_req.query.offset) || 0;
    const payload = await provider.getCountryWiseTable(limit, offset, filters);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch country-wise", message: error.message });
  }
});

router.get("/campaign-wise", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    
    // Add sorting and search parameters to filters
    if (_req.query.sortBy) filters.sortBy = _req.query.sortBy;
    if (_req.query.sortOrder) filters.sortOrder = _req.query.sortOrder;
    if (_req.query.campaign) filters.campaign = _req.query.campaign;
    
    const limit = Number(_req.query.limit) || 50;
    const offset = Number(_req.query.offset) || 0;
    const payload = await provider.getCampaignWiseTable(limit, offset, filters);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch campaign-wise", message: error.message });
  }
});

router.get("/product-wise", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const limit = Number(_req.query.limit) || 50;
    const offset = Number(_req.query.offset) || 0;
    const payload = await provider.getProductWiseTable(limit, offset, filters);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch product-wise", message: error.message });
  }
});

router.get("/cpm-trend", async (_req, res) => {
  try {
    const trendFilters = withUserScope(parseFilters(_req.query), _req.user);
    // BigQuery now queries both tracker and transition tables automatically
    const trendData = clampFutureMonths(await provider.getCpmTrend(trendFilters));
    res.json(trendData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cpm-trend", message: error.message });
  }
});

router.get("/net-margin-trend", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const payload = clampFutureMonths(await provider.getNetMarginTrend(filters));
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch net-margin-trend", message: error.message });
  }
});

router.get("/sources", (_req, res) => {
  try {
    const sources = privateSheetsService.getSourceConfig();
    res.json(sources);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch source config", message: error.message });
  }
});

router.get("/last-sync", async (_req, res) => {
  try {
    const iso = await bigQuerySyncService.getLastSyncTime();
    res.json({ lastSyncAt: iso });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch last sync time", message: error.message });
  }
});

router.get("/sync/bigquery/status", (_req, res) => {
  try {
    if (!_req.user || _req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const status = bigQuerySyncService.getSyncStatus();
    res.json(status || { ok: true, status: "idle", message: "No sync has run yet" });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sync status", message: error.message });
  }
});

router.post("/sync/bigquery", async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const fullRefresh = req.query.fullRefresh !== "false";
    const forceRefresh = req.query.forceRefresh === "true";
    const skipIfUnchanged = req.query.skipIfUnchanged !== "false";
    const runAsync = req.query.async !== "false";
    if (runAsync) {
      const started = bigQuerySyncService.startSync({ fullRefresh, forceRefresh, skipIfUnchanged });
      return res.status(started.ok ? 202 : 409).json(started);
    }
    const result = await bigQuerySyncService.syncToBigQuery({ fullRefresh, forceRefresh, skipIfUnchanged });
    return res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to sync BigQuery", message: error.message });
  }
});

router.post("/sync/bigquery/stop", (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const result = bigQuerySyncService.requestStopSync();
    return res.status(result.ok ? 200 : 409).json(result);
  } catch (error) {
    return res.status(500).json({ error: "Failed to stop sync", message: error.message });
  }
});

// Diagnostic endpoint to check CPM data in BigQuery
router.get("/debug/cpm-data", async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const diagnostics = await bigQueryReadService.debugCpmData();
    return res.json(diagnostics);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch CPM diagnostics", message: error.message });
  }
});

module.exports = router;
