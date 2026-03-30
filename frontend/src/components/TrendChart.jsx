import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, LabelList
} from "recharts";
import axios from "axios";
import { mockRevenueTrend, mockMarginTrend, mockCPMTrend, mockNetMarginTrend } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import { formatAbsoluteCurrency, formatAbsoluteNumber, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
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
  return selectedYears.map(y => ({ label: String(y), [y]: +(totals[y] || 0).toFixed(2) }));
}

function extractYears(raw) {
  if (!raw?.length) return [];
  return Object.keys(raw[0]).filter(k => k !== "month" && k !== "label").sort();
}

function BarLabel({ x, y, width, value, isPercent, isRaw }) {
  if (value == null || value === 0) return null;
  let display;
  let absolute;
  if (isPercent)  display = `${Number(value).toFixed(2)}%`;
  else if (isRaw) display = `${Number(value).toFixed(1)}`;
  else            display = `${Number(value).toFixed(2)}M`;
  if (isPercent) absolute = formatAbsolutePercent(value, 2);
  else if (isRaw) absolute = formatAbsoluteNumber(value, 2);
  else absolute = formatAbsoluteCurrency(Number(value) * 1_000_000, "USD");
  return (
    <text x={x + width / 2} y={y - 4} textAnchor="middle"
      fontSize={9} fill="#444" fontFamily="Segoe UI, sans-serif">
      <title>{absolute}</title>
      {display}
    </text>
  );
}

export default function TrendChart({
  title, endpoint, isPercent = false, isRaw = false,
  controlledYears, onYearsChange, controlledGranularity, onAvailableYears, filters = {}
}) {
  const [rawData, setRawData]       = useState([]);
  const [localYears, setLocalYears] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  const selectedYears = controlledYears ?? localYears;
  const setYears      = onYearsChange ?? setLocalYears;
  const granularity   = controlledGranularity ?? "month";

  useEffect(() => {
    const fallback = getFallback(endpoint, isPercent, isRaw);
    setLoading(true);
    setError("");
    axios.get(endpoint, { timeout: 5000, params: toApiParams(filters) })
      .then(res => {
        const d = res.data?.length ? res.data : fallback;
        setRawData(d);
        const years = extractYears(d);
        if (!controlledYears?.length && years.length) setYears(years);
        if (onAvailableYears) onAvailableYears(years);
      })
      .catch(() => {
        if (ENABLE_MOCK_FALLBACK) {
          setRawData(fallback);
          const years = extractYears(fallback);
          if (!controlledYears?.length && years.length) setYears(years);
          if (onAvailableYears) onAvailableYears(years);
          return;
        }
        setRawData([]);
        if (onAvailableYears) onAvailableYears([]);
        setError("Failed to load trend data");
      })
      .finally(() => setLoading(false));
  }, [endpoint, JSON.stringify(filters)]);

  const data    = useMemo(() => buildGroupedData(rawData, granularity, selectedYears), [rawData, granularity, selectedYears]);
  const barSize = granularity === "year" ? 40 : granularity === "quarter" ? 28 : 16;
  const yTickFmt = v => isPercent ? `${v}%` : isRaw ? `${v}` : `${v}M`;
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
                formatter={(v, name) => [
                  isPercent
                    ? formatAbsolutePercent(v, 2)
                    : isRaw
                      ? formatAbsoluteNumber(v, 2)
                      : formatAbsoluteCurrency(Number(v) * 1_000_000, "USD"),
                  name
                ]}
                contentStyle={{ fontSize: 11, border: "1px solid #c8d6cd", borderRadius: 6, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
              />
              {selectedYears.map((y, i) => {
                const color = colorForIndex(i, selectedYears.length);
                return (
                  <Bar key={y} dataKey={y} fill={color} radius={[2, 2, 0, 0]}>
                    <LabelList dataKey={y} content={props => <BarLabel {...props} isPercent={isPercent} isRaw={isRaw} />} />
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
