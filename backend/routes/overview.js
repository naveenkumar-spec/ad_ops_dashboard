const express = require("express");
const router = express.Router();
const powerBiService = require("../services/powerBiService");
const dummyService = require("../services/dummyDataService");
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
  if (DATA_SOURCE === "powerbi") return powerBiService;
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

  const activeKeys = parseMonthYearKeysFromSeries(base);
  if (!activeKeys.length) return base;

  const preserveRecent = new Set(activeKeys.slice(-2).map((x) => x.key));
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
      if (preserveRecent.has(key)) return;
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
  if (hasScopedAccess || hasAdopsScope) return baseSeries;
  const filterKeys = ["region", "year", "month", "status", "product", "platform", "ops", "cs", "sales"];
  const hasActiveFilters = filterKeys.some((key) => {
    const value = filters[key];
    if (value === undefined || value === null) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim().toLowerCase() !== "all" && String(value).trim() !== "";
  });
  if (hasActiveFilters) return baseSeries;
  const legacySeries = await privateSheetsService.getOverviewLegacyTrend(metric);
  return mergeLegacySeries(baseSeries, legacySeries);
}

router.get("/kpis", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const key = cacheKey(_req, "kpis", JSON.stringify(filters || {}));
    const cached = getCached(key);
    if (cached) return res.json(cached);

    const kpis = DATA_SOURCE === "powerbi"
      ? await powerBiService.getKPIData()
      : await provider.getKpis(filters);

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
    const trendFilters = {};
    const baseSeries = DATA_SOURCE === "powerbi"
      ? await powerBiService.getRevenueTrendData()
      : await provider.getRevenueTrend(trendFilters);
    const trendData = clampFutureMonths(await withLegacyOverviewTrend("revenue", baseSeries, trendFilters));
    res.json(trendData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch revenue trend", message: error.message });
  }
});

router.get("/margin-trend", async (_req, res) => {
  try {
    const trendFilters = {};
    const baseSeries = DATA_SOURCE === "powerbi"
      ? await powerBiService.getRevenueTrendData()
      : await provider.getMarginTrend(trendFilters);
    const trendData = clampFutureMonths(await withLegacyOverviewTrend("margin", baseSeries, trendFilters));
    res.json(trendData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch margin trend", message: error.message });
  }
});

router.get("/campaigns", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const campaigns = DATA_SOURCE === "powerbi"
      ? await powerBiService.getCampaignData()
      : await provider.getBottomCampaignsSimple(8, filters);
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch campaign data", message: error.message });
  }
});

router.get("/regions", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const regions = DATA_SOURCE === "powerbi"
      ? await powerBiService.getRegionData()
      : await provider.getRegionTable(filters);
    res.json(regions);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch regional data", message: error.message });
  }
});

router.get("/summary", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const summary = DATA_SOURCE === "powerbi"
      ? await powerBiService.getSummaryMetrics()
      : (await provider.getKpis(filters)).map((k) => ({ title: k.title, value: k.value, subtitle: k.subtitle }));
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
    if (DATA_SOURCE === "powerbi") {
      const payload = dummyService.getFilterOptions();
      setCached(key, payload);
      return res.json(payload);
    }
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
    const revenueBase = DATA_SOURCE === "powerbi"
      ? await powerBiService.getRevenueTrendData()
      : await provider.getRevenueTrend(trendFilters);
    const marginBase = DATA_SOURCE === "powerbi"
      ? await powerBiService.getRevenueTrendData()
      : await provider.getMarginTrend(trendFilters);
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
    const payload = await provider.getCampaignsDetailed(25, filters);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch campaigns-detailed", message: error.message });
  }
});

router.get("/country-wise", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const payload = await provider.getCountryWiseTable(filters);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch country-wise", message: error.message });
  }
});

router.get("/campaign-wise", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const payload = await provider.getCampaignWiseTable(50, filters);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch campaign-wise", message: error.message });
  }
});

router.get("/product-wise", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const payload = await provider.getProductWiseTable(filters);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch product-wise", message: error.message });
  }
});

router.get("/cpm-trend", async (_req, res) => {
  try {
    const trendFilters = {};
    const baseSeries = await provider.getCpmTrend(trendFilters);
    const payload = clampFutureMonths(await withLegacyOverviewTrend("cpm", baseSeries, trendFilters));
    res.json(payload);
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
