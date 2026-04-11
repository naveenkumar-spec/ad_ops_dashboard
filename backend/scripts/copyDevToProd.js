const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const bigquery = new BigQuery({
  projectId: 'tactile-petal-820',
  keyFilename: path.resolve(__dirname, '../secrets/google-sa.json')
});

async function copyDevToProd() {
  console.log('🔄 Copying data from DEV to PROD...\n');
  
  // Step 1: Clear production table
  console.log('Step 1: Clearing production table...');
  await bigquery.query({
    query: `TRUNCATE TABLE \`tactile-petal-820.adops_dashboard.campaign_tracker_consolidated\``,
    location: 'US'
  });
  console.log('✅ Production table cleared\n');
  
  // Step 2: Copy all data from dev to prod
  console.log('Step 2: Copying data from dev to prod...');
  await bigquery.query({
    query: `
      INSERT INTO \`tactile-petal-820.adops_dashboard.campaign_tracker_consolidated\`
      SELECT * FROM \`tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated\`
    `,
    location: 'US'
  });
  console.log('✅ Data copied from dev to prod\n');
  
  // Step 3: Verify row counts
  console.log('Step 3: Verifying row counts...');
  
  const [devRows] = await bigquery.query({
    query: `SELECT COUNT(*) as count FROM \`tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated\``,
    location: 'US'
  });
  
  const [prodRows] = await bigquery.query({
    query: `SELECT COUNT(*) as count FROM \`tactile-petal-820.adops_dashboard.campaign_tracker_consolidated\``,
    location: 'US'
  });
  
  console.log(`Dev rows: ${devRows[0].count}`);
  console.log(`Prod rows: ${prodRows[0].count}`);
  
  if (devRows[0].count === prodRows[0].count) {
    console.log('\n✅ SUCCESS! Dev and Prod have the same number of rows');
  } else {
    console.log('\n⚠️  WARNING! Row counts do not match');
  }
  
  // Step 4: Copy sync state
  console.log('\nStep 4: Copying sync state...');
  await bigquery.query({
    query: `TRUNCATE TABLE \`tactile-petal-820.adops_dashboard.campaign_tracker_sync_state\``,
    location: 'US'
  });
  
  await bigquery.query({
    query: `
      INSERT INTO \`tactile-petal-820.adops_dashboard.campaign_tracker_sync_state\`
      SELECT * FROM \`tactile-petal-820.adops_dashboard_dev.campaign_tracker_sync_state\`
    `,
    location: 'US'
  });
  console.log('✅ Sync state copied\n');
  
  // Step 5: Show data distribution
  console.log('Step 5: Production data distribution:');
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
  
  monthRows.forEach(r => console.log(`  ${r.year} ${r.month}: ${r.row_count} rows`));
  
  console.log('\n🎉 Copy complete! Production now matches dev dataset.');
}

copyDevToProd().catch(console.error);
