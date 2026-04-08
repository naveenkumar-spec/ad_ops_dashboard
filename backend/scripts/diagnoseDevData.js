const path = require("path");
const { BigQuery } = require("@google-cloud/bigquery");

// Use development dataset
const projectId = process.env.GCP_PROJECT_ID || "tactile-petal-820";
const datasetId = "adops_dashboard_dev"; // DEVELOPMENT dataset
const tableId = "campaign_tracker_consolidated";

const keyFileFromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || "./secrets/google-sa.json";
const keyFilename = path.isAbsolute(keyFileFromEnv)
  ? keyFileFromEnv
  : path.resolve(__dirname, "..", keyFileFromEnv);

const bigquery = new BigQuery({
  projectId,
  keyFilename
});

async function diagnoseDevelopmentData() {
  console.log("\n=== DEVELOPMENT DATA DIAGNOSTIC ===");
  console.log(`Project: ${projectId}`);
  console.log(`Dataset: ${datasetId}`);
  console.log(`Table: ${tableId}\n`);

  try {
    // 1. Total row count
    const [totalRows] = await bigquery.query({
      query: `SELECT COUNT(*) as total FROM \`${projectId}.${datasetId}.${tableId}\``,
      location: "US"
    });
    console.log(`📊 Total rows: ${totalRows[0].total}`);

    // 2. Unique campaigns
    const [campaigns] = await bigquery.query({
      query: `SELECT COUNT(DISTINCT campaign_id) as unique_campaigns FROM \`${projectId}.${datasetId}.${tableId}\``,
      location: "US"
    });
    console.log(`📋 Unique campaigns: ${campaigns[0].unique_campaigns}`);

    // 3. Row count by country
    const [countryRows] = await bigquery.query({
      query: `
        SELECT 
          country,
          COUNT(*) as row_count,
          COUNT(DISTINCT campaign_id) as unique_campaigns,
          MIN(synced_at) as first_sync,
          MAX(synced_at) as last_sync
        FROM \`${projectId}.${datasetId}.${tableId}\`
        GROUP BY country
        ORDER BY row_count DESC
      `,
      location: "US"
    });

    console.log("\n📍 Rows by Country:");
    console.log("─".repeat(80));
    countryRows.forEach(row => {
      const lastSync = row.last_sync?.value || row.last_sync;
      console.log(`${row.country.padEnd(20)} | Rows: ${String(row.row_count).padStart(6)} | Campaigns: ${String(row.unique_campaigns).padStart(4)} | Last Sync: ${lastSync}`);
    });

    // 4. Recent sync history
    const [syncHistory] = await bigquery.query({
      query: `
        SELECT 
          sync_id,
          synced_at,
          COUNT(*) as row_count,
          COUNT(DISTINCT country) as countries
        FROM \`${projectId}.${datasetId}.${tableId}\`
        GROUP BY sync_id, synced_at
        ORDER BY synced_at DESC
        LIMIT 10
      `,
      location: "US"
    });

    console.log("\n🕐 Recent Sync History:");
    console.log("─".repeat(80));
    syncHistory.forEach(row => {
      const syncedAt = row.synced_at?.value || row.synced_at;
      console.log(`${row.sync_id.padEnd(25)} | ${syncedAt} | Rows: ${String(row.row_count).padStart(6)} | Countries: ${row.countries}`);
    });

    // 5. Check sync state table
    const stateTableId = "campaign_tracker_sync_state";
    const [syncStates] = await bigquery.query({
      query: `
        SELECT 
          sync_id,
          synced_at,
          status,
          mode,
          row_count,
          message
        FROM \`${projectId}.${datasetId}.${stateTableId}\`
        ORDER BY synced_at DESC
        LIMIT 10
      `,
      location: "US"
    });

    console.log("\n📝 Sync State History:");
    console.log("─".repeat(80));
    syncStates.forEach(row => {
      const syncedAt = row.synced_at?.value || row.synced_at;
      const message = row.message || 'N/A';
      console.log(`${row.sync_id.padEnd(25)} | ${syncedAt} | ${row.status.padEnd(10)} | ${(row.mode || 'N/A').padEnd(15)} | Rows: ${String(row.row_count || 0).padStart(5)} | ${message.substring(0, 40)}`);
    });

    console.log("\n✅ Diagnostic complete!\n");

  } catch (error) {
    console.error("\n❌ Error running diagnostic:", error.message);
    console.error(error);
  }
}

diagnoseDevelopmentData();
