const cron = require("node-cron");
const bigQuerySyncService = require("./bigQuerySyncService");

let scheduledTask = null;
let lastScheduledRun = null;

const cron = require("node-cron");
const bigQuerySyncService = require("./bigQuerySyncService");

let scheduledTask = null;
let transitionTask = null;
let lastScheduledRun = null;
let lastTransitionRun = null;

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

  // Transition table refresh mode
  const transitionMode = String(process.env.TRANSITION_TABLE_REFRESH_MODE || "daily").toLowerCase();
  const transitionCron = process.env.TRANSITION_TABLE_DAILY_CRON || "0 0 * * *"; // Daily at midnight

  // Main hourly sync (tracker data only for incremental)
  scheduledTask = cron.schedule(cronExpr, async () => {
    const startedAt = new Date().toISOString();
    console.log("[BigQuery Scheduler] Starting scheduled sync (incremental)...");
    
    try {
      const result = await bigQuerySyncService.syncToBigQuery({
        fullRefresh: false, // Incremental sync for hourly
        forceRefresh: false,
        skipIfUnchanged: true,
        batchSize: 100
      });
      
      lastScheduledRun = { ok: true, startedAt, result };
      if (result.skipped) {
        console.log("[BigQuery Scheduler] No change detected. Incremental sync skipped.");
      } else {
        console.log(`[BigQuery Scheduler] Incremental sync success: ${result.rowCount} rows`);
      }
    } catch (error) {
      lastScheduledRun = { ok: false, startedAt, error: error.message };
      console.error(`[BigQuery Scheduler] Incremental sync failed: ${error.message}`);
    }
  });

  // Transition table refresh based on mode
  if (transitionMode === "hourly") {
    console.log("[BigQuery Scheduler] Transition table will update hourly (with tracker sync)");
    // Modify the hourly task to include transition updates
    scheduledTask.destroy();
    scheduledTask = cron.schedule(cronExpr, async () => {
      const startedAt = new Date().toISOString();
      console.log("[BigQuery Scheduler] Starting scheduled sync (with transition table)...");
      
      try {
        const result = await bigQuerySyncService.syncToBigQuery({
          fullRefresh: true, // Full refresh to update transition table
          forceRefresh: false,
          skipIfUnchanged: true,
          batchSize: 100
        });
        
        lastScheduledRun = { ok: true, startedAt, result };
        if (result.skipped) {
          console.log("[BigQuery Scheduler] No change detected. Full sync skipped.");
        } else {
          console.log(`[BigQuery Scheduler] Full sync success: ${result.rowCount} rows, ${result.transitionRowCount} transition rows`);
        }
      } catch (error) {
        lastScheduledRun = { ok: false, startedAt, error: error.message };
        console.error(`[BigQuery Scheduler] Full sync failed: ${error.message}`);
      }
    });
  } else if (transitionMode === "daily") {
    console.log(`[BigQuery Scheduler] Transition table will update daily at: ${transitionCron}`);
    // Separate daily task for transition table
    transitionTask = cron.schedule(transitionCron, async () => {
      const startedAt = new Date().toISOString();
      console.log("[BigQuery Scheduler] Starting daily transition table refresh...");
      
      try {
        const result = await bigQuerySyncService.syncToBigQuery({
          fullRefresh: true, // Full refresh for transition table
          forceRefresh: true, // Force refresh for daily update
          skipIfUnchanged: false,
          batchSize: 100
        });
        
        lastTransitionRun = { ok: true, startedAt, result };
        console.log(`[BigQuery Scheduler] Daily transition refresh success: ${result.rowCount} rows, ${result.transitionRowCount} transition rows`);
      } catch (error) {
        lastTransitionRun = { ok: false, startedAt, error: error.message };
        console.error(`[BigQuery Scheduler] Daily transition refresh failed: ${error.message}`);
      }
    });
  } else {
    console.log("[BigQuery Scheduler] Transition table updates: Manual only");
  }

  console.log(`[BigQuery Scheduler] Tracker sync: ${cronExpr} (incremental)`);
  console.log(`[BigQuery Scheduler] Transition refresh mode: ${transitionMode}`);
  
  return { 
    enabled: true, 
    cron: cronExpr,
    transitionMode,
    transitionCron: transitionMode === "daily" ? transitionCron : null
  };
}

function getSchedulerStatus() {
  return {
    running: Boolean(scheduledTask),
    transitionTaskRunning: Boolean(transitionTask),
    lastScheduledRun,
    lastTransitionRun
  };
}

module.exports = {
  startBigQueryScheduler,
  getSchedulerStatus
};
