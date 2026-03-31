const RAW_RATES = [
  ["Thailand", "THB", 0.03155, 31.6957210776545],
  ["Philippines", "USD", 1, 1],
  ["Singapore", "SGD", 0.76564, 1.30609686014315],
  ["Vietnam", "USD", 1, 1],
  ["Malaysia", "RM", 0.25, 4],
  ["USA", "USD", 1, 1],
  ["Australia", "AUD", 0.659318, 1.51671879123579],
  ["Middle East", "USD", 1, 1],
  ["Pakistan", "USD", 1, 1],
  ["Indonesia", "IDR", 0.00006, 16666.6666666667],
  ["South Africa", "USD", 1, 1],
  ["Kenya", "USD", 1, 1],
  ["New Zealand", "NZD", 0.6, 1.66666666666667],
  ["Japan", "JPY", 0.0064, 156.25],
  ["India", "INR", 0.011, 90.9090909090909],
  ["Canada", "USD", 1, 1],
  ["Portugal", "GBP", 1.35, 0.740740740740741],
  ["Netherlands", "GBP", 1.35, 0.740740740740741],
  ["UK", "GBP", 1.35, 0.740740740740741],
  ["France", "GBP", 1.35, 0.740740740740741],
  ["Spain", "GBP", 1.35, 0.740740740740741],
  ["Germany", "GBP", 1.35, 0.740740740740741],
  ["Sweden", "GBP", 1.35, 0.740740740740741],
  ["Italy", "GBP", 1.35, 0.740740740740741],
  ["Africa", "USD", 1, 1],
  ["Nigeria", "USD", 1, 1],
  ["Zambia", "USD", 1, 1],
  ["Switzerland", "GBP", 1.35, 0.740740740740741],
  ["Uganda", "USD", 1, 1],
  ["Ghana", "USD", 1, 1],
  ["Belgium", "USD", 1, 1],
  ["Chile", "USD", 1, 1],
  ["Finland", "USD", 1, 1],
  ["Denmark", "USD", 1, 1],
  ["Cameroon", "USD", 1, 1],
  ["Baltics", "USD", 1, 1],
  ["Bangladesh", "USD", 1, 1],
  ["Brazil", "USD", 1, 1],
  ["Cambodia", "USD", 1, 1],
  ["Cyprus", "USD", 1, 1],
  ["Hong Kong", "USD", 1, 1],
  ["Mozambique", "USD", 1, 1],
  ["South Korea", "USD", 1, 1],
  ["Sri Lanka", "USD", 1, 1],
  ["Taiwan", "USD", 1, 1],
  ["Turkey", "USD", 1, 1]
];

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const COUNTRY_ALIASES = {
  "united states": "USA",
  usa: "USA",
  "us": "USA",
  "u.s.": "USA",
  "u s a": "USA",
  "united kingdom": "UK",
  uk: "UK",
  "u.k.": "UK",
  "newzealand": "New Zealand",
  "new zealand": "New Zealand",
  "southafrica": "South Africa",
  "south africa": "South Africa",
  "middleeast": "Middle East",
  "middle east": "Middle East",
  phillipines: "Philippines",
  philippines: "Philippines"
};

const RATES_BY_COUNTRY = new Map(
  RAW_RATES.map(([country, currencyCode, oneUnitUsd, usdToLocal]) => [
    normalizeKey(country),
    {
      country,
      currencyCode,
      oneUnitUsd: Number(oneUnitUsd),
      usdToLocal: Number(usdToLocal)
    }
  ])
);

export function getCountryRate(countryName) {
  const raw = String(countryName || "").trim();
  if (!raw) return null;
  const alias = COUNTRY_ALIASES[normalizeKey(raw)] || raw;
  return RATES_BY_COUNTRY.get(normalizeKey(alias)) || null;
}

export function resolveSelectedCountries(regionFilter, regionTree = []) {
  const values = Array.isArray(regionFilter)
    ? regionFilter
    : String(regionFilter || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  const cleaned = values.filter((v) => String(v).toLowerCase() !== "all");
  if (!cleaned.length) return [];

  const regionMap = new Map();
  (regionTree || []).forEach((node) => {
    const region = String(node?.region || "").trim();
    if (!region) return;
    const countries = Array.isArray(node?.countries) ? node.countries : [];
    regionMap.set(normalizeKey(region), countries.map((c) => String(c || "").trim()).filter(Boolean));
  });

  const selected = new Set();
  cleaned.forEach((token) => {
    const text = String(token || "").trim();
    if (!text) return;
    const lower = text.toLowerCase();

    if (lower.startsWith("country::")) {
      const country = text.slice("country::".length).trim();
      if (country) selected.add(country);
      return;
    }

    if (lower.startsWith("region::")) {
      const region = text.slice("region::".length).trim();
      const regionCountries = regionMap.get(normalizeKey(region)) || [];
      if (regionCountries.length) {
        regionCountries.forEach((country) => selected.add(country));
      } else if (region) {
        selected.add(region);
      }
      return;
    }

    const regionCountries = regionMap.get(normalizeKey(text)) || [];
    if (regionCountries.length) {
      regionCountries.forEach((country) => selected.add(country));
      return;
    }

    selected.add(text);
  });

  return Array.from(selected);
}

