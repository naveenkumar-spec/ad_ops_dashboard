import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, LabelList
} from "recharts";
import { apiGet } from "../utils/apiClient";
import { mockRevenueTrend, mockMarginTrend, mockCPMTrend, mockNetMarginTrend } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import { formatAbsoluteNumber, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import { convertUsdToDisplay, formatAbsoluteCurrencyByContext, formatCompactCurrency } from "../utils/currencyDisplay.js";
import "../../styles/Charts.css";
const ENABLE_MOCK_FALLBACK = String(import.meta.env.VITE_ENABLE_MOCK_FALLBACK || "").toLowerCase() === "true";

// Year color order (latest year -> older year), as requested by design.
const YEAR_COLORS = ["#2BA18B", "#208171", "#1D685C", "#1C534C", "#1B4640", "#0A2926"];

function fallbackColor(index) {
  // Deterministic "random-like" fallback for additional years beyond the fixed palette.
  const hue = (index * 137.508) % 360;
  return `hsl(${hue.toFixed(0)} 55% 45%)`;
}

const colorForIndex = (index) => YEAR_COLORS[index] || fallbackColor(index);

const MONTHS_ORDER = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_TO_FULL = {Jan:'January',Feb:'February',Mar:'March',Apr:'April',May:'May',Jun:'June',Jul:'July',Aug:'August',Sep:'September',Oct:'October',Nov:'November',Dec:'December'};

function getFallback(endpoint, isPercent, isRaw) {
  if (endpoint?.includes("cpm"))        return mockCPMTrend();
  if (endpoint?.includes("net-margin")) return mockNetMarginTrend();
  if (isPercent)                         return mockMarginTrend();
  return mockRevenueTrend();
}

function buildGroupedData(raw, granularity, selectedYears) {
  if (!raw?.length) return [];
  const expanded = raw.map(r => ({ ...r, month: SHORT_TO_FULL[r.month] || r.month }));
  const sorted = [...expanded].sort((a, b) => MONTHS_ORDER.indexOf(a.month) - MONTHS_ORDER.indexOf(b.month));

  if (granularity === "month") {
    return sorted.map(row => {
      const entry = { label: row.month };
      selectedYears.forEach(y => { if (row[y] != null) entry[y] = Number(row[y]); });
      return entry;
    });
  }
  if (granularity === "quarter") {
    const buckets = {};
    sorted.forEach(row => {
      const mi = MONTHS_ORDER.indexOf(row.month);
      const q = `Q${Math.floor(mi / 3) + 1}`;
      if (!buckets[q]) buckets[q] = { label: q };
      selectedYears.forEach(y => {
        const v = Number(row[y]);
        if (Number.isFinite(v)) buckets[q][y] = (buckets[q][y] || 0) + v;
      });
    });
    return ['Q1','Q2','Q3','Q4'].map(q => buckets[q] || { label: q });
  }
  const totals = {};
  sorted.forEach(row => selectedYears.forEach(y => {
    const v = Number(row[y]);
    if (Number.isFinite(v)) totals[y] = (totals[y] || 0) + v;
  }));
  return selectedYears.map(y => ({ label: String(y), [y]: +(totals[y] || 0) }));
}

function extractYears(raw) {
  if (!raw?.length) return [];
  return Object.keys(raw[0]).filter(k => k !== "month" && k !== "label").sort();
}

function BarLabel({ x, y, width, value, isPercent, isRaw, currencyContext, index, data }) {
  if (value == null || value === 0) return null;
  
  let display;
  let absolute;
  
  if (isPercent) {
    // Show more precision for percentages
    const precise = Number(value);
    display = `${precise.toFixed(2)}%`;
    absolute = `${precise.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 10 
    })}%`;
  } else if (isRaw) {
    // Show more precision for raw numbers
    const precise = Number(value);
    display = `${precise.toFixed(2)}`;
    absolute = precise.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 10 
    });
  } else {
    // For revenue: show precise values without currency symbol
    const fullValue = Number(value) * 1_000_000;
    const convertedValue = convertUsdToDisplay(fullValue, currencyContext) || fullValue;
    
    // Format without currency symbol but with higher precision
    if (convertedValue >= 1_000_000) {
      display = `${(convertedValue / 1_000_000).toFixed(2)}M`;
    } else if (convertedValue >= 1_000) {
      display = `${(convertedValue / 1_000).toFixed(2)}K`;
    } else {
      display = `${convertedValue.toFixed(0)}`;
    }
    
    // Create precise absolute value for tooltip
    const currencyCode = currencyContext?.currencyCode || "USD";
    absolute = `${currencyCode} ${convertedValue.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 10 
    })}`;
  }
  
  // Auto-detect overlapping labels and rotate 90° when crowded
  const shouldRotate = data && data.length > 6; // Rotate if more than 6 data points
  const rotation = shouldRotate ? -90 : 0;
  const textAnchor = shouldRotate ? "end" : "middle";
  // Position labels on top of bars (negative y offset to go above the bar)
  const yOffset = shouldRotate ? -12 : -8;
  const xOffset = shouldRotate ? -4 : 0;
  
  const textX = x + width / 2 + xOffset;
  const textY = y + yOffset;
  
  return (
    <text 
      x={textX} 
      y={textY} 
      textAnchor={textAnchor}
      fontSize={9} 
      fill="#444" 
      fontFamily="Segoe UI, sans-serif"
      fontWeight="600"
      stroke="white"
      strokeWidth="2"
      paintOrder="stroke fill"
      transform={rotation !== 0 ? `rotate(${rotation} ${textX} ${textY})` : undefined}
    >
      <title>{absolute}</title>
      {display}
    </text>
  );
}

export default function TrendChart({
  title, endpoint, isPercent = false, isRaw = false,
  controlledYears, onYearsChange, controlledGranularity, onAvailableYears, filters = {},
  rawDataOverride = null, currencyContext = null
}) {
  const [rawData, setRawData]       = useState([]);
  const [localYears, setLocalYears] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [error, setError]           = useState("");

  const selectedYears = controlledYears ?? localYears;
  const setYears      = onYearsChange ?? setLocalYears;
  const granularity   = controlledGranularity ?? "month";

  useEffect(() => {
    if (Array.isArray(rawDataOverride)) {
      setError("");
      setLoading(false);
      setRawData(rawDataOverride);
      setInitialLoadComplete(true);
      const years = extractYears(rawDataOverride);
      if (!controlledYears?.length && years.length) setYears(years);
      if (onAvailableYears) onAvailableYears(years);
      return;
    }

    const fallback = getFallback(endpoint, isPercent, isRaw);
    setLoading(true);
    setError("");
    apiGet(endpoint, { timeout: 20000, params: toApiParams(filters) })
      .then(res => {
        const d = res.data?.length ? res.data : fallback;
        setRawData(d);
        setInitialLoadComplete(true);
        const years = extractYears(d);
        if (!controlledYears?.length && years.length) setYears(years);
        if (onAvailableYears) onAvailableYears(years);
      })
      .catch(() => {
        if (ENABLE_MOCK_FALLBACK) {
          setRawData(fallback);
          setInitialLoadComplete(true);
          const years = extractYears(fallback);
          if (!controlledYears?.length && years.length) setYears(years);
          if (onAvailableYears) onAvailableYears(years);
          return;
        }
        setRawData([]);
        setInitialLoadComplete(true);
        if (onAvailableYears) onAvailableYears([]);
        setError("Failed to load trend data");
      })
      .finally(() => setLoading(false));
  }, [endpoint, JSON.stringify(filters), JSON.stringify(rawDataOverride)]);

  const data = useMemo(() => {
    // Don't show any data until initial load is complete
    if (!initialLoadComplete) {
      return [];
    }

    const grouped = buildGroupedData(rawData, granularity, selectedYears);
    if (isPercent || isRaw) return grouped;
    return grouped.map((row) => {
      const out = { ...row };
      selectedYears.forEach((year) => {
        if (out[year] == null) return;
        const usdValue = Number(out[year]) * 1_000_000;
        const converted = convertUsdToDisplay(usdValue, currencyContext);
        out[year] = converted == null ? out[year] : Number(converted / 1_000_000);
      });
      return out;
    });
  }, [rawData, granularity, selectedYears, isPercent, isRaw, currencyContext, initialLoadComplete]);
  const barSize = granularity === "year" ? 40 : granularity === "quarter" ? 28 : 16;
  const yTickFmt = v => isPercent ? `${v}%` : isRaw ? `${v}` : formatCompactCurrency(Number(v) * 1_000_000, currencyContext, 1);
  const yDomain  = isPercent ? [0, 80] : [0, "auto"];

  return (
    <div className="trend-block">
      <h3 className="chart-title" title={safeTitle(title)}>{title}</h3>

      <div className="trend-legend">
        <span className="legend-label-text">Year</span>
        {selectedYears.map((y, i) => {
          const color = colorForIndex(i, selectedYears.length);
          return (
            <span key={y} className="legend-dot-item" style={{ color }}>
              <span className="legend-dot" style={{ background: color }} />
              <span title={safeTitle(y)}>{y}</span>
            </span>
          );
        })}
      </div>

      {loading ? (
        <div className="chart-placeholder">Loading…</div>
      ) : error ? (
        <div className="chart-placeholder">{error}</div>
      ) : data.length > 0 ? (
        <div className="trend-chart-area">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={barSize} barGap={6}
              margin={{ top: 22, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#dde8e2" vertical={false} />
              <XAxis dataKey="label"
                tick={{ fill: "#555", fontSize: 11, fontFamily: "Segoe UI, sans-serif" }}
                axisLine={{ stroke: "#ccc" }} tickLine={false} />
              <YAxis
                tick={{ fill: "#777", fontSize: 11, fontFamily: "Segoe UI, sans-serif" }}
                axisLine={false} tickLine={false}
                tickFormatter={yTickFmt} width={44} domain={yDomain} />
              <Tooltip
                formatter={(v, name) => {
                  if (isPercent) {
                    // For percentages, show full precision
                    const precise = Number(v);
                    return [`${precise.toLocaleString(undefined, { 
                      minimumFractionDigits: 0, 
                      maximumFractionDigits: 10 
                    })}%`, name];
                  }
                  if (isRaw) {
                    // For raw numbers, show full precision
                    const precise = Number(v);
                    return [precise.toLocaleString(undefined, { 
                      minimumFractionDigits: 0, 
                      maximumFractionDigits: 10 
                    }), name];
                  }
                  // For currency values: v is already in millions, so multiply by 1M to get actual value
                  const actualValue = Number(v) * 1_000_000;
                  const convertedValue = convertUsdToDisplay(actualValue, currencyContext) || actualValue;
                  const currencyCode = currencyContext?.currencyCode || "USD";
                  
                  const formatted = `${currencyCode} ${convertedValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}`;
                  
                  return [formatted, name];
                }}
                contentStyle={{ fontSize: 11, border: "1px solid #c8d6cd", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
              />
              {selectedYears.map((y, i) => {
                const color = colorForIndex(i, selectedYears.length);
                return (
                  <Bar key={y} dataKey={y} fill={color} radius={[2, 2, 0, 0]}>
                    <LabelList dataKey={y} content={props => <BarLabel {...props} isPercent={isPercent} isRaw={isRaw} currencyContext={currencyContext} data={data} />} />
                  </Bar>
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="chart-placeholder">No data</div>
      )}
    </div>
  );
}


