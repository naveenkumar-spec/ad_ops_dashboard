import { formatAbsoluteCurrency } from "./absoluteTooltip.js";
import { getCountryRate, resolveSelectedCountries } from "./currencyRates.js";

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function resolveCurrencyContext({
  mode = "USD",
  regionFilter = "all",
  regionTree = []
} = {}) {
  const requestedNative = String(mode || "USD").toLowerCase() === "native";
  if (!requestedNative) {
    return {
      mode: "USD",
      currencyCode: "USD",
      usdToLocal: 1,
      localToUsd: 1,
      selectedCountry: null,
      converted: false
    };
  }

  const countries = resolveSelectedCountries(regionFilter, regionTree);
  if (countries.length !== 1) {
    return {
      mode: "USD",
      currencyCode: "USD",
      usdToLocal: 1,
      localToUsd: 1,
      selectedCountry: null,
      converted: false
    };
  }

  const rate = getCountryRate(countries[0]);
  if (!rate) {
    return {
      mode: "USD",
      currencyCode: "USD",
      usdToLocal: 1,
      localToUsd: 1,
      selectedCountry: null,
      converted: false
    };
  }

  return {
    mode: "Native",
    currencyCode: rate.currencyCode || "USD",
    usdToLocal: Number(rate.usdToLocal || 1),
    localToUsd: Number(rate.oneUnitUsd || 1),
    selectedCountry: rate.country,
    converted: true
  };
}

/**
 * NO CONVERSION - Backend already returns the correct values based on currency mode.
 * This function now just passes through the value and updates the currency code for display.
 * 
 * @param {number} value - Value from backend (already in correct currency)
 * @param {object} context - Currency context with mode and currencyCode
 * @returns {number|null} - Value as-is (no conversion)
 */
export function convertUsdToDisplay(value, context) {
  const n = toNumber(value);
  if (n === null) return null;
  
  // Backend already returns the correct values based on currency mode
  // No conversion needed on frontend
  return n;
}

export function formatCompactCurrency(value, context, digits = 2) {
  const n = toNumber(value);
  if (n === null) return "";
  const code = context?.currencyCode || "USD";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${code} ${(n / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${code} ${(n / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${code} ${(n / 1e3).toFixed(digits)}K`;
  return `${code} ${n.toFixed(0)}`;
}

export function formatAbsoluteCurrencyByContext(value, context) {
  return formatAbsoluteCurrency(value, context?.currencyCode || "USD");
}

