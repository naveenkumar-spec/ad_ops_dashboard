const records = [
  // Ops
  { ownerType: "ops", owner: "Lakshman", campaigns: 18, budgetGroups: 235, revenue: 1870000, spend: 930000, grossMarginPct: 55.2, netMarginPct: 28.4, bookedRevenue: 1870.0, region: "APAC", year: 2025, month: "Jan", status: "Active", product: "Display", platform: "Youtube" },
  { ownerType: "ops", owner: "Ravi Arya", campaigns: 14, budgetGroups: 231, revenue: 1298000, spend: 640000, grossMarginPct: 52.1, netMarginPct: 26.2, bookedRevenue: 1298.2, region: "APAC", year: 2025, month: "Feb", status: "Active", product: "Display", platform: "Youtube" },
  { ownerType: "ops", owner: "Susanketh", campaigns: 12, budgetGroups: 187, revenue: 1161000, spend: 520000, grossMarginPct: 48.3, netMarginPct: 23.1, bookedRevenue: 1161.7, region: "APAC", year: 2025, month: "Mar", status: "Active", product: "Video", platform: "OpenWeb" },
  { ownerType: "ops", owner: "Abhishek", campaigns: 11, budgetGroups: 177, revenue: 642000, spend: 330000, grossMarginPct: 40.1, netMarginPct: 18.7, bookedRevenue: 641.9, region: "APAC", year: 2025, month: "Apr", status: "Paused", product: "Video", platform: "Tiktok" },
  { ownerType: "ops", owner: "Shivam", campaigns: 9, budgetGroups: 127, revenue: 511000, spend: 250000, grossMarginPct: 37.9, netMarginPct: 16.5, bookedRevenue: 511.3, region: "APAC", year: 2025, month: "May", status: "Active", product: "Display", platform: "OpenWeb" },
  { ownerType: "ops", owner: "Kamlesh", campaigns: 10, budgetGroups: 109, revenue: 1255000, spend: 560000, grossMarginPct: 46.0, netMarginPct: 22.4, bookedRevenue: 1255.0, region: "EMEA", year: 2025, month: "Jun", status: "Active", product: "Display", platform: "Youtube" },
  { ownerType: "ops", owner: "Abhinav", campaigns: 8, budgetGroups: 100, revenue: 620000, spend: 300000, grossMarginPct: 41.4, netMarginPct: 20.1, bookedRevenue: 619.9, region: "EMEA", year: 2025, month: "Jul", status: "Active", product: "Search", platform: "CTV" },
  { ownerType: "ops", owner: "Hrishikesh", campaigns: 7, budgetGroups: 96, revenue: 861000, spend: 420000, grossMarginPct: 37.0, netMarginPct: 18.0, bookedRevenue: 861.4, region: "EMEA", year: 2025, month: "Aug", status: "Active", product: "Video", platform: "Tiktok" },
  { ownerType: "ops", owner: "Rohit", campaigns: 6, budgetGroups: 89, revenue: 370000, spend: 190000, grossMarginPct: 35.0, netMarginPct: 16.0, bookedRevenue: 370.0, region: "Americas", year: 2025, month: "Sep", status: "Paused", product: "Video", platform: "Youtube" },
  { ownerType: "ops", owner: "Sumit", campaigns: 13, budgetGroups: 88, revenue: 1870000, spend: 900000, grossMarginPct: 51.5, netMarginPct: 26.5, bookedRevenue: 1870.0, region: "Americas", year: 2025, month: "Oct", status: "Active", product: "Video", platform: "Youtube" },
  { ownerType: "ops", owner: "Utkarsh", campaigns: 12, budgetGroups: 86, revenue: 1160000, spend: 590000, grossMarginPct: 43.4, netMarginPct: 21.5, bookedRevenue: 1159.7, region: "Americas", year: 2025, month: "Nov", status: "Active", product: "Display", platform: "OpenWeb" },
  { ownerType: "ops", owner: "Shubh", campaigns: 9, budgetGroups: 82, revenue: 885000, spend: 430000, grossMarginPct: 38.7, netMarginPct: 18.9, bookedRevenue: 885.3, region: "Americas", year: 2025, month: "Dec", status: "Active", product: "Search", platform: "CTV" },
  { ownerType: "ops", owner: "Ranjith", campaigns: 8, budgetGroups: 77, revenue: 308000, spend: 150000, grossMarginPct: 34.0, netMarginPct: 14.5, bookedRevenue: 308.2, region: "APAC", year: 2026, month: "Jan", status: "Active", product: "Display", platform: "Youtube" },

  // CS
  { ownerType: "cs", owner: "Apoorva", campaigns: 37, budgetGroups: 306, revenue: 1984000, spend: 820000, grossMarginPct: 48.5, netMarginPct: 23.2, bookedRevenue: 1984.3, region: "APAC", year: 2025, month: "Jan", status: "Active", product: "Video", platform: "Youtube" },
  { ownerType: "cs", owner: "Puja", campaigns: 22, budgetGroups: 201, revenue: 354000, spend: 160000, grossMarginPct: 34.4, netMarginPct: 12.8, bookedRevenue: 354.4, region: "APAC", year: 2025, month: "Feb", status: "Active", product: "Display", platform: "OpenWeb" },
  { ownerType: "cs", owner: "Christian", campaigns: 18, budgetGroups: 190, revenue: 284000, spend: 130000, grossMarginPct: 32.1, netMarginPct: 11.7, bookedRevenue: 283.8, region: "EMEA", year: 2025, month: "Mar", status: "Active", product: "Search", platform: "Tiktok" },
  { ownerType: "cs", owner: "Debrata", campaigns: 14, budgetGroups: 85, revenue: 306000, spend: 150000, grossMarginPct: 30.2, netMarginPct: 10.9, bookedRevenue: 306.3, region: "EMEA", year: 2025, month: "Apr", status: "Active", product: "Search", platform: "CTV" },
  { ownerType: "cs", owner: "Sagar", campaigns: 12, budgetGroups: 84, revenue: 300000, spend: 140000, grossMarginPct: 31.0, netMarginPct: 11.2, bookedRevenue: 300.3, region: "EMEA", year: 2025, month: "May", status: "Active", product: "Display", platform: "OpenWeb" },
  { ownerType: "cs", owner: "Achala", campaigns: 17, budgetGroups: 73, revenue: 390000, spend: 185000, grossMarginPct: 33.5, netMarginPct: 13.1, bookedRevenue: 390.1, region: "Americas", year: 2025, month: "Jun", status: "Active", product: "Video", platform: "Youtube" },
  { ownerType: "cs", owner: "Natercia", campaigns: 16, budgetGroups: 70, revenue: 1170000, spend: 520000, grossMarginPct: 46.2, netMarginPct: 21.4, bookedRevenue: 1169.7, region: "Americas", year: 2025, month: "Jul", status: "Active", product: "Video", platform: "Youtube" },
  { ownerType: "cs", owner: "Mayank", campaigns: 15, budgetGroups: 57, revenue: 1264000, spend: 600000, grossMarginPct: 44.8, netMarginPct: 20.6, bookedRevenue: 1264.2, region: "Americas", year: 2025, month: "Aug", status: "Active", product: "Display", platform: "OpenWeb" },
  { ownerType: "cs", owner: "Graham", campaigns: 13, budgetGroups: 56, revenue: 1714000, spend: 740000, grossMarginPct: 46.3, netMarginPct: 22.1, bookedRevenue: 1714.4, region: "Americas", year: 2025, month: "Sep", status: "Active", product: "Video", platform: "Youtube" },
  { ownerType: "cs", owner: "Abhishek", campaigns: 12, budgetGroups: 45, revenue: 354000, spend: 180000, grossMarginPct: 28.9, netMarginPct: 10.2, bookedRevenue: 354.4, region: "APAC", year: 2025, month: "Oct", status: "Paused", product: "Video", platform: "Tiktok" },
  { ownerType: "cs", owner: "Sydney", campaigns: 11, budgetGroups: 44, revenue: 1071000, spend: 510000, grossMarginPct: 42.2, netMarginPct: 19.8, bookedRevenue: 1070.9, region: "APAC", year: 2025, month: "Nov", status: "Active", product: "Display", platform: "OpenWeb" },
  { ownerType: "cs", owner: "Alexandra", campaigns: 10, budgetGroups: 43, revenue: 1984000, spend: 880000, grossMarginPct: 44.2, netMarginPct: 21.0, bookedRevenue: 1984.3, region: "APAC", year: 2025, month: "Dec", status: "Active", product: "Video", platform: "Youtube" },

  // Sales
  { ownerType: "sales", owner: "Abhimanyu", campaigns: 28, budgetGroups: 140, revenue: 600000, spend: 240000, grossMarginPct: 35.0, netMarginPct: 16.0, bookedRevenue: 600.0, region: "APAC", year: 2025, month: "Jan", status: "Active", product: "Display", platform: "OpenWeb" },
  { ownerType: "sales", owner: "Alexa Doan", campaigns: 16, budgetGroups: 95, revenue: 260000, spend: 130000, grossMarginPct: 34.5, netMarginPct: 15.0, bookedRevenue: 260.0, region: "APAC", year: 2025, month: "Feb", status: "Active", product: "Video", platform: "Youtube" },
  { ownerType: "sales", owner: "Alex Debenham", campaigns: 11, budgetGroups: 78, revenue: 300000, spend: 90000, grossMarginPct: 46.0, netMarginPct: 22.5, bookedRevenue: 300.0, region: "EMEA", year: 2025, month: "Mar", status: "Paused", product: "Search", platform: "OpenWeb" },
  { ownerType: "sales", owner: "Andreas Wahlman", campaigns: 12, budgetGroups: 82, revenue: 920000, spend: 320000, grossMarginPct: 48.2, netMarginPct: 24.0, bookedRevenue: 920.0, region: "Americas", year: 2025, month: "Apr", status: "Active", product: "Video", platform: "Youtube" }
];

function normalize(val) {
  if (val === undefined || val === null) return "";
  return String(val).trim().toLowerCase();
}

function toFilterList(value) {
  if (value === undefined || value === null || value === "all") return [];
  if (Array.isArray(value)) {
    return value.map(normalize).filter((v) => v && v !== "all");
  }
  return String(value)
    .split(",")
    .map(normalize)
    .filter((v) => v && v !== "all");
}

function matches(record, filters) {
  const entries = Object.entries(filters);
  for (const [key, value] of entries) {
    const list = toFilterList(value);
    if (!list.length) continue;
    const recVal = normalize(record[key]);
    if (!list.includes(recVal)) return false;
  }
  return true;
}

function getOwnerPerformance(ownerType, filters = {}) {
  const filtered = records.filter(r => r.ownerType === ownerType && matches(r, filters));
  // sort by revenue desc
  return filtered.sort((a, b) => b.revenue - a.revenue).map(r => ({
    owner: r.owner,
    campaigns: r.campaigns,
    revenue: r.revenue,
    spend: r.spend,
    grossMarginPct: r.grossMarginPct,
    netMarginPct: r.netMarginPct,
    budgetGroups: r.budgetGroups,
    bookedRevenue: r.bookedRevenue
  }));
}

function getFilterOptions() {
  const unique = (field) => [...new Set(records.map(r => r[field]))];
  return {
    region: unique("region"),
    year: unique("year"),
    month: unique("month"),
    status: unique("status"),
    product: unique("product"),
    platform: unique("platform")
  };
}

const platformSpends = [
  { month: "Apr", year: 2025, platform: "CTV", spend: 3700 },
  { month: "Apr", year: 2025, platform: "OpenWeb", spend: 16790 },
  { month: "Apr", year: 2025, platform: "Tiktok", spend: 2980 },
  { month: "Apr", year: 2025, platform: "Youtube", spend: 38570 },
  { month: "May", year: 2025, platform: "CTV", spend: 9100 },
  { month: "May", year: 2025, platform: "OpenWeb", spend: 16250 },
  { month: "May", year: 2025, platform: "Tiktok", spend: 3520 },
  { month: "May", year: 2025, platform: "Youtube", spend: 69670 },
  { month: "Jun", year: 2025, platform: "OpenWeb", spend: 49550 },
  { month: "Jun", year: 2025, platform: "Tiktok", spend: 3460 },
  { month: "Jun", year: 2025, platform: "Youtube", spend: 82540 },
  { month: "Jul", year: 2025, platform: "CTV", spend: 143260 },
  { month: "Jul", year: 2025, platform: "YT Mirrors", spend: 4280 },
  { month: "Aug", year: 2025, platform: "CTV", spend: 260 },
  { month: "Aug", year: 2025, platform: "OpenWeb", spend: 68940 },
  { month: "Aug", year: 2025, platform: "Tiktok", spend: 3530 },
  { month: "Aug", year: 2025, platform: "Youtube", spend: 408390 },
  { month: "Sep", year: 2025, platform: "CTV", spend: 17870 },
  { month: "Sep", year: 2025, platform: "OpenWeb", spend: 76530 },
  { month: "Sep", year: 2025, platform: "Tiktok", spend: 7900 },
  { month: "Sep", year: 2025, platform: "Youtube", spend: 332840 },
  { month: "Oct", year: 2025, platform: "CTV", spend: 4500 },
  { month: "Oct", year: 2025, platform: "Meta", spend: 1200 },
  { month: "Oct", year: 2025, platform: "OpenWeb", spend: 75340 },
  { month: "Oct", year: 2025, platform: "Tiktok", spend: 24210 },
  { month: "Oct", year: 2025, platform: "Youtube", spend: 285160 },
  { month: "Oct", year: 2025, platform: "YT Mirrors", spend: 449340 }
];

function getPlatformSpends(filters = {}) {
  const years = toFilterList(filters.year);
  const months = toFilterList(filters.month);
  const platforms = toFilterList(filters.platform);
  return platformSpends.filter((row) => {
    if (years.length && !years.includes(normalize(row.year))) return false;
    if (months.length && !months.includes(normalize(row.month))) return false;
    if (platforms.length && !platforms.includes(normalize(row.platform))) return false;
    return true;
  });
}

module.exports = {
  getOwnerPerformance,
  getFilterOptions,
  getPlatformSpends
};
