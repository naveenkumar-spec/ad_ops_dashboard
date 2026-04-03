import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  LabelList
} from "recharts";
import { apiGet } from "../utils/apiClient";
import { formatAbsoluteInteger, safeTitle } from "../utils/absoluteTooltip.js";
import { convertUsdToDisplay, formatAbsoluteCurrencyByContext } from "../utils/currencyDisplay.js";
import "../../styles/PerformanceChart.css";

const fallbackOps = [
  { name: "Lakshman", budgetGroups: 235, campaigns: 18, bookedRevenue: 1865.52 },
  { name: "Ravi Arya", budgetGroups: 231, campaigns: 14, bookedRevenue: 1298.19 },
  { name: "Susanketh", budgetGroups: 187, campaigns: 12, bookedRevenue: 1161.72 },
  { name: "Abhishek", budgetGroups: 177, campaigns: 11, bookedRevenue: 641.97 },
  { name: "Shivam", budgetGroups: 127, campaigns: 9, bookedRevenue: 511.27 },
  { name: "Kamlesh", budgetGroups: 109, campaigns: 10, bookedRevenue: 1245.95 },
  { name: "Abhinav", budgetGroups: 100, campaigns: 8, bookedRevenue: 619.91 },
  { name: "Hrishikesh", budgetGroups: 96, campaigns: 7, bookedRevenue: 861.39 },
  { name: "Rohit", budgetGroups: 89, campaigns: 6, bookedRevenue: 369.99 },
  { name: "Sumit", budgetGroups: 88, campaigns: 13, bookedRevenue: 1870.20 },
  { name: "Utkarsh", budgetGroups: 86, campaigns: 12, bookedRevenue: 1159.68 },
  { name: "Shubh", budgetGroups: 82, campaigns: 9, bookedRevenue: 885.28 },
  { name: "Ranjith", budgetGroups: 77, campaigns: 8, bookedRevenue: 308.23 },
  { name: "Rishav", budgetGroups: 72, campaigns: 7, bookedRevenue: 219.52 },
  { name: "Sanjana", budgetGroups: 72, campaigns: 9, bookedRevenue: 839.84 }
];

const fallbackCs = [
  { name: "Apoorva", budgetGroups: 306, campaigns: 37, bookedRevenue: 1984.25 },
  { name: "Puja", budgetGroups: 201, campaigns: 22, bookedRevenue: 354.39 },
  { name: "Christian", budgetGroups: 190, campaigns: 18, bookedRevenue: 283.81 },
  { name: "Debrata", budgetGroups: 85, campaigns: 14, bookedRevenue: 306.31 },
  { name: "Sagar", budgetGroups: 84, campaigns: 12, bookedRevenue: 300.33 },
  { name: "Achala", budgetGroups: 73, campaigns: 17, bookedRevenue: 390.09 },
  { name: "Natercia", budgetGroups: 70, campaigns: 16, bookedRevenue: 1169.67 },
  { name: "Mayank", budgetGroups: 57, campaigns: 15, bookedRevenue: 1264.18 },
  { name: "Graham", budgetGroups: 56, campaigns: 13, bookedRevenue: 1714.40 },
  { name: "Abhishek", budgetGroups: 45, campaigns: 12, bookedRevenue: 354.39 },
  { name: "Sydney", budgetGroups: 44, campaigns: 11, bookedRevenue: 1070.89 },
  { name: "Alexandra", budgetGroups: 43, campaigns: 10, bookedRevenue: 1984.25 }
];

function valueLabel(v) {
  if (v == null) return "";
  const num = Number(v);
  if (!Number.isFinite(num)) return "";
  if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(2)}K`;
  return num.toFixed(2);
}

const renderBarLabel = (props) => {
  const { x, y, value } = props;
  if (value == null) return null;
  return (
    <text x={(x ?? 0) + 14} y={(y ?? 0) - 14} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0f1f2f">
      <title>{formatAbsoluteInteger(value)}</title>
      {value}
    </text>
  );
};

const renderLineLabel = (currencyContext) => (props) => {
  const { x, y, value, payload } = props;
  const txt = valueLabel(value);
  if (!txt) return null;
  const barVal = Number(payload?.budgetGroups ?? payload?.campaigns);
  const hasBar = Number.isFinite(barVal) && barVal > 0;
  const lift = hasBar ? -20 : -10;
  const width = Math.max(32, txt.length * 7 + 10);
  const height = 16;
  const yPos = y - lift;
  return (
    <g>
      <rect x={x - width / 2} y={yPos} rx={4} ry={4} width={width} height={height} fill="#1b2b44" opacity={0.9} />
      <text x={x} y={yPos + height / 2 + 3} textAnchor="middle" fontSize={10} fontWeight={700} fill="#ffffff">
        <title>{formatAbsoluteCurrencyByContext(value, currencyContext)}</title>
        {txt}
      </text>
    </g>
  );
};

export default function PerformanceChart({ title = "Ops Performance", variant = "ops", data, filters = {}, currencyContext = null, metric = "budgetGroups" }) {
  const [remoteData, setRemoteData] = useState([]);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await apiGet("/api/management/performance", {
          params: { type: variant, ...filters },
          timeout: 6000
        });
        setRemoteData(res.data || []);
        setInitialLoadComplete(true); // Mark initial load as complete
      } catch (_err) {
        setRemoteData([]);
        setInitialLoadComplete(true); // Even on error, mark as complete to show fallback
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [variant, JSON.stringify(filters)]);

  const chartData = useMemo(() => {
    // Don't show any data until initial load is complete
    if (!initialLoadComplete) {
      return [];
    }

    const source = data && data.length
      ? data
      : remoteData.length
        ? remoteData.map((d) => ({
          name: d.owner,
          budgetGroups: d.budgetGroups ?? 0,
          campaigns: d.campaigns ?? 0,
          bookedRevenue: d.bookedRevenue ?? d.revenue ?? 0
        }))
        : (variant === "cs" ? fallbackCs : fallbackOps);

    // Sort by the current metric (budgetGroups or campaigns) in descending order by default
    const sorted = source.sort((a, b) => {
      const aVal = Number(a[metric] || 0);
      const bVal = Number(b[metric] || 0);
      return bVal - aVal; // Descending order (highest first)
    });

    return sorted.map((row) => ({
      ...row,
      bookedRevenue: convertUsdToDisplay(row.bookedRevenue, currencyContext) ?? row.bookedRevenue
    }));
  }, [data, remoteData, variant, currencyContext, metric, initialLoadComplete]);

  const leftMax = useMemo(() => {
    const vals = chartData.map(d => Number(d[metric] || 0)).filter(v => Number.isFinite(v) && v >= 0);
    if (!vals.length) return 10;
    return Math.ceil(Math.max(...vals) * 1.3) || 10;
  }, [chartData, metric]);

  const rightMax = useMemo(() => {
    const vals = chartData.map(d => Number(d.bookedRevenue || 0)).filter(v => Number.isFinite(v) && v >= 0);
    if (!vals.length) return 10;
    return Math.ceil(Math.max(...vals) * 1.3) || 10;
  }, [chartData]);

  const totals = useMemo(() => {
    if (!chartData.length) return null;
    return {
      budgetGroups: chartData.reduce((sum, d) => sum + (Number(d.budgetGroups) || 0), 0),
      campaigns: chartData.reduce((sum, d) => sum + (Number(d.campaigns) || 0), 0),
      bookedRevenue: chartData.reduce((sum, d) => sum + (Number(d.bookedRevenue) || 0), 0)
    };
  }, [chartData]);

  const minWidthPx = Math.max(1200, chartData.length * 100); // Increased from 90 to 100 for better spacing
  const barName = metric === "campaigns" ? "Campaigns" : "Budget Groups";

  return (
    <div className="performance-card">
      <div className="perf-header">
        <h3 title={safeTitle(title)}>{title}</h3>
        {totals && (
          <div className="perf-totals">
            <span className="total-item">
              <span className="total-label">{barName}:</span>
              <span className="total-value">{formatAbsoluteInteger(totals[metric])}</span>
            </span>
          </div>
        )}
      </div>

      {loading && <div className="chart-loading">Loading...</div>}
      
      <div className="perf-chart-wrapper">
        <div className="perf-chart-inner" style={{ minWidth: `${minWidthPx}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 30, right: 24, left: 8, bottom: 36 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#3d4d45" }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#3d4d45" }} domain={[0, leftMax]} />
              <YAxis yAxisId="right" orientation="right" hide domain={[0, rightMax]} />
              <Tooltip
                formatter={(v, name) => {
                  const metricName = String(name || "");
                  if (metricName.toLowerCase().includes("revenue")) return formatAbsoluteCurrencyByContext(v, currencyContext);
                  return formatAbsoluteInteger(v);
                }}
              />
              <Bar yAxisId="left" dataKey={metric} name={barName} barSize={32} fill="#3b5e57" radius={[3, 3, 0, 0]}>
                <LabelList dataKey={metric} position="top" offset={0} content={renderBarLabel} />
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="bookedRevenue"
                name={`Booked Revenue (${currencyContext?.currencyCode || "USD"})`}
                stroke="#1b2b44"
                strokeWidth={3}
                dot={{ r: 3.5, strokeWidth: 2, stroke: "#1b2b44", strokeOpacity: 0.55, fill: "#1b2b44", fillOpacity: 0.55 }}
                activeDot={{ r: 5 }}
              >
                <LabelList dataKey="bookedRevenue" content={renderLineLabel(currencyContext)} />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="perf-legend perf-legend-bottom">
        <span className="legend-dot budget" /> {barName}
        <span className="legend-sep" />
        <span className="legend-line" /> Booked Revenue ({currencyContext?.currencyCode || "USD"})
      </div>
    </div>
  );
}
