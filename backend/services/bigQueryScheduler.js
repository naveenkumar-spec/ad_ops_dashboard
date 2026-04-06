const cron = require("node-cron");
const bigQuerySyncService = require("./bigQuerySyncService");

let scheduledTask = null;
let lastScheduledRun = null;

function startBigQueryScheduler() {
  const enabledEnv = String(process.env.BIGQUERY_SYNC_ENABLED ?? "false").toLowerCase();
  const enabled = enabledEnv === "true";
  if (!enabled) {
    console.log("[BigQuery Scheduler] Sync disabled (BIGQUERY_SYNC_ENABLED is not 'true')");
    return { enabled: false, reason: "BIGQUERY_SYNC_ENABLED is not 'true'" };
  }

  const cronExpr = process.env.BIGQUERY_SYNC_CRON || "0 * * * *";
  if (!cron.validate(cronExpr)) {
    return { enabled: false, reason: `Invalid cron expression: ${cronExpr}` };
  }

  scheduledTask = cron.schedule(cronExpr, async () => {
    const startedAt = new Date().toISOString();
    console.log("[BigQuery Scheduler] Starting scheduled sync...");
    
    try {
      // Use incremental sync by default to reduce resource usage
      const result = await bigQuerySyncService.syncToBigQuery({
        fullRefresh: false, // Use incremental sync instead of full refresh
        forceRefresh: false, // Don't force refresh unless needed
        skipIfUnchanged: true, // Skip if no changes detected
        batchSize: 100 // Smaller batch size to reduce memory usage
      });
      
      lastScheduledRun = { ok: true, startedAt, result };
      if (result.skipped) {
        console.log("[BigQuery Scheduler] No change detected. Sync skipped.");
      } else {
        console.log(`[BigQuery Scheduler] Sync success: ${result.rowCount} rows, ${result.transitionRowCount} transition rows`);
      }
    } catch (error) {
      lastScheduledRun = { ok: false, startedAt, error: error.message };
      console.error(`[BigQuery Scheduler] Sync failed: ${error.message}`);
    }
  });

  console.log(`[BigQuery Scheduler] Scheduled with cron: ${cronExpr} (incremental mode for better performance)`);
  return { enabled: true, cron: cronExpr };
}

function getSchedulerStatus() {
  return {
    running: Boolean(scheduledTask),
    lastScheduledRun
  };
}

module.exports = {
  startBigQueryScheduler,
  getSchedulerStatus
};
