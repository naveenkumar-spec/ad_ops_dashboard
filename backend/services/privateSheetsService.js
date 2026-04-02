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

const REGION_GROUPS = {
  "North America": new Set(["usa", "canada", "multiple"]),
  LATAM: new Set(["brazil", "chile"]),
  Australia: new Set(["australia"]),
  Europe: new Set([
    "uk", "france", "germany", "spain", "italy", "switzerland", "cyprus",
    "portugal", "netherlands", "austria", "denmark", "sweden", "belgium",
    "poland", "baltics", "finland", "ukeurope", "europe"
  ]),
  "Middle East": new Set([
    "turkey", "uae", "ksa", "abudhabiqatarkuwaitdubaibahrain", "middleeast",
    "ksakuwait", "ksauae", "abudhabi", "qatar", "kuwait", "dubai", "bahrain",
    "saudiarabia"
  ]),
  "India+SEA": new Set([
    "india", "thailand", "indonesia", "philippines", "malaysia", "vietnam", "singapore"
  ]),
  "Rest of APAC": new Set([
    "cambodia", "newzealand", "bangladesh", "taiwan", "southkorea", "srilanka", "pakistan", "hongkong"
  ]),
  Japan: new Set(["japan"]),
  Africa: new Set([
    "africa", "southafrica", "zambia", "botswana", "kenya", "mozambique", "nigeria", "kenyatanzania"
  ])
};

const COUNTRY_CANONICAL = {
  usa: "USA",
  uk: "UK",
  ukeurope: "UK",
  canada: "Canada",
  india: "India",
  malaysia: "Malaysia",
  singapore: "Singapore",
  australia: "Australia",
  indonesia: "Indonesia",
  japan: "Japan",
  newzealand: "New Zealand",
  pakistan: "Pakistan",
  philippines: "Philippines",
  southafrica: "South Africa",
  thailand: "Thailand",
  vietnam: "Vietnam",
  middleeast: "Middle East",
  uae: "UAE",
  saudiarabia: "Saudi Arabia",
  germany: "Germany",
  france: "France",
  netherlands: "Netherlands",
  portugal: "Portugal",
  spain: "Spain",
  sweden: "Sweden",
  italy: "Italy",
  kenya: "Kenya",
  nigeria: "Nigeria",
  africa: "Africa",
  uae: "UAE",
  saudiarabia: "Saudi Arabia",
  unitedstates: "USA",
  unitedkingdom: "UK",
  phillipines: "Philippines"
};

const FIELD_ALIASES = {
  campaignName: ["Campaign Name"],
  campaignId: ["Campaign ID"],
  status: ["Status"],
  country: ["Country"],
  currency: ["Currency", "Currency Code"],
  revenue: ["Revenue"],
  spend: ["Spends"],
  grossProfit: ["Gross Profit"],
  rebate: ["Rebate"],
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

const COUNTRY_DEFAULT_CURRENCY = {
  Thailand: "THB",
  Philippines: "USD",
  Singapore: "SGD",
  Vietnam: "USD",
  Malaysia: "RM",
  USA: "USD",
  Australia: "AUD",
  "Middle East": "USD",
  Pakistan: "USD",
  Indonesia: "IDR",
  "South Africa": "USD",
  Kenya: "USD",
  "New Zealand": "NZD",
  Japan: "JPY",
  India: "INR",
  Canada: "USD",
  Portugal: "USD",
  Netherlands: "USD",
  UK: "USD",
  France: "USD",
  Spain: "USD",
  Germany: "USD",
  Sweden: "USD",
  Italy: "USD",
  Africa: "USD",
  Nigeria: "USD",
  Zambia: "USD",
  Switzerland: "USD",
  Uganda: "USD",
  Ghana: "USD",
  Belgium: "USD",
  Chile: "USD",
  Finland: "USD",
  Denmark: "USD",
  Cameroon: "USD",
  Baltics: "USD",
  Bangladesh: "USD",
  Brazil: "USD",
  Cambodia: "USD",
  Cyprus: "USD",
  "Hong Kong": "USD",
  Mozambique: "USD",
  "South Korea": "USD",
  "Sri Lanka": "USD",
  Taiwan: "USD",
  Turkey: "USD",
  UAE: "USD",
  "Saudi Arabia": "USD"
};

const LOCAL_TO_USD_BY_CURRENCY = {
  USD: 1,
  THB: 0.03155,
  SGD: 0.76564,
  RM: 0.25,
  AUD: 0.659318,
  IDR: 0.00006,
  NZD: 0.6,
  JPY: 0.0064,
  INR: 0.011,
  GBP: 1.35
};

const OVERVIEW_RAW_SPENDS_SOURCE = {
  country: "Overview Legacy",
  sheetId: "1MwWqMLj5b4FwIS6wD3FugfwgbWlyJD0xaQJLpmlRlQs",
  tabName: "Raw Spends Data",
  gid: 848964579,
  enabled: true
};

const OVERVIEW_RAW_ALIASES = {
  month: ["Month"],
  year: ["Year"],
  country: ["Country", "Region", "Market"],
  salesValueUsd: ["Sales Value in USD"],
  mediaSpendUsd: ["Media Spend in USD"],
  ecpm: ["eCPM."],
  // single-column date alternatives (Month-Year combined)
  monthYear: ["Month-Year", "Month Year", "Date", "Period"]
};

const NORMALIZED_HEADER_CANDIDATES = new Set(
  Object.values(FIELD_ALIASES).flat().map((value) => normalizeKey(value))
);

let cachedRows = null;
let lastFetchTime = 0;
const sheetMetaCache = new Map();
let lastDataQualityReport = null;

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

function parseYearValue(value) {
  const n = parseInt(String(value || "").trim(), 10);
  if (Number.isFinite(n) && n >= 2000 && n <= 2100) return n;
  const text = String(value || "");
  const fullYear = text.match(/\b(20\d{2})\b/);
  if (fullYear) return Number(fullYear[1]);
  const shortYear = text.match(/(?:^|[^0-9])(\d{2})(?:[^0-9]|$)/);
  if (shortYear) return 2000 + Number(shortYear[1]);
  return 0;
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

function canonicalCountryName(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const key = normalizeKey(raw);
  return COUNTRY_CANONICAL[key] || raw;
}

function normalizeCurrencyCode(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (raw === "MYR") return "RM";
  if (raw === "US$" || raw === "$") return "USD";
  return raw;
}

function resolveLocalToUsdRate(country, currencyCode) {
  const normalizedCurrency = normalizeCurrencyCode(currencyCode);
  if (normalizedCurrency && Number.isFinite(Number(LOCAL_TO_USD_BY_CURRENCY[normalizedCurrency]))) {
    return Number(LOCAL_TO_USD_BY_CURRENCY[normalizedCurrency]);
  }
  const fallbackCurrency = COUNTRY_DEFAULT_CURRENCY[String(country || "").trim()];
  if (fallbackCurrency && Number.isFinite(Number(LOCAL_TO_USD_BY_CURRENCY[fallbackCurrency]))) {
    return Number(LOCAL_TO_USD_BY_CURRENCY[fallbackCurrency]);
  }
  return 1;
}

function mapCountryToRegion(countryValue, fallbackValue = "") {
  const key = normalizeKey(countryValue || fallbackValue);
  if (!key) return "Other";
  for (const [region, values] of Object.entries(REGION_GROUPS)) {
    if (values.has(key)) return region;
  }
  return "Other";
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

async function getSheetMetaById(sheets, spreadsheetId) {
  const cacheKey = String(spreadsheetId || "").trim();
  if (!cacheKey) return [];
  if (sheetMetaCache.has(cacheKey)) return sheetMetaCache.get(cacheKey);

  const res = await sheets.spreadsheets.get({
    spreadsheetId: cacheKey,
    fields: "sheets.properties(title,sheetId)"
  });
  const meta = (res.data.sheets || [])
    .map((s) => ({
      title: String(s?.properties?.title || ""),
      sheetId: Number(s?.properties?.sheetId || 0)
    }))
    .filter((s) => String(s.title || "").trim() !== "");

  sheetMetaCache.set(cacheKey, meta);
  return meta;
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
  const gid = Number(source?.gid || 0);

  for (const candidate of candidates) {
    try {
      await readTabValues(sheets, source.sheetId, candidate);
      return String(candidate).trim();
    } catch (_error) {
      // Try next candidate.
    }
  }

  // Use gid as a fallback only if configured tab candidates cannot be read.
  if (Number.isFinite(gid) && gid > 0) {
    const meta = await getSheetMetaById(sheets, source.sheetId);
    const byGid = meta.find((m) => Number(m.sheetId) === gid);
    if (byGid?.title) return byGid.title;
  }

  const meta = await getSheetMetaById(sheets, source.sheetId);
  const titles = meta.map((m) => String(m.title || "").trim()).filter(Boolean);
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
  const campaignId = String(pickField(rowValues, headerMap, FIELD_ALIASES.campaignId) || "").trim();
  const status = String(pickField(rowValues, headerMap, FIELD_ALIASES.status) || "Active").trim();
  const rowCountry = canonicalCountryName(pickField(rowValues, headerMap, FIELD_ALIASES.country));
  const sourceCountry = canonicalCountryName(source.country);
  const country = rowCountry || sourceCountry || "Unknown";

  const currencyRaw = pickField(rowValues, headerMap, FIELD_ALIASES.currency);
  const currencyCode = normalizeCurrencyCode(currencyRaw || COUNTRY_DEFAULT_CURRENCY[country] || "USD");
  const localToUsd = resolveLocalToUsdRate(country, currencyCode);

  const revenueLocal = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.revenue));
  const spendLocal = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.spend));
  const revenue = revenueLocal * localToUsd;
  const spend = spendLocal * localToUsd;

  // Gross margin amount is always derived from revenue and spend.
  const grossProfit = revenue - spend;
  // Net margin is derived strictly from gross margin minus rebate amount.
  const rebateCell = pickField(rowValues, headerMap, FIELD_ALIASES.rebate);
  const rebateText = String(rebateCell || "").trim();
  const rebateRaw = parseNumber(rebateCell);
  const rebateIsPercent = rebateText.includes("%");
  const rebate = rebateIsPercent ? grossProfit * (rebateRaw / 100) : rebateRaw * localToUsd;
  const netMargin = grossProfit - rebate;

  const grossMarginPct = revenue ? (grossProfit / revenue) * 100 : 0;
  const netMarginPct = revenue ? (netMargin / revenue) * 100 : 0;

  const plannedImpressions = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.plannedImpressions));
  const deliveredImpressions = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.deliveredImpressions));
  const budgetGroups = Math.max(1, Math.round(parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.budgetGroups)) || 1));
  // Buying CPM is stored in cents in the sheets, divide by 100 to get dollars
  const cpm = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.cpm)) / 100;

  const startDate = parseDate(pickField(rowValues, headerMap, FIELD_ALIASES.startDate));
  const endDate = parseDate(pickField(rowValues, headerMap, FIELD_ALIASES.endDate));
  const monthFromField = parseMonthName(pickField(rowValues, headerMap, FIELD_ALIASES.month));
  // Month must come from the Month column only (no fallback).
  const month = monthFromField || null;

  const currentYear = new Date().getFullYear();
  const yearRaw = parseNumber(pickField(rowValues, headerMap, FIELD_ALIASES.year));
  let year = yearRaw || (startDate ? startDate.getFullYear() : currentYear);
  if (year < 2023 || year > currentYear + 2) {
    year = currentYear;
  }

  const normalized = {
    campaignName,
    campaignId,
    status,
    country,
    region: mapCountryToRegion(country, sourceCountry),
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
    _sourceGid: source.gid,
    _sourceCurrency: currencyCode
  };

  if (
    !normalized.month ||
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

async function fetchSourceRows(sheets, source, options = {}) {
  const issueSink = Array.isArray(options.issues) ? options.issues : null;
  const issueLimit = Number(options.issueLimit || 500);
  const onSourceStatus = typeof options.onSourceStatus === "function" ? options.onSourceStatus : null;
  const shouldAbort = typeof options.shouldAbort === "function" ? options.shouldAbort : null;
  const pushIssue = (issue) => {
    if (!issueSink) return;
    if (issueSink.length >= issueLimit) return;
    issueSink.push(issue);
  };
  const notify = (payload) => {
    if (!onSourceStatus) return;
    try {
      onSourceStatus({
        sourceCountry: source.country || null,
        sourceSheetId: source.sheetId || null,
        configuredTab: source.tabName || null,
        ...payload
      });
    } catch (_ignored) {
      // no-op
    }
  };

  const resolvedTab = await resolveTabName(sheets, source);
  if (shouldAbort && shouldAbort()) {
    const stopError = new Error("Sync stopped by admin");
    stopError.code = "SYNC_STOPPED";
    throw stopError;
  }
  notify({ status: "in_progress", resolvedTab });
  const candidates = getTabCandidates(source).map((v) => normalizeTabName(v));
  if (resolvedTab && candidates.length && !candidates.includes(normalizeTabName(resolvedTab))) {
    pushIssue({
      type: "tab_name_mismatch",
      severity: "warning",
      sourceCountry: source.country || null,
      sourceSheetId: source.sheetId || null,
      configuredTab: source.tabName || null,
      resolvedTab: resolvedTab || null,
      column: null,
      row: null,
      detail: "Configured tab name did not resolve directly; fallback tab was used."
    });
  }

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
  notify({
    status: "in_progress",
    resolvedTab,
    headerRow: headerRowIndex + 1,
    columns: headers.filter((h) => String(h || "").trim() !== "")
  });
  const headerMap = {};
  const headerCounts = {};
  headers.forEach((header, idx) => {
    const key = normalizeKey(header);
    if (key) headerCounts[key] = (headerCounts[key] || 0) + 1;
    if (key && headerMap[key] === undefined) headerMap[key] = idx;
  });
  Object.entries(headerCounts)
    .filter(([, count]) => Number(count) > 1)
    .forEach(([key, count]) => {
      pushIssue({
        type: "duplicate_column",
        severity: "warning",
        sourceCountry: source.country || null,
        sourceSheetId: source.sheetId || null,
        configuredTab: source.tabName || null,
        resolvedTab: resolvedTab || null,
        column: key,
        row: headerRowIndex + 1,
        detail: `Duplicate column detected (${count} occurrences).`
      });
    });

  const requiredFields = [
    { name: "Campaign Name", aliases: FIELD_ALIASES.campaignName },
    { name: "Campaign ID", aliases: FIELD_ALIASES.campaignId },
    { name: "Month", aliases: FIELD_ALIASES.month },
    { name: "Revenue", aliases: FIELD_ALIASES.revenue },
    { name: "Spends", aliases: FIELD_ALIASES.spend }
  ];
  requiredFields.forEach((field) => {
    const found = (field.aliases || []).some((alias) => headerMap[normalizeKey(alias)] !== undefined);
    if (!found) {
      pushIssue({
        type: "missing_column",
        severity: "error",
        sourceCountry: source.country || null,
        sourceSheetId: source.sheetId || null,
        configuredTab: source.tabName || null,
        resolvedTab: resolvedTab || null,
        column: field.name,
        row: headerRowIndex + 1,
        detail: `Required column not found. Accepted aliases: ${field.aliases.join(", ")}`
      });
    }
  });

  const dataRows = [];
  const errorTokenPattern = /^#(value!?|div\/0!?|ref!?|n\/a|name\?|num!?|error!?)/i;
  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    if (shouldAbort && shouldAbort()) {
      const stopError = new Error("Sync stopped by admin");
      stopError.code = "SYNC_STOPPED";
      throw stopError;
    }
    const rowValues = rows[i];
    if (!rowValues || rowValues.every((cell) => String(cell || "").trim() === "")) continue;

    rowValues.forEach((cell, idx) => {
      const cellText = String(cell || "").trim();
      if (!cellText || !errorTokenPattern.test(cellText)) return;
      pushIssue({
        type: "cell_error",
        severity: "error",
        sourceCountry: source.country || null,
        sourceSheetId: source.sheetId || null,
        configuredTab: source.tabName || null,
        resolvedTab: resolvedTab || null,
        column: headers[idx] || `col_${idx + 1}`,
        row: i + 1,
        value: cellText,
        detail: "Spreadsheet formula/value error detected."
      });
    });

    const normalized = normalizeRow(rowValues, headerMap, effectiveSource);
    if (normalized) dataRows.push(normalized);
  }
  notify({
    status: "success",
    resolvedTab,
    headerRow: headerRowIndex + 1,
    columns: headers.filter((h) => String(h || "").trim() !== ""),
    rowCount: dataRows.length
  });
  return dataRows;
}

async function loadAllRows(forceRefresh = false, options = {}) {
  const cacheDuration = Number(config.cacheDurationMs || 5 * 60 * 1000);
  const now = Date.now();
  const issueSink = Array.isArray(options.issues) ? options.issues : null;
  const issueLimit = Number(options.issueLimit || 500);
  const onSourceStatus = typeof options.onSourceStatus === "function" ? options.onSourceStatus : null;
  const shouldAbort = typeof options.shouldAbort === "function" ? options.shouldAbort : null;
  if (!forceRefresh && cachedRows && now - lastFetchTime < cacheDuration) {
    return cachedRows;
  }

  const sheets = await getSheetsClient();
  const enabledSources = (config.sources || []).filter((s) => s.enabled !== false);

  const results = [];
  for (const source of enabledSources) {
    if (shouldAbort && shouldAbort()) {
      const stopError = new Error("Sync stopped by admin");
      stopError.code = "SYNC_STOPPED";
      throw stopError;
    }
    try {
      if (onSourceStatus) {
        onSourceStatus({
          sourceCountry: source.country || null,
          sourceSheetId: source.sheetId || null,
          configuredTab: source.tabName || null,
          status: "in_progress"
        });
      }
      const rows = await fetchSourceRows(sheets, source, {
        issues: issueSink,
        issueLimit,
        onSourceStatus,
        shouldAbort
      });
      results.push(rows);
    } catch (error) {
      if (error?.code === "SYNC_STOPPED") throw error;
      console.warn(`Failed to read ${source.country} (${source.tabName}): ${error.message}`);
      if (onSourceStatus) {
        onSourceStatus({
          sourceCountry: source.country || null,
          sourceSheetId: source.sheetId || null,
          configuredTab: source.tabName || null,
          status: "failed",
          detail: error.message
        });
      }
      if (issueSink && issueSink.length < issueLimit) {
        issueSink.push({
          type: "source_read_error",
          severity: "error",
          sourceCountry: source.country || null,
          sourceSheetId: source.sheetId || null,
          configuredTab: source.tabName || null,
          resolvedTab: null,
          column: null,
          row: null,
          detail: error.message
        });
      }
      results.push([]);
    }
  }

  cachedRows = results.flat();
  lastFetchTime = now;
  if (issueSink) {
    lastDataQualityReport = {
      createdAt: new Date().toISOString(),
      issueCount: issueSink.length,
      issues: issueSink.slice(0, issueLimit)
    };
  }
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
  const validItems = items.filter(item => {
    const val = Number(valueFn(item)) || 0;
    return val > 0;
  });
  if (!validItems.length) return 0;
  const sum = validItems.reduce((acc, item) => acc + (Number(valueFn(item)) || 0), 0);
  return sum / validItems.length;
}

function sum(items, valueFn) {
  return items.reduce((acc, item) => acc + (Number(valueFn(item)) || 0), 0);
}

function formatUsd(value) {
  const n = Number(value || 0);
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function countDistinctCampaignIds(items) {
  return new Set(
    (items || [])
      .map((item) => String(item?.campaignId || "").trim())
      .filter(Boolean)
  ).size;
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
  const totalGrossMargin = totalRevenue - totalSpend;
  const totalNetMargin = sum(rows, (r) => r.netMargin);
  const grossMarginPct = average(rows, (r) => r.grossMarginPct);
  const netMarginPct = totalRevenue ? (totalNetMargin / totalRevenue) * 100 : 0;
  const campaigns = countDistinctCampaignIds(rows);
  const budgetGroups = rows.filter((r) => String(r.campaignName || "").trim() !== "").length;

  return [
    { title: "No of Campaigns", value: campaigns, subtitle: `Budget Groups: ${budgetGroups}` },
    { title: "Gross Margin %", value: `${grossMarginPct.toFixed(1)}%`, subtitle: `Gross Margin: ${formatUsd(totalGrossMargin)}` },
    { title: "Net Margin %", value: `${netMarginPct.toFixed(1)}%`, subtitle: `Net Margin: ${formatUsd(totalNetMargin)}` },
    { title: "Spend", value: formatUsd(totalSpend), subtitle: `Booked Revenue: ${formatUsd(totalRevenue)}` }
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

async function getOverviewLegacyTrend(metric = "revenue", filters = {}) {
  const sheets = await getSheetsClient();
  const resolvedTab = await resolveTabName(sheets, OVERVIEW_RAW_SPENDS_SOURCE);
  const rows = await readTabValues(sheets, OVERVIEW_RAW_SPENDS_SOURCE.sheetId, resolvedTab);
  if (rows.length <= 1) return [];

  // Find header row by scoring against known aliases
  let headerRowIndex = 0;
  let bestScore = -1;
  const aliasKeys = new Set(
    Object.values(OVERVIEW_RAW_ALIASES).flat().map((v) => normalizeKey(v))
  );
  for (let i = 0; i < Math.min(rows.length, 120); i += 1) {
    const row = rows[i] || [];
    const nonEmpty = row.filter((cell) => String(cell || "").trim() !== "").length;
    if (!nonEmpty) continue;
    const score = row.reduce((acc, cell) => {
      const key = normalizeKey(cell);
      if (aliasKeys.has(key)) return acc + 1;
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

  console.log(`[getOverviewLegacyTrend] Found headers at row ${headerRowIndex}:`, headers.slice(0, 15).join(", "));
  console.log(`[getOverviewLegacyTrend] Total rows to parse: ${rows.length - headerRowIndex - 1}`);

  // Find eCPM column (prefer "eCPM." with period)
  const ecpmColIdx = OVERVIEW_RAW_ALIASES.ecpm
    .map((alias) => headerMap[normalizeKey(alias)])
    .find((idx) => idx !== undefined);

  // Parse region filter to get allowed countries
  const allowedCountries = new Set();
  if (filters.region && filters.region !== "all") {
    const regionFilter = String(filters.region).trim();
    // Check if it's a country or region
    const allCountries = Object.keys(COUNTRY_DEFAULT_CURRENCY);
    if (allCountries.some(c => canonicalCountryName(c) === canonicalCountryName(regionFilter))) {
      // It's a specific country
      allowedCountries.add(canonicalCountryName(regionFilter));
    } else {
      // It's a region, find all countries in that region
      allCountries.forEach(country => {
        if (mapCountryToRegion(country) === regionFilter) {
          allowedCountries.add(canonicalCountryName(country));
        }
      });
    }
  }

  // Helper: parse a combined month-year cell like "Mar-20", "March 2020", "03/2020", "2020-03"
  function parseCombinedMonthYear(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    // "Mar-20" or "March-20" or "Mar-2020"
    const m1 = text.match(/^([A-Za-z]+)[- \/](\d{2,4})$/);
    if (m1) {
      const month = parseMonthName(m1[1]);
      const yr = m1[2].length === 2 ? 2000 + Number(m1[2]) : Number(m1[2]);
      if (month && yr >= 2000 && yr <= 2100) return { month, year: yr };
    }
    // "2020-03" or "2020/03"
    const m2 = text.match(/^(20\d{2})[- \/](\d{1,2})$/);
    if (m2) {
      const yr = Number(m2[1]);
      const monthIdx = Number(m2[2]) - 1;
      if (monthIdx >= 0 && monthIdx < 12) return { month: MONTHS[monthIdx], year: yr };
    }
    // "03/2020" or "3/2020"
    const m3 = text.match(/^(\d{1,2})[\/\-](20\d{2})$/);
    if (m3) {
      const monthIdx = Number(m3[1]) - 1;
      const yr = Number(m3[2]);
      if (monthIdx >= 0 && monthIdx < 12) return { month: MONTHS[monthIdx], year: yr };
    }
    // "January 2020" or "January, 2020"
    const m4 = text.match(/^([A-Za-z]+)[,\s]+(20\d{2})$/);
    if (m4) {
      const month = parseMonthName(m4[1]);
      const yr = Number(m4[2]);
      if (month && yr >= 2000 && yr <= 2100) return { month, year: yr };
    }
    return null;
  }

  const parsed = [];
  for (let i = headerRowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    if (!row.length || row.every((cell) => String(cell || "").trim() === "")) continue;

    let month = null;
    let year = null;

    // Try separate Month + Year columns first
    const monthRaw = pickField(row, headerMap, OVERVIEW_RAW_ALIASES.month);
    const yearRaw = pickField(row, headerMap, OVERVIEW_RAW_ALIASES.year);
    month = parseMonthName(monthRaw);
    year = parseYearValue(yearRaw) || parseYearValue(monthRaw) || 0;

    // If that fails, try combined month-year column
    if (!month || !year) {
      const combined = pickField(row, headerMap, OVERVIEW_RAW_ALIASES.monthYear);
      if (combined) {
        const parsed2 = parseCombinedMonthYear(combined);
        if (parsed2) { month = parsed2.month; year = parsed2.year; }
      }
    }

    // Last resort: scan all cells for a recognisable month-year pattern
    if (!month || !year) {
      for (const cell of row) {
        const parsed2 = parseCombinedMonthYear(String(cell || ""));
        if (parsed2) { month = parsed2.month; year = parsed2.year; break; }
      }
    }

    if (!month || !year) continue;

    const country = canonicalCountryName(pickField(row, headerMap, OVERVIEW_RAW_ALIASES.country) || "");
    
    // Apply country/region filter
    if (allowedCountries.size > 0 && !allowedCountries.has(country)) {
      continue;
    }

    const salesValueUsd = parseNumber(pickField(row, headerMap, OVERVIEW_RAW_ALIASES.salesValueUsd));
    const mediaSpendUsd = parseNumber(pickField(row, headerMap, OVERVIEW_RAW_ALIASES.mediaSpendUsd));
    // Use the eCPM column
    const ecpm = ecpmColIdx !== undefined ? parseNumber(row[ecpmColIdx]) : 0;
    const grossMarginPct = salesValueUsd ? ((salesValueUsd - mediaSpendUsd) / salesValueUsd) * 100 : 0;

    if (parsed.length < 5) {
      console.log(`[getOverviewLegacyTrend] Sample row ${i}: month=${month}, year=${year}, country=${country}, salesValueUsd=${salesValueUsd}, ecpm=${ecpm}`);
    }

    parsed.push({
      country,
      month,
      year,
      salesValueUsd,
      mediaSpendUsd,
      ecpm,
      grossMarginPct
    });
  }

  // Aggregate by month+year across all countries
  const aggregated = new Map();
  parsed.forEach((r) => {
    const key = `${r.year}__${r.month}`;
    if (!aggregated.has(key)) {
      aggregated.set(key, {
        month: r.month,
        year: r.year,
        totalSalesValueUsd: 0,
        totalMediaSpendUsd: 0,
        cpmSum: 0,
        cpmCount: 0
      });
    }
    const agg = aggregated.get(key);
    agg.totalSalesValueUsd += r.salesValueUsd;
    agg.totalMediaSpendUsd += r.mediaSpendUsd;
    if (r.ecpm > 0) {
      agg.cpmSum += r.ecpm;
      agg.cpmCount += 1;
    }
  });

  const aggregatedRows = Array.from(aggregated.values()).map((agg) => ({
    month: agg.month,
    year: agg.year,
    bookedRevenueM: agg.totalSalesValueUsd / 1_000_000,
    grossMarginPct: agg.totalSalesValueUsd > 0 
      ? ((agg.totalSalesValueUsd - agg.totalMediaSpendUsd) / agg.totalSalesValueUsd) * 100 
      : 0,
    averageBuyingCpm: agg.cpmCount > 0 ? agg.cpmSum / agg.cpmCount : 0
  }));

  console.log(`[getOverviewLegacyTrend] Parsed ${parsed.length} raw rows, aggregated to ${aggregatedRows.length} month-year entries for metric=${metric}`);

  const years = Array.from(new Set(aggregatedRows.map((r) => String(r.year)).filter(Boolean))).sort();
  const byMonth = {};
  MONTHS.forEach((m) => {
    byMonth[m] = { month: m };
    years.forEach((y) => { byMonth[m][y] = 0; });
  });

  aggregatedRows.forEach((r) => {
    const yearKey = String(r.year);
    if (!byMonth[r.month]) return;
    if (metric === "cpm") byMonth[r.month][yearKey] = Number((r.averageBuyingCpm || 0).toFixed(2));
    else if (metric === "margin") byMonth[r.month][yearKey] = Number((r.grossMarginPct || 0).toFixed(2));
    else byMonth[r.month][yearKey] = Number((r.bookedRevenueM || 0).toFixed(2));
  });

  return MONTHS.map((m) => byMonth[m]);
}

async function getBrandingSheetParsedData() {
  // Returns raw parsed branding sheet data with all dimensions (country, month, year, etc.)
  // This is used for populating the transition table with the same schema as tracker sheets
  
  const sheets = await getSheetsClient();
  const resolvedTab = await resolveTabName(sheets, OVERVIEW_RAW_SPENDS_SOURCE);
  const range = `${resolvedTab}!A1:ZZ`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: OVERVIEW_RAW_SPENDS_SOURCE.sheetId,
    range
  });

  const rows = response.data.values || [];
  if (!rows.length) {
    console.log("[getBrandingSheetParsedData] No data found in branding sheet");
    return [];
  }

  // Find header row
  let headerRowIndex = -1;
  let bestScore = -1;
  const aliasKeys = new Set(
    Object.values(OVERVIEW_RAW_ALIASES).flat().map((v) => normalizeKey(v))
  );
  for (let i = 0; i < Math.min(rows.length, 120); i += 1) {
    const row = rows[i] || [];
    const score = row.filter((cell) => aliasKeys.has(normalizeKey(cell))).length;
    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = i;
    }
  }

  if (headerRowIndex < 0 || bestScore < 2) {
    console.error("[getBrandingSheetParsedData] Could not find header row");
    return [];
  }

  const headers = rows[headerRowIndex].map((h) => String(h || "").trim());
  const headerMap = {};
  headers.forEach((header, idx) => {
    const key = normalizeKey(header);
    if (key && headerMap[key] === undefined) headerMap[key] = idx;
  });

  console.log(`[getBrandingSheetParsedData] Found headers at row ${headerRowIndex}:`, headers.slice(0, 15).join(", "));
  console.log(`[getBrandingSheetParsedData] Total rows to parse: ${rows.length - headerRowIndex - 1}`);

  // Find eCPM column
  const ecpmColIdx = OVERVIEW_RAW_ALIASES.ecpm
    .map((alias) => headerMap[normalizeKey(alias)])
    .find((idx) => idx !== undefined);

  const parsed = [];
  let skippedRows = 0;
  let validRows = 0;
  
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) {
      skippedRows++;
      continue;
    }

    let month = null;
    let year = 0;

    // Try separate Month + Year columns first
    const monthRaw = pickField(row, headerMap, OVERVIEW_RAW_ALIASES.month);
    const yearRaw = pickField(row, headerMap, OVERVIEW_RAW_ALIASES.year);
    month = parseMonthName(monthRaw);
    year = parseYearValue(yearRaw) || parseYearValue(monthRaw) || 0;

    // If that fails, try combined month-year column
    if (!month || !year) {
      const combined = pickField(row, headerMap, OVERVIEW_RAW_ALIASES.monthYear);
      if (combined) {
        const parsed2 = parseCombinedMonthYear(combined);
        if (parsed2) {
          month = parsed2.month;
          year = parsed2.year;
        }
      }
    }

    if (!month || !year) {
      skippedRows++;
      if (skippedRows <= 5) {
        console.log(`[getBrandingSheetParsedData] Skipped row ${i}: month=${monthRaw}, year=${yearRaw}, combined=${pickField(row, headerMap, OVERVIEW_RAW_ALIASES.monthYear)}`);
      }
      continue;
    }

    const country = canonicalCountryName(pickField(row, headerMap, OVERVIEW_RAW_ALIASES.country) || "");
    const region = mapCountryToRegion(country);
    const salesValueUsd = parseNumber(pickField(row, headerMap, OVERVIEW_RAW_ALIASES.salesValueUsd));
    const mediaSpendUsd = parseNumber(pickField(row, headerMap, OVERVIEW_RAW_ALIASES.mediaSpendUsd));
    const ecpm = ecpmColIdx !== undefined ? parseNumber(row[ecpmColIdx]) : 0;

    parsed.push({
      country,
      region,
      month,
      year,
      salesValueUsd,
      mediaSpendUsd,
      ecpm
    });
    
    validRows++;
    if (validRows <= 5) {
      console.log(`[getBrandingSheetParsedData] Sample row ${validRows}: month=${month}, year=${year}, country=${country}, salesValueUsd=${salesValueUsd}, ecpm=${ecpm}`);
    }
  }

  console.log(`[getBrandingSheetParsedData] Parsed ${parsed.length} raw rows from branding sheet (skipped ${skippedRows} invalid rows)`);
  return parsed;
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
      totalCampaigns: countDistinctCampaignIds(bucket),
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
      campaigns: countDistinctCampaignIds(bucket),
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
      totalCampaigns: countDistinctCampaignIds(bucket),
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

function getLastDataQualityReport() {
  return lastDataQualityReport;
}

module.exports = {
  loadAllRows,
  getKpis,
  getRevenueTrend,
  getMarginTrend,
  getNetMarginTrend,
  getCpmTrend,
  getOverviewLegacyTrend,
  getBrandingSheetParsedData,
  getBottomCampaignsSimple,
  getCampaignsDetailed,
  getRegionTable,
  getCountryWiseTable,
  getCampaignWiseTable,
  getProductWiseTable,
  getFilterOptions,
  getSourceConfig,
  getLastDataQualityReport
};
