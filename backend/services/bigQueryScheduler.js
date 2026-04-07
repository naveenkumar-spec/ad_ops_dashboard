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
  const transitionMode = "daily"; // Set to daily mode
  const transitionCron = "30 18 * * *"; // 12 AM IST = 6:30 PM UTC (previous day)

  // Main hourly sync (recent data only for performance)
  scheduledTask = cron.schedule(cronExpr, async () => {
    const startedAt = new Date().toISOString();
    console.log("[BigQuery Scheduler] Starting scheduled sync (recent 2 months only)...");
    
    try {
      const result = await bigQuerySyncService.syncToBigQuery({
        fullRefresh: false,
        recentOnly: true,      // Only sync recent data
        monthsToSync: 2,       // Last 2 months
        forceRefresh: false,
        skipIfUnchanged: true,
        batchSize: 100
      });
      
      lastScheduledRun = { ok: true, startedAt, result };
      if (result.skipped) {
        console.log("[BigQuery Scheduler] No change detected. Recent sync skipped.");
      } else {
        console.log(`[BigQuery Scheduler] Recent sync success: ${result.rowCount}/${result.totalRowsRead} rows (last ${result.monthsSynced} months)`);
      }
    } catch (error) {
      lastScheduledRun = { ok: false, startedAt, error: error.message };
      console.error(`[BigQuery Scheduler] Recent sync failed: ${error.message}`);
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
    console.log(`[BigQuery Scheduler] Transition table will update daily at 12:00 AM IST (${transitionCron} UTC)`);
    // Separate daily task for transition table
    transitionTask = cron.schedule(transitionCron, async () => {
      const startedAt = new Date().toISOString();
      console.log("[BigQuery Scheduler] Starting daily transition table refresh (12:00 AM IST)...");
      
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

  console.log(`[BigQuery Scheduler] Tracker sync: ${cronExpr} (recent ${2} months only, hourly)`);
  console.log(`[BigQuery Scheduler] Transition refresh: Daily at 12:00 AM IST (${transitionCron} UTC)`);
  console.log(`[BigQuery Scheduler] Manual sync: Full refresh including all historical data`);
  
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
