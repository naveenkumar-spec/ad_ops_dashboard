const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const bigquery = new BigQuery({
  projectId: 'tactile-petal-820',
  keyFilename: path.resolve(__dirname, '../secrets/google-sa.json')
});

async function checkProdData() {
  console.log('Checking PRODUCTION dataset (adops_dashboard)...\n');
  
  // Total rows
  const [rows] = await bigquery.query({
    query: `
      SELECT COUNT(*) as total_rows
      FROM \`tactile-petal-820.adops_dashboard.campaign_tracker_consolidated\`
    `,
    location: 'US'
  });
  console.log('Total rows in PRODUCTION:', rows[0].total_rows);
  
  // Count by sync_id
  const [syncIdRows] = await bigquery.query({
    query: `
      SELECT sync_id, COUNT(*) as row_count
      FROM \`tactile-petal-820.adops_dashboard.campaign_tracker_consolidated\`
      GROUP BY sync_id
      ORDER BY row_count DESC
      LIMIT 20
    `,
    location: 'US'
  });
  console.log('\nRows by sync_id (top 20):');
  syncIdRows.forEach(r => console.log(`  ${r.sync_id}: ${r.row_count} rows`));
  
  // Unique sync_ids
  const [uniqueSyncIds] = await bigquery.query({
    query: `
      SELECT COUNT(DISTINCT sync_id) as unique_sync_ids
      FROM \`tactile-petal-820.adops_dashboard.campaign_tracker_consolidated\`
    `,
    location: 'US'
  });
  console.log('\nTotal unique sync_ids:', uniqueSyncIds[0].unique_sync_ids);
  
  // Data by month
  const [monthRows] = await bigquery.query({
    query: `
      SELECT year, month, COUNT(*) as row_count
      FROM \`tactile-petal-820.adops_dashboard.campaign_tracker_consolidated\`
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
  
  // Check for duplicates
  const [duplicates] = await bigquery.query({
    query: `
      SELECT 
        campaign_id, 
        campaign_name,
        month, 
        year, 
        country, 
        COUNT(*) as versions,
        COUNT(DISTINCT sync_id) as different_syncs
      FROM \`tactile-petal-820.adops_dashboard.campaign_tracker_consolidated\`
      GROUP BY campaign_id, campaign_name, month, year, country
      HAVING COUNT(*) > 1
      ORDER BY versions DESC
      LIMIT 10
    `,
    location: 'US'
  });
  
  if (duplicates.length > 0) {
    console.log('\n⚠️  DUPLICATES FOUND (same campaign in multiple syncs):');
    duplicates.forEach(d => {
      console.log(`  ${d.campaign_name} (${d.country}) - ${d.month} ${d.year}: ${d.versions} versions from ${d.different_syncs} different syncs`);
    });
  }
  
  // Recent syncs
  const [syncRows] = await bigquery.query({
    query: `
      SELECT sync_id, synced_at, status, mode, row_count, message
      FROM \`tactile-petal-820.adops_dashboard.campaign_tracker_sync_state\`
      ORDER BY synced_at DESC
      LIMIT 10
    `,
    location: 'US'
  });
  console.log('\nRecent syncs:');
  syncRows.forEach(r => {
    const syncedAt = r.synced_at.value || r.synced_at;
    console.log(`  ${syncedAt}: ${r.mode} - ${r.row_count} rows - ${r.message}`);
  });
}

checkProdData().catch(console.error);
