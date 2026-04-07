/**
 * Copy Production Data to Dev Dataset
 * 
 * This script copies all tables from production dataset to dev dataset.
 * Use this to populate dev with production data for realistic testing.
 * 
 * Usage: node scripts/copyProdToDev.js
 */

const path = require("path");
const { BigQuery } = require("@google-cloud/bigquery");

const keyFileFromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || "./secrets/google-sa.json";
const keyFilename = path.isAbsolute(keyFileFromEnv)
  ? keyFileFromEnv
  : path.resolve(__dirname, "..", keyFileFromEnv);

const projectId = process.env.GCP_PROJECT_ID || "tactile-petal-820";
const prodDataset = "adops_dashboard";
const devDataset = "adops_dashboard_dev";
const location = process.env.BIGQUERY_LOCATION || "US";

const bigquery = new BigQuery({
  projectId,
  keyFilename
});

async function createDevDataset() {
  console.log(`\n📊 Creating dev dataset: ${devDataset}...`);
  
  try {
    const [dataset] = await bigquery.createDataset(devDataset, {
      location
    });
    console.log(`✅ Dataset ${dataset.id} created successfully`);
  } catch (error) {
    if (error.code === 409) {
      console.log(`ℹ️  Dataset ${devDataset} already exists`);
    } else {
      throw error;
    }
  }
}

async function copyTable(tableName) {
  console.log(`\n📋 Copying table: ${tableName}...`);
  
  const sourceTable = `${projectId}.${prodDataset}.${tableName}`;
  const destTable = `${projectId}.${devDataset}.${tableName}`;
  
  try {
    // Check if source table exists
    const [exists] = await bigquery
      .dataset(prodDataset)
      .table(tableName)
      .exists();
    
    if (!exists) {
      console.log(`⚠️  Source table ${tableName} does not exist in production, skipping...`);
      return;
    }
    
    // Copy table using SQL query
    const query = `
      CREATE OR REPLACE TABLE \`${destTable}\`
      AS SELECT * FROM \`${sourceTable}\`
    `;
    
    console.log(`   Running: CREATE OR REPLACE TABLE ${devDataset}.${tableName}...`);
    const [job] = await bigquery.createQueryJob({
      query,
      location
    });
    
    await job.getQueryResults();
    
    // Get row count
    const countQuery = `SELECT COUNT(*) as count FROM \`${destTable}\``;
    const [rows] = await bigquery.query({ query: countQuery, location });
    const rowCount = rows[0].count;
    
    console.log(`✅ Table ${tableName} copied successfully (${rowCount} rows)`);
  } catch (error) {
    console.error(`❌ Error copying table ${tableName}:`, error.message);
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     Copy Production Data to Dev Dataset                   ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log(`\nProject: ${projectId}`);
  console.log(`Source: ${prodDataset} (production)`);
  console.log(`Destination: ${devDataset} (development)`);
  console.log(`Location: ${location}`);
  
  try {
    // Step 1: Create dev dataset
    await createDevDataset();
    
    // Step 2: Copy all tables
    const tablesToCopy = [
      "campaign_tracker_consolidated",
      "overview_transition_metrics",
      "campaign_tracker_sync_state",
      "users"
    ];
    
    console.log(`\n📦 Tables to copy: ${tablesToCopy.length}`);
    
    for (const tableName of tablesToCopy) {
      await copyTable(tableName);
    }
    
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║                    ✅ COPY COMPLETE                        ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log(`\nDev dataset ${devDataset} is now populated with production data.`);
    console.log(`You can now safely test changes without affecting production.`);
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

main();
