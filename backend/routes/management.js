const express = require("express");
const router = express.Router();
const dummyService = require("../services/dummyDataService");

const handleRequest = async (req, res, handler, label) => {
  try {
    console.log(`📧 ${label} endpoint called`);
    const data = await handler();
    console.log(`✅ ${label} response sent: ${Array.isArray(data) ? data.length : "1"} rows`);
    res.json(data);
  } catch (error) {
    console.error(`❌ Error fetching ${label.toLowerCase()}:`, error.message);
    res
      .status(500)
      .json({ error: `Failed to fetch ${label.toLowerCase()} data`, message: error.message });
  }
};

const applyUserScopeToRows = (rows, user) => {
  if (!user || user.role === "admin" || user.fullAccess || !Array.isArray(rows)) return rows;
  const allowedAdops = Array.isArray(user.allowedAdops) ? user.allowedAdops.map((v) => String(v).toLowerCase()) : [];
  if (!allowedAdops.length) return rows;
  return rows.filter((row) => {
    const owner = String(row.owner || row.name || "").toLowerCase();
    return allowedAdops.includes(owner);
  });
};

const pickFilters = (query) => {
  const { region, year, month, status, product, platform } = query || {};
  const norm = (v) => {
    if (v === undefined || v === null) return undefined;
    const parts = Array.isArray(v) ? v : String(v).split(",");
    const cleaned = parts
      .map((item) => String(item).trim())
      .filter((item) => item && item.toLowerCase() !== "all");
    if (!cleaned.length) return "all";
    return cleaned.length === 1 ? cleaned[0] : cleaned;
  };
  const f = {
    region: norm(region),
    year: norm(year),
    month: norm(month),
    status: norm(status),
    product: norm(product),
    platform: norm(platform),
  };
  Object.keys(f).forEach((k) => {
    if (f[k] && String(f[k]).toLowerCase() === "all") f[k] = "all";
  });
  return f;
};

router.get("/performance", (req, res) => {
  const { type = "ops" } = req.query;
  const filters = pickFilters(req.query);
  return handleRequest(
    req,
    res,
    async () => applyUserScopeToRows(dummyService.getOwnerPerformance(type, filters), req.user),
    `${type} performance (chart)`
  );
});

router.get("/ops", (req, res) => {
  const filters = pickFilters(req.query);
  return handleRequest(req, res, async () => applyUserScopeToRows(dummyService.getOwnerPerformance("ops", filters), req.user), "Ops performance");
});

router.get("/cs", (req, res) => {
  const filters = pickFilters(req.query);
  return handleRequest(req, res, async () => applyUserScopeToRows(dummyService.getOwnerPerformance("cs", filters), req.user), "CS performance");
});

router.get("/sales", (req, res) => {
  const filters = pickFilters(req.query);
  return handleRequest(req, res, async () => applyUserScopeToRows(dummyService.getOwnerPerformance("sales", filters), req.user), "Sales performance");
});

router.get("/filter-options", (req, res) => {
  return handleRequest(req, res, () => dummyService.getFilterOptions(), "Filter options");
});

router.get("/platform-spends", (req, res) => {
  const filters = pickFilters(req.query);
  return handleRequest(req, res, () => dummyService.getPlatformSpends(filters), "Platform spends");
});

module.exports = router;
