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
const stateTableId = process.env.BIGQUERY_SYNC_STATE_TABLE_ID || "campaign_tracker_sync_state";

const bigquery = new BigQuery({
  projectId: projectId || undefined,
  keyFilename
});

let lastSyncResult = null;

const TABLE_SCHEMA = [
  { name: "sync_id", type: "STRING" },
  { name: "synced_at", type: "TIMESTAMP" },
  { name: "campaign_name", type: "STRING" },
  { name: "status", type: "STRING" },
  { name: "country", type: "STRING" },
  { name: "region", type: "STRING" },
  { name: "revenue", type: "FLOAT" },
  { name: "spend", type: "FLOAT" },
  { name: "gross_profit", type: "FLOAT" },
  { name: "gross_margin_pct", type: "FLOAT" },
  { name: "net_margin", type: "FLOAT" },
  { name: "net_margin_pct", type: "FLOAT" },
  { name: "planned_impressions", type: "FLOAT" },
  { name: "delivered_impressions", type: "FLOAT" },
  { name: "budget_groups", type: "INT64" },
  { name: "cpm", type: "FLOAT" },
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

function computeChecksum(rows) {
  const canonical = rows
    .map((r) => [
      r.campaignName || "",
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
  return crypto.createHash("sha256").update(canonical).digest("hex");
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
  return rows.map((row) => ({
    sync_id: syncId,
    synced_at: syncedAtIso,
    campaign_name: row.campaignName || null,
    status: row.status || null,
    country: row.country || null,
    region: row.region || null,
    revenue: Number(row.revenue || 0),
    spend: Number(row.spend || 0),
    gross_profit: Number(row.grossProfit || 0),
    gross_margin_pct: Number(row.grossMarginPct || 0),
    net_margin: Number(row.netMargin || 0),
    net_margin_pct: Number(row.netMarginPct || 0),
    planned_impressions: Number(row.plannedImpressions || 0),
    delivered_impressions: Number(row.deliveredImpressions || 0),
    budget_groups: Math.round(Number(row.budgetGroups || 0)),
    cpm: Number(row.cpm || 0),
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

async function syncToBigQuery(options = {}) {
  const fullRefresh = options.fullRefresh !== false;
  const skipIfUnchanged = options.skipIfUnchanged !== false;
  const syncId = `sync_${Date.now()}`;
  const syncedAtIso = new Date().toISOString();
  try {
    const table = await ensureTable();
    await ensureStateTable();
    const rows = await privateSheetsService.loadAllRows(Boolean(options.forceRefresh));
    const checksum = computeChecksum(rows);
    const previousChecksum = await getLastChecksum();

    if (skipIfUnchanged && previousChecksum && previousChecksum === checksum) {
      const skipped = {
        ok: true,
        skipped: true,
        syncId,
        mode: fullRefresh ? "full_refresh" : "append",
        rowCount: rows.length,
        datasetId,
        tableId,
        projectId,
        checksum,
        syncedAt: syncedAtIso,
        message: "No data change detected. BigQuery load skipped."
      };
      await writeState({
        sync_id: syncId,
        synced_at: syncedAtIso,
        status: "skipped",
        mode: skipped.mode,
        row_count: rows.length,
        checksum,
        message: skipped.message
      });
      lastSyncResult = skipped;
      return skipped;
    }

    const bqRows = toBigQueryRows(rows, syncId, syncedAtIso);

    if (fullRefresh) {
      await bigquery.query({
        query: `TRUNCATE TABLE \`${projectId}.${datasetId}.${tableId}\``,
        location: process.env.BIGQUERY_LOCATION || "US"
      });
    }

    const batchSize = 500;
    for (let i = 0; i < bqRows.length; i += batchSize) {
      const batch = bqRows.slice(i, i + batchSize);
      if (batch.length) await table.insert(batch);
    }

    const result = {
      ok: true,
      syncId,
      mode: fullRefresh ? "full_refresh" : "append",
      rowCount: bqRows.length,
      datasetId,
      tableId,
      projectId,
      checksum,
      syncedAt: syncedAtIso
    };
    await writeState({
      sync_id: syncId,
      synced_at: syncedAtIso,
      status: "success",
      mode: result.mode,
      row_count: bqRows.length,
      checksum,
      message: "Sync completed"
    });
    lastSyncResult = result;
    return result;
  } catch (error) {
    const message = `BigQuery sync failed (${syncId}): ${error.message}`;
    try {
      await writeState({
        sync_id: syncId,
        synced_at: syncedAtIso,
        status: "failed",
        mode: fullRefresh ? "full_refresh" : "append",
        row_count: 0,
        checksum: null,
        message
      });
    } catch (_ignored) {
      // no-op
    }
    try {
      await alertService.sendAlert("AdOps BigQuery Sync Failed", `${message}\nProject: ${projectId}\nDataset: ${datasetId}\nTable: ${tableId}`);
    } catch (_ignored) {
      // no-op
    }
    throw error;
  }
}

function getLastSyncResult() {
  return lastSyncResult;
}

module.exports = {
  syncToBigQuery,
  getLastSyncResult
};
