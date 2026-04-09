const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const bigquery = new BigQuery({
  projectId: 'tactile-petal-820',
  keyFilename: path.resolve(__dirname, '../secrets/google-sa.json')
});

async function checkData() {
  console.log('Checking BigQuery data...\n');
  
  // Total rows
  const [rows] = await bigquery.query({
    query: `
      SELECT COUNT(*) as total_rows
      FROM \`tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated\`
    `,
    location: 'US'
  });
  console.log('Total rows:', rows[0].total_rows);
  
  // Data by month
  const [monthRows] = await bigquery.query({
    query: `
      SELECT year, month, COUNT(*) as row_count
      FROM \`tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated\`
      GROUP BY year, month
      ORDER BY year DESC, 
        CASE month
          WHEN 'January' THEN 1 WHEN 'February' THEN 2 WHEN 'March' THEN 3
          WHEN 'April' THEN 4 WHEN 'May' THEN 5 WHEN 'June' THEN 6
          WHEN 'July' THEN 7 WHEN 'August' THEN 8 WHEN 'September' THEN 9
          WHEN 'October' THEN 10 WHEN 'November' THEN 11 WHEN 'December' THEN 12
        END DESC
      LIMIT 20
    `,
    location: 'US'
  });
  console.log('\nData by month:');
  monthRows.forEach(r => console.log(`  ${r.year} ${r.month}: ${r.row_count} rows`));
  
  // Recent syncs
  const [syncRows] = await bigquery.query({
    query: `
      SELECT sync_id, synced_at, status, mode, row_count, message
      FROM \`tactile-petal-820.adops_dashboard_dev.campaign_tracker_sync_state\`
      ORDER BY synced_at DESC
      LIMIT 5
    `,
    location: 'US'
  });
  console.log('\nRecent syncs:');
  syncRows.forEach(r => {
    const syncedAt = r.synced_at.value || r.synced_at;
    console.log(`  ${syncedAt}: ${r.mode} - ${r.row_count} rows - ${r.message}`);
  });
  
  // Check for old data
  const [oldDataRows] = await bigquery.query({
    query: `
      SELECT COUNT(*) as old_data_count
      FROM \`tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated\`
      WHERE year < 2026 OR (year = 2026 AND month NOT IN ('March', 'April'))
    `,
    location: 'US'
  });
  console.log('\nHistorical data (not March/April 2026):', oldDataRows[0].old_data_count, 'rows');
}

checkData().catch(console.error);
