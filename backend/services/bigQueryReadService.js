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
const MONTH_ORDER_CASE = `
CASE LOWER(TRIM(month))
  WHEN 'january' THEN 1
  WHEN 'february' THEN 2
  WHEN 'march' THEN 3
  WHEN 'april' THEN 4
  WHEN 'may' THEN 5
  WHEN 'june' THEN 6
  WHEN 'july' THEN 7
  WHEN 'august' THEN 8
  WHEN 'september' THEN 9
  WHEN 'october' THEN 10
  WHEN 'november' THEN 11
  WHEN 'december' THEN 12
  ELSE 99
END
`;

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

let cachedTransitionRows = null;
let lastTransitionFetchTime = 0;
const CACHE_MS = Number(process.env.BIGQUERY_READ_CACHE_MS || 120000);

function normalize(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim().toLowerCase();
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

function toIntFilterList(value) {
  return toFilterList(value)
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
}

function latestMainTableSql() {
  return `(
    SELECT *
    FROM ${tableRef}
    WHERE sync_id = (
      SELECT sync_id
      FROM ${tableRef}
      ORDER BY synced_at DESC
      LIMIT 1
    )
  )`;
}

function buildWhereClause(filters = {}, alias = "t") {
  const f = filters || {};
  const conditions = [];
  const params = {};

  const scopeCountries = Array.isArray(f.scopeCountries)
    ? f.scopeCountries.map(normalize).filter(Boolean)
    : [];
  if (scopeCountries.length) {
    conditions.push(`(
      LOWER(TRIM(COALESCE(${alias}.country, ''))) IN UNNEST(@scopeCountries)
      OR LOWER(TRIM(COALESCE(${alias}.region, ''))) IN UNNEST(@scopeCountries)
    )`);
    params.scopeCountries = scopeCountries;
  }

  const scopeAdops = Array.isArray(f.scopeAdops)
    ? f.scopeAdops.map(normalize).filter(Boolean)
    : [];
  if (scopeAdops.length) {
    conditions.push(`(
      LOWER(TRIM(COALESCE(${alias}.ops_owner, ''))) IN UNNEST(@scopeAdops)
      OR LOWER(TRIM(COALESCE(${alias}.cs_owner, ''))) IN UNNEST(@scopeAdops)
      OR LOWER(TRIM(COALESCE(${alias}.sales_owner, ''))) IN UNNEST(@scopeAdops)
    )`);
    params.scopeAdops = scopeAdops;
  }

  const regionList = toFilterList(f.region);
  if (regionList.length) {
    conditions.push(`(
      LOWER(TRIM(COALESCE(${alias}.region, ''))) IN UNNEST(@regionFilter)
      OR LOWER(TRIM(COALESCE(${alias}.country, ''))) IN UNNEST(@regionFilter)
    )`);
    params.regionFilter = regionList;
  }

  const yearList = toIntFilterList(f.year);
  if (yearList.length) {
    conditions.push(`SAFE_CAST(${alias}.year AS INT64) IN UNNEST(@yearFilter)`);
    params.yearFilter = yearList;
  }

  const simpleStringFilters = [
    { key: "month", column: `${alias}.month`, param: "monthFilter" },
    { key: "status", column: `${alias}.status`, param: "statusFilter" },
    { key: "product", column: `${alias}.product`, param: "productFilter" },
    { key: "platform", column: `${alias}.platform`, param: "platformFilter" },
    { key: "ops", column: `${alias}.ops_owner`, param: "opsFilter" },
    { key: "cs", column: `${alias}.cs_owner`, param: "csFilter" },
    { key: "sales", column: `${alias}.sales_owner`, param: "salesFilter" }
  ];

  simpleStringFilters.forEach(({ key, column, param }) => {
    const list = toFilterList(f[key]);
    if (!list.length) return;
    conditions.push(`LOWER(TRIM(COALESCE(${column}, ''))) IN UNNEST(@${param})`);
    params[param] = list;
  });

  return {
    whereSql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params
  };
}

async function runQuery(query, params = {}) {
  if (!projectId || String(projectId).toLowerCase().includes("your-gcp-project-id")) {
    throw new Error("Set GCP_PROJECT_ID in backend/.env");
  }
  const [rows] = await bigquery.query({ query, params, location });
  return rows;
}

function toNumber(value, fixed = null) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  if (fixed === null) return n;
  return Number(n.toFixed(fixed));
}

function monthYearSeriesFromRows(rows = []) {
  const years = Array.from(new Set((rows || []).map((r) => String(Number(r.year || 0))).filter((y) => y !== "0"))).sort();
  const out = MONTHS.map((m) => {
    const row = { month: m };
    years.forEach((y) => { row[y] = 0; });
    return row;
  });

  (rows || []).forEach((r) => {
    const monthRaw = String(r.month || "").trim();
    const year = String(Number(r.year || 0));
    const value = toNumber(r.value, 2);
    if (!monthRaw || !year || year === "0") return;
    const monthIdx = MONTH_INDEX[monthRaw.toLowerCase()];
    if (monthIdx === undefined) return;
    if (out[monthIdx][year] === undefined) out[monthIdx][year] = 0;
    out[monthIdx][year] = value;
  });

  return out;
}

async function queryTransitionRows() {
  try {
    const rows = await runQuery(
      `
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
      `
    );
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

async function loadAllRows(_forceRefresh = false) {
  const rows = await runQuery(
    `
      SELECT
        campaign_name, campaign_id, status, country, region, revenue, spend, gross_profit, gross_margin_pct,
        net_margin, net_margin_pct, planned_impressions, delivered_impressions, budget_groups, cpm,
        start_date, end_date, month, year, product, platform, ops_owner, cs_owner, sales_owner
      FROM ${latestMainTableSql()}
    `
  );
  return rows.map((r) => ({
    campaignName: r.campaign_name,
    campaignId: r.campaign_id,
    status: r.status,
    country: r.country,
    region: r.region,
    revenue: toNumber(r.revenue),
    spend: toNumber(r.spend),
    grossProfit: toNumber(r.gross_profit),
    grossMarginPct: toNumber(r.gross_margin_pct),
    netMargin: toNumber(r.net_margin),
    netMarginPct: toNumber(r.net_margin_pct),
    plannedImpressions: toNumber(r.planned_impressions),
    deliveredImpressions: toNumber(r.delivered_impressions),
    budgetGroups: toNumber(r.budget_groups),
    cpm: toNumber(r.cpm),
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

async function getKpis(filters = {}) {
  const { whereSql, params } = buildWhereClause(filters, "t");
  const rows = await runQuery(
    `
      SELECT
        COUNT(DISTINCT NULLIF(TRIM(COALESCE(t.campaign_id, '')), '')) AS campaigns,
        SUM(COALESCE(t.budget_groups, 0)) AS budget_groups,
        SUM(COALESCE(t.revenue, 0)) AS total_revenue,
        SUM(COALESCE(t.spend, 0)) AS total_spend,
        AVG(COALESCE(t.gross_margin_pct, 0)) AS gross_margin_pct,
        AVG(COALESCE(t.net_margin_pct, 0)) AS net_margin_pct
      FROM ${latestMainTableSql()} t
      ${whereSql}
    `,
    params
  );

  const row = rows[0] || {};
  const campaigns = Number(row.campaigns || 0);
  const budgetGroups = Number(row.budget_groups || 0);
  const totalRevenue = Number(row.total_revenue || 0);
  const totalSpend = Number(row.total_spend || 0);
  const grossMarginPct = Number(row.gross_margin_pct || 0);
  const netMarginPct = Number(row.net_margin_pct || 0);

  return [
    { title: "No of Campaigns", value: campaigns, subtitle: `Budget Groups: ${budgetGroups}` },
    { title: "Gross Margin %", value: `${grossMarginPct.toFixed(1)}%`, subtitle: `Total Revenue: $${(totalRevenue / 1_000_000).toFixed(2)}M` },
    { title: "Net Margin %", value: `${netMarginPct.toFixed(1)}%`, subtitle: `Total Spend: $${(totalSpend / 1_000_000).toFixed(2)}M` },
    { title: "Spend", value: `$${(totalSpend / 1_000_000).toFixed(2)}M`, subtitle: `Booked Revenue: $${(totalRevenue / 1_000_000).toFixed(2)}M` }
  ];
}

async function getOverviewSeries(metric, filters = {}) {
  const { whereSql, params } = buildWhereClause(filters, "t");

  let valueExpr = "SUM(COALESCE(t.revenue, 0)) / 1000000";
  if (metric === "margin") valueExpr = "AVG(COALESCE(t.gross_margin_pct, 0))";
  if (metric === "net_margin") valueExpr = "AVG(COALESCE(t.net_margin_pct, 0))";
  if (metric === "cpm") valueExpr = "AVG(COALESCE(t.cpm, 0))";

  const rows = await runQuery(
    `
      SELECT
        t.month AS month,
        SAFE_CAST(t.year AS INT64) AS year,
        ROUND(${valueExpr}, 2) AS value
      FROM ${latestMainTableSql()} t
      ${whereSql}
      GROUP BY month, year
      ORDER BY year ASC, ${MONTH_ORDER_CASE}
    `,
    params
  );

  return monthYearSeriesFromRows(rows);
}

async function getRevenueTrend(filters = {}) {
  const base = await getOverviewSeries("revenue", filters);
  return getMergedOverviewSeries(base, "revenue");
}

async function getMarginTrend(filters = {}) {
  const base = await getOverviewSeries("margin", filters);
  return getMergedOverviewSeries(base, "margin");
}

async function getNetMarginTrend(filters = {}) {
  return getOverviewSeries("net_margin", filters);
}

async function getCpmTrend(filters = {}) {
  const base = await getOverviewSeries("cpm", filters);
  return getMergedOverviewSeries(base, "cpm");
}

async function getBottomCampaignsSimple(limit = 8, filters = {}) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit || 8)));
  const { whereSql, params } = buildWhereClause(filters, "t");
  const rows = await runQuery(
    `
      SELECT
        COALESCE(t.campaign_name, 'Unknown Campaign') AS campaignName,
        COALESCE(t.status, 'Unknown') AS status,
        COALESCE(t.revenue, 0) AS revenue,
        COALESCE(t.spend, 0) AS spend,
        COALESCE(t.gross_profit, 0) AS profit,
        ROUND(COALESCE(t.gross_margin_pct, 0), 2) AS grossMargin
      FROM ${latestMainTableSql()} t
      ${whereSql}
      ORDER BY COALESCE(t.gross_margin_pct, 0) ASC
      LIMIT @limit
    `,
    { ...params, limit: safeLimit }
  );

  return rows.map((r) => ({
    campaignName: r.campaignName,
    status: r.status,
    revenue: toNumber(r.revenue),
    spend: toNumber(r.spend),
    profit: toNumber(r.profit),
    grossMargin: toNumber(r.grossMargin, 2)
  }));
}

async function getCampaignsDetailed(limit = 25, filters = {}) {
  const safeLimit = Math.max(1, Math.min(500, Number(limit || 25)));
  const { whereSql, params } = buildWhereClause(filters, "t");

  const rows = await runQuery(
    `
      WITH ranked AS (
        SELECT
          COALESCE(t.campaign_name, 'Unknown Campaign') AS name,
          COALESCE(t.status, 'Unknown') AS status,
          COALESCE(t.revenue, 0) AS revenue,
          COALESCE(t.spend, 0) AS spend,
          COALESCE(t.gross_profit, 0) AS grossMargin,
          ROUND(COALESCE(t.gross_margin_pct, 0), 2) AS grossMarginPct,
          COALESCE(t.net_margin, 0) AS netMargin,
          ROUND(COALESCE(t.net_margin_pct, 0), 2) AS netMarginPct,
          COALESCE(t.planned_impressions, 0) AS plannedImpressions
        FROM ${latestMainTableSql()} t
        ${whereSql}
        ORDER BY COALESCE(t.gross_margin_pct, 0) ASC
        LIMIT @limit
      )
      SELECT * FROM ranked
    `,
    { ...params, limit: safeLimit }
  );

  const totalsRows = await runQuery(
    `
      WITH ranked AS (
        SELECT
          COALESCE(t.revenue, 0) AS revenue,
          COALESCE(t.spend, 0) AS spend,
          COALESCE(t.gross_profit, 0) AS grossMargin,
          ROUND(COALESCE(t.gross_margin_pct, 0), 2) AS grossMarginPct,
          COALESCE(t.net_margin, 0) AS netMargin,
          ROUND(COALESCE(t.net_margin_pct, 0), 2) AS netMarginPct,
          COALESCE(t.planned_impressions, 0) AS plannedImpressions
        FROM ${latestMainTableSql()} t
        ${whereSql}
        ORDER BY COALESCE(t.gross_margin_pct, 0) ASC
        LIMIT @limit
      )
      SELECT
        SUM(revenue) AS revenue,
        SUM(spend) AS spend,
        SUM(grossMargin) AS grossMargin,
        AVG(grossMarginPct) AS grossMarginPct,
        SUM(netMargin) AS netMargin,
        AVG(netMarginPct) AS netMarginPct,
        SUM(plannedImpressions) AS plannedImpressions
      FROM ranked
    `,
    { ...params, limit: safeLimit }
  );

  const totals = totalsRows[0] || {};
  return {
    rows: rows.map((r) => ({
      name: r.name,
      status: r.status,
      revenue: toNumber(r.revenue),
      spend: toNumber(r.spend),
      grossMargin: toNumber(r.grossMargin),
      grossMarginPct: toNumber(r.grossMarginPct, 2),
      netMargin: toNumber(r.netMargin),
      netMarginPct: toNumber(r.netMarginPct, 2),
      plannedImpressions: toNumber(r.plannedImpressions)
    })),
    totals: {
      revenue: toNumber(totals.revenue),
      spend: toNumber(totals.spend),
      grossMargin: toNumber(totals.grossMargin),
      grossMarginPct: toNumber(totals.grossMarginPct, 2),
      netMargin: toNumber(totals.netMargin),
      netMarginPct: toNumber(totals.netMarginPct, 2),
      plannedImpressions: toNumber(totals.plannedImpressions)
    }
  };
}

async function getRegionTable(filters = {}) {
  const { whereSql, params } = buildWhereClause(filters, "t");
  const rows = await runQuery(
    `
      SELECT
        COALESCE(NULLIF(TRIM(t.country), ''), 'Unknown') AS region,
        COUNT(DISTINCT NULLIF(TRIM(COALESCE(t.campaign_id, '')), '')) AS totalCampaigns,
        SUM(COALESCE(t.budget_groups, 0)) AS budgetGroups,
        SUM(COALESCE(t.revenue, 0)) AS bookedRevenue,
        SUM(COALESCE(t.spend, 0)) AS spend,
        SUM(COALESCE(t.planned_impressions, 0)) AS plannedImpressions,
        SUM(COALESCE(t.delivered_impressions, 0)) AS deliveredImpressions,
        SUM(COALESCE(t.gross_profit, 0)) AS grossMargin,
        IFNULL(SAFE_DIVIDE(SUM(COALESCE(t.delivered_impressions, 0)), NULLIF(SUM(COALESCE(t.planned_impressions, 0)), 0)) * 100, 0) AS deliveredPct,
        IFNULL(SAFE_DIVIDE(SUM(COALESCE(t.gross_profit, 0)), NULLIF(SUM(COALESCE(t.revenue, 0)), 0)) * 100, 0) AS grossMarginPct
      FROM ${latestMainTableSql()} t
      ${whereSql}
      GROUP BY region
      ORDER BY bookedRevenue DESC
    `,
    params
  );

  return rows.map((r) => ({
    region: r.region,
    totalCampaigns: toNumber(r.totalCampaigns),
    budgetGroups: toNumber(r.budgetGroups),
    bookedRevenue: toNumber(r.bookedRevenue),
    spend: toNumber(r.spend),
    plannedImpressions: toNumber(r.plannedImpressions),
    deliveredImpressions: toNumber(r.deliveredImpressions),
    deliveredPct: toNumber(r.deliveredPct, 2),
    grossMargin: toNumber(r.grossMargin),
    grossMarginPct: toNumber(r.grossMarginPct, 2)
  }));
}

async function getCountryWiseTable(filters = {}) {
  const { whereSql, params } = buildWhereClause(filters, "t");

  const rows = await runQuery(
    `
      WITH grouped AS (
        SELECT
          COALESCE(NULLIF(TRIM(t.region), ''), 'Unknown') AS region,
          COUNT(DISTINCT NULLIF(TRIM(COALESCE(t.campaign_id, '')), '')) AS campaigns,
          SUM(COALESCE(t.budget_groups, 0)) AS budgetGroups,
          SUM(COALESCE(t.revenue, 0)) AS revenue,
          SUM(COALESCE(t.spend, 0)) AS spend,
          SUM(COALESCE(t.planned_impressions, 0)) AS plannedImpressions,
          SUM(COALESCE(t.delivered_impressions, 0)) AS deliveredImpressions,
          SUM(COALESCE(t.gross_profit, 0)) AS grossMargin,
          IFNULL(SAFE_DIVIDE(SUM(COALESCE(t.delivered_impressions, 0)), NULLIF(SUM(COALESCE(t.planned_impressions, 0)), 0)) * 100, 0) AS deliveredPct,
          IFNULL(SAFE_DIVIDE(SUM(COALESCE(t.gross_profit, 0)), NULLIF(SUM(COALESCE(t.revenue, 0)), 0)) * 100, 0) AS grossMarginPct
        FROM ${latestMainTableSql()} t
        ${whereSql}
        GROUP BY region
      )
      SELECT *
      FROM grouped
      ORDER BY revenue DESC
    `,
    params
  );

  const totalsRows = await runQuery(
    `
      WITH grouped AS (
        SELECT
          COUNT(DISTINCT NULLIF(TRIM(COALESCE(t.campaign_id, '')), '')) AS campaigns,
          SUM(COALESCE(t.budget_groups, 0)) AS budgetGroups,
          SUM(COALESCE(t.revenue, 0)) AS revenue,
          SUM(COALESCE(t.spend, 0)) AS spend,
          SUM(COALESCE(t.planned_impressions, 0)) AS plannedImpressions,
          SUM(COALESCE(t.delivered_impressions, 0)) AS deliveredImpressions,
          SUM(COALESCE(t.gross_profit, 0)) AS grossMargin
        FROM ${latestMainTableSql()} t
        ${whereSql}
        GROUP BY COALESCE(NULLIF(TRIM(t.region), ''), 'Unknown')
      )
      SELECT
        SUM(campaigns) AS campaigns,
        SUM(budgetGroups) AS budgetGroups,
        SUM(revenue) AS revenue,
        SUM(spend) AS spend,
        SUM(plannedImpressions) AS plannedImpressions,
        SUM(deliveredImpressions) AS deliveredImpressions,
        SUM(grossMargin) AS grossMargin,
        IFNULL(SAFE_DIVIDE(SUM(deliveredImpressions), NULLIF(SUM(plannedImpressions), 0)) * 100, 0) AS deliveredPct,
        IFNULL(SAFE_DIVIDE(SUM(grossMargin), NULLIF(SUM(revenue), 0)) * 100, 0) AS grossMarginPct
      FROM grouped
    `,
    params
  );

  const totals = totalsRows[0] || {};
  return {
    rows: rows.map((r) => ({
      region: r.region,
      campaigns: toNumber(r.campaigns),
      budgetGroups: toNumber(r.budgetGroups),
      revenue: toNumber(r.revenue),
      spend: toNumber(r.spend),
      plannedImpressions: toNumber(r.plannedImpressions),
      deliveredImpressions: toNumber(r.deliveredImpressions),
      deliveredPct: toNumber(r.deliveredPct, 2),
      grossMargin: toNumber(r.grossMargin),
      grossMarginPct: toNumber(r.grossMarginPct, 2)
    })),
    totals: {
      campaigns: toNumber(totals.campaigns),
      budgetGroups: toNumber(totals.budgetGroups),
      revenue: toNumber(totals.revenue),
      spend: toNumber(totals.spend),
      plannedImpressions: toNumber(totals.plannedImpressions),
      deliveredImpressions: toNumber(totals.deliveredImpressions),
      deliveredPct: toNumber(totals.deliveredPct, 2),
      grossMargin: toNumber(totals.grossMargin),
      grossMarginPct: toNumber(totals.grossMarginPct, 2)
    }
  };
}

async function getCampaignWiseTable(limit = 50, filters = {}) {
  const safeLimit = Math.max(1, Math.min(1000, Number(limit || 50)));
  const { whereSql, params } = buildWhereClause(filters, "t");

  const rows = await runQuery(
    `
      WITH grouped AS (
        SELECT
          COALESCE(NULLIF(TRIM(t.campaign_name), ''), 'Unknown Campaign') AS name,
          SUM(COALESCE(t.budget_groups, 0)) AS budgetGroups,
          MIN(t.start_date) AS startDate,
          MAX(t.end_date) AS endDate,
          SUM(COALESCE(t.planned_impressions, 0)) AS plannedImpressions
        FROM ${latestMainTableSql()} t
        ${whereSql}
        GROUP BY name
      )
      SELECT *
      FROM grouped
      ORDER BY plannedImpressions DESC
      LIMIT @limit
    `,
    { ...params, limit: safeLimit }
  );

  const totalsRows = await runQuery(
    `
      WITH grouped AS (
        SELECT
          COALESCE(NULLIF(TRIM(t.campaign_name), ''), 'Unknown Campaign') AS name,
          SUM(COALESCE(t.budget_groups, 0)) AS budgetGroups,
          SUM(COALESCE(t.planned_impressions, 0)) AS plannedImpressions
        FROM ${latestMainTableSql()} t
        ${whereSql}
        GROUP BY name
      ),
      top_rows AS (
        SELECT *
        FROM grouped
        ORDER BY plannedImpressions DESC
        LIMIT @limit
      )
      SELECT
        SUM(budgetGroups) AS budgetGroups,
        SUM(plannedImpressions) AS plannedImpressions
      FROM top_rows
    `,
    { ...params, limit: safeLimit }
  );

  const totals = totalsRows[0] || {};
  return {
    rows: rows.map((r) => ({
      name: r.name,
      budgetGroups: toNumber(r.budgetGroups),
      startDate: r.startDate ? String(r.startDate.value || r.startDate) : null,
      endDate: r.endDate ? String(r.endDate.value || r.endDate) : null,
      plannedImpressions: toNumber(r.plannedImpressions)
    })),
    totals: {
      budgetGroups: toNumber(totals.budgetGroups),
      duration: 0,
      daysRemaining: 0,
      avgPctPassed: 0,
      plannedImpressions: toNumber(totals.plannedImpressions)
    }
  };
}

async function getProductWiseTable(filters = {}) {
  const { whereSql, params } = buildWhereClause(filters, "t");

  const rows = await runQuery(
    `
      WITH grouped AS (
        SELECT
          COALESCE(NULLIF(TRIM(t.product), ''), 'Unknown') AS product,
          COUNT(DISTINCT NULLIF(TRIM(COALESCE(t.campaign_id, '')), '')) AS totalCampaigns,
          SUM(COALESCE(t.budget_groups, 0)) AS budgetGroups,
          SUM(COALESCE(t.revenue, 0)) AS bookedRevenue,
          SUM(COALESCE(t.spend, 0)) AS spend,
          SUM(COALESCE(t.planned_impressions, 0)) AS plannedImpressions,
          SUM(COALESCE(t.delivered_impressions, 0)) AS deliveredImpressions,
          SUM(COALESCE(t.gross_profit, 0)) AS grossProfitLoss,
          IFNULL(SAFE_DIVIDE(SUM(COALESCE(t.delivered_impressions, 0)), NULLIF(SUM(COALESCE(t.planned_impressions, 0)), 0)) * 100, 0) AS deliveredPct,
          IFNULL(SAFE_DIVIDE(SUM(COALESCE(t.gross_profit, 0)), NULLIF(SUM(COALESCE(t.revenue, 0)), 0)) * 100, 0) AS grossMargin
        FROM ${latestMainTableSql()} t
        ${whereSql}
        GROUP BY product
      )
      SELECT *
      FROM grouped
      ORDER BY bookedRevenue DESC
    `,
    params
  );

  const totalsRows = await runQuery(
    `
      WITH grouped AS (
        SELECT
          COUNT(DISTINCT NULLIF(TRIM(COALESCE(t.campaign_id, '')), '')) AS totalCampaigns,
          SUM(COALESCE(t.budget_groups, 0)) AS budgetGroups,
          SUM(COALESCE(t.revenue, 0)) AS bookedRevenue,
          SUM(COALESCE(t.spend, 0)) AS spend,
          SUM(COALESCE(t.planned_impressions, 0)) AS plannedImpressions,
          SUM(COALESCE(t.delivered_impressions, 0)) AS deliveredImpressions,
          SUM(COALESCE(t.gross_profit, 0)) AS grossProfitLoss
        FROM ${latestMainTableSql()} t
        ${whereSql}
        GROUP BY COALESCE(NULLIF(TRIM(t.product), ''), 'Unknown')
      )
      SELECT
        SUM(totalCampaigns) AS totalCampaigns,
        SUM(budgetGroups) AS budgetGroups,
        SUM(bookedRevenue) AS bookedRevenue,
        SUM(spend) AS spend,
        SUM(plannedImpressions) AS plannedImpressions,
        SUM(deliveredImpressions) AS deliveredImpressions,
        SUM(grossProfitLoss) AS grossProfitLoss,
        IFNULL(SAFE_DIVIDE(SUM(deliveredImpressions), NULLIF(SUM(plannedImpressions), 0)) * 100, 0) AS deliveredPct,
        IFNULL(SAFE_DIVIDE(SUM(grossProfitLoss), NULLIF(SUM(bookedRevenue), 0)) * 100, 0) AS grossMargin
      FROM grouped
    `,
    params
  );

  const totals = totalsRows[0] || {};
  return {
    rows: rows.map((r) => ({
      product: r.product,
      totalCampaigns: toNumber(r.totalCampaigns),
      budgetGroups: toNumber(r.budgetGroups),
      bookedRevenue: toNumber(r.bookedRevenue),
      spend: toNumber(r.spend),
      plannedImpressions: toNumber(r.plannedImpressions),
      deliveredImpressions: toNumber(r.deliveredImpressions),
      deliveredPct: toNumber(r.deliveredPct, 2),
      grossProfitLoss: toNumber(r.grossProfitLoss),
      grossMargin: toNumber(r.grossMargin, 2)
    })),
    totals: {
      totalCampaigns: toNumber(totals.totalCampaigns),
      budgetGroups: toNumber(totals.budgetGroups),
      bookedRevenue: toNumber(totals.bookedRevenue),
      spend: toNumber(totals.spend),
      plannedImpressions: toNumber(totals.plannedImpressions),
      deliveredImpressions: toNumber(totals.deliveredImpressions),
      deliveredPct: toNumber(totals.deliveredPct, 2),
      grossProfitLoss: toNumber(totals.grossProfitLoss),
      grossMargin: toNumber(totals.grossMargin, 2)
    }
  };
}

async function getFilterOptions(filters = {}) {
  const { whereSql, params } = buildWhereClause(filters, "t");
  const rows = await runQuery(
    `
      SELECT DISTINCT
        t.region,
        t.country,
        SAFE_CAST(t.year AS INT64) AS year,
        t.month,
        t.status,
        t.product,
        t.platform,
        t.ops_owner,
        t.cs_owner,
        t.sales_owner
      FROM ${latestMainTableSql()} t
      ${whereSql}
    `,
    params
  );

  const uniq = (arr) => Array.from(new Set(arr.filter((x) => x !== null && x !== undefined && String(x).trim() !== ""))).sort();
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
    year: uniq(rows.map((r) => Number(r.year || 0)).filter((y) => y > 0)),
    month: uniq(rows.map((r) => r.month)).sort((a, b) => (MONTH_INDEX[String(a).toLowerCase()] ?? 999) - (MONTH_INDEX[String(b).toLowerCase()] ?? 999)),
    status: uniq(rows.map((r) => r.status)),
    product: uniq(rows.map((r) => r.product)),
    platform: uniq(rows.map((r) => r.platform)),
    ops: uniq(rows.map((r) => r.ops_owner)),
    cs: uniq(rows.map((r) => r.cs_owner)),
    sales: uniq(rows.map((r) => r.sales_owner)),
    regionTree,
    yearMonthTree
  };
}

async function getAdminOptions() {
  const rows = await runQuery(
    `
      SELECT DISTINCT
        country,
        region,
        ops_owner,
        cs_owner,
        sales_owner
      FROM ${latestMainTableSql()}
    `
  );

  const uniq = (arr) => Array.from(new Set(arr.filter((x) => x !== null && x !== undefined && String(x).trim() !== ""))).sort();
  return {
    countries: uniq(rows.map((r) => r.country)),
    regions: uniq(rows.map((r) => r.region)),
    adops: uniq(rows.flatMap((r) => [r.ops_owner, r.cs_owner, r.sales_owner]))
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
