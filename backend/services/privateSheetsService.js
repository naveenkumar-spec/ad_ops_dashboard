const path = require("path");
const { google } = require("googleapis");
const config = require("../config/googleSheetsSources.json");

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

const COUNTRY_TO_REGION = {
  USA: "North America",
  UK: "Europe",
  "UK/Europe": "Europe",
  Europe: "Europe",
  India: "India+SEA",
  Canada: "North America",
  UAE: "Middle East",
  Malaysia: "India+SEA",
  Singapore: "Rest of APAC",
  Australia: "Australia",
  Indonesia: "India+SEA",
  Japan: "Japan",
  "New Zealand": "Rest of APAC",
  Newzealand: "Rest of APAC",
  Pakistan: "India+SEA",
  Philippines: "India+SEA",
  "South Africa": "Africa",
  Thailand: "India+SEA",
  Vietnam: "India+SEA"
};

const FIELD_ALIASES = {
  campaignName: ["Campaign Name"],
  status: ["Status"],
  country: ["Country"],
  revenue: ["Revenue"],
  spend: ["Spends"],
  grossProfit: ["Gross Profit"],
  grossMarginPct: ["Gross Profit %"],
  netMarginPct: ["% Net gross margin", "% Net gross margin "],
  netMargin: ["Net gross margin", "Net gross margin ", " Net gross margin "],
  plannedImpressions: ["Planned Impression"],
  deliveredImpressions: ["Delivered Impressions"],
  month: ["Month"],
  year: ["Year"],
  startDate: ["Start Date"],
  endDate: ["End Date"],
  product: ["Product"],
  platform: ["Platform"],
  opsOwner: ["Ops Responsible"],
  csOwner: ["CS Responsible"],
  salesOwner: ["Sale Responsible", "Sales Responsible"],
  budgetGroups: ["Budget Groups"],
  cpm: ["Buying CPM"]
};

const OVERVIEW_RAW_SPENDS_SOURCE = {
  country: "Overview Legacy",
  sheetId: "1MwWqMLj5b4FwIS6wD3FugfwgbWlyJD0xaQJLpmlRlQs",
  tabName: "Raw Spends Data",
  gid: 848964579,
  enabled: true
};

const NORMALIZED_HEADER_CANDIDATES = new Set(
  Object.values(FIELD_ALIASES).flat().map((value) => normalizeKey(value))
);

let cachedRows = null;
let lastFetchTime = 0;
const sheetMetaCache = new Map();

const keyFileFromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || "./secrets/google-sa.json";
const keyFilePath = path.isAbsolute(keyFileFromEnv)
  ? keyFileFromEnv
  : path.resolve(__dirname, "..", keyFileFromEnv);

const auth = new google.auth.GoogleAuth({
  keyFile: keyFilePath,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
});

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseNumber(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value).trim();
  if (!raw) return 0;

  const isNegativeInParens = raw.startsWith("(") && raw.endsWith(")");
  const suffix = raw.slice(-1).toUpperCase();
  const multiplier = suffix === "K" ? 1e3 : suffix === "M" ? 1e6 : suffix === "B" ? 1e9 : 1;

  const cleaned = raw
    .replace(/[,$%()]/g, "")
    .replace(/[KMB]$/i, "")
    .replace(/\s+/g, "");

  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return 0;

  const base = parsed * multiplier;
  return isNegativeInParens ? -base : base;
}

function parseDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const ddmmyyyy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]) - 1;
    const year = Number(ddmmyyyy[3].length === 2 ? `20${ddmmyyyy[3]}` : ddmmyyyy[3]);
    const d = new Date(year, month, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseMonthName(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const exact = MONTHS.find((m) => m.toLowerCase() === lower);
  if (exact) return exact;
  const short = MONTHS.find((m) => m.slice(0, 3).toLowerCase() === lower.slice(0, 3));
  return short || null;
}

function pickField(rowValues, headerMap, aliases) {
  for (const alias of aliases) {
    const idx = headerMap[normalizeKey(alias)];
    if (idx === undefined) continue;
    const value = rowValues[idx];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

async function getSheetsClient() {
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client });
}

function normalizeTabName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getTabCandidates(source = {}) {
  const country = String(source.country || "").trim();
  const tabName = String(source.tabName || "").trim();
  const out = [tabName, country];
  const normalizedCountry = normalizeTabName(country);

  if (normalizedCountry === "uk" || normalizedCountry === "europe" || normalizedCountry === "ukeurope") {
    out.push("UK/Europe", "UK Europe");
  }
  if (normalizedCountry === "newzealand") {
    out.push("New Zealand", "Newzealand");
  }
  if (normalizedCountry === "middleeast") {
    out.push("Middle East", "Middleeast");
  }
  return Array.from(new Set(out.filter(Boolean)));
}

async function getSheetTitlesById(sheets, spreadsheetId) {
  const cacheKey = String(spreadsheetId || "").trim();
  if (!cacheKey) return [];
  if (sheetMetaCache.has(cacheKey)) return sheetMetaCache.get(cacheKey);

  const res = await sheets.spreadsheets.get({
    spreadsheetId: cacheKey,
    fields: "sheets.properties.title"
  });
  const titles = (res.data.sheets || [])
    .map((s) => String(s?.properties?.title || "").trim())
    .filter(Boolean);

  sheetMetaCache.set(cacheKey, titles);
  return titles;
}

async function readTabValues(sheets, spreadsheetId, tabName) {
  const range = `'${String(tabName || "").replace(/'/g, "''")}'`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range
  });
  return res.data.values || [];
}

async function resolveTabName(sheets, source) {
  const candidates = getTabCandidates(source);

  for (const candidate of candidates) {
    try {
      await readTabValues(sheets, source.sheetId, candidate);
      return String(candidate).trim();
    } catch (_error) {
      // Try next candidate.
    }
  }

  const titles = await getSheetTitlesById(sheets, source.sheetId);
  if (!titles.length) return String(source.tabName || source.country || "").trim();

  const normalizedMap = new Map(titles.map((title) => [normalizeTabName(title), title]));
  for (const candidate of candidates) {
    const matched = normalizedMap.get(normalizeTabName(candidate));
    if (matched) return matched;
  }
  return titles[0];
}

function normalizeRow(rowValues, headerMap, source) {
  const campaignName = String(pickField(rowValues, headerMap, FIELD_ALIASES.campaignName) || "").trim() || "Unknown Campaign";
  const status = String(pickField(rowValues, headerMap, FIELD_ALIASES.status) || "Active").trim();
  const country = String(source.country || pickField(rowValues, headerMap, FIELD_ALIASES.country) || "Unknown").trim();

  const revenue = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.revenue));
  const spend = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.spend));
  const grossProfitRaw = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.grossProfit));
  const grossProfit = grossProfitRaw || revenue - spend;
  const netMarginRaw = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.netMargin));
  const netMargin = netMarginRaw || grossProfit;

  let grossMarginPct = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.grossMarginPct));
  let netMarginPct = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.netMarginPct));
  if (!grossMarginPct && revenue) grossMarginPct = (grossProfit / revenue) * 100;
  if (!netMarginPct && revenue) netMarginPct = (netMargin / revenue) * 100;

  const plannedImpressions = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.plannedImpressions));
  const deliveredImpressions = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.deliveredImpressions));
  const budgetGroups = Math.max(1, Math.round(parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.budgetGroups)) || 1));
  const cpm = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.cpm));

  const startDate = parseDate(pickField(rowValues, headerMap, FIELD_ALIASES.startDate));
  const endDate = parseDate(pickField(rowValues, headerMap, FIELD_ALIASES.endDate));
  const monthFromField = parseMonthName(pickField(rowValues, headerMap, FIELD_ALIASES.month));
  const month = monthFromField || (startDate ? MONTHS[startDate.getMonth()] : null);

  const currentYear = new Date().getFullYear();
  const yearRaw = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.year));
  let year = yearRaw || (startDate ? startDate.getFullYear() : currentYear);
  if (year < 2023 || year > currentYear + 2) {
    year = currentYear;
  }

  const normalized = {
    campaignName,
    status,
    country,
    region: COUNTRY_TO_REGION[country] || country,
    revenue,
    spend,
    grossProfit,
    grossMarginPct,
    netMargin,
    netMarginPct,
    plannedImpressions,
    deliveredImpressions,
    budgetGroups,
    cpm,
    startDate: startDate ? startDate.toISOString().slice(0, 10) : null,
    endDate: endDate ? endDate.toISOString().slice(0, 10) : null,
    month,
    year: Math.round(year),
    product: String(pickField(rowValues, headerMap, FIELD_ALIASES.product) || "Unknown").trim(),
    platform: String(pickField(rowValues, headerMap, FIELD_ALIASES.platform) || "Unknown").trim(),
    opsOwner: String(pickField(rowValues, headerMap, FIELD_ALIASES.opsOwner) || "Unknown").trim(),
    csOwner: String(pickField(rowValues, headerMap, FIELD_ALIASES.csOwner) || "Unknown").trim(),
    salesOwner: String(pickField(rowValues, headerMap, FIELD_ALIASES.salesOwner) || "Unknown").trim(),
    _sourceSheetId: source.sheetId,
    _sourceTab: source.tabName,
    _sourceCountry: source.country,
    _sourceGid: source.gid
  };

  if (
    normalized.campaignName === "Unknown Campaign" &&
    normalized.revenue === 0 &&
    normalized.spend === 0 &&
    normalized.plannedImpressions === 0 &&
    normalized.deliveredImpressions === 0
  ) {
    return null;
  }

  return normalized;
}

async function fetchSourceRows(sheets, source) {
  const resolvedTab = await resolveTabName(sheets, source);
  const effectiveSource = { ...source, tabName: resolvedTab };
  const rows = await readTabValues(sheets, source.sheetId, resolvedTab);
  if (rows.length <= 1) return [];

  let headerRowIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 120); i += 1) {
    const row = rows[i] || [];
    const nonEmpty = row.filter((cell) => String(cell || "").trim() !== "").length;
    if (!nonEmpty) continue;
    const score = row.reduce((acc, cell) => {
      const key = normalizeKey(cell);
      if (NORMALIZED_HEADER_CANDIDATES.has(key)) return acc + 1;
      return acc;
    }, 0);
    if (score > bestScore || (score === bestScore && nonEmpty > (rows[headerRowIndex] || []).length)) {
      bestScore = score;
      headerRowIndex = i;
    }
  }

  const headers = rows[headerRowIndex].map((h) => String(h || "").trim());
  const headerMap = {};
  headers.forEach((header, idx) => {
    const key = normalizeKey(header);
    if (key && headerMap[key] === undefined) headerMap[key] = idx;
  });

  const dataRows = [];
  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const rowValues = rows[i];
    if (!rowValues || rowValues.every((cell) => String(cell || "").trim() === "")) continue;
    const normalized = normalizeRow(rowValues, headerMap, effectiveSource);
    if (normalized) dataRows.push(normalized);
  }
  return dataRows;
}

async function loadAllRows(forceRefresh = false) {
  const cacheDuration = Number(config.cacheDurationMs || 5 * 60 * 1000);
  const now = Date.now();
  if (!forceRefresh && cachedRows && now - lastFetchTime < cacheDuration) {
    return cachedRows;
  }

  const sheets = await getSheetsClient();
  const enabledSources = (config.sources || []).filter((s) => s.enabled !== false);

  const results = await Promise.all(
    enabledSources.map(async (source) => {
      try {
        const rows = await fetchSourceRows(sheets, source);
        return rows;
      } catch (error) {
        console.warn(`Failed to read ${source.country} (${source.tabName}): ${error.message}`);
        return [];
      }
    })
  );

  cachedRows = results.flat();
  lastFetchTime = now;
  return cachedRows;
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

function average(items, valueFn) {
  if (!items.length) return 0;
  const sum = items.reduce((acc, item) => acc + (Number(valueFn(item)) || 0), 0);
  return sum / items.length;
}

function sum(items, valueFn) {
  return items.reduce((acc, item) => acc + (Number(valueFn(item)) || 0), 0);
}

function buildMonthYearSeries(rows, metricFn, mode = "sum") {
  const yearSet = new Set(rows.map((r) => String(r.year || new Date().getFullYear())));
  const years = Array.from(yearSet).sort();
  const byMonth = {};
  MONTHS.forEach((m) => {
    byMonth[m] = { month: m };
    years.forEach((y) => {
      byMonth[m][y] = 0;
    });
  });

  const grouped = groupBy(rows.filter((r) => r.month), (r) => `${r.month}__${r.year}`);
  grouped.forEach((bucket, key) => {
    const [month, year] = key.split("__");
    if (!byMonth[month]) return;
    if (mode === "avg") byMonth[month][year] = Number(average(bucket, metricFn).toFixed(2));
    else byMonth[month][year] = Number((sum(bucket, metricFn) / 1_000_000).toFixed(2));
  });

  return MONTHS.map((month) => byMonth[month]);
}

async function getKpis() {
  const rows = await loadAllRows();
  const totalRevenue = sum(rows, (r) => r.revenue);
  const totalSpend = sum(rows, (r) => r.spend);
  const grossMarginPct = average(rows, (r) => r.grossMarginPct);
  const netMarginPct = average(rows, (r) => r.netMarginPct);
  const campaigns = new Set(rows.map((r) => r.campaignName)).size;
  const budgetGroups = sum(rows, (r) => r.budgetGroups);

  return [
    { title: "No of Campaigns", value: campaigns, subtitle: `Budget Groups: ${budgetGroups}` },
    { title: "Gross Margin %", value: `${grossMarginPct.toFixed(1)}%`, subtitle: `Total Revenue: $${(totalRevenue / 1_000_000).toFixed(2)}M` },
    { title: "Net Margin %", value: `${netMarginPct.toFixed(1)}%`, subtitle: `Total Spend: $${(totalSpend / 1_000_000).toFixed(2)}M` },
    { title: "Spend", value: `$${(totalSpend / 1_000_000).toFixed(2)}M`, subtitle: `Booked Revenue: $${(totalRevenue / 1_000_000).toFixed(2)}M` }
  ];
}

async function getRevenueTrend() {
  const rows = await loadAllRows();
  return buildMonthYearSeries(rows, (r) => r.revenue, "sum");
}

async function getMarginTrend() {
  const rows = await loadAllRows();
  return buildMonthYearSeries(rows, (r) => r.grossMarginPct, "avg");
}

async function getNetMarginTrend() {
  const rows = await loadAllRows();
  return buildMonthYearSeries(rows, (r) => r.netMarginPct, "avg");
}

async function getCpmTrend() {
  const rows = await loadAllRows();
  return buildMonthYearSeries(rows, (r) => r.cpm, "avg");
}

async function getOverviewLegacyTrend(metric = "revenue") {
  const sheets = await getSheetsClient();
  const rows = await fetchSourceRows(sheets, OVERVIEW_RAW_SPENDS_SOURCE);
  if (metric === "cpm") return buildMonthYearSeries(rows, (r) => r.cpm, "avg");
  if (metric === "margin") return buildMonthYearSeries(rows, (r) => r.grossMarginPct, "avg");
  return buildMonthYearSeries(rows, (r) => r.revenue, "sum");
}

async function getBottomCampaignsSimple(limit = 8) {
  const rows = await loadAllRows();
  return rows
    .slice()
    .sort((a, b) => a.grossMarginPct - b.grossMarginPct)
    .slice(0, limit)
    .map((r) => ({
      campaignName: r.campaignName,
      status: r.status,
      revenue: Number(r.revenue.toFixed(2)),
      spend: Number(r.spend.toFixed(2)),
      profit: Number(r.grossProfit.toFixed(2)),
      grossMargin: Number(r.grossMarginPct.toFixed(2))
    }));
}

async function getCampaignsDetailed(limit = 20) {
  const rows = await loadAllRows();
  const detailed = rows
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

  const totals = {
    revenue: sum(detailed, (r) => r.revenue),
    spend: sum(detailed, (r) => r.spend),
    grossMargin: sum(detailed, (r) => r.grossMargin),
    grossMarginPct: average(detailed, (r) => r.grossMarginPct),
    netMargin: sum(detailed, (r) => r.netMargin),
    netMarginPct: average(detailed, (r) => r.netMarginPct),
    plannedImpressions: sum(detailed, (r) => r.plannedImpressions)
  };

  return { rows: detailed, totals };
}

async function getRegionTable() {
  const rows = await loadAllRows();
  const grouped = groupBy(rows, (r) => r.country);
  const result = [];

  grouped.forEach((bucket, country) => {
    const bookedRevenue = sum(bucket, (r) => r.revenue);
    const spend = sum(bucket, (r) => r.spend);
    const grossMargin = sum(bucket, (r) => r.grossProfit);
    const planned = sum(bucket, (r) => r.plannedImpressions);
    const delivered = sum(bucket, (r) => r.deliveredImpressions);
    const deliveredPct = planned ? Number(((delivered / planned) * 100).toFixed(2)) : 0;
    const grossMarginPct = bookedRevenue ? Number(((grossMargin / bookedRevenue) * 100).toFixed(2)) : 0;

    result.push({
      region: country,
      totalCampaigns: new Set(bucket.map((r) => r.campaignName)).size,
      budgetGroups: sum(bucket, (r) => r.budgetGroups),
      bookedRevenue,
      spend,
      plannedImpressions: planned,
      deliveredImpressions: delivered,
      deliveredPct,
      grossMargin,
      grossMarginPct
    });
  });

  return result.sort((a, b) => b.bookedRevenue - a.bookedRevenue);
}

async function getCountryWiseTable() {
  const rows = await loadAllRows();
  const grouped = groupBy(rows, (r) => r.region);
  const result = [];

  grouped.forEach((bucket, region) => {
    const revenue = sum(bucket, (r) => r.revenue);
    const spend = sum(bucket, (r) => r.spend);
    const grossMargin = sum(bucket, (r) => r.grossProfit);
    const plannedImpressions = sum(bucket, (r) => r.plannedImpressions);
    const deliveredImpressions = sum(bucket, (r) => r.deliveredImpressions);
    const deliveredPct = plannedImpressions ? Number(((deliveredImpressions / plannedImpressions) * 100).toFixed(2)) : 0;
    const grossMarginPct = revenue ? Number(((grossMargin / revenue) * 100).toFixed(2)) : 0;

    result.push({
      region,
      campaigns: new Set(bucket.map((r) => r.campaignName)).size,
      budgetGroups: sum(bucket, (r) => r.budgetGroups),
      revenue,
      spend,
      plannedImpressions,
      deliveredImpressions,
      deliveredPct,
      grossMargin,
      grossMarginPct
    });
  });

  const totals = {
    campaigns: sum(result, (r) => r.campaigns),
    budgetGroups: sum(result, (r) => r.budgetGroups),
    revenue: sum(result, (r) => r.revenue),
    spend: sum(result, (r) => r.spend),
    plannedImpressions: sum(result, (r) => r.plannedImpressions),
    deliveredImpressions: sum(result, (r) => r.deliveredImpressions),
    grossMargin: sum(result, (r) => r.grossMargin),
    grossMarginPct: 0,
    deliveredPct: 0
  };
  totals.deliveredPct = totals.plannedImpressions
    ? Number(((totals.deliveredImpressions / totals.plannedImpressions) * 100).toFixed(2))
    : 0;
  totals.grossMarginPct = totals.revenue ? Number(((totals.grossMargin / totals.revenue) * 100).toFixed(2)) : 0;

  return { rows: result.sort((a, b) => b.revenue - a.revenue), totals };
}

async function getCampaignWiseTable(limit = 50) {
  const rows = await loadAllRows();
  const grouped = groupBy(rows, (r) => r.campaignName);
  const items = [];

  grouped.forEach((bucket, name) => {
    const startDates = bucket.map((r) => r.startDate).filter(Boolean).sort();
    const endDates = bucket.map((r) => r.endDate).filter(Boolean).sort();
    items.push({
      name,
      budgetGroups: sum(bucket, (r) => r.budgetGroups),
      startDate: startDates[0] || null,
      endDate: endDates[endDates.length - 1] || null,
      plannedImpressions: sum(bucket, (r) => r.plannedImpressions)
    });
  });

  const rowsOut = items.sort((a, b) => b.plannedImpressions - a.plannedImpressions).slice(0, limit);
  const totals = {
    budgetGroups: sum(rowsOut, (r) => r.budgetGroups),
    duration: 0,
    daysRemaining: 0,
    avgPctPassed: 0,
    plannedImpressions: sum(rowsOut, (r) => r.plannedImpressions)
  };
  return { rows: rowsOut, totals };
}

async function getProductWiseTable() {
  const rows = await loadAllRows();
  const grouped = groupBy(rows, (r) => r.product || "Unknown");
  const out = [];

  grouped.forEach((bucket, product) => {
    const bookedRevenue = sum(bucket, (r) => r.revenue);
    const spend = sum(bucket, (r) => r.spend);
    const plannedImpressions = sum(bucket, (r) => r.plannedImpressions);
    const deliveredImpressions = sum(bucket, (r) => r.deliveredImpressions);
    const grossProfitLoss = sum(bucket, (r) => r.grossProfit);
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
    deliveredPct: 0,
    grossProfitLoss: sum(out, (r) => r.grossProfitLoss),
    grossMargin: 0
  };
  totals.deliveredPct = totals.plannedImpressions
    ? Number(((totals.deliveredImpressions / totals.plannedImpressions) * 100).toFixed(2))
    : 0;
  totals.grossMargin = totals.bookedRevenue
    ? Number(((totals.grossProfitLoss / totals.bookedRevenue) * 100).toFixed(2))
    : 0;

  return { rows: out.sort((a, b) => b.bookedRevenue - a.bookedRevenue), totals };
}

async function getFilterOptions() {
  const rows = await loadAllRows();
  const unique = (arr) => Array.from(new Set(arr.filter(Boolean))).sort();
  return {
    region: unique(rows.map((r) => r.region)),
    year: unique(rows.map((r) => r.year)),
    month: unique(rows.map((r) => r.month)),
    status: unique(rows.map((r) => r.status)),
    product: unique(rows.map((r) => r.product)),
    platform: unique(rows.map((r) => r.platform))
  };
}

function getSourceConfig() {
  return config.sources || [];
}

module.exports = {
  loadAllRows,
  getKpis,
  getRevenueTrend,
  getMarginTrend,
  getNetMarginTrend,
  getCpmTrend,
  getOverviewLegacyTrend,
  getBottomCampaignsSimple,
  getCampaignsDetailed,
  getRegionTable,
  getCountryWiseTable,
  getCampaignWiseTable,
  getProductWiseTable,
  getFilterOptions,
  getSourceConfig
};
