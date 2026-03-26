const cron = require("node-cron");
const bigQuerySyncService = require("./bigQuerySyncService");

let scheduledTask = null;
let lastScheduledRun = null;

function startBigQueryScheduler() {
  const enabled = String(process.env.BIGQUERY_SYNC_ENABLED || "false").toLowerCase() === "true";
  if (!enabled) {
    return { enabled: false, reason: "BIGQUERY_SYNC_ENABLED is false" };
  }

  const cronExpr = process.env.BIGQUERY_SYNC_CRON || "*/30 * * * *";
  if (!cron.validate(cronExpr)) {
    return { enabled: false, reason: `Invalid cron expression: ${cronExpr}` };
  }

  scheduledTask = cron.schedule(cronExpr, async () => {
    const startedAt = new Date().toISOString();
    try {
      const result = await bigQuerySyncService.syncToBigQuery({
        fullRefresh: String(process.env.BIGQUERY_SYNC_FULL_REFRESH || "true").toLowerCase() !== "false",
        forceRefresh: true,
        skipIfUnchanged: String(process.env.BIGQUERY_SKIP_IF_UNCHANGED || "true").toLowerCase() !== "false"
      });
      lastScheduledRun = { ok: true, startedAt, result };
      if (result.skipped) {
        console.log("[BigQuery Scheduler] No change detected. Sync skipped.");
      } else {
        console.log(`[BigQuery Scheduler] Sync success: ${result.rowCount} rows`);
      }
    } catch (error) {
      lastScheduledRun = { ok: false, startedAt, error: error.message };
      console.error(`[BigQuery Scheduler] Sync failed: ${error.message}`);
    }
  });

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
