const axios = require('axios');

const POWERBI_API_BASE = 'https://api.powerbi.com/v1.0/myorg';
const DATASET_ID = process.env.POWERBI_DATASET_ID || '36816ea5-480d-46ca-9f91-32ee6e6846e2';
const WORKSPACE_ID = process.env.POWERBI_WORKSPACE_ID;

let cachedToken = null;
let tokenExpiry = null;

/**
 * Get Power BI access token using user credentials
 */
async function getAccessToken() {
  // Return cached token if still valid
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log('Using cached Power BI token');
    return cachedToken;
  }

  const hasClientCredentials =
    process.env.POWERBI_CLIENT_ID &&
    process.env.POWERBI_CLIENT_SECRET &&
    process.env.POWERBI_TENANT_ID &&
    !process.env.POWERBI_CLIENT_ID.includes('your-') &&
    !process.env.POWERBI_CLIENT_SECRET.includes('your-');

  try {
    console.log('🔐 Authenticating with Power BI...');

    const tenantId = process.env.POWERBI_TENANT_ID || '04b46710-5659-4f42-83aa-9ea5328db2c5';
    
    const tokenUrl = hasClientCredentials
      ? `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
      : `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const form = hasClientCredentials
      ? new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: process.env.POWERBI_CLIENT_ID,
          client_secret: process.env.POWERBI_CLIENT_SECRET,
          scope: 'https://analysis.windows.net/powerbi/api/.default'
        })
      : new URLSearchParams({
          grant_type: 'password',
          client_id: process.env.POWERBI_CLIENT_ID,
          scope: 'https://analysis.windows.net/powerbi/api/.default',
          username: process.env.POWERBI_USERNAME,
          password: process.env.POWERBI_PASSWORD
        });

    const tokenResponse = await axios.post(tokenUrl, form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    cachedToken = tokenResponse.data.access_token;
    tokenExpiry = Date.now() + (tokenResponse.data.expires_in * 1000) - 60000; // Refresh 1 min before expiry

    console.log('Power BI authentication successful');
    return cachedToken;
  } catch (error) {
    console.error('Power BI authentication failed:', error.message);
    if (error.response?.data) {
      console.error('Details:', error.response.data);
    }
    throw new Error('Failed to authenticate with Power BI');
  }
}
async function executeDaxQuery(daxQuery) {
  try {
    const token = await getAccessToken();
    
    console.log(` Executing DAX query...`);
    
    const response = await axios.post(
      `${POWERBI_API_BASE}/datasets/${DATASET_ID}/executeQueries`,
      {
        queries: [{ query: daxQuery }],
        serializationSettings: { includeNulls: true }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data.results && response.data.results[0]) {
      const result = response.data.results[0];
      if (result.error) {
        console.error(' DAX query error:', result.error);
        throw new Error(`DAX Error: ${result.error.message}`);
      }
      console.log(` DAX query returned ${result.tables?.[0]?.rows?.length || 0} rows`);
      return result.tables?.[0]?.rows || [];
    }
    
    return [];
  } catch (error) {
    console.error(' Error executing DAX query:', error.message);
    throw error;
  }
}

/**
 * Get KPI data from Power BI
 */
async function getKPIData() {
  try {
    console.log(' Fetching KPI data...');
    
    // DAX query to get KPI metrics
    const daxQuery = `
      EVALUATE ROW(
        "TotalCampaigns", COUNTA(Campaigns[Campaign ID]),
        "TotalRevenue", SUM(Campaigns[Revenue (USD)]),
        "TotalSpend", SUM(Campaigns[Spends (USD)]),
        "AvgGrossMargin", AVERAGE(Campaigns[Gross Profit %]),
        "AvgNetMargin", AVERAGE(Campaigns[% Net gross margin])
      )
    `;
    
    const rows = await executeDaxQuery(daxQuery);
    
    if (rows.length === 0) {
      console.warn('  No KPI data returned, using fallback');
      return getFallbackKPIData();
    }

    const kpiRow = rows[0];
    const kpis = [
      {
        title: "No of Campaigns",
        value: Math.round(kpiRow['TotalCampaigns']) || 0,
        subtitle: `Budget Groups: ${Math.round(kpiRow['TotalCampaigns'] / 5) || 0}`
      },
      {
        title: "Gross Margin %",
        value: (kpiRow['AvgGrossMargin'] || 0).toFixed(1) + "%",
        subtitle: `Total Revenue: $${(kpiRow['TotalRevenue'] / 1000000).toFixed(1)}M`
      },
      {
        title: "Net Margin %",
        value: (kpiRow['AvgNetMargin'] || 0).toFixed(1) + "%",
        subtitle: `Total Spend: $${(kpiRow['TotalSpend'] / 1000).toFixed(0)}K`
      },
      {
        title: "Spend",
        value: "$" + (kpiRow['TotalSpend'] / 1000000).toFixed(1) + "M",
        subtitle: `Booked Revenue: $${(kpiRow['TotalRevenue'] / 1000000).toFixed(1)}M`
      }
    ];

    console.log(' KPI data formatted successfully');
    return kpis;
  } catch (error) {
    console.error(' Error getting KPI data:', error.message);
    return getFallbackKPIData();
  }
}

/**
 * Get revenue trend data
 */
async function getRevenueTrendData() {
  try {
    console.log(' Fetching revenue trend...');
    
    const daxQuery = `
      EVALUATE
      SUMMARIZECOLUMNS(
        'Date'[Year],
        'Date'[Month],
        "Revenue", SUM(Campaigns[Revenue (USD)])
      )
      ORDER BY 'Date'[Year], 'Date'[Month]
    `;
    
    const rows = await executeDaxQuery(daxQuery);
    
    if (rows.length === 0) {
      console.warn('  No trend data, using fallback');
      return getFallbackTrendData();
    }

    // Format into month-based data
    const monthMap = {};
    rows.forEach(row => {
      const month = row['Month'] || 'Jan';
      const year = row['Year'] || '2026';
      if (!monthMap[month]) {
        monthMap[month] = { month, '2025': 0, '2026': 0 };
      }
      monthMap[month][year] = (row['Revenue'] / 1000000).toFixed(1);
    });

    const trendData = Object.values(monthMap);
    console.log(` Revenue trend formatted: ${trendData.length} months`);
    return trendData;
  } catch (error) {
    console.error(' Error getting revenue trend:', error.message);
    return getFallbackTrendData();
  }
}

/**
 * Get campaign performance data (bottom performers)
 */
async function getCampaignData() {
  try {
    console.log(' Fetching campaign data...');
    
    const daxQuery = `
      EVALUATE
      TOPN(
        4,
        FILTER(
          SUMMARIZECOLUMNS(
            Campaigns[Campaign Name],
            Campaigns[Status],
            "Revenue", SUM(Campaigns[Revenue (USD)]),
            "Spend", SUM(Campaigns[Spends (USD)]),
            "GrossMargin", AVERAGE(Campaigns[Gross Profit %])
          ),
          [GrossMargin] < 50
        ),
        [GrossMargin],
        ASC
      )
    `;
    
    const rows = await executeDaxQuery(daxQuery);
    
    if (rows.length === 0) {
      console.warn('  No campaign data, using fallback');
      return getFallbackCampaignData();
    }

    const campaigns = rows.map(row => ({
      campaignName: row['Campaign Name'] || 'Unknown',
      status: row['Status'] || 'Active',
      revenue: (row['Revenue'] / 1000).toFixed(0),
      spend: (row['Spend'] / 1000).toFixed(0),
      profit: ((row['Revenue'] - row['Spend']) / 1000).toFixed(0),
      grossMargin: Math.round(row['GrossMargin']) || 0
    }));

    console.log(` Campaign data formatted: ${campaigns.length} bottom performers`);
    return campaigns;
  } catch (error) {
    console.error(' Error getting campaign data:', error.message);
    return getFallbackCampaignData();
  }
}

/**
 * Get regional/country performance data
 */
async function getRegionData() {
  try {
    console.log(' Fetching region data...');
    
    const daxQuery = `
      EVALUATE
      SUMMARIZECOLUMNS(
        Campaigns[Country],
        "Campaigns", COUNTA(Campaigns[Campaign ID]),
        "Revenue", SUM(Campaigns[Revenue (USD)]),
        "Spend", SUM(Campaigns[Spends (USD)]),
        "Impressions", SUM(Campaigns[Impressions]),
        "GrossMargin", AVERAGE(Campaigns[Gross Profit %]),
        "NetMargin", AVERAGE(Campaigns[% Net gross margin])
      )
      ORDER BY [Revenue] DESC
    `;
    
    const rows = await executeDaxQuery(daxQuery);
    
    if (rows.length === 0) {
      console.warn('  No region data, using fallback');
      return getFallbackRegionData();
    }

    const regions = rows.map(row => ({
      country: row['Country'] || 'Unknown',
      campaigns: Math.round(row['Campaigns']) || 0,
      revenue: (row['Revenue'] / 1000000).toFixed(2),
      spend: (row['Spend'] / 1000000).toFixed(2),
      impressions: Math.round(row['Impressions']) || 0,
      profit: ((row['Revenue'] - row['Spend']) / 1000000).toFixed(2),
      grossMargin: Math.round(row['GrossMargin']) || 0,
      netMargin: Math.round(row['NetMargin']) || 0
    }));

    console.log(` Region data formatted: ${regions.length} regions`);
    return regions;
  } catch (error) {
    console.error(' Error getting region data:', error.message);
    return getFallbackRegionData();
  }
}

/**
 * Get summary metrics (booked revenue, margins, spend) for the overview KPIs
 */
async function getSummaryMetrics() {
  try {
    console.log(' Fetching overview summary metrics...');

    const daxQuery = `
      EVALUATE
      ROW(
        "TotalCampaigns", COUNTA('Campaigns'[Campaign ID]),
        "TotalRevenue", SUM('Campaigns'[Revenue (USD)]),
        "TotalSpend", SUM('Campaigns'[Spends (USD)]),
        "AvgGrossMargin", AVERAGE('Campaigns'[Gross Profit %]),
        "AvgNetMargin", AVERAGE('Campaigns'[% Net gross margin])
      )
    `;

    const rows = await executeDaxQuery(daxQuery);
    if (!rows || rows.length === 0) {
      console.warn('  No summary metrics returned, using fallback');
      return getFallbackSummaryMetrics();
    }

    const row = rows[0];
    const totalCampaigns = safeNumber(row['TotalCampaigns']);
    const totalRevenue = safeNumber(row['TotalRevenue']);
    const totalSpend = safeNumber(row['TotalSpend']);
    const avgGrossMargin = safeNumber(row['AvgGrossMargin']);
    const avgNetMargin = safeNumber(row['AvgNetMargin']);
    const grossMarginValue = (totalRevenue * avgGrossMargin) / 100 || 0;
    const netMarginValue = (totalRevenue * avgNetMargin) / 100 || 0;

    return [
      {
        title: 'Booked Revenue',
        value: formatCurrencyLabel(totalRevenue),
        subtitle: `${totalCampaigns} campaigns`
      },
      {
        title: 'Spend',
        value: formatCurrencyLabel(totalSpend),
        subtitle: `Net Margin: ${formatCurrencyLabel(netMarginValue)}`
      },
      {
        title: 'Gross Margin %',
        value: formatPercentageLabel(avgGrossMargin),
        subtitle: `Gross Profit: ${formatCurrencyLabel(grossMarginValue)}`
      },
      {
        title: 'Gross Margin $',
        value: formatCurrencyLabel(grossMarginValue),
        subtitle: `Avg Margin: ${formatPercentageLabel(avgGrossMargin)}`
      },
      {
        title: 'Net Margin %',
        value: formatPercentageLabel(avgNetMargin),
        subtitle: `Net Profit: ${formatCurrencyLabel(netMarginValue)}`
      },
      {
        title: 'Net Margin $',
        value: formatCurrencyLabel(netMarginValue),
        subtitle: `Avg Margin: ${formatPercentageLabel(avgNetMargin)}`
      }
    ];
  } catch (error) {
    console.error(' Error getting summary metrics:', error.message);
    return getFallbackSummaryMetrics();
  }
}

/**
 * Get owner-level performance summary (Ops, CS, Sales)
 */
async function getResponsibilitySummary(ownerColumn) {
  try {
    console.log(` Fetching ${ownerColumn} performance summary...`);
    const daxQuery = buildOwnerSummaryQuery(ownerColumn);
    const rows = await executeDaxQuery(daxQuery);
    if (!rows || rows.length === 0) {
      console.warn(`  Empty ${ownerColumn} summary; using fallback`);
      return getFallbackOwnerData(ownerColumn);
    }

    return rows.map(row => ({
      owner: row['Owner'] || 'Unknown',
      campaigns: safeNumber(row['Campaigns']),
      revenue: safeNumber(row['BookedRevenue']),
      spend: safeNumber(row['Spend']),
      grossMarginPct: safeNumber(row['GrossMarginPct']),
      netMarginPct: safeNumber(row['NetMarginPct'])
    }));
  } catch (error) {
    console.error(` Error getting ${ownerColumn} summary:`, error.message);
    return getFallbackOwnerData(ownerColumn);
  }
}

/**
 * Platform-wise monthly spend data
 */
async function getPlatformMonthlySpends() {
  try {
    console.log(' Fetching platform monthly spends...');
    const daxQuery = buildPlatformSpendsQuery();
    const rows = await executeDaxQuery(daxQuery);
    if (!rows || rows.length === 0) {
      console.warn('  No platform spends returned, using fallback');
      return getFallbackPlatformSpends();
    }

    return rows.map(row => ({
      month: row['Month'] || 'Unknown',
      year: row['Year'] || new Date().getFullYear(),
      platform: row['Platform'] || 'Unknown',
      spend: safeNumber(row['Spend'])
    }));
  } catch (error) {
    console.error(' Error getting platform spends:', error.message);
    return getFallbackPlatformSpends();
  }
}

function buildOwnerSummaryQuery(ownerColumn) {
  const sanitized = ownerColumn.replace(/'/g, "''");
  return `
    EVALUATE
    SELECTCOLUMNS(
      SUMMARIZECOLUMNS(
        'Campaigns'[${sanitized}],
        "Campaigns", COUNTA('Campaigns'[Campaign ID]),
        "BookedRevenue", SUM('Campaigns'[Revenue (USD)]),
        "Spend", SUM('Campaigns'[Spends (USD)]),
        "GrossMarginPct", AVERAGE('Campaigns'[Gross Profit %]),
        "NetMarginPct", AVERAGE('Campaigns'[% Net gross margin])
      ),
      "Owner", 'Campaigns'[${sanitized}],
      "Campaigns", [Campaigns],
      "BookedRevenue", [BookedRevenue],
      "Spend", [Spend],
      "GrossMarginPct", [GrossMarginPct],
      "NetMarginPct", [NetMarginPct]
    )
    ORDER BY [BookedRevenue] DESC
  `;
}

function buildPlatformSpendsQuery() {
  return `
    EVALUATE
    SELECTCOLUMNS(
      SUMMARIZECOLUMNS(
        'Date'[Year],
        'Date'[Month],
        'Campaigns'[Platform],
        "Spend", SUM('Campaigns'[Spends (USD)])
      ),
      "Year", 'Date'[Year],
      "Month", 'Date'[Month],
      "Platform", 'Campaigns'[Platform],
      "Spend", [Spend]
    )
    ORDER BY 'Date'[Year], 'Date'[Month]
  `;
}

function safeNumber(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrencyLabel(value) {
  const num = safeNumber(value);
  const absValue = Math.abs(num);
  if (absValue >= 1_000_000) {
    return `$${(num / 1_000_000).toFixed(2)}M`;
  }
  if (absValue >= 1_000) {
    return `$${(num / 1_000).toFixed(2)}K`;
  }
  return `$${num.toFixed(2)}`;
}

function formatPercentageLabel(value) {
  const num = safeNumber(value);
  return `${num.toFixed(1)}%`;
}

function getFallbackOwnerData(ownerColumn) {
  return OWNER_FALLBACKS[ownerColumn] || [];
}

function getFallbackSummaryMetrics() {
  return [
    { title: 'Booked Revenue', value: '$18.68M', subtitle: '315 campaigns' },
    { title: 'Spend', value: '$7.70M', subtitle: 'Net Margin: $4.79M' },
    { title: 'Gross Margin %', value: '58.77%', subtitle: 'Gross Margin: $10.98M' },
    { title: 'Gross Margin $', value: '$10.98M', subtitle: 'Avg Margin: 58.77%' },
    { title: 'Net Margin %', value: '25.65%', subtitle: 'Net Margin: $4.79M' },
    { title: 'Net Margin $', value: '$4.79M', subtitle: 'Avg Margin: 25.65%' }
  ];
}

function getFallbackPlatformSpends() {
  return PLATFORM_FALLBACK;
}

const OWNER_FALLBACKS = {
  'Ops Responsible': [
    { owner: 'Aaushi', campaigns: 1, revenue: 30_000, spend: 12_000, grossMarginPct: 32.39, netMarginPct: 12 },
    { owner: 'Aayushi', campaigns: 1, revenue: 60_000, spend: 24_000, grossMarginPct: 60.44, netMarginPct: 35 },
    { owner: 'Abhinav', campaigns: 4, revenue: 560_000, spend: 160_000, grossMarginPct: 40.72, netMarginPct: 18 },
    { owner: 'Abhishek', campaigns: 24, revenue: 550_000, spend: 210_000, grossMarginPct: 50.91, netMarginPct: 24 },
    { owner: 'Aditi', campaigns: 13, revenue: 360_000, spend: 120_000, grossMarginPct: 32.57, netMarginPct: 14 },
    { owner: 'Anshuman', campaigns: 10, revenue: 200_000, spend: 90_000, grossMarginPct: 46.77, netMarginPct: 22 }
  ],
  'CS Responsible': [
    { owner: 'Abhishek', campaigns: 20, revenue: 390_000, spend: 180_000, grossMarginPct: 50.1, netMarginPct: 29 },
    { owner: 'Achala', campaigns: 17, revenue: 300_000, spend: 150_000, grossMarginPct: 48, netMarginPct: 25 },
    { owner: 'Aisosa', campaigns: 20, revenue: 350_000, spend: 160_000, grossMarginPct: 30.57, netMarginPct: 12 },
    { owner: 'Alexandra', campaigns: 10, revenue: 1_070_000, spend: 390_000, grossMarginPct: 35, netMarginPct: 18 },
    { owner: 'Apoorva', campaigns: 37, revenue: 1_980_000, spend: 820_000, grossMarginPct: 10.77, netMarginPct: 5 },
    { owner: 'Ashley', campaigns: 1, revenue: 30_000, spend: 12_000, grossMarginPct: 40, netMarginPct: 22 }
  ],
  'Sales Responsible': [
    { owner: 'Abhimanyu', campaigns: 28, revenue: 600_000, spend: 240_000, grossMarginPct: 25.64, netMarginPct: 14 },
    { owner: 'Adam Lindh', campaigns: 1, revenue: 0, spend: 0, grossMarginPct: 0, netMarginPct: 0 },
    { owner: 'Alex Debenham Burton', campaigns: 11, revenue: 300_000, spend: 90_000, grossMarginPct: 29.85, netMarginPct: 16 },
    { owner: 'Alexa Doan', campaigns: 6, revenue: 260_000, spend: 130_000, grossMarginPct: 52.87, netMarginPct: 30 },
    { owner: 'Andreas Wahlman', campaigns: 12, revenue: 920_000, spend: 320_000, grossMarginPct: 35.14, netMarginPct: 17 }
  ]
};

const PLATFORM_FALLBACK = [
  { month: 'Apr', year: 2025, platform: 'CTV', spend: 3_700 },
  { month: 'Apr', year: 2025, platform: 'OpenWeb', spend: 16_790 },
  { month: 'Apr', year: 2025, platform: 'Tiktok', spend: 2_980 },
  { month: 'Apr', year: 2025, platform: 'Youtube', spend: 38_570 },
  { month: 'May', year: 2025, platform: 'CTV', spend: 9_100 },
  { month: 'May', year: 2025, platform: 'OpenWeb', spend: 16_250 },
  { month: 'May', year: 2025, platform: 'Tiktok', spend: 3_520 },
  { month: 'May', year: 2025, platform: 'Youtube', spend: 69_670 },
  { month: 'Jun', year: 2025, platform: 'OpenWeb', spend: 49_550 },
  { month: 'Jun', year: 2025, platform: 'Tiktok', spend: 3_460 },
  { month: 'Jun', year: 2025, platform: 'Youtube', spend: 82_540 },
  { month: 'Jul', year: 2025, platform: 'CTV', spend: 143_260 },
  { month: 'Jul', year: 2025, platform: 'YT Mirrors', spend: 4_280 },
  { month: 'Aug', year: 2025, platform: 'CTV', spend: 260 },
  { month: 'Aug', year: 2025, platform: 'OpenWeb', spend: 68_940 },
  { month: 'Aug', year: 2025, platform: 'Tiktok', spend: 3_530 },
  { month: 'Aug', year: 2025, platform: 'Youtube', spend: 408_390 },
  { month: 'Sep', year: 2025, platform: 'CTV', spend: 17_870 },
  { month: 'Sep', year: 2025, platform: 'OpenWeb', spend: 76_530 },
  { month: 'Sep', year: 2025, platform: 'Tiktok', spend: 7_900 },
  { month: 'Sep', year: 2025, platform: 'Youtube', spend: 332_840 },
  { month: 'Oct', year: 2025, platform: 'CTV', spend: 4_500 },
  { month: 'Oct', year: 2025, platform: 'Meta', spend: 1_200 },
  { month: 'Oct', year: 2025, platform: 'OpenWeb', spend: 75_340 },
  { month: 'Oct', year: 2025, platform: 'Tiktok', spend: 24_210 },
  { month: 'Oct', year: 2025, platform: 'Youtube', spend: 285_160 },
  { month: 'Oct', year: 2025, platform: 'YT Mirrors', spend: 449_340 }
];

/**
 * Fallback data when Power BI is unavailable
 */
function getFallbackKPIData() {
  return [
    {
      title: "No of Campaigns",
      value: 45,
      subtitle: "Budget Groups: 9"
    },
    {
      title: "Gross Margin %",
      value: "62.5%",
      subtitle: "Total Revenue: $15.2M"
    },
    {
      title: "Net Margin %",
      value: "48.3%",
      subtitle: "Total Spend: $9.8K"
    },
    {
      title: "Spend",
      value: "$9.8M",
      subtitle: "Booked Revenue: $15.2M"
    }
  ];
}

function getFallbackTrendData() {
  return [
    { month: 'Jan', '2025': '1.2', '2026': '1.5' },
    { month: 'Feb', '2025': '1.4', '2026': '1.8' },
    { month: 'Mar', '2025': '1.6', '2026': '2.1' },
    { month: 'Apr', '2025': '1.8', '2026': '2.3' }
  ];
}

function getFallbackCampaignData() {
  return [
    {
      campaignName: 'Campaign A',
      status: 'Active',
      revenue: '450',
      spend: '250',
      profit: '200',
      grossMargin: 44
    },
    {
      campaignName: 'Campaign B',
      status: 'Active',
      revenue: '320',
      spend: '180',
      profit: '140',
      grossMargin: 44
    }
  ];
}

function getFallbackRegionData() {
  return [
    {
      country: 'United States',
      campaigns: 15,
      revenue: '8.50',
      spend: '4.20',
      impressions: 250000,
      profit: '4.30',
      grossMargin: 51,
      netMargin: 38
    },
    {
      country: 'United Kingdom',
      campaigns: 10,
      revenue: '4.25',
      spend: '2.10',
      impressions: 125000,
      profit: '2.15',
      grossMargin: 51,
      netMargin: 38
    }
  ];
}

module.exports = {
  getKPIData,
  getRevenueTrendData,
  getCampaignData,
  getRegionData,
  getSummaryMetrics,
  getResponsibilitySummary,
  getPlatformMonthlySpends,
  executeDaxQuery
};
