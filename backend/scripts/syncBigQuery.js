require("dotenv").config();
const bigQuerySyncService = require("../services/bigQuerySyncService");

async function main() {
  const fullRefresh = process.argv.includes("--append") ? false : true;
  const forceRefresh = process.argv.includes("--force-refresh");
  const skipIfUnchanged = process.argv.includes("--no-skip") ? false : true;
  const result = await bigQuerySyncService.syncToBigQuery({ fullRefresh, forceRefresh, skipIfUnchanged });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("BigQuery sync failed:", error.message);
  process.exit(1);
});
