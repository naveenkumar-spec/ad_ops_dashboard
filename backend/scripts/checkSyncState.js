const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const bigquery = new BigQuery({
  projectId: 'tactile-petal-820',
  keyFilename: path.resolve(__dirname, '../secrets/google-sa.json')
});

async function checkSyncState() {
  console.log('Checking sync_state table for last successful sync...\n');
  
  // Get last successful sync from state table
  const [rows] = await bigquery.query({
    query: `
      SELECT sync_id, synced_at, status, mode, row_count, message
      FROM \`tactile-petal-820.adops_dashboard.campaign_tracker_sync_state\`
      WHERE status = 'success'
      ORDER BY synced_at DESC
      LIMIT 5
    `,
    location: 'US'
  });
  
  console.log('Last 5 successful syncs:');
  rows.forEach((r, i) => {
    const syncedAt = r.synced_at.value || r.synced_at;
    const date = new Date(syncedAt);
    console.log(`\n${i + 1}. Sync ID: ${r.sync_id}`);
    console.log(`   Synced At (raw): ${syncedAt}`);
    console.log(`   Synced At (ISO): ${date.toISOString()}`);
    console.log(`   Synced At (IST): ${date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`   Mode: ${r.mode}`);
    console.log(`   Rows: ${r.row_count}`);
    console.log(`   Message: ${r.message}`);
  });
  
  // Check what the API would return
  const lastSync = rows[0];
  if (lastSync) {
    const raw = lastSync.synced_at;
    const iso = raw?.value || raw || null;
    const isoString = iso ? new Date(iso).toISOString() : null;
    console.log(`\n📡 API would return: ${isoString}`);
    console.log(`📅 Which in IST is: ${new Date(isoString).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
  }
}

checkSyncState().catch(console.error);
