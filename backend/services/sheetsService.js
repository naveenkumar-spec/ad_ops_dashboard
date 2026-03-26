const csv = require('csv-parser');
const https = require('https');

// Google Sheet Configuration
const SHEET_ID = '1XkX4rmGZCvVedTrdCKpCIUci78xuVerxWm6pqeKtjUI';
const SHEET_GID = '758688445';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

let cachedData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

console.log(`📊 Google Sheets Service initialized`);
console.log(`📄 CSV URL: ${CSV_URL}`);

// Fallback sample data
const FALLBACK_DATA = [
  {
    'Campaign Name': 'Sample Campaign 1',
    'Status': 'Active',
    'Revenue (USD)': '50000',
    'Spends (USD)': '25000',
    'Gross Profit %': '45',
    '% Net gross margin ': '30',
    'Country': 'United States',
    'Month': 'January',
    'Start Date': '2026-01-01',
    'Gross Profit': '25000'
  },
  {
    'Campaign Name': 'Sample Campaign 2',
    'Status': 'Completed',
    'Revenue (USD)': '75000',
    'Spends (USD)': '30000',
    'Gross Profit %': '55',
    '% Net gross margin ': '35',
    'Country': 'Canada',
    'Month': 'February',
    'Start Date': '2026-02-01',
    'Gross Profit': '45000'
  }
];

// Fetch CSV from Google Sheets
async function loadSheetData() {
  try {
    // Check if cache is still valid
    const now = Date.now();
    if (cachedData && (now - lastFetchTime) < CACHE_DURATION) {
      console.log(`✓ Using cached data (${cachedData.length} rows)`);
      return cachedData;
    }

    console.log(`⏳ Fetching data from Google Sheets...`);
    
    return new Promise((resolve, reject) => {
      const request = https.get(CSV_URL, { timeout: 10000 }, (response) => {
        console.log(`📡 Response status: ${response.statusCode}`);
        
        if (response.statusCode !== 200) {
          console.warn(`⚠️  Non-200 status code: ${response.statusCode}`);
          console.log(`ℹ️  Using fallback data instead`);
          cachedData = FALLBACK_DATA;
          lastFetchTime = Date.now();
          return resolve(FALLBACK_DATA);
        }

        const data = [];
        response
          .pipe(csv())
          .on('data', (row) => {
            data.push(row);
          })
          .on('end', () => {
            if (data.length === 0) {
              console.warn(`⚠️  No data received from sheet, using fallback`);
              cachedData = FALLBACK_DATA;
            } else {
              cachedData = data;
              console.log(`✓ Successfully loaded ${data.length} rows from Google Sheet`);
            }
            lastFetchTime = Date.now();
            resolve(cachedData);
          })
          .on('error', (error) => {
            console.error(`❌ CSV parsing error:`, error.message);
            console.log(`ℹ️  Using fallback data instead`);
            cachedData = FALLBACK_DATA;
            lastFetchTime = Date.now();
            resolve(FALLBACK_DATA);
          });
      }).on('error', (error) => {
        console.error(`❌ HTTPS request error:`, error.message);
        console.log(`ℹ️  Using fallback data instead`);
        cachedData = FALLBACK_DATA;
        lastFetchTime = Date.now();
        resolve(FALLBACK_DATA);
      });

      request.on('timeout', () => {
        console.error(`❌ Request timeout`);
        request.destroy();
        console.log(`ℹ️  Using fallback data instead`);
        cachedData = FALLBACK_DATA;
        lastFetchTime = Date.now();
        resolve(FALLBACK_DATA);
      });
    });
  } catch (error) {
    console.error(`❌ Error loading Google Sheet:`, error.message);
    console.log(`ℹ️  Using fallback data instead`);
    cachedData = FALLBACK_DATA;
    lastFetchTime = Date.now();
    return FALLBACK_DATA;
  }
}

// Calculate KPI metrics
function calculateKPIs(data) {
  const metrics = {
    totalCampaigns: data.length,
    totalBudgetGroups: 0,
    totalRevenue: 0,
    totalSpend: 0,
    averageGrossMargin: 0,
    averageNetMargin: 0
  };

  let grossMarginSum = 0;
  let netMarginSum = 0;
  let count = 0;

  data.forEach(row => {
    // Parse numeric values - handle various column name formats
    const revenue = parseFloat(row['Revenue (USD)'] || row['Revenue'] || 0) || 0;
    const spend = parseFloat(row['Spends (USD)'] || row['Spend'] || 0) || 0;
    const grossMarginPct = parseFloat(row['Gross Profit %'] || row['Gross Margin %'] || 0) || 0;
    const netMarginPct = parseFloat(row['% Net gross margin '] || row['Net Margin %'] || 0) || 0;

    metrics.totalRevenue += revenue;
    metrics.totalSpend += spend;
    grossMarginSum += grossMarginPct;
    netMarginSum += netMarginPct;
    count++;
  });

  metrics.averageGrossMargin = count > 0 ? (grossMarginSum / count).toFixed(2) : 0;
  metrics.averageNetMargin = count > 0 ? (netMarginSum / count).toFixed(2) : 0;
  metrics.totalRevenue = (metrics.totalRevenue / 1000000).toFixed(2);
  metrics.totalSpend = (metrics.totalSpend / 1000000).toFixed(2);

  return metrics;
}

// Get data by country
function getCountryData(data) {
  const countryMap = {};

  data.forEach(row => {
    const country = row['Country'] || 'Unknown';
    if (!countryMap[country]) {
      countryMap[country] = {
        region: country,
        campaigns: 0,
        budgetGroups: 0,
        bookedRevenue: 0,
        spend: 0,
        plannedImpressions: 0,
        deliveredImpressions: 0,
        grossProfit: 0,
        grossMargin: 0
      };
    }

    countryMap[country].campaigns += 1;
    countryMap[country].bookedRevenue += parseFloat(row['Revenue (USD)'] || 0) || 0;
    countryMap[country].spend += parseFloat(row['Spends (USD)'] || 0) || 0;
    countryMap[country].plannedImpressions += parseFloat(row['Planned Impressions / Views / Budget / Clicks'] || 0) || 0;
    countryMap[country].deliveredImpressions += parseFloat(row['Delivered Impressions'] || 0) || 0;
    countryMap[country].grossProfit += parseFloat(row['Gross Profit'] || 0) || 0;
    countryMap[country].grossMargin += parseFloat(row['Gross Profit %'] || 0) || 0;
  });

  return Object.values(countryMap).map(country => ({
    ...country,
    bookedRevenue: '$' + (country.bookedRevenue / 1000000).toFixed(2) + 'M',
    spend: '$' + (country.spend / 1000).toFixed(2) + 'K',
    plannedImpressions: (country.plannedImpressions / 1000000).toFixed(2) + 'M',
    deliveredImpressions: (country.deliveredImpressions / 1000000).toFixed(2) + 'M',
    grossProfit: '$' + (country.grossProfit / 1000000).toFixed(2) + 'M',
    grossMargin: (country.grossMargin / Math.max(data.length, 1)).toFixed(0) + '%'
  }));
}

// Get campaign data for table
function getCampaignData(data) {
  return data
    .filter(row => (parseFloat(row['Gross Profit %'] || 0) || 0) < 50)
    .map(row => ({
      campaign: row['Campaign Name'] || 'N/A',
      status: row['Status'] || 'N/A',
      bookedRevenue: '$' + ((parseFloat(row['Revenue (USD)'] || 0) / 1000000)).toFixed(2) + 'M',
      spend: '$' + (parseFloat(row['Spends (USD)'] || 0)).toFixed(2),
      grossProfit: '$' + ((parseFloat(row['Gross Profit'] || 0) / 1000)).toFixed(2) + 'K',
      grossMargin: (parseFloat(row['Gross Profit %'] || 0)).toFixed(2) + '%',
      netProfit: '$' + ((parseFloat(row['Net gross margin '] || 0) / 1000)).toFixed(2) + 'K',
      netMargin: (parseFloat(row['% Net gross margin '] || 0)).toFixed(2) + '%'
    }))
    .slice(0, 4);
}

// Get monthly trend data
function getMonthlyTrendData(data) {
  const monthMap = {};
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  months.forEach(month => {
    monthMap[month] = {
      month: month,
      '2025': 0,
      '2026': 0
    };
  });

  data.forEach(row => {
    const month = row['Month'];
    if (month && monthMap[month]) {
      const revenue = parseFloat(row['Revenue (USD)'] || 0) || 0;
      const year = row['Start Date'] ? new Date(row['Start Date']).getFullYear() : 2026;
      if (year) {
        monthMap[month][year] += revenue / 1000000;
      }
    }
  });

  return Object.values(monthMap);
}

module.exports = {
  loadSheetData,
  calculateKPIs,
  getCountryData,
  getCampaignData,
  getMonthlyTrendData
};
