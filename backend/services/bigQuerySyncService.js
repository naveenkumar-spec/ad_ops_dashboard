const path = require("path");
const crypto = require("crypto");
const { BigQuery } = require("@google-cloud/bigquery");
const privateSheetsService = require("./privateSheetsService");
const alertService = require("./alertService");

const keyFileFromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || "./secrets/google-sa.json";
const keyFilename = path.isAbsolute(keyFileFromEnv)
  ? keyFileFromEnv
  : path.resolve(__dirname, "..", keyFileFromEnv);

const projectId = process.env.GCP_PROJECT_ID;
const datasetId = process.env.BIGQUERY_DATASET_ID || "adops_dashboard";
const tableId = process.env.BIGQUERY_TABLE_ID || "campaign_tracker_consolidated";
const transitionTableId = process.env.BIGQUERY_TRANSITION_TABLE_ID || "overview_transition_metrics";
const stateTableId = process.env.BIGQUERY_SYNC_STATE_TABLE_ID || "campaign_tracker_sync_state";

const bigquery = new BigQuery({
  projectId: projectId || undefined,
  keyFilename
});

let lastSyncResult = null;
let activeSyncStatus = null;
let currentSyncPromise = null;

function sourceKey(source = {}) {
  return `${source.sourceSheetId || source.sheetId || ""}::${source.configuredTab || source.tabName || ""}::${source.sourceCountry || source.country || ""}`;
}

function createInitialSources() {
  const configured = (privateSheetsService.getSourceConfig() || []).filter((s) => s.enabled !== false);
  return configured.map((s) => ({
    sourceCountry: s.country || null,
    sourceSheetId: s.sheetId || null,
    configuredTab: s.tabName || null,
    resolvedTab: null,
    status: "pending",
    rowCount: 0,
    columns: [],
    detail: null
  }));
}

function updateActiveSource(partial = {}) {
  if (!activeSyncStatus || !Array.isArray(activeSyncStatus.sources)) return;
  const key = sourceKey(partial);
  const idx = activeSyncStatus.sources.findIndex((s) => sourceKey(s) === key);
  if (idx < 0) return;
  activeSyncStatus.sources[idx] = {
    ...activeSyncStatus.sources[idx],
    ...partial
  };
  const statuses = activeSyncStatus.sources.map((s) => s.status);
  activeSyncStatus.completedSources = statuses.filter((s) => s === "success").length;
  activeSyncStatus.failedSources = statuses.filter((s) => s === "failed").length;
  activeSyncStatus.inProgressSources = statuses.filter((s) => s === "in_progress").length;
}

function isStopRequested() {
  return Boolean(activeSyncStatus?.cancelRequested);
}

function throwIfStopRequested() {
  if (!isStopRequested()) return;
  const error = new Error("Sync stopped by admin");
  error.code = "SYNC_STOPPED";
  throw error;
}

function buildIssueSignature(issueReport = {}) {
  const issues = Array.isArray(issueReport.issues) ? issueReport.issues : [];
  const issueCount = Number(issueReport.issueCount || issues.length || 0);
  const canonical = issues
    .slice(0, 150)
    .map((issue) => [
      issue?.type || "",
      issue?.severity || "",
      issue?.sourceSheetId || "",
      issue?.resolvedTab || issue?.configuredTab || "",
      issue?.column || "",
      String(issue?.row || ""),
      String(issue?.value || ""),
      issue?.detail || ""
    ].join("|"))
    .sort()
    .join("\n");
  return crypto.createHash("sha256").update(`${issueCount}\n${canonical}`).digest("hex");
}

async function wasAlertSentRecently(signature, cooldownMinutes) {
  if (!signature || !Number.isFinite(cooldownMinutes) || cooldownMinutes <= 0) return false;
  const [rows] = await bigquery.query({
    query: `
      SELECT synced_at
      FROM \`${projectId}.${datasetId}.${stateTableId}\`
      WHERE status = 'alert_sent'
        AND checksum = @signature
      ORDER BY synced_at DESC
      LIMIT 1
    `,
    params: { signature },
    location: process.env.BIGQUERY_LOCATION || "US"
  });
  const last = rows[0]?.synced_at?.value || rows[0]?.synced_at || null;
  if (!last) return false;
  const lastMs = new Date(last).getTime();
  if (!Number.isFinite(lastMs)) return false;
  const elapsedMinutes = (Date.now() - lastMs) / 60000;
  return elapsedMinutes < cooldownMinutes;
}

function formatDataQualityIssue(issue, index) {
  const parts = [
    `${index + 1}. [${String(issue?.severity || "info").toUpperCase()}] ${issue?.type || "issue"}`,
    `country=${issue?.sourceCountry || "-"}`,
    `sheetId=${issue?.sourceSheetId || "-"}`,
    `configuredTab=${issue?.configuredTab || "-"}`,
    `resolvedTab=${issue?.resolvedTab || "-"}`,
    `column=${issue?.column || "-"}`,
    `row=${issue?.row || "-"}`
  ];
  if (issue?.value !== undefined && issue?.value !== null) parts.push(`value=${String(issue.value)}`);
  if (issue?.detail) parts.push(`detail=${issue.detail}`);
  return parts.join(" | ");
}

async function sendDataQualityAlert({ syncId, syncedAtIso, issueReport = {}, mode = "full_refresh", rowCount = 0, transitionRowCount = 0 }) {
  const issues = Array.isArray(issueReport.issues) ? issueReport.issues : [];
  const issueCount = Number(issueReport.issueCount || issues.length || 0);
  if (!issueCount) return { sent: false, reason: "no_issues" };

  const cooldownMinutes = Number(process.env.SYNC_ALERT_COOLDOWN_MINUTES || 180);
  const signature = buildIssueSignature({ issueCount, issues });
  if (await wasAlertSentRecently(signature, cooldownMinutes)) {
    return { sent: false, reason: "cooldown", signature, cooldownMinutes };
  }

  const maxLines = Number(process.env.SYNC_ALERT_MAX_ISSUES || 120);
  const shown = issues.slice(0, Math.max(1, maxLines));
  const lines = shown.map((issue, i) => formatDataQualityIssue(issue, i)).join("\n");
  const remaining = issueCount > shown.length ? `\n... and ${issueCount - shown.length} more issue(s)` : "";
  const body = [
    `BigQuery sync data-quality issues detected`,
    `syncId: ${syncId}`,
    `syncedAt: ${syncedAtIso}`,
    `mode: ${mode}`,
    `project: ${projectId}`,
    `dataset: ${datasetId}`,
    `table: ${tableId}`,
    `transitionTable: ${transitionTableId}`,
    `rowCount: ${rowCount}`,
    `transitionRowCount: ${transitionRowCount}`,
    `issueCount: ${issueCount}`,
    "",
    "Issue details:",
    lines + remaining
  ].join("\n");

  const alertResult = await alertService.sendAlert("AdOps BigQuery Sync Data Quality Alert", body);
  if (!alertResult?.sent) {
    return { sent: false, reason: alertResult?.reason || "disabled", signature, issueCount };
  }
  try {
    await writeState({
      sync_id: `${syncId}_alert`,
      synced_at: syncedAtIso,
      status: "alert_sent",
      mode,
      row_count: issueCount,
      checksum: signature,
      message: `Data-quality alert sent. issueCount=${issueCount}`
    });
  } catch (_ignored) {
    // no-op
  }
  return { sent: true, signature, issueCount };
}

const TABLE_SCHEMA = [
  { name: "sync_id", type: "STRING" },
  { name: "synced_at", type: "TIMESTAMP" },
  { name: "campaign_name", type: "STRING" },
  { name: "campaign_id", type: "STRING" },
  { name: "status", type: "STRING" },
  { name: "country", type: "STRING" },
  { name: "region", type: "STRING" },
  { name: "currency_code", type: "STRING" },
  { name: "revenue", type: "FLOAT" },
  { name: "spend", type: "FLOAT" },
  { name: "gross_profit", type: "FLOAT" },
  { name: "gross_margin_pct", type: "FLOAT" },
  { name: "net_margin", type: "FLOAT" },
  { name: "net_margin_pct", type: "FLOAT" },
  // Native currency values (original from sheets)
  { name: "revenue_local", type: "FLOAT" },
  { name: "spend_local", type: "FLOAT" },
  { name: "gross_profit_local", type: "FLOAT" },
  { name: "net_margin_local", type: "FLOAT" },
  { name: "planned_impressions", type: "FLOAT" },
  { name: "delivered_impressions", type: "FLOAT" },
  { name: "budget_groups", type: "INT64" },
  { name: "cpm", type: "FLOAT" },
  // New pace and campaign tracking columns
  { name: "days_remaining", type: "FLOAT" },
  { name: "days_passed", type: "FLOAT" },
  { name: "daily_required_pace", type: "FLOAT" },
  { name: "yesterday_pace", type: "FLOAT" },
  { name: "pace_remarks", type: "STRING" },
  { name: "start_date", type: "DATE" },
  { name: "end_date", type: "DATE" },
  { name: "month", type: "STRING" },
  { name: "year", type: "INT64" },
  { name: "product", type: "STRING" },
  { name: "platform", type: "STRING" },
  { name: "ops_owner", type: "STRING" },
  { name: "cs_owner", type: "STRING" },
  { name: "sales_owner", type: "STRING" },
  { name: "source_sheet_id", type: "STRING" },
  { name: "source_tab", type: "STRING" },
  { name: "source_country", type: "STRING" },
  { name: "source_gid", type: "INT64" }
];

const TRANSITION_TABLE_SCHEMA = [
  { name: "sync_id", type: "STRING" },
  { name: "synced_at", type: "TIMESTAMP" },
  { name: "month", type: "STRING" },
  { name: "year", type: "INT64" },
  { name: "country", type: "STRING" },
  { name: "region", type: "STRING" },
  { name: "revenue", type: "FLOAT" },
  { name: "spend", type: "FLOAT" },
  { name: "gross_profit", type: "FLOAT" },
  { name: "gross_margin_pct", type: "FLOAT" },
  { name: "cpm", type: "FLOAT" },
  { name: "source_sheet_id", type: "STRING" },
  { name: "source_tab", type: "STRING" },
  { name: "source_country", type: "STRING" }
  // NOTE: NO net_margin or net_margin_pct - these come from tracker sheet only
];

async function ensureTable() {
  if (!projectId || String(projectId).toLowerCase().includes("your-gcp-project-id")) {
    throw new Error("Set a real GCP_PROJECT_ID in backend/.env before running BigQuery sync");
  }

  const dataset = bigquery.dataset(datasetId);
  await dataset.get({ autoCreate: true });

  const table = dataset.table(tableId);
  const [tableExists] = await table.exists();
  if (!tableExists) {
    await table.create({
      schema: TABLE_SCHEMA,
      description: "Consolidated private Google Sheets tracker data for adops dashboard"
    });
  } else {
    const [meta] = await table.getMetadata();
    const existing = new Set((meta.schema?.fields || []).map((f) => f.name));
    const missing = TABLE_SCHEMA.filter((f) => !existing.has(f.name));
    if (missing.length) {
      await table.setMetadata({
        schema: {
          fields: [...(meta.schema?.fields || []), ...missing]
        }
      });
    }
  }
  return table;
}

async function ensureTransitionTable() {
  const dataset = bigquery.dataset(datasetId);
  await dataset.get({ autoCreate: true });

  const table = dataset.table(transitionTableId);
  const [tableExists] = await table.exists();
  
  if (tableExists) {
    // Check if table has the correct schema
    const [meta] = await table.getMetadata();
    const existingFields = (meta.schema?.fields || []).map((f) => f.name);
    const expectedFields = TRANSITION_TABLE_SCHEMA.map((f) => f.name);
    
    // Check if we have old schema columns that shouldn't be there
    const hasOldColumns = existingFields.includes('quarter') || 
                         existingFields.includes('booked_revenue_m') || 
                         existingFields.includes('average_buying_cpm');
    
    const missingColumns = expectedFields.filter(field => !existingFields.includes(field));
    const extraColumns = existingFields.filter(field => !expectedFields.includes(field));
    
    if (hasOldColumns || missingColumns.length > 0 || extraColumns.length > 0) {
      console.log(`[ensureTransitionTable] Schema mismatch detected. Recreating table.`);
      console.log(`[ensureTransitionTable] Missing columns: ${missingColumns.join(', ')}`);
      console.log(`[ensureTransitionTable] Extra columns: ${extraColumns.join(', ')}`);
      
      // Drop and recreate table with correct schema
      await table.delete();
      console.log(`[ensureTransitionTable] Dropped existing table with old schema`);
      
      await table.create({
        schema: TRANSITION_TABLE_SCHEMA,
        description: "Overview transition metrics from Raw Spends Data tab - simplified schema for country-based JOIN"
      });
      console.log(`[ensureTransitionTable] Created new table with simplified schema`);
    } else {
      console.log(`[ensureTransitionTable] Table schema is correct`);
    }
  } else {
    await table.create({
      schema: TRANSITION_TABLE_SCHEMA,
      description: "Overview transition metrics from Raw Spends Data tab - simplified schema for country-based JOIN"
    });
    console.log(`[ensureTransitionTable] Created new transition table`);
  }
  
  return table;
}

async function ensureStateTable() {
  const dataset = bigquery.dataset(datasetId);
  await dataset.get({ autoCreate: true });
  const table = dataset.table(stateTableId);
  const [exists] = await table.exists();
  if (!exists) {
    await table.create({
      schema: [
        { name: "sync_id", type: "STRING" },
        { name: "synced_at", type: "TIMESTAMP" },
        { name: "status", type: "STRING" },
        { name: "mode", type: "STRING" },
        { name: "row_count", type: "INT64" },
        { name: "checksum", type: "STRING" },
        { name: "message", type: "STRING" }
      ]
    });
  }
  return table;
}

function computeChecksum(rows, transitionRows = []) {
  const canonicalMain = rows
    .map((r) => [
      r.campaignName || "",
      r.campaignId || "",
      r.country || "",
      r.status || "",
      Number(r.revenue || 0).toFixed(4),
      Number(r.spend || 0).toFixed(4),
      Number(r.grossProfit || 0).toFixed(4),
      Number(r.grossMarginPct || 0).toFixed(4),
      Number(r.netMargin || 0).toFixed(4),
      Number(r.netMarginPct || 0).toFixed(4),
      Number(r.plannedImpressions || 0).toFixed(4),
      Number(r.deliveredImpressions || 0).toFixed(4),
      Number(r.budgetGroups || 0),
      Number(r.cpm || 0).toFixed(4),
      // New pace and campaign tracking fields
      Number(r.daysRemaining || 0).toFixed(4),
      Number(r.daysPassed || 0).toFixed(4),
      Number(r.dailyRequiredPace || 0).toFixed(4),
      Number(r.yesterdayPace || 0).toFixed(4),
      r.paceRemarks || "",
      r.startDate || "",
      r.endDate || "",
      r.month || "",
      Number(r.year || 0),
      r.product || "",
      r.platform || "",
      r.opsOwner || "",
      r.csOwner || "",
      r.salesOwner || ""
    ].join("|"))
    .sort()
    .join("\n");

  const canonicalTransition = transitionRows
    .map((r) => [
      r.month || "",
      Number(r.year || 0),
      r.quarter || "",
      Number(r.booked_revenue_m || 0).toFixed(4),
      Number(r.gross_margin_pct || 0).toFixed(4),
      Number(r.average_buying_cpm || 0).toFixed(4)
    ].join("|"))
    .sort()
    .join("\n");

  return crypto.createHash("sha256").update(`${canonicalMain}\n---\n${canonicalTransition}`).digest("hex");
}

async function getLastChecksum() {
  const [rows] = await bigquery.query({
    query: `
      SELECT checksum
      FROM \`${projectId}.${datasetId}.${stateTableId}\`
      WHERE status = 'success'
      ORDER BY synced_at DESC
      LIMIT 1
    `,
    location: process.env.BIGQUERY_LOCATION || "US"
  });
  return rows[0]?.checksum || null;
}

async function writeState(state) {
  const table = await ensureStateTable();
  await table.insert([state]);
}

function toBigQueryRows(rows, syncId, syncedAtIso) {
  console.log(`[toBigQueryRows] Processing ${rows.length} rows`);
  
  // Log first row to see what data we're getting
  if (rows.length > 0) {
    const firstRow = rows[0];
    console.log(`[toBigQueryRows] First row sample:`, {
      country: firstRow.country,
      currencyCode: firstRow.currencyCode,
      revenue: firstRow.revenue,
      revenueLocal: firstRow.revenueLocal,
      spend: firstRow.spend,
      spendLocal: firstRow.spendLocal,
      grossProfit: firstRow.grossProfit,
      grossProfitLocal: firstRow.grossProfitLocal,
      netMargin: firstRow.netMargin,
      netMarginLocal: firstRow.netMarginLocal
    });
  }
  
  return rows.map((row) => ({
    sync_id: syncId,
    synced_at: syncedAtIso,
    campaign_name: row.campaignName || null,
    campaign_id: row.campaignId || null,
    status: row.status || null,
    country: row.country || null,
    region: row.region || null,
    currency_code: row.currencyCode || null,
    // USD values (converted)
    revenue: Number(row.revenue || 0),
    spend: Number(row.spend || 0),
    gross_profit: Number(row.grossProfit || 0),
    gross_margin_pct: Number(row.grossMarginPct || 0),
    net_margin: Number(row.netMargin || 0),
    net_margin_pct: Number(row.netMarginPct || 0),
    // Native currency values (original from sheets)
    revenue_local: Number(row.revenueLocal || 0),
    spend_local: Number(row.spendLocal || 0),
    gross_profit_local: Number(row.grossProfitLocal || 0),
    net_margin_local: Number(row.netMarginLocal || 0),
    planned_impressions: Number(row.plannedImpressions || 0),
    delivered_impressions: Number(row.deliveredImpressions || 0),
    budget_groups: Math.round(Number(row.budgetGroups || 0)),
    cpm: Number(row.cpm || 0),
    // New pace and campaign tracking fields
    days_remaining: Number(row.daysRemaining || 0),
    days_passed: Number(row.daysPassed || 0),
    daily_required_pace: Number(row.dailyRequiredPace || 0),
    yesterday_pace: Number(row.yesterdayPace || 0),
    pace_remarks: row.paceRemarks || null,
    start_date: row.startDate || null,
    end_date: row.endDate || null,
    month: row.month || null,
    year: Math.round(Number(row.year || 0)),
    product: row.product || null,
    platform: row.platform || null,
    ops_owner: row.opsOwner || null,
    cs_owner: row.csOwner || null,
    sales_owner: row.salesOwner || null,
    source_sheet_id: row._sourceSheetId || null,
    source_tab: row._sourceTab || null,
    source_country: row._sourceCountry || null,
    source_gid: Math.round(Number(row._sourceGid || 0))
  }));
}

function toTransitionMapRow(seriesByMetric, month, year) {
  // This function is no longer needed - we'll parse raw branding sheet data directly
  const row = {
    month,
    year: Math.round(Number(year || 0)),
    quarter: null,
    booked_revenue_m: 0,
    gross_margin_pct: 0,
    average_buying_cpm: 0
  };
  const monthIndex = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
  }[month];
  if (monthIndex !== undefined) row.quarter = `Q${Math.floor(monthIndex / 3) + 1}`;

  Object.entries(seriesByMetric || {}).forEach(([metric, series]) => {
    const monthRow = (series || []).find((s) => s.month === month) || {};
    const value = Number(monthRow[String(year)] || 0);
    if (metric === "revenue") row.booked_revenue_m = Number(value.toFixed(2));
    if (metric === "margin") row.gross_margin_pct = Number(value.toFixed(2));
    if (metric === "cpm") row.average_buying_cpm = Number(value.toFixed(2));
  });
  
  // Debug: Log first few rows
  if (row.year === 2020 && (month === "January" || month === "September")) {
    console.log(`[toTransitionMapRow] ${month} ${year}:`, row);
  }
  
  return row;
}

async function getBrandingSheetRawData() {
  // Get raw parsed data from branding sheet with all dimensions
  try {
    const rawData = await privateSheetsService.getBrandingSheetParsedData();
    console.log(`[getBrandingSheetRawData] Retrieved ${rawData.length} raw rows from branding sheet`);
    return rawData;
  } catch (error) {
    console.error("[getBrandingSheetRawData] Failed to get branding sheet data:", error.message);
    return [];
  }
}

function toTransitionRows(syncId, syncedAtIso, rawBrandingData) {
  console.log(`[toTransitionRows] Processing ${rawBrandingData.length} raw branding sheet rows`);
  
  if (!rawBrandingData.length) {
    console.log(`[toTransitionRows] No raw branding data to process`);
    return [];
  }
  
  let validRows = 0;
  let filteredRows = 0;
  
  const out = rawBrandingData.map((row, index) => {
    const revenue = Number(row.salesValueUsd || 0);
    const spend = Number(row.mediaSpendUsd || 0);
    const grossProfit = revenue - spend;
    const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    
    const transitionRow = {
      sync_id: syncId,
      synced_at: syncedAtIso,
      month: row.month || null,
      year: Math.round(Number(row.year || 0)),
      country: row.country || null,
      region: row.region || null,
      revenue: revenue,
      spend: spend,
      gross_profit: grossProfit,
      gross_margin_pct: grossMarginPct,
      cpm: Number(row.ecpm || 0),
      source_sheet_id: "1MwWqMLj5b4FwIS6wD3FugfwgbWlyJD0xaQJLpmlRlQs",
      source_tab: "Raw Spends Data",
      source_country: row.country || null
      // NOTE: NO net_margin fields - these come from tracker sheet only
    };
    
    // Log first few rows for debugging
    if (validRows < 5) {
      console.log(`[toTransitionRows] Sample row ${validRows + 1}: month=${transitionRow.month}, year=${transitionRow.year}, country=${transitionRow.country}, revenue=${transitionRow.revenue}, spend=${transitionRow.spend}, cpm=${transitionRow.cpm}`);
    }
    
    return transitionRow;
  }).filter(row => {
    // Keep rows that have meaningful data - be less restrictive
    const hasValidDate = row.year > 0 && row.month;
    const hasData = row.revenue > 0 || row.spend > 0 || row.cpm > 0;
    
    if (hasValidDate && hasData) {
      validRows++;
      return true;
    } else {
      filteredRows++;
      if (filteredRows <= 5) {
        console.log(`[toTransitionRows] Filtered out row: year=${row.year}, month=${row.month}, revenue=${row.revenue}, spend=${row.spend}, cpm=${row.cpm}`);
      }
      return false;
    }
  });
  
  console.log(`[toTransitionRows] Created ${out.length} transition rows from ${rawBrandingData.length} raw rows (filtered out ${filteredRows} rows)`);
  
  // Log year distribution
  const yearCounts = {};
  out.forEach(row => {
    yearCounts[row.year] = (yearCounts[row.year] || 0) + 1;
  });
  console.log(`[toTransitionRows] Year distribution:`, yearCounts);
  
  return out;
}

async function syncToBigQuery(options = {}) {
  const fullRefresh = options.fullRefresh === true; // Default to incremental
  const skipIfUnchanged = options.skipIfUnchanged !== false;
  const batchSize = options.batchSize || 100; // Smaller default batch size
  
  if (activeSyncStatus?.status === "running") {
    return {
      ok: false,
      status: "running",
      message: "A sync is already in progress",
      syncId: activeSyncStatus.syncId
    };
  }
  
  const syncId = `sync_${Date.now()}`;
  const syncedAtIso = new Date().toISOString();
  const initialSources = createInitialSources();
  
  activeSyncStatus = {
    ok: true,
    status: "running",
    syncId,
    startedAt: syncedAtIso,
    mode: fullRefresh ? "full_refresh" : "incremental",
    step: "initializing",
    sources: initialSources,
    totalSources: initialSources.length,
    completedSources: 0,
    failedSources: 0,
    inProgressSources: 0,
    cancelRequested: false,
    rowCount: 0,
    transitionRowCount: 0,
    issueCount: 0,
    message: "Sync started (optimized for performance)"
  };
  
  try {
    throwIfStopRequested();
    activeSyncStatus.step = "ensuring_bigquery_tables";
    const table = await ensureTable();
    const transitionTable = await ensureTransitionTable();
    await ensureStateTable();
    
    const issueLimit = Number(process.env.SYNC_VALIDATION_MAX_ISSUES || 100); // Reduced from 500
    const syncIssues = [];
    
    activeSyncStatus.step = "reading_sheets";
    activeSyncStatus.message = "Reading tracker sheets (incremental mode)";
    
    // Use lighter options for incremental sync
    const rows = await privateSheetsService.loadAllRows(Boolean(options.forceRefresh), {
      issues: syncIssues,
      issueLimit,
      shouldAbort: () => isStopRequested(),
      onSourceStatus: (sourceUpdate) => {
        updateActiveSource(sourceUpdate);
        activeSyncStatus.message = "Reading tracker sheets (incremental mode)";
      }
    });
    
    throwIfStopRequested();
    activeSyncStatus.rowCount = rows.length;
    activeSyncStatus.issueCount = syncIssues.length;
    
    // Skip transition table processing for incremental syncs to save resources
    let transitionRows = [];
    if (fullRefresh) {
      activeSyncStatus.step = "building_transition_metrics";
      activeSyncStatus.message = "Reading legacy branding sheet for trend metrics";
      console.log("[BigQuery Sync] 📊 FULL REFRESH: Reading Google Sheets for legacy branding data");
      
      const rawBrandingData = await getBrandingSheetRawData();
      console.log(`[BigQuery Sync] ✅ Retrieved ${rawBrandingData.length} raw branding sheet rows`);
      transitionRows = toTransitionRows(syncId, syncedAtIso, rawBrandingData);
    } else {
      console.log("[BigQuery Sync] 🚀 INCREMENTAL SYNC: Skipping transition table update for better performance");
    }
    
    throwIfStopRequested();
    activeSyncStatus.transitionRowCount = transitionRows.length;
    activeSyncStatus.step = "preparing_bigquery_load";
    
    const checksum = computeChecksum(rows, transitionRows);
    const previousChecksum = await getLastChecksum();

    if (skipIfUnchanged && previousChecksum && previousChecksum === checksum) {
      const skipped = {
        ok: true,
        skipped: true,
        syncId,
        mode: fullRefresh ? "full_refresh" : "incremental",
        rowCount: rows.length,
        transitionRowCount: transitionRows.length,
        datasetId,
        tableId,
        transitionTableId,
        projectId,
        checksum,
        syncedAt: syncedAtIso,
        message: "No data change detected. BigQuery load skipped.",
        dataQuality: {
          issueCount: syncIssues.length,
          issues: syncIssues.slice(0, issueLimit)
        }
      };
      
      await writeState({
        sync_id: syncId,
        synced_at: syncedAtIso,
        status: "skipped",
        mode: skipped.mode,
        row_count: rows.length + transitionRows.length,
        checksum,
        message: skipped.message
      });
      
      lastSyncResult = skipped;
      activeSyncStatus = {
        ...activeSyncStatus,
        status: "completed",
        step: "completed",
        message: skipped.message,
        finishedAt: new Date().toISOString(),
        result: skipped
      };
      return skipped;
    }

    const bqRows = toBigQueryRows(rows, syncId, syncedAtIso);
    activeSyncStatus.step = "writing_bigquery";
    activeSyncStatus.message = `Writing data to BigQuery (batch size: ${batchSize})`;
    throwIfStopRequested();

    // Only truncate on full refresh
    if (fullRefresh) {
      console.log("[BigQuery Sync] 🗑️ FULL REFRESH: Truncating tables");
      await bigquery.query({
        query: `TRUNCATE TABLE \`${projectId}.${datasetId}.${tableId}\``,
        location: process.env.BIGQUERY_LOCATION || "US"
      });
      if (transitionRows.length > 0) {
        await bigquery.query({
          query: `TRUNCATE TABLE \`${projectId}.${datasetId}.${transitionTableId}\``,
          location: process.env.BIGQUERY_LOCATION || "US"
        });
      }
    }

    // Use smaller batches and add delays to reduce resource pressure
    for (let i = 0; i < bqRows.length; i += batchSize) {
      throwIfStopRequested();
      const batch = bqRows.slice(i, i + batchSize);
      if (batch.length) {
        await table.insert(batch);
        // Small delay between batches to reduce resource pressure
        if (i + batchSize < bqRows.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      activeSyncStatus.rowCount = Math.min(bqRows.length, i + batch.length);
    }
    
    // Only update transition table on full refresh
    if (transitionRows.length > 0) {
      activeSyncStatus.step = "writing_transition_table";
      for (let i = 0; i < transitionRows.length; i += batchSize) {
        throwIfStopRequested();
        const batch = transitionRows.slice(i, i + batchSize);
        if (batch.length) {
          await transitionTable.insert(batch);
          // Small delay between batches
          if (i + batchSize < transitionRows.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        activeSyncStatus.transitionRowCount = Math.min(transitionRows.length, i + batch.length);
      }
    }

    const result = {
      ok: true,
      syncId,
      mode: fullRefresh ? "full_refresh" : "incremental",
      rowCount: bqRows.length,
      transitionRowCount: transitionRows.length,
      datasetId,
      tableId,
      transitionTableId,
      projectId,
      checksum,
      syncedAt: syncedAtIso,
      dataQuality: {
        issueCount: syncIssues.length,
        issues: syncIssues.slice(0, issueLimit)
      }
    };
    
    await writeState({
      sync_id: syncId,
      synced_at: syncedAtIso,
      status: "success",
      mode: result.mode,
      row_count: bqRows.length + transitionRows.length,
      checksum,
      message: "Sync completed (optimized)"
    });
    
    lastSyncResult = result;
    activeSyncStatus = {
      ...activeSyncStatus,
      status: "completed",
      step: "completed",
      message: "Sync completed (optimized)",
      finishedAt: new Date().toISOString(),
      result
    };
    
    console.log(`[BigQuery Sync] ✅ ${result.mode.toUpperCase()} completed: ${result.rowCount} rows, ${result.transitionRowCount} transition rows`);
    return result;
    
  } catch (error) {
    // ... error handling remains the same
    if (error?.code === "SYNC_STOPPED") {
      const stopped = {
        ok: false,
        stopped: true,
        syncId,
        mode: fullRefresh ? "full_refresh" : "incremental",
        rowCount: Number(activeSyncStatus?.rowCount || 0),
        transitionRowCount: Number(activeSyncStatus?.transitionRowCount || 0),
        datasetId,
        tableId,
        transitionTableId,
        projectId,
        syncedAt: syncedAtIso,
        message: "Sync stopped by admin"
      };
      try {
        await writeState({
          sync_id: syncId,
          synced_at: new Date().toISOString(),
          status: "stopped",
          mode: stopped.mode,
          row_count: stopped.rowCount + stopped.transitionRowCount,
          checksum: null,
          message: stopped.message
        });
      } catch (_ignored) {
        // no-op
      }
      lastSyncResult = stopped;
      activeSyncStatus = {
        ...activeSyncStatus,
        ok: false,
        status: "stopped",
        step: "stopped",
        message: stopped.message,
        finishedAt: new Date().toISOString(),
        result: stopped
      };
      return stopped;
    }
    const message = `BigQuery sync failed (${syncId}): ${error.message}`;
    try {
      await writeState({
        sync_id: syncId,
        synced_at: syncedAtIso,
        status: "failed",
        mode: fullRefresh ? "full_refresh" : "incremental",
        row_count: 0,
        checksum: null,
        message
      });
    } catch (_ignored) {
      // no-op
    }
    activeSyncStatus = {
      ...activeSyncStatus,
      ok: false,
      status: "failed",
      step: "failed",
      message: error.message,
      finishedAt: new Date().toISOString(),
      error: error.message
    };
    throw error;
  }
}

function getLastSyncResult() {
  return lastSyncResult;
}

function getSyncStatus() {
  if (activeSyncStatus?.status === "running") return activeSyncStatus;
  if (activeSyncStatus) return activeSyncStatus;
  return lastSyncResult || { ok: true, status: "idle", message: "No sync has run yet" };
}

function startSync(options = {}) {
  if (activeSyncStatus?.status === "running") {
    return {
      ok: false,
      status: "running",
      message: "A sync is already in progress",
      syncId: activeSyncStatus.syncId
    };
  }
  currentSyncPromise = syncToBigQuery(options)
    .catch(() => null)
    .finally(() => {
      currentSyncPromise = null;
    });
  return {
    ok: true,
    status: "started",
    syncId: activeSyncStatus?.syncId || null,
    message: "Sync started"
  };
}

function requestStopSync() {
  if (!activeSyncStatus || activeSyncStatus.status !== "running") {
    return { ok: false, status: "idle", message: "No active sync to stop" };
  }
  activeSyncStatus.cancelRequested = true;
  activeSyncStatus.message = "Stop requested by admin";
  activeSyncStatus.step = "stopping";
  return { ok: true, status: "stopping", syncId: activeSyncStatus.syncId, message: "Stop request accepted" };
}

async function getLastSyncTime() {
  try {
    const [rows] = await bigquery.query({
      query: `
        SELECT synced_at
        FROM \`${projectId}.${datasetId}.${stateTableId}\`
        WHERE status = 'success'
        ORDER BY synced_at DESC
        LIMIT 1
      `,
      location: process.env.BIGQUERY_LOCATION || "US"
    });
    if (!rows || rows.length === 0) return null;
    const raw = rows[0].synced_at;
    // BigQuery TIMESTAMP comes back as a BigQuery date object or ISO string
    const iso = raw?.value || raw || null;
    return iso ? new Date(iso).toISOString() : null;
  } catch {
    return null;
  }
}

module.exports = {
  syncToBigQuery,
  getLastSyncResult,
  getSyncStatus,
  startSync,
  requestStopSync,
  getLastSyncTime
};
