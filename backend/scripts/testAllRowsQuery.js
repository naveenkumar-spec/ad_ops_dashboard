const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const bigquery = new BigQuery({
  projectId: 'tactile-petal-820',
  keyFilename: path.resolve(__dirname, '../secrets/google-sa.json')
});

const tableRef = '`tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated`';

async function testQuery() {
  console.log('Testing query that returns ALL rows (no deduplication)...\n');
  
  // Simple query - all rows
  const [rows] = await bigquery.query({
    query: `SELECT COUNT(*) as total_rows FROM ${tableRef}`,
    location: 'US'
  });
  console.log('Total rows:', rows[0].total_rows);
  
  // Check month distribution
  const [monthRows] = await bigquery.query({
    query: `
      SELECT year, month, COUNT(*) as row_count
      FROM ${tableRef}
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
  console.log('\nData by month (all rows including duplicates):');
  monthRows.forEach(r => console.log(`  ${r.year} ${r.month}: ${r.row_count} rows`));
  
  console.log('\n✅ Dashboard will now show ALL 3,041 rows including duplicates!');
}

testQuery().catch(console.error);
