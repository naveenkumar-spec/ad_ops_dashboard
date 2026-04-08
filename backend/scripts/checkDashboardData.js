const path = require("path");
const { BigQuery } = require("@google-cloud/bigquery");

const projectId = process.env.GCP_PROJECT_ID || "tactile-petal-820";
const datasetId = process.env.BIGQUERY_DATASET_ID || "adops_dashboard";
const tableId = "campaign_tracker_consolidated";

const keyFileFromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || "./secrets/google-sa.json";
const keyFilename = path.isAbsolute(keyFileFromEnv)
  ? keyFileFromEnv
  : path.resolve(__dirname, "..", keyFileFromEnv);

const bigquery = new BigQuery({
  projectId,
  keyFilename
});

async function checkDashboardData() {
  console.log("\n=== DASHBOARD DATA CHECK ===");
  console.log(`Project: ${projectId}`);
  console.log(`Dataset: ${datasetId}`);
  console.log(`Table: ${tableId}\n`);

  try {
    // 1. Check what dashboard query returns (with DISTINCT)
    console.log("1️⃣ Dashboard Query (with DISTINCT campaign_id):");
    const [distinctCampaigns] = await bigquery.query({
      query: `
        SELECT 
          COUNT(DISTINCT campaign_id) as unique_campaigns,
          SUM(budget_groups) as total_budget_groups
        FROM \`${projectId}.${datasetId}.${tableId}\`
      `,
      location: "US"
    });
    console.log(`   Unique Campaigns: ${distinctCampaigns[0].unique_campaigns}`);
    console.log(`   Total Budget Groups: ${distinctCampaigns[0].total_budget_groups}`);

    // 2. Check latest sync_id data only
    console.log("\n2️⃣ Latest Sync Data Only:");
    const [latestSync] = await bigquery.query({
      query: `
        WITH latest AS (
          SELECT sync_id
          FROM \`${projectId}.${datasetId}.${tableId}\`
          ORDER BY synced_at DESC
          LIMIT 1
        )
        SELECT 
          COUNT(*) as row_count,
          COUNT(DISTINCT campaign_id) as unique_campaigns,
          SUM(budget_groups) as total_budget_groups,
          MAX(synced_at) as sync_time
        FROM \`${projectId}.${datasetId}.${tableId}\`
        WHERE sync_id = (SELECT sync_id FROM latest)
      `,
      location: "US"
    });
    console.log(`   Rows: ${latestSync[0].row_count}`);
    console.log(`   Unique Campaigns: ${latestSync[0].unique_campaigns}`);
    console.log(`   Total Budget Groups: ${latestSync[0].total_budget_groups}`);
    console.log(`   Sync Time: ${latestSync[0].sync_time?.value || latestSync[0].sync_time}`);

    // 3. Check if dashboard is filtering by sync_id
    console.log("\n3️⃣ All Data (including duplicates):");
    const [allData] = await bigquery.query({
      query: `
        SELECT 
          COUNT(*) as total_rows,
          COUNT(DISTINCT campaign_id) as unique_campaigns,
          COUNT(DISTINCT sync_id) as sync_count,
          SUM(budget_groups) as total_budget_groups
        FROM \`${projectId}.${datasetId}.${tableId}\`
      `,
      location: "US"
    });
    console.log(`   Total Rows: ${allData[0].total_rows}`);
    console.log(`   Unique Campaigns: ${allData[0].unique_campaigns}`);
    console.log(`   Sync IDs: ${allData[0].sync_count}`);
    console.log(`   Total Budget Groups: ${allData[0].total_budget_groups}`);

    // 4. Check campaign distribution
    console.log("\n4️⃣ Campaign Distribution:");
    const [campaignDist] = await bigquery.query({
      query: `
        SELECT 
          campaign_id,
          campaign_name,
          COUNT(*) as occurrences,
          SUM(budget_groups) as total_budget_groups,
          STRING_AGG(DISTINCT sync_id ORDER BY sync_id DESC LIMIT 3) as sync_ids
        FROM \`${projectId}.${datasetId}.${tableId}\`
        GROUP BY campaign_id, campaign_name
        HAVING COUNT(*) > 1
        ORDER BY occurrences DESC
        LIMIT 10
      `,
      location: "US"
    });
    
    if (campaignDist.length > 0) {
      console.log(`   Found ${campaignDist.length} campaigns with duplicates:`);
      campaignDist.forEach(row => {
        console.log(`   - ${row.campaign_name}: ${row.occurrences} copies, ${row.total_budget_groups} budget groups`);
      });
    } else {
      console.log(`   No duplicates found`);
    }

    // 5. Check what the KPI query returns
    console.log("\n5️⃣ KPI Query (what dashboard uses):");
    const [kpiData] = await bigquery.query({
      query: `
        SELECT 
          COUNT(DISTINCT campaign_id) as campaigns,
          SUM(budget_groups) as budget_groups,
          SUM(revenue) as revenue,
          SUM(spend) as spend
        FROM \`${projectId}.${datasetId}.${tableId}\`
      `,
      location: "US"
    });
    console.log(`   Campaigns: ${kpiData[0].campaigns}`);
    console.log(`   Budget Groups: ${kpiData[0].budget_groups}`);
    console.log(`   Revenue: $${Math.round(kpiData[0].revenue).toLocaleString()}`);
    console.log(`   Spend: $${Math.round(kpiData[0].spend).toLocaleString()}`);

    // 6. Check if there's a sync_id filter issue
    console.log("\n6️⃣ Checking Sync ID Usage:");
    const [syncIds] = await bigquery.query({
      query: `
        SELECT 
          sync_id,
          COUNT(*) as row_count,
          COUNT(DISTINCT campaign_id) as campaigns,
          SUM(budget_groups) as budget_groups,
          MAX(synced_at) as synced_at
        FROM \`${projectId}.${datasetId}.${tableId}\`
        GROUP BY sync_id
        ORDER BY synced_at DESC
        LIMIT 5
      `,
      location: "US"
    });
    
    console.log(`   Recent Syncs:`);
    syncIds.forEach(row => {
      const syncTime = row.synced_at?.value || row.synced_at;
      console.log(`   ${row.sync_id}: ${row.row_count} rows, ${row.campaigns} campaigns, ${row.budget_groups} budget groups`);
    });

    console.log("\n✅ Check complete!\n");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
  }
}

checkDashboardData();
