const express = require("express");
const router = express.Router();
const powerBiService = require("../services/powerBiService");
const dummyService = require("../services/dummyDataService");
const privateSheetsService = require("../services/privateSheetsService");
const bigQueryReadService = require("../services/bigQueryReadService");
const bigQuerySyncService = require("../services/bigQuerySyncService");

const DATA_SOURCE = (process.env.DATA_SOURCE || "bigquery").toLowerCase();

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

router.get("/kpis", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const kpis = DATA_SOURCE === "powerbi"
      ? await powerBiService.getKPIData()
      : await provider.getKpis(filters);

    const response = [
      { title: "No of Campaigns", value: kpis[0].value, subtitle: kpis[0].subtitle },
      { title: "Gross Margin %", value: kpis[1].value, subtitle: kpis[1].subtitle },
      { title: "Net Margin %", value: kpis[2].value, subtitle: kpis[2].subtitle },
      { title: "Spend", value: kpis[3].value, subtitle: kpis[3].subtitle }
    ];
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch KPI data", message: error.message });
  }
});

router.get("/revenue-trend", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const trendData = DATA_SOURCE === "powerbi"
      ? await powerBiService.getRevenueTrendData()
      : await provider.getRevenueTrend(filters);
    res.json(trendData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch revenue trend", message: error.message });
  }
});

router.get("/margin-trend", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const trendData = DATA_SOURCE === "powerbi"
      ? await powerBiService.getRevenueTrendData()
      : await provider.getMarginTrend(filters);
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
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    if (DATA_SOURCE === "powerbi") {
      return res.json(dummyService.getFilterOptions());
    }
    const options = await provider.getFilterOptions(filters);
    return res.json(options);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch filter options", message: error.message });
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
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const payload = await provider.getCpmTrend(filters);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cpm-trend", message: error.message });
  }
});

router.get("/net-margin-trend", async (_req, res) => {
  try {
    const filters = withUserScope(parseFilters(_req.query), _req.user);
    const payload = await provider.getNetMarginTrend(filters);
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
    const status = bigQuerySyncService.getLastSyncResult();
    res.json(status || { ok: true, status: "idle", message: "No sync has run yet" });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sync status", message: error.message });
  }
});

router.post("/sync/bigquery", async (req, res) => {
  try {
    const fullRefresh = req.query.fullRefresh !== "false";
    const forceRefresh = req.query.forceRefresh === "true";
    const skipIfUnchanged = req.query.skipIfUnchanged !== "false";
    const result = await bigQuerySyncService.syncToBigQuery({ fullRefresh, forceRefresh, skipIfUnchanged });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to sync BigQuery", message: error.message });
  }
});

module.exports = router;
