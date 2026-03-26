// Rich mock data: Jan 2020 – Dec 2026

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

function seededRand(seed) {
  let s = seed;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── KPIs ──────────────────────────────────────────────────────────────────
export const mockKPIs = [
  { title: 'No of Campaigns', value: 315,    subtitle: 'Budget Groups: 63' },
  { title: 'Gross Margin %',  value: '58.8%', subtitle: 'Gross Margin: $10.98M' },
  { title: 'Net Margin %',    value: '25.6%', subtitle: 'Net Margin: $4.79M' },
  { title: 'Spend',           value: '$7.70M', subtitle: 'Booked Revenue: $18.68M' },
];

// ── Revenue Trend — matches screenshot values for 2025/2026 ──────────────
export function mockRevenueTrend() {
  // Exact 2025 values from screenshot
  const v2025 = [1.74, 2.15, 3.17, 3.13, 3.44, 3.85, 3.51, 4.42, 4.75, 5.63, 4.94, 4.83];
  // Exact 2026 values from screenshot (only Jan–Mar shown)
  const v2026 = [2.60, 3.84, 2.90, null, null, null, null, null, null, null, null, null];

  const rand = seededRand(42);
  // Realistic values for older years
  const base = { 2020: 0.55, 2021: 0.80, 2022: 1.10, 2023: 1.50, 2024: 2.10 };
  const seasonal = [0.65,0.72,0.88,0.90,0.95,1.0,0.98,1.05,1.02,1.15,1.08,1.12];

  return SHORT_MONTHS.map((m, i) => {
    const row = { month: m };
    // Historical years
    Object.entries(base).forEach(([y, b]) => {
      row[y] = +(b * seasonal[i] * (0.85 + rand() * 0.3)).toFixed(2);
    });
    // 2025 — exact screenshot values
    row[2025] = v2025[i];
    // 2026 — only first 3 months have data
    if (v2026[i] !== null) row[2026] = v2026[i];
    return row;
  });
}

// ── Gross Margin Trend — matches screenshot values ────────────────────────
export function mockMarginTrend() {
  // Exact 2025 values from screenshot
  const v2025 = [53.47, 53.33, 48.35, 48.04, 47.66, 47.07, 50.28, 50.14, 43.30, 50.44, 52.17, 53.98];
  // 2026 — only March shown with 67.82
  const v2026 = [53.20, 53.10, 67.82, null, null, null, null, null, null, null, null, null];

  const rand = seededRand(99);
  const base = { 2020: 40, 2021: 44, 2022: 48, 2023: 51, 2024: 53 };
  const seasonal = [0.97,0.97,0.95,0.96,0.95,0.95,0.97,0.97,0.92,0.97,0.99,1.01];

  return SHORT_MONTHS.map((m, i) => {
    const row = { month: m };
    Object.entries(base).forEach(([y, b]) => {
      row[y] = +(b * seasonal[i] * (0.94 + rand() * 0.12)).toFixed(2);
    });
    row[2025] = v2025[i];
    if (v2026[i] !== null) row[2026] = v2026[i];
    return row;
  });
}

// ── Campaigns ─────────────────────────────────────────────────────────────
export const mockCampaigns = [
  { campaignName:'APAC Programmatic Q1',    status:'Active',  revenue:128000, spend:98000,  profit:30000,  grossMargin:23.4 },
  { campaignName:'EMEA Display Retargeting',status:'Active',  revenue:95000,  spend:77000,  profit:18000,  grossMargin:18.9 },
  { campaignName:'US CTV Awareness',        status:'Paused',  revenue:210000, spend:175000, profit:35000,  grossMargin:16.7 },
  { campaignName:'SEA Social Branding',     status:'Active',  revenue:67000,  spend:56000,  profit:11000,  grossMargin:16.4 },
  { campaignName:'LATAM Video Campaign',    status:'Ended',   revenue:44000,  spend:38000,  profit:6000,   grossMargin:13.6 },
  { campaignName:'AU Brand Awareness Q4',   status:'Active',  revenue:182000, spend:160000, profit:22000,  grossMargin:12.1 },
  { campaignName:'MENA Search Perf',        status:'Active',  revenue:39000,  spend:35000,  profit:4000,   grossMargin:10.3 },
  { campaignName:'Global Native Q2',        status:'Paused',  revenue:88000,  spend:80000,  profit:8000,   grossMargin:9.1  },
  { campaignName:'IN Mobile App Install',   status:'Active',  revenue:52000,  spend:48000,  profit:4000,   grossMargin:7.7  },
  { campaignName:'UK OTT Streaming',        status:'Ended',   revenue:31000,  spend:29000,  profit:2000,   grossMargin:6.5  },
  { campaignName:'DE Influencer Collab',    status:'Active',  revenue:75000,  spend:71000,  profit:4000,   grossMargin:5.3  },
  { campaignName:'FR Performance Max',      status:'Paused',  revenue:28000,  spend:27000,  profit:1000,   grossMargin:3.6  },
];

// ── Regions ────────────────────────────────────────────────────────────────
export const mockRegions = [
  { country:'United States',  campaigns:72,  revenue:6.84, spend:2.94, impressions:4820000, profit:3.90, grossMargin:57.0, netMargin:28.4 },
  { country:'United Kingdom', campaigns:38,  revenue:2.42, spend:0.98, impressions:1940000, profit:1.44, grossMargin:59.5, netMargin:29.8 },
  { country:'Germany',        campaigns:24,  revenue:1.68, spend:0.71, impressions:1120000, profit:0.97, grossMargin:57.7, netMargin:27.9 },
  { country:'Australia',      campaigns:21,  revenue:1.44, spend:0.62, impressions:980000,  profit:0.82, grossMargin:56.9, netMargin:26.4 },
  { country:'India',          campaigns:31,  revenue:1.12, spend:0.44, impressions:3640000, profit:0.68, grossMargin:60.7, netMargin:30.2 },
  { country:'France',         campaigns:18,  revenue:0.98, spend:0.43, impressions:720000,  profit:0.55, grossMargin:56.1, netMargin:25.5 },
  { country:'Canada',         campaigns:22,  revenue:0.92, spend:0.39, impressions:680000,  profit:0.53, grossMargin:57.6, netMargin:27.2 },
  { country:'Singapore',      campaigns:15,  revenue:0.74, spend:0.30, impressions:540000,  profit:0.44, grossMargin:59.5, netMargin:29.7 },
  { country:'Japan',          campaigns:12,  revenue:0.68, spend:0.28, impressions:490000,  profit:0.40, grossMargin:58.8, netMargin:28.6 },
  { country:'UAE',            campaigns:14,  revenue:0.62, spend:0.26, impressions:420000,  profit:0.36, grossMargin:58.1, netMargin:27.4 },
  { country:'Netherlands',    campaigns:10,  revenue:0.48, spend:0.20, impressions:310000,  profit:0.28, grossMargin:58.3, netMargin:27.1 },
  { country:'Brazil',         campaigns:9,   revenue:0.34, spend:0.15, impressions:560000,  profit:0.19, grossMargin:55.9, netMargin:24.1 },
  { country:'South Africa',   campaigns:6,   revenue:0.22, spend:0.10, impressions:280000,  profit:0.12, grossMargin:54.5, netMargin:22.7 },
];

// Management view region/country (hierarchy level 1)
export const mockManagementRegions = [
  {
    region: "India+SEA", adOps: 14, cs: 13, sales: 20, bookedRevenue: 7470000, totalCampaigns: 166, budgetGroups: 1234,
    spend: 2510000, plannedImpressions: 2.59e9, deliveredImpressions: 2.22e9, deliveredPct: 85.91, grossMargin: 4810000, grossMarginPct: 65.70,
    children: [
      { region: "India", adOps: 8, cs: 7, sales: 9, bookedRevenue: 4200000, totalCampaigns: 92, budgetGroups: 740, spend: 1400000, plannedImpressions: 1.4e9, deliveredImpressions: 1.2e9, deliveredPct: 85.0, grossMargin: 2800000, grossMarginPct: 66.67 },
      { region: "SEA",   adOps: 6, cs: 6, sales:11, bookedRevenue: 3270000, totalCampaigns: 74, budgetGroups: 494, spend: 1110000, plannedImpressions: 1.19e9, deliveredImpressions: 1.02e9, deliveredPct: 85.71, grossMargin: 2010000, grossMarginPct: 61.47 }
    ]
  },
  {
    region: "North America", adOps: 7, cs: 8, sales: 1, bookedRevenue: 4660000, totalCampaigns: 53, budgetGroups: 304,
    spend: 2630000, plannedImpressions: 1.14e9, deliveredImpressions: 6.2835e8, deliveredPct: 55.10, grossMargin: 1920000, grossMarginPct: 42.21,
    children: [
      { region: "USA", adOps: 5, cs: 6, sales: 1, bookedRevenue: 3500000, totalCampaigns: 40, budgetGroups: 240, spend: 2100000, plannedImpressions: 9e8, deliveredImpressions: 4.8e8, deliveredPct: 53.3, grossMargin: 1400000, grossMarginPct: 40.0 },
      { region: "Canada", adOps: 2, cs: 2, sales: 0, bookedRevenue: 1160000, totalCampaigns: 13, budgetGroups: 64, spend: 530000, plannedImpressions: 2.4e8, deliveredImpressions: 1.48e8, deliveredPct: 61.7, grossMargin: 630000, grossMarginPct: 54.3 }
    ]
  },
  {
    region: "Europe", adOps: 6, cs: 7, sales: 14, bookedRevenue: 3780000, totalCampaigns: 128, budgetGroups: 327,
    spend: 1120000, plannedImpressions: 4.4889e8, deliveredImpressions: 3.9735e8, deliveredPct: 88.52, grossMargin: 2360000, grossMarginPct: 67.81,
    children: [
      { region: "UK", adOps: 2, cs: 2, sales: 5, bookedRevenue: 1180000, totalCampaigns: 34, budgetGroups: 96, spend: 360000, plannedImpressions: 1.3e8, deliveredImpressions: 1.12e8, deliveredPct: 86.2, grossMargin: 820000, grossMarginPct: 69.5 },
      { region: "Germany", adOps: 2, cs: 3, sales: 4, bookedRevenue: 1020000, totalCampaigns: 31, budgetGroups: 88, spend: 300000, plannedImpressions: 1.1e8, deliveredImpressions: 9.6e7, deliveredPct: 87.3, grossMargin: 720000, grossMarginPct: 70.6 },
      { region: "France", adOps: 2, cs: 2, sales: 5, bookedRevenue: 1580000, totalCampaigns: 63, budgetGroups: 143, spend: 460000, plannedImpressions: 2.1e8, deliveredImpressions: 1.91e8, deliveredPct: 91.0, grossMargin: 1120000, grossMarginPct: 70.9 }
    ]
  },
  {
    region: "Middle East", adOps: 3, cs: 1, sales: 3, bookedRevenue: 1340000, totalCampaigns: 12, budgetGroups: 131,
    spend: 382870, plannedImpressions: 1.2831e8, deliveredImpressions: 1.1327e8, deliveredPct: 88.28, grossMargin: 941110, grossMarginPct: 71.08,
    children: [
      { region: "UAE", adOps: 2, cs: 1, sales: 2, bookedRevenue: 820000, totalCampaigns: 7, budgetGroups: 78, spend: 226000, plannedImpressions: 7.3e7, deliveredImpressions: 6.5e7, deliveredPct: 89.0, grossMargin: 594000, grossMarginPct: 72.4 },
      { region: "KSA", adOps: 1, cs: 0, sales: 1, bookedRevenue: 520000, totalCampaigns: 5, budgetGroups: 53, spend: 156870, plannedImpressions: 5.3e7, deliveredImpressions: 4.8e7, deliveredPct: 90.6, grossMargin: 347130, grossMarginPct: 66.8 }
    ]
  },
  { region: "Australia", adOps: 3, cs: 3, sales: 3, bookedRevenue: 607230, totalCampaigns: 53, budgetGroups: 456, spend: 250000, plannedImpressions: 128310000, deliveredImpressions: 113270000, deliveredPct: 88.28, grossMargin: 357230, grossMarginPct: 58.85 },
  { region: "Rest of APAC", adOps: 3, cs: 2, sales: 3, bookedRevenue: 454180, totalCampaigns: 12, budgetGroups: 114, spend: 180000, plannedImpressions: 60000000, deliveredImpressions: 54000000, deliveredPct: 90.0, grossMargin: 274180, grossMarginPct: 60.36 },
  { region: "Japan", adOps: 1, cs: 2, sales: 1, bookedRevenue: 385820, totalCampaigns: 12, budgetGroups: 58, spend: 185000, plannedImpressions: 44600000, deliveredImpressions: 34830000, deliveredPct: 78.06, grossMargin: 200820, grossMarginPct: 52.06 },
  { region: "Africa", adOps: 1, cs: 1, sales: 1, bookedRevenue: 219520, totalCampaigns: 13, budgetGroups: 72, spend: 91430, plannedImpressions: 30500000, deliveredImpressions: 17050000, deliveredPct: 55.90, grossMargin: 128090, grossMarginPct: 58.34 },
];

// ── Owners ────────────────────────────────────────────────────────────────
export const mockOwners = {
  ops: [
    { owner:'Aayushi',  campaigns:6,  revenue:360000,  spend:138000, grossMarginPct:61.7, netMarginPct:32.4 },
    { owner:'Abhinav',  campaigns:14, revenue:980000,  spend:372000, grossMarginPct:62.0, netMarginPct:30.1 },
    { owner:'Abhishek', campaigns:28, revenue:1420000, spend:548000, grossMarginPct:61.4, netMarginPct:29.8 },
    { owner:'Aditi',    campaigns:18, revenue:760000,  spend:294000, grossMarginPct:61.3, netMarginPct:29.2 },
    { owner:'Anshuman', campaigns:11, revenue:520000,  spend:202000, grossMarginPct:61.2, netMarginPct:28.9 },
    { owner:'Arjun',    campaigns:9,  revenue:410000,  spend:161000, grossMarginPct:60.7, netMarginPct:28.6 },
    { owner:'Deepika',  campaigns:22, revenue:1100000, spend:432000, grossMarginPct:60.7, netMarginPct:28.4 },
    { owner:'Kavya',    campaigns:12, revenue:580000,  spend:230000, grossMarginPct:60.3, netMarginPct:27.6 },
    { owner:'Megha',    campaigns:5,  revenue:220000,  spend:88000,  grossMarginPct:60.0, netMarginPct:27.1 },
  ],
  cs: [
    { owner:'Abhishek',  campaigns:24, revenue:940000,  spend:360000, grossMarginPct:61.7, netMarginPct:32.1 },
    { owner:'Achala',    campaigns:20, revenue:780000,  spend:302000, grossMarginPct:61.3, netMarginPct:31.4 },
    { owner:'Aisosa',    campaigns:22, revenue:860000,  spend:335000, grossMarginPct:61.0, netMarginPct:30.8 },
    { owner:'Alexandra', campaigns:12, revenue:1320000, spend:512000, grossMarginPct:61.2, netMarginPct:31.0 },
    { owner:'Apoorva',   campaigns:41, revenue:2140000, spend:832000, grossMarginPct:61.1, netMarginPct:30.6 },
    { owner:'Ashley',    campaigns:8,  revenue:340000,  spend:132000, grossMarginPct:61.2, netMarginPct:30.9 },
    { owner:'Divya',     campaigns:15, revenue:620000,  spend:242000, grossMarginPct:60.3, netMarginPct:29.8 },
    { owner:'Fatima',    campaigns:17, revenue:700000,  spend:274000, grossMarginPct:60.9, netMarginPct:30.4 },
  ],
  sales: [
    { owner:'Abhimanyu',            campaigns:32, revenue:780000,  spend:296000, grossMarginPct:62.1, netMarginPct:32.8 },
    { owner:'Alex Debenham Burton', campaigns:14, revenue:460000,  spend:176000, grossMarginPct:61.7, netMarginPct:32.1 },
    { owner:'Alexa Doan',           campaigns:8,  revenue:380000,  spend:146000, grossMarginPct:61.6, netMarginPct:31.6 },
    { owner:'Andreas Wahlman',      campaigns:15, revenue:1120000, spend:428000, grossMarginPct:61.8, netMarginPct:32.2 },
    { owner:'Ben Clarke',           campaigns:11, revenue:560000,  spend:214000, grossMarginPct:61.8, netMarginPct:32.0 },
    { owner:'Carlos Ruiz',          campaigns:19, revenue:740000,  spend:284000, grossMarginPct:61.6, netMarginPct:31.4 },
    { owner:'Diana Park',           campaigns:9,  revenue:420000,  spend:162000, grossMarginPct:61.4, netMarginPct:31.2 },
    { owner:'Emma Wilson',          campaigns:13, revenue:580000,  spend:224000, grossMarginPct:61.4, netMarginPct:31.0 },
  ],
};

// ── Average Buying CPM Trend ──────────────────────────────────────────────
export function mockCPMTrend() {
  // Exact 2025 values from screenshot (Apr/May missing = null)
  const v2025 = [null, null, null, 3.6, null, 3.6, 3.2, 3.1, 2.2, 2.2, 1.7, 3.3];
  // Exact 2026 values (Jan–Mar shown)
  const v2026 = [3.5, 4.3, 4.6, null, null, null, null, null, null, null, null, null];

  const rand = seededRand(55);
  const base = { 2020: 1.8, 2021: 2.1, 2022: 2.5, 2023: 2.8, 2024: 3.0 };
  const seasonal = [0.90,0.92,0.95,1.05,0.98,1.02,1.0,0.98,0.85,0.88,0.80,1.05];

  return SHORT_MONTHS.map((m, i) => {
    const row = { month: m };
    Object.entries(base).forEach(([y, b]) => {
      row[y] = +(b * seasonal[i] * (0.88 + rand() * 0.24)).toFixed(1);
    });
    if (v2025[i] !== null) row[2025] = v2025[i];
    if (v2026[i] !== null) row[2026] = v2026[i];
    return row;
  });
}

// ── Net Margin Trend (Tracker Sheet) ─────────────────────────────────────
export function mockNetMarginTrend() {
  // Exact 2025 values from screenshot
  const v2025 = [30.78, 34.04, 34.12, 36.37, 32.66, 37.76, 48.31, 48.03, 44.38, 44.78, 51.85, 33.05];
  // 2026 values (Apr–Jun shown at 50%)
  const v2026 = [null, null, null, 50.00, 50.00, 50.00, null, null, null, null, null, null];

  const rand = seededRand(123);
  const base = { 2020: 22, 2021: 26, 2022: 29, 2023: 31, 2024: 33 };
  const seasonal = [0.92,0.95,0.95,0.98,0.93,0.99,1.06,1.05,1.0,1.01,1.08,0.90];

  return SHORT_MONTHS.map((m, i) => {
    const row = { month: m };
    Object.entries(base).forEach(([y, b]) => {
      row[y] = +(b * seasonal[i] * (0.92 + rand() * 0.16)).toFixed(2);
    });
    row[2025] = v2025[i];
    if (v2026[i] !== null) row[2026] = v2026[i];
    return row;
  });
}

// ── Platform Spends (2020–2025 all months) ────────────────────────────────
export function mockPlatformSpends() {
  const platforms = ['CTV','Meta','OpenWeb','Tiktok','Youtube','YT Mirrors'];
  const rand = seededRand(77);
  const rows = [];
  const base = { CTV:15000, Meta:8000, OpenWeb:22000, Tiktok:12000, Youtube:85000, 'YT Mirrors':18000 };
  const growth = { 2020:0.4, 2021:0.55, 2022:0.72, 2023:0.88, 2024:1.0, 2025:1.15 };
  const seasonal = [0.72,0.74,0.85,0.90,0.95,1.0,1.08,1.12,1.05,0.98,0.88,1.22];

  [2020,2021,2022,2023,2024,2025].forEach(year => {
    SHORT_MONTHS.forEach((month, mi) => {
      platforms.forEach(platform => {
        if (platform === 'CTV' && year < 2022) return;
        if (platform === 'YT Mirrors' && year < 2023) return;
        if (platform === 'Meta' && year < 2024) return;
        const spend = Math.round(base[platform] * growth[year] * seasonal[mi] * (0.75 + rand() * 0.5));
        rows.push({ month, year, platform, spend });
      });
    });
  });
  return rows;
}

// ── Bottom Campaigns (full columns matching screenshot) ───────────────────
export const mockBottomCampaigns = [
  { name:'Regent Seven Sea Crui…',   status:'Live', revenue:300000,  spend:178380, grossMargin:121622, grossMarginPct:40.54, netMargin:null,   netMarginPct:null,  plannedImpressions:48600000  },
  { name:'Zoetis Simparica OLV P…',  status:'Live', revenue:250250,  spend:187690, grossMargin:62563,  grossMarginPct:25.00, netMargin:null,   netMarginPct:null,  plannedImpressions:109600000 },
  { name:'Direct Health ECOM',        status:'Live', revenue:141480,  spend:104520, grossMargin:36958,  grossMarginPct:26.12, netMargin:null,   netMarginPct:null,  plannedImpressions:11000000  },
  { name:'Good Apple_Crexont',        status:'Live', revenue:140250,  spend:97930,  grossMargin:42319,  grossMarginPct:30.17, netMargin:null,   netMarginPct:null,  plannedImpressions:62500000  },
  { name:'Zoetis Simparica OLV CC',   status:'Live', revenue:134750,  spend:90330,  grossMargin:44418,  grossMarginPct:32.96, netMargin:null,   netMarginPct:null,  plannedImpressions:49700000  },
  { name:'UK Hasbro Beyblade',        status:'Live', revenue:125520,  spend:83690,  grossMargin:41836,  grossMarginPct:33.33, netMargin:38570,  netMarginPct:30.73, plannedImpressions:13300000  },
  { name:'TX33 Nuestro PAC IE',       status:'Live', revenue:117830,  spend:90780,  grossMargin:27047,  grossMarginPct:22.95, netMargin:null,   netMarginPct:null,  plannedImpressions:7580000   },
];

export const mockBottomCampaignsTotals = {
  revenue:   6900000, spend:   4650000, grossMargin: 2250000,
  grossMarginPct: 32.61, netMargin: 855410, netMarginPct: 12.39, plannedImpressions: 1950000000,
};

// ── Country wise Data ─────────────────────────────────────────────────────
export const mockCountryData = [
  { region:'India+SEA',     campaigns:153, budgetGroups:1216, revenue:7330000,  spend:2510000, plannedImpressions:2590000000, deliveredImpressions:2222320000, deliveredPct:85.91, grossMargin:4810000,  grossMarginPct:65.70 },
  { region:'North America', campaigns:48,  budgetGroups:295,  revenue:4550000,  spend:2630000, plannedImpressions:1140000000, deliveredImpressions:628350000,  deliveredPct:55.10, grossMargin:1920000,  grossMarginPct:42.21 },
  { region:'Australia',     campaigns:50,  budgetGroups:454,  revenue:3480000,  spend:1120000, plannedImpressions:448890000,  deliveredImpressions:397350000,  deliveredPct:88.52, grossMargin:2360000,  grossMarginPct:67.81 },
  { region:'Europe',        campaigns:118, budgetGroups:305,  revenue:3400000,  spend:1700000, plannedImpressions:335040000,  deliveredImpressions:267040000,  deliveredPct:79.71, grossMargin:1700000,  grossMarginPct:49.93 },
  { region:'Middle East',   campaigns:12,  budgetGroups:131,  revenue:1320000,  spend:382870,  plannedImpressions:128310000,  deliveredImpressions:113270000,  deliveredPct:88.28, grossMargin:941110,   grossMarginPct:71.08 },
  { region:'Rest of APAC',  campaigns:11,  budgetGroups:112,  revenue:453160,   spend:160940,  plannedImpressions:59010000,   deliveredImpressions:54490000,   deliveredPct:92.34, grossMargin:292220,   grossMarginPct:64.48 },
  { region:'Japan',         campaigns:12,  budgetGroups:58,   revenue:380790,   spend:185030,  plannedImpressions:44060000,   deliveredImpressions:34830000,   deliveredPct:79.06, grossMargin:195760,   grossMarginPct:51.41 },
  { region:'Africa',        campaigns:13,  budgetGroups:72,   revenue:210530,   spend:91430,   plannedImpressions:30500000,   deliveredImpressions:17050000,   deliveredPct:55.90, grossMargin:105350,   grossMarginPct:50.04 },
];

export const mockCountryTotals = {
  campaigns:417, budgetGroups:2643, revenue:21140000, spend:8720000,
  plannedImpressions:4770000000, deliveredImpressions:3734950000, deliveredPct:78.27,
  grossMargin:12420000, grossMarginPct:58.74,
};

// ── Product wise data (matches screenshot layout) ──
export const mockProductData = [
  {
    product:"Product",
    totalCampaigns:1,
    budgetGroups:55,
    bookedRevenue:480000,
    spend:166740,
    plannedImpressions:22370000,
    deliveredImpressions:19380000,
    deliveredPct:86.67,
    grossProfitLoss:310000,
    grossMargin:64.92,
  },
  {
    product:"Crafters",
    totalCampaigns:1,
    budgetGroups:8,
    bookedRevenue:40000,
    spend:19260,
    plannedImpressions:13680000,
    deliveredImpressions:13390000,
    deliveredPct:97.86,
    grossProfitLoss:20000,
    grossMargin:45.98,
  },
  {
    product:"Mirrors",
    totalCampaigns:294,
    budgetGroups:1956,
    bookedRevenue:16310000,
    spend:6950000,
    plannedImpressions:3288620000,
    deliveredImpressions:2666610000,
    deliveredPct:81.09,
    grossProfitLoss:9360000,
    grossMargin:57.38,
  },
  {
    product:"Open",
    totalCampaigns:12,
    budgetGroups:93,
    bookedRevenue:1220000,
    spend:425210,
    plannedImpressions:550240000,
    deliveredImpressions:508120000,
    deliveredPct:92.35,
    grossProfitLoss:790000,
    grossMargin:65.09,
  },
  {
    product:"Others",
    totalCampaigns:2,
    budgetGroups:29,
    bookedRevenue:60000,
    spend:13750,
    plannedImpressions:14790000,
    deliveredImpressions:13860000,
    deliveredPct:93.72,
    grossProfitLoss:40000,
    grossMargin:76.47,
  },
  {
    product:"Parallels",
    totalCampaigns:11,
    budgetGroups:95,
    bookedRevenue:550000,
    spend:118830,
    plannedImpressions:222990000,
    deliveredImpressions:206760000,
    deliveredPct:92.72,
    grossProfitLoss:430000,
    grossMargin:78.48,
  },
  {
    product:"Self serve",
    totalCampaigns:1,
    budgetGroups:12,
    bookedRevenue:10000,
    spend:1160,
    plannedImpressions:2010000,
    deliveredImpressions:1990000,
    deliveredPct:98.99,
    grossProfitLoss:8900,
    grossMargin:90.93,
  },
  {
    product:"TIKTOK",
    totalCampaigns:1,
    budgetGroups:3,
    bookedRevenue:20000,
    spend:5880,
    plannedImpressions:1980000,
    deliveredImpressions:2010000,
    deliveredPct:101.53,
    grossProfitLoss:10000,
    grossMargin:61.64,
  },
  {
    product:"Zimmer",
    totalCampaigns:1,
    budgetGroups:1,
    bookedRevenue:0,
    spend:159,
    plannedImpressions:10000,
    deliveredImpressions:9350,
    deliveredPct:93.63,
    grossProfitLoss:0,
    grossMargin:80.74,
  },
];

export const mockProductTotals = {
  totalCampaigns:315,
  budgetGroups:2252,
  bookedRevenue:18680000,
  spend:7700000,
  plannedImpressions:4114680000,
  deliveredImpressions:3434930000,
  deliveredPct:83.48,
  grossProfitLoss:10980000,
  grossMargin:58.77,
};

// Children under each product for expand/collapse (sample values)
export const mockProductChildren = {
  Product: [
    {
      product:"Youtube",
      totalCampaigns:324,
      budgetGroups:1677,
      bookedRevenue:15150000,
      spend:6940000,
      plannedImpressions:3000000000,
      deliveredImpressions:2110630000,
      deliveredPct:70.41,
      grossProfitLoss:8210000,
      grossMargin:54.15,
    },
    {
      product:"OpenWeb",
      totalCampaigns:18,
      budgetGroups:192,
      bookedRevenue:1200000,
      spend:239620,
      plannedImpressions:319980000,
      deliveredImpressions:307740000,
      deliveredPct:96.18,
      grossProfitLoss:961690,
      grossMargin:80.00,
    },
    {
      product:"Meta",
      totalCampaigns:24,
      budgetGroups:279,
      bookedRevenue:1590000,
      spend:550880,
      plannedImpressions:271610000,
      deliveredImpressions:251610000,
      deliveredPct:92.64,
      grossProfitLoss:1040000,
      grossMargin:65.35,
    },
    {
      product:"Other Platforms",
      totalCampaigns:4,
      budgetGroups:4,
      bookedRevenue:7660,
      spend:79038,
      plannedImpressions:0,
      deliveredImpressions:0,
      deliveredPct:null,
      grossProfitLoss:6876,
      grossMargin:89.66,
    },
    {
      product:"Tiktok",
      totalCampaigns:26,
      budgetGroups:166,
      bookedRevenue:727020,
      spend:214650,
      plannedImpressions:317330000,
      deliveredImpressions:278100000,
      deliveredPct:87.64,
      grossProfitLoss:512370,
      grossMargin:70.48,
    },
    {
      product:"CTV",
      totalCampaigns:3,
      budgetGroups:3,
      bookedRevenue:5340,
      spend:3660,
      plannedImpressions:688830,
      deliveredImpressions:510720,
      deliveredPct:74.14,
      grossProfitLoss:1680,
      grossMargin:31.46,
    },
    {
      product:"YT Mirrors",
      totalCampaigns:1,
      budgetGroups:1,
      bookedRevenue:302820,
      spend:114540,
      plannedImpressions:84710,
      deliveredImpressions:84710,
      deliveredPct:100.00,
      grossProfitLoss:188280,
      grossMargin:62.14,
    },
  ],
  Mirrors: [
    {
      product:"Youtube",
      totalCampaigns:324,
      budgetGroups:1677,
      bookedRevenue:15150000,
      spend:6940000,
      plannedImpressions:3000000000,
      deliveredImpressions:2110630000,
      deliveredPct:70.41,
      grossProfitLoss:8210000,
      grossMargin:54.15,
    },
    {
      product:"OpenWeb",
      totalCampaigns:18,
      budgetGroups:192,
      bookedRevenue:1200000,
      spend:239620,
      plannedImpressions:319980000,
      deliveredImpressions:307740000,
      deliveredPct:96.18,
      grossProfitLoss:961690,
      grossMargin:80.00,
    },
    {
      product:"Meta",
      totalCampaigns:24,
      budgetGroups:279,
      bookedRevenue:1590000,
      spend:550880,
      plannedImpressions:271610000,
      deliveredImpressions:251610000,
      deliveredPct:92.64,
      grossProfitLoss:1040000,
      grossMargin:65.35,
    },
    {
      product:"Other",
      totalCampaigns:4,
      budgetGroups:4,
      bookedRevenue:7660,
      spend:79038,
      plannedImpressions:0,
      deliveredImpressions:0,
      deliveredPct:null,
      grossProfitLoss:6876,
      grossMargin:89.66,
    },
    {
      product:"Tiktok",
      totalCampaigns:26,
      budgetGroups:166,
      bookedRevenue:727020,
      spend:214650,
      plannedImpressions:317330000,
      deliveredImpressions:278100000,
      deliveredPct:87.64,
      grossProfitLoss:512370,
      grossMargin:70.48,
    },
    {
      product:"CTV",
      totalCampaigns:3,
      budgetGroups:3,
      bookedRevenue:5340,
      spend:3660,
      plannedImpressions:688830,
      deliveredImpressions:510720,
      deliveredPct:74.14,
      grossProfitLoss:1680,
      grossMargin:31.46,
    },
    {
      product:"YT Mirrors",
      totalCampaigns:1,
      budgetGroups:1,
      bookedRevenue:302820,
      spend:114540,
      plannedImpressions:84710,
      deliveredImpressions:84710,
      deliveredPct:100.00,
      grossProfitLoss:188280,
      grossMargin:62.14,
    },
  ],
  Open: [
    {
      product:"Programmatic",
      totalCampaigns:6,
      budgetGroups:40,
      bookedRevenue:620000,
      spend:210000,
      plannedImpressions:190000000,
      deliveredImpressions:168000000,
      deliveredPct:88.42,
      grossProfitLoss:410000,
      grossMargin:66.13,
    },
    {
      product:"Direct",
      totalCampaigns:6,
      budgetGroups:53,
      bookedRevenue:650000,
      spend:228820,
      plannedImpressions:379990000,
      deliveredImpressions:352110000,
      deliveredPct:92.65,
      grossProfitLoss:421000,
      grossMargin:64.77,
    },
  ],
  Others: [
    {
      product:"Marketplace",
      totalCampaigns:1,
      budgetGroups:15,
      bookedRevenue:30000,
      spend:7200,
      plannedImpressions:7200000,
      deliveredImpressions:7020000,
      deliveredPct:97.50,
      grossProfitLoss:22800,
      grossMargin:76.00,
    },
    {
      product:"Affiliate",
      totalCampaigns:1,
      budgetGroups:14,
      bookedRevenue:30000,
      spend:6550,
      plannedImpressions:7590000,
      deliveredImpressions:6840000,
      deliveredPct:90.12,
      grossProfitLoss:23450,
      grossMargin:78.17,
    },
  ],
  Parallels: [
    {
      product:"Publisher Direct",
      totalCampaigns:6,
      budgetGroups:50,
      bookedRevenue:320000,
      spend:88000,
      plannedImpressions:122990000,
      deliveredImpressions:114760000,
      deliveredPct:93.29,
      grossProfitLoss:232000,
      grossMargin:72.50,
    },
    {
      product:"Reseller",
      totalCampaigns:5,
      budgetGroups:45,
      bookedRevenue:230000,
      spend:30830,
      plannedImpressions:100000000,
      deliveredImpressions:92000000,
      deliveredPct:92.00,
      grossProfitLoss:199170,
      grossMargin:86.59,
    },
  ],
  "Self serve": [
    {
      product:"Self-serve Platform",
      totalCampaigns:1,
      budgetGroups:12,
      bookedRevenue:10000,
      spend:1160,
      plannedImpressions:2010000,
      deliveredImpressions:1990000,
      deliveredPct:98.99,
      grossProfitLoss:8900,
      grossMargin:90.93,
    },
  ],
  TIKTOK: [
    {
      product:"TikTok Ads",
      totalCampaigns:1,
      budgetGroups:3,
      bookedRevenue:20000,
      spend:5880,
      plannedImpressions:1980000,
      deliveredImpressions:2010000,
      deliveredPct:101.53,
      grossProfitLoss:10000,
      grossMargin:61.64,
    },
  ],
  Zimmer: [],
  Crafters: [],
};

// ── Campaign wise data (table below the product table) ──
export const mockCampaignWise = [
  {
    name:"MYT_France_Initiative_Dyson_XCAT Wintersales_2026",
    budgetGroups:2,
    startDate:"2026-01-07",
    endDate:"2026-02-03",
    plannedImpressions:86000000,
  },
  {
    name:"Natures Own Energy & Sleep_Shorts",
    budgetGroups:2,
    startDate:"2026-01-29",
    endDate:"2026-02-25",
    plannedImpressions:42000000,
  },
  {
    name:"nonskip Monster Jam Mini Jams",
    budgetGroups:1,
    startDate:"2026-02-02",
    endDate:"2026-02-28",
    plannedImpressions:36000000,
  },
  {
    name:"skip Monster Jam Mini Jams (views)",
    budgetGroups:1,
    startDate:"2026-02-02",
    endDate:"2026-02-28",
    plannedImpressions:34000000,
  },
  {
    name:"Vietnam_JUL-VN42_Zott Montinis_Yogurt_2025060",
    budgetGroups:3,
    startDate:"2025-07-30",
    endDate:"2025-12-03",
    plannedImpressions:118000000,
  },
  {
    name:'"ENCHANTEUR  DELUXE"',
    budgetGroups:1,
    startDate:"2025-08-01",
    endDate:"2025-09-19",
    plannedImpressions:19000000,
  },
  {
    name:"(FRANCE)  MiddleEast_Ellington_Properties_Mirrors",
    budgetGroups:1,
    startDate:"2025-08-19",
    endDate:"2025-09-19",
    plannedImpressions:19000000,
  },
];

export const mockCampaignWiseTotals = null;
