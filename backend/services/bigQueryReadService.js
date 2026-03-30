const path = require("path");
const { BigQuery } = require("@google-cloud/bigquery");

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
const MONTH_INDEX = Object.fromEntries(MONTHS.map((m, i) => [m.toLowerCase(), i]));

const keyFileFromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || "./secrets/google-sa.json";
const keyFilename = path.isAbsolute(keyFileFromEnv)
  ? keyFileFromEnv
  : path.resolve(__dirname, "..", keyFileFromEnv);

const projectId = process.env.GCP_PROJECT_ID;
const datasetId = process.env.BIGQUERY_DATASET_ID || "adops_dashboard";
const tableId = process.env.BIGQUERY_TABLE_ID || "campaign_tracker_consolidated";
const transitionTableId = process.env.BIGQUERY_TRANSITION_TABLE_ID || "overview_transition_metrics";
const tableRef = `\`${projectId}.${datasetId}.${tableId}\``;
const transitionTableRef = `\`${projectId}.${datasetId}.${transitionTableId}\``;
const location = process.env.BIGQUERY_LOCATION || "US";

const bigquery = new BigQuery({
  projectId: projectId || undefined,
  keyFilename
});

let cachedRows = null;
let lastFetchTime = 0;
let cachedTransitionRows = null;
let lastTransitionFetchTime = 0;
const CACHE_MS = Number(process.env.BIGQUERY_READ_CACHE_MS || 120000);

function normalize(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim().toLowerCase();
}

function isAll(value) {
  return normalize(value) === "all" || normalize(value) === "";
}

function toFilterList(value) {
  if (Array.isArray(value)) {
    return value.map(normalize).filter((v) => v && v !== "all");
  }
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "all") return [];
  return text
    .split(",")
    .map(normalize)
    .filter((v) => v && v !== "all");
}

function matchesAny(rowValue, filterValue) {
  const list = toFilterList(filterValue);
  if (!list.length) return true;
  return list.includes(normalize(rowValue));
}

function applyFilters(rows, filters = {}) {
  const f = filters || {};
  const scopeCountries = Array.isArray(f.scopeCountries) ? f.scopeCountries.map(normalize).filter(Boolean) : [];
  const scopeAdops = Array.isArray(f.scopeAdops) ? f.scopeAdops.map(normalize).filter(Boolean) : [];
  const regionList = toFilterList(f.region);
  const yearList = toFilterList(f.year);
  return rows.filter((row) => {
    if (scopeCountries.length) {
      const c = normalize(row.country);
      const r = normalize(row.region);
      if (!scopeCountries.includes(c) && !scopeCountries.includes(r)) return false;
    }
    if (scopeAdops.length) {
      const owners = [normalize(row.opsOwner), normalize(row.csOwner), normalize(row.salesOwner)];
      if (!owners.some((owner) => scopeAdops.includes(owner))) return false;
    }
    if (regionList.length) {
      const region = normalize(row.region);
      const country = normalize(row.country);
      if (!regionList.includes(region) && !regionList.includes(country)) return false;
    }
    if (yearList.length && !yearList.includes(normalize(row.year))) return false;
    if (!matchesAny(row.month, f.month)) return false;
    if (!matchesAny(row.status, f.status)) return false;
    if (!matchesAny(row.product, f.product)) return false;
    if (!matchesAny(row.platform, f.platform)) return false;
    if (!matchesAny(row.opsOwner, f.ops)) return false;
    if (!matchesAny(row.csOwner, f.cs)) return false;
    if (!matchesAny(row.salesOwner, f.sales)) return false;
    return true;
  });
}

function sum(items, getter) {
  return items.reduce((acc, item) => acc + (Number(getter(item)) || 0), 0);
}

function avg(items, getter) {
  if (!items.length) return 0;
  return sum(items, getter) / items.length;
}

function groupBy(items, keyFn) {
  const map = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
}

async function queryRows() {
  if (!projectId || String(projectId).toLowerCase().includes("your-gcp-project-id")) {
    throw new Error("Set GCP_PROJECT_ID in backend/.env");
  }
  const [rows] = await bigquery.query({
    query: `
      SELECT
        campaign_name, status, country, region, revenue, spend, gross_profit, gross_margin_pct,
        net_margin, net_margin_pct, planned_impressions, delivered_impressions, budget_groups, cpm,
        start_date, end_date, month, year, product, platform, ops_owner, cs_owner, sales_owner
      FROM ${tableRef}
    `,
    location
  });

  return rows.map((r) => ({
    campaignName: r.campaign_name,
    status: r.status,
    country: r.country,
    region: r.region,
    revenue: Number(r.revenue || 0),
    spend: Number(r.spend || 0),
    grossProfit: Number(r.gross_profit || 0),
    grossMarginPct: Number(r.gross_margin_pct || 0),
    netMargin: Number(r.net_margin || 0),
    netMarginPct: Number(r.net_margin_pct || 0),
    plannedImpressions: Number(r.planned_impressions || 0),
    deliveredImpressions: Number(r.delivered_impressions || 0),
    budgetGroups: Number(r.budget_groups || 0),
    cpm: Number(r.cpm || 0),
    startDate: r.start_date ? String(r.start_date.value || r.start_date) : null,
    endDate: r.end_date ? String(r.end_date.value || r.end_date) : null,
    month: r.month,
    year: Number(r.year || 0),
    product: r.product,
    platform: r.platform,
    opsOwner: r.ops_owner,
    csOwner: r.cs_owner,
    salesOwner: r.sales_owner
  }));
}

async function loadAllRows(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedRows && now - lastFetchTime < CACHE_MS) return cachedRows;
  cachedRows = await queryRows();
  lastFetchTime = now;
  return cachedRows;
}

async function queryTransitionRows() {
  if (!projectId || String(projectId).toLowerCase().includes("your-gcp-project-id")) {
    throw new Error("Set GCP_PROJECT_ID in backend/.env");
  }
  try {
    const [rows] = await bigquery.query({
      query: `
        SELECT month, year, quarter, booked_revenue_m, gross_margin_pct, average_buying_cpm
        FROM (
          SELECT
            month,
            year,
            quarter,
            booked_revenue_m,
            gross_margin_pct,
            average_buying_cpm,
            ROW_NUMBER() OVER (PARTITION BY month, year ORDER BY synced_at DESC) AS rn
          FROM ${transitionTableRef}
        )
        WHERE rn = 1
      `,
      location
    });
    return rows.map((r) => ({
      month: r.month,
      year: Number(r.year || 0),
      quarter: r.quarter,
      bookedRevenueM: Number(r.booked_revenue_m || 0),
      grossMarginPct: Number(r.gross_margin_pct || 0),
      averageBuyingCpm: Number(r.average_buying_cpm || 0)
    }));
  } catch (error) {
    const msg = String(error?.message || "").toLowerCase();
    if (msg.includes("not found") || msg.includes("no such table")) return [];
    throw error;
  }
}

async function loadTransitionRows(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedTransitionRows && now - lastTransitionFetchTime < CACHE_MS) {
    return cachedTransitionRows;
  }
  cachedTransitionRows = await queryTransitionRows();
  lastTransitionFetchTime = now;
  return cachedTransitionRows;
}

function monthYearSeries(rows, getter, mode = "sum") {
  const years = Array.from(new Set(rows.map((r) => String(r.year)))).filter(Boolean).sort();
  const out = MONTHS.map((m) => {
    const row = { month: m };
    years.forEach((y) => {
      row[y] = 0;
    });
    return row;
  });
  const idx = Object.fromEntries(MONTHS.map((m, i) => [m, i]));
  const buckets = groupBy(rows.filter((r) => r.month && idx[r.month] !== undefined), (r) => `${r.month}__${r.year}`);
  buckets.forEach((bucket, key) => {
    const [month, year] = key.split("__");
    const i = idx[month];
    if (i === undefined) return;
    out[i][year] = mode === "avg" ? Number(avg(bucket, getter).toFixed(2)) : Number((sum(bucket, getter) / 1_000_000).toFixed(2));
  });
  return out;
}

function parseMonthYearKeysFromSeries(series = []) {
  const keys = [];
  (series || []).forEach((row) => {
    const month = String(row?.month || "").trim();
    const monthIdx = MONTH_INDEX[month.toLowerCase()];
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

function mergeSeriesPreserveRecent(baseSeries = [], legacySeries = []) {
  const base = (baseSeries || []).map((row) => ({ ...row }));
  if (!base.length || !legacySeries?.length) return base;

  const activeKeys = parseMonthYearKeysFromSeries(base);
  if (!activeKeys.length) return base;
  const preserveRecent = new Set(activeKeys.slice(-2).map((x) => x.key));

  const allYears = new Set();
  base.forEach((row) => Object.keys(row || {}).forEach((k) => { if (k !== "month") allYears.add(String(k)); }));
  legacySeries.forEach((row) => Object.keys(row || {}).forEach((k) => { if (k !== "month") allYears.add(String(k)); }));

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
      const value = Number(legacyRow[year]);
      if (!Number.isFinite(value)) return;
      const key = `${Number(year)}__${month}`;
      if (preserveRecent.has(key)) return;
      target[year] = value;
    });
  });
  return base;
}

function transitionSeries(rows, metric) {
  const years = Array.from(new Set((rows || []).map((r) => String(r.year)).filter(Boolean))).sort();
  const out = MONTHS.map((month) => {
    const row = { month };
    years.forEach((year) => { row[year] = 0; });
    return row;
  });
  const monthIdx = Object.fromEntries(MONTHS.map((m, i) => [m, i]));
  (rows || []).forEach((r) => {
    const month = String(r.month || "").trim();
    const year = String(r.year || "");
    const idx = monthIdx[month];
    if (idx === undefined || !year) return;
    let value = 0;
    if (metric === "revenue") value = Number(r.bookedRevenueM || 0);
    if (metric === "margin") value = Number(r.grossMarginPct || 0);
    if (metric === "cpm") value = Number(r.averageBuyingCpm || 0);
    out[idx][year] = Number(value.toFixed(2));
  });
  return out;
}

async function getMergedOverviewSeries(baseSeries, metric) {
  const legacyRows = await loadTransitionRows();
  if (!legacyRows.length) return baseSeries;
  const legacySeries = transitionSeries(legacyRows, metric);
  return mergeSeriesPreserveRecent(baseSeries, legacySeries);
}

async function getKpis(filters = {}) {
  const rows = applyFilters(await loadAllRows(), filters);
  const totalRevenue = sum(rows, (r) => r.revenue);
  const totalSpend = sum(rows, (r) => r.spend);
  const campaigns = new Set(rows.map((r) => r.campaignName)).size;
  const budgetGroups = sum(rows, (r) => r.budgetGroups);
  return [
    { title: "No of Campaigns", value: campaigns, subtitle: `Budget Groups: ${budgetGroups}` },
    { title: "Gross Margin %", value: `${avg(rows, (r) => r.grossMarginPct).toFixed(1)}%`, subtitle: `Total Revenue: $${(totalRevenue / 1_000_000).toFixed(2)}M` },
    { title: "Net Margin %", value: `${avg(rows, (r) => r.netMarginPct).toFixed(1)}%`, subtitle: `Total Spend: $${(totalSpend / 1_000_000).toFixed(2)}M` },
    { title: "Spend", value: `$${(totalSpend / 1_000_000).toFixed(2)}M`, subtitle: `Booked Revenue: $${(totalRevenue / 1_000_000).toFixed(2)}M` }
  ];
}

async function getRevenueTrend(filters = {}) {
  const base = monthYearSeries(applyFilters(await loadAllRows(), filters), (r) => r.revenue, "sum");
  return getMergedOverviewSeries(base, "revenue");
}

async function getMarginTrend(filters = {}) {
  const base = monthYearSeries(applyFilters(await loadAllRows(), filters), (r) => r.grossMarginPct, "avg");
  return getMergedOverviewSeries(base, "margin");
}

async function getNetMarginTrend(filters = {}) {
  return monthYearSeries(applyFilters(await loadAllRows(), filters), (r) => r.netMarginPct, "avg");
}

async function getCpmTrend(filters = {}) {
  const base = monthYearSeries(applyFilters(await loadAllRows(), filters), (r) => r.cpm, "avg");
  return getMergedOverviewSeries(base, "cpm");
}

async function getBottomCampaignsSimple(limit = 8, filters = {}) {
  const rows = applyFilters(await loadAllRows(), filters);
  return rows
    .slice()
    .sort((a, b) => a.grossMarginPct - b.grossMarginPct)
    .slice(0, limit)
    .map((r) => ({
      campaignName: r.campaignName,
      status: r.status,
      revenue: r.revenue,
      spend: r.spend,
      profit: r.grossProfit,
      grossMargin: Number(r.grossMarginPct.toFixed(2))
    }));
}

async function getCampaignsDetailed(limit = 25, filters = {}) {
  const rows = applyFilters(await loadAllRows(), filters);
  const out = rows
    .slice()
    .sort((a, b) => a.grossMarginPct - b.grossMarginPct)
    .slice(0, limit)
    .map((r) => ({
      name: r.campaignName,
      status: r.status,
      revenue: r.revenue,
      spend: r.spend,
      grossMargin: r.grossProfit,
      grossMarginPct: Number(r.grossMarginPct.toFixed(2)),
      netMargin: r.netMargin,
      netMarginPct: Number(r.netMarginPct.toFixed(2)),
      plannedImpressions: r.plannedImpressions
    }));
  return {
    rows: out,
    totals: {
      revenue: sum(out, (r) => r.revenue),
      spend: sum(out, (r) => r.spend),
      grossMargin: sum(out, (r) => r.grossMargin),
      grossMarginPct: avg(out, (r) => r.grossMarginPct),
      netMargin: sum(out, (r) => r.netMargin),
      netMarginPct: avg(out, (r) => r.netMarginPct),
      plannedImpressions: sum(out, (r) => r.plannedImpressions)
    }
  };
}

async function getRegionTable(filters = {}) {
  const rows = applyFilters(await loadAllRows(), filters);
  const grouped = groupBy(rows, (r) => r.country || "Unknown");
  const out = [];
  grouped.forEach((bucket, country) => {
    const bookedRevenue = sum(bucket, (r) => r.revenue);
    const spend = sum(bucket, (r) => r.spend);
    const grossMargin = sum(bucket, (r) => r.grossProfit);
    const plannedImpressions = sum(bucket, (r) => r.plannedImpressions);
    const deliveredImpressions = sum(bucket, (r) => r.deliveredImpressions);
    out.push({
      region: country,
      totalCampaigns: new Set(bucket.map((r) => r.campaignName)).size,
      budgetGroups: sum(bucket, (r) => r.budgetGroups),
      bookedRevenue,
      spend,
      plannedImpressions,
      deliveredImpressions,
      deliveredPct: plannedImpressions ? Number(((deliveredImpressions / plannedImpressions) * 100).toFixed(2)) : 0,
      grossMargin,
      grossMarginPct: bookedRevenue ? Number(((grossMargin / bookedRevenue) * 100).toFixed(2)) : 0
    });
  });
  return out.sort((a, b) => b.bookedRevenue - a.bookedRevenue);
}

async function getCountryWiseTable(filters = {}) {
  const rows = applyFilters(await loadAllRows(), filters);
  const grouped = groupBy(rows, (r) => r.region || "Unknown");
  const out = [];
  grouped.forEach((bucket, region) => {
    const revenue = sum(bucket, (r) => r.revenue);
    const spend = sum(bucket, (r) => r.spend);
    const grossMargin = sum(bucket, (r) => r.grossProfit);
    const plannedImpressions = sum(bucket, (r) => r.plannedImpressions);
    const deliveredImpressions = sum(bucket, (r) => r.deliveredImpressions);
    out.push({
      region,
      campaigns: new Set(bucket.map((r) => r.campaignName)).size,
      budgetGroups: sum(bucket, (r) => r.budgetGroups),
      revenue,
      spend,
      plannedImpressions,
      deliveredImpressions,
      deliveredPct: plannedImpressions ? Number(((deliveredImpressions / plannedImpressions) * 100).toFixed(2)) : 0,
      grossMargin,
      grossMarginPct: revenue ? Number(((grossMargin / revenue) * 100).toFixed(2)) : 0
    });
  });
  const totals = {
    campaigns: sum(out, (r) => r.campaigns),
    budgetGroups: sum(out, (r) => r.budgetGroups),
    revenue: sum(out, (r) => r.revenue),
    spend: sum(out, (r) => r.spend),
    plannedImpressions: sum(out, (r) => r.plannedImpressions),
    deliveredImpressions: sum(out, (r) => r.deliveredImpressions),
    grossMargin: sum(out, (r) => r.grossMargin)
  };
  totals.deliveredPct = totals.plannedImpressions ? Number(((totals.deliveredImpressions / totals.plannedImpressions) * 100).toFixed(2)) : 0;
  totals.grossMarginPct = totals.revenue ? Number(((totals.grossMargin / totals.revenue) * 100).toFixed(2)) : 0;
  return { rows: out.sort((a, b) => b.revenue - a.revenue), totals };
}

async function getCampaignWiseTable(limit = 50, filters = {}) {
  const rows = applyFilters(await loadAllRows(), filters);
  const grouped = groupBy(rows, (r) => r.campaignName || "Unknown");
  const out = [];
  grouped.forEach((bucket, name) => {
    const starts = bucket.map((r) => r.startDate).filter(Boolean).sort();
    const ends = bucket.map((r) => r.endDate).filter(Boolean).sort();
    out.push({
      name,
      budgetGroups: sum(bucket, (r) => r.budgetGroups),
      startDate: starts[0] || null,
      endDate: ends[ends.length - 1] || null,
      plannedImpressions: sum(bucket, (r) => r.plannedImpressions)
    });
  });
  const rowsOut = out.sort((a, b) => b.plannedImpressions - a.plannedImpressions).slice(0, limit);
  return {
    rows: rowsOut,
    totals: {
      budgetGroups: sum(rowsOut, (r) => r.budgetGroups),
      duration: 0,
      daysRemaining: 0,
      avgPctPassed: 0,
      plannedImpressions: sum(rowsOut, (r) => r.plannedImpressions)
    }
  };
}

async function getProductWiseTable(filters = {}) {
  const rows = applyFilters(await loadAllRows(), filters);
  const grouped = groupBy(rows, (r) => r.product || "Unknown");
  const out = [];
  grouped.forEach((bucket, product) => {
    const bookedRevenue = sum(bucket, (r) => r.revenue);
    const spend = sum(bucket, (r) => r.spend);
    const grossProfitLoss = sum(bucket, (r) => r.grossProfit);
    const plannedImpressions = sum(bucket, (r) => r.plannedImpressions);
    const deliveredImpressions = sum(bucket, (r) => r.deliveredImpressions);
    out.push({
      product,
      totalCampaigns: new Set(bucket.map((r) => r.campaignName)).size,
      budgetGroups: sum(bucket, (r) => r.budgetGroups),
      bookedRevenue,
      spend,
      plannedImpressions,
      deliveredImpressions,
      deliveredPct: plannedImpressions ? Number(((deliveredImpressions / plannedImpressions) * 100).toFixed(2)) : 0,
      grossProfitLoss,
      grossMargin: bookedRevenue ? Number(((grossProfitLoss / bookedRevenue) * 100).toFixed(2)) : 0
    });
  });
  const totals = {
    totalCampaigns: sum(out, (r) => r.totalCampaigns),
    budgetGroups: sum(out, (r) => r.budgetGroups),
    bookedRevenue: sum(out, (r) => r.bookedRevenue),
    spend: sum(out, (r) => r.spend),
    plannedImpressions: sum(out, (r) => r.plannedImpressions),
    deliveredImpressions: sum(out, (r) => r.deliveredImpressions),
    grossProfitLoss: sum(out, (r) => r.grossProfitLoss)
  };
  totals.deliveredPct = totals.plannedImpressions ? Number(((totals.deliveredImpressions / totals.plannedImpressions) * 100).toFixed(2)) : 0;
  totals.grossMargin = totals.bookedRevenue ? Number(((totals.grossProfitLoss / totals.bookedRevenue) * 100).toFixed(2)) : 0;
  return { rows: out.sort((a, b) => b.bookedRevenue - a.bookedRevenue), totals };
}

async function getFilterOptions(filters = {}) {
  const rows = applyFilters(await loadAllRows(), filters);
  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean))).sort();
  const regionMap = new Map();
  const yearMonthMap = new Map();

  rows.forEach((r) => {
    const region = String(r.region || "").trim();
    const country = String(r.country || "").trim();
    if (region) {
      if (!regionMap.has(region)) regionMap.set(region, new Set());
      if (country) regionMap.get(region).add(country);
    }

    const year = Number(r.year || 0);
    const month = String(r.month || "").trim();
    if (year) {
      if (!yearMonthMap.has(year)) yearMonthMap.set(year, new Set());
      if (month) yearMonthMap.get(year).add(month);
    }
  });

  const regionTree = Array.from(regionMap.entries())
    .map(([region, countriesSet]) => ({
      region,
      countries: Array.from(countriesSet).sort()
    }))
    .sort((a, b) => a.region.localeCompare(b.region));

  const yearMonthTree = Array.from(yearMonthMap.entries())
    .map(([year, monthsSet]) => ({
      year: Number(year),
      months: Array.from(monthsSet).sort(
        (a, b) => (MONTH_INDEX[String(a).toLowerCase()] ?? 999) - (MONTH_INDEX[String(b).toLowerCase()] ?? 999)
      )
    }))
    .sort((a, b) => b.year - a.year);

  return {
    region: uniq(rows.map((r) => r.region)),
    year: uniq(rows.map((r) => r.year)),
    month: uniq(rows.map((r) => r.month)),
    status: uniq(rows.map((r) => r.status)),
    product: uniq(rows.map((r) => r.product)),
    platform: uniq(rows.map((r) => r.platform)),
    ops: uniq(rows.map((r) => r.opsOwner)),
    cs: uniq(rows.map((r) => r.csOwner)),
    sales: uniq(rows.map((r) => r.salesOwner)),
    regionTree,
    yearMonthTree
  };
}

async function getAdminOptions(filters = {}) {
  const rows = applyFilters(await loadAllRows(), filters);
  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean))).sort();
  return {
    countries: uniq(rows.map((r) => r.country)),
    regions: uniq(rows.map((r) => r.region)),
    adops: uniq(rows.flatMap((r) => [r.opsOwner, r.csOwner, r.salesOwner]))
  };
}

module.exports = {
  loadAllRows,
  getKpis,
  getRevenueTrend,
  getMarginTrend,
  getNetMarginTrend,
  getCpmTrend,
  getBottomCampaignsSimple,
  getCampaignsDetailed,
  getRegionTable,
  getCountryWiseTable,
  getCampaignWiseTable,
  getProductWiseTable,
  getFilterOptions,
  getAdminOptions
};
