const { BigQuery } = require('@google-cloud/bigquery');
const path = require('path');

const bigquery = new BigQuery({
  projectId: 'tactile-petal-820',
  keyFilename: path.resolve(__dirname, '../secrets/google-sa.json')
});

const tableRef = '`tactile-petal-820.adops_dashboard_dev.campaign_tracker_consolidated`';

async function testQuery() {
  console.log('Testing new query that gets latest data for each row...\n');
  
  // New query - gets latest version of each row
  const [rows] = await bigquery.query({
    query: `
      SELECT COUNT(*) as total_rows
      FROM (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY campaign_id, month, year, country 
            ORDER BY synced_at DESC
          ) AS rn
        FROM ${tableRef}
      )
      WHERE rn = 1
    `,
    location: 'US'
  });
  console.log('Total rows with new query:', rows[0].total_rows);
  
  // Check month distribution
  const [monthRows] = await bigquery.query({
    query: `
      SELECT year, month, COUNT(*) as row_count
      FROM (
        SELECT *,
          ROW_NUMBER() OVER (
            PARTITION BY campaign_id, month, year, country 
            ORDER BY synced_at DESC
          ) AS rn
        FROM ${tableRef}
      )
      WHERE rn = 1
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
  console.log('\nData by month (new query):');
  monthRows.forEach(r => console.log(`  ${r.year} ${r.month}: ${r.row_count} rows`));
  
  console.log('\n✅ New query should show ALL historical data!');
}

testQuery().catch(console.error);
