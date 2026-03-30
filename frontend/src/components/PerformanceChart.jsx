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
import axios from "axios";
import { formatAbsoluteCurrency, formatAbsoluteInteger, safeTitle } from "../utils/absoluteTooltip.js";
import "../../styles/PerformanceChart.css";

const fallbackOps = [
  { name: "Lakshman", budgetGroups: 235, bookedRevenue: 1865.52 },
  { name: "Ravi Arya", budgetGroups: 231, bookedRevenue: 1298.19 },
  { name: "Susanketh", budgetGroups: 187, bookedRevenue: 1161.72 },
  { name: "Abhishek", budgetGroups: 177, bookedRevenue: 641.97 },
  { name: "Shivam", budgetGroups: 127, bookedRevenue: 511.27 },
  { name: "Kamlesh", budgetGroups: 109, bookedRevenue: 1245.95 },
  { name: "Abhinav", budgetGroups: 100, bookedRevenue: 619.91 },
  { name: "Hrishikesh", budgetGroups: 96, bookedRevenue: 861.39 },
  { name: "Rohit", budgetGroups: 89, bookedRevenue: 369.99 },
  { name: "Sumit", budgetGroups: 88, bookedRevenue: 1870.20 },
  { name: "Utkarsh", budgetGroups: 86, bookedRevenue: 1159.68 },
  { name: "Shubh", budgetGroups: 82, bookedRevenue: 885.28 },
  { name: "Ranjith", budgetGroups: 77, bookedRevenue: 308.23 },
  { name: "Rishav", budgetGroups: 72, bookedRevenue: 219.52 },
  { name: "Sanjana", budgetGroups: 72, bookedRevenue: 839.84 }
];

const fallbackCs = [
  { name: "Apoorva", budgetGroups: 306, bookedRevenue: 1984.25 },
  { name: "Puja", budgetGroups: 201, bookedRevenue: 354.39 },
  { name: "Christian", budgetGroups: 190, bookedRevenue: 283.81 },
  { name: "Debrata", budgetGroups: 85, bookedRevenue: 306.31 },
  { name: "Sagar", budgetGroups: 84, bookedRevenue: 300.33 },
  { name: "Achala", budgetGroups: 73, bookedRevenue: 390.09 },
  { name: "Natercia", budgetGroups: 70, bookedRevenue: 1169.67 },
  { name: "Mayank", budgetGroups: 57, bookedRevenue: 1264.18 },
  { name: "Graham", budgetGroups: 56, bookedRevenue: 1714.40 },
  { name: "Abhishek", budgetGroups: 45, bookedRevenue: 354.39 },
  { name: "Sydney", budgetGroups: 44, bookedRevenue: 1070.89 },
  { name: "Alexandra", budgetGroups: 43, bookedRevenue: 1984.25 }
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
    <text
      x={(x ?? 0)  +14}
      y={(y ?? 0) - 14}
      textAnchor="midd/*  */le"
      fontSize={10}
      fontWeight={700}
      fill="#0f1f2f"
    >
      <title>{formatAbsoluteInteger(value)}</title>
      {value}
    </text>
  );
};

const renderLineLabel = (props) => {
  const { x, y, value, payload } = props;
  const txt = valueLabel(value);
  if (!txt) return null;
  const barVal = Number(payload?.budgetGroups);
  const hasBar = Number.isFinite(barVal) && barVal > 0;
  const lift = hasBar ? -20 : -10; // negative places below the point
  const width = Math.max(32, txt.length * 7 + 10);
  const height = 16;
  const yPos = y - lift; // if lift negative => below point
  return (
    <g>
      <rect x={x - width / 2} y={yPos} rx={4} ry={4} width={width} height={height} fill="#1b2b44" opacity={0.9} />
      <text x={x} y={yPos + height / 2 + 3} textAnchor="middle" fontSize={10} fontWeight={700} fill="#ffffff">
        <title>{formatAbsoluteCurrency(value, "USD")}</title>
        {txt}
      </text>
    </g>
  );
};

export default function PerformanceChart({ title = "Ops Performance", variant = "ops", data, filters = {} }) {
  const [remoteData, setRemoteData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get("/api/management/performance", {
          params: { type: variant, ...filters },
          timeout: 6000
        });
        setRemoteData(res.data || []);
      } catch (err) {
        setRemoteData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [variant, JSON.stringify(filters)]);

  const chartData = useMemo(() => {
    if (data && data.length) return data;
    if (remoteData.length) return remoteData.map(d => ({
      name: d.owner,
      budgetGroups: d.budgetGroups ?? d.campaigns,
      bookedRevenue: d.bookedRevenue ?? d.revenue
    }));
    return variant === "cs" ? fallbackCs : fallbackOps;
  }, [data, remoteData, variant]);
  const minWidthPx = Math.max(1400, chartData.length * 90);

  return (
    <div className="performance-card">
      <div className="perf-header">
        <h3 title={safeTitle(title)}>{title}</h3>
      </div>

      <div className="perf-chart-wrapper">
        <div className="perf-chart-inner" style={{ minWidth: `${minWidthPx}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 30, right: 24, left: 8, bottom: 36 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#3d4d45" }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: "#3d4d45" }}
                domain={[0, (dataMax) => dataMax * 1.15]}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                hide
                domain={[0, (dataMax) => dataMax * 1.15]}
              />
              <Tooltip
                formatter={(v, name) => {
                  const metricName = String(name || "");
                  if (metricName.toLowerCase().includes("revenue")) return formatAbsoluteCurrency(v, "USD");
                  return formatAbsoluteInteger(v);
                }}
              />
              <Bar yAxisId="left" dataKey="budgetGroups" name="Budget Groups" barSize={32} fill="#3b5e57" radius={[3,3,0,0]}>
                <LabelList dataKey="budgetGroups" position="top" offset={0} content={renderBarLabel} />
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="bookedRevenue"
                name="Booked Revenue (USD)"
                stroke="#1b2b44"
                strokeWidth={3}
                dot={{ r: 3.5, strokeWidth: 2, stroke: "#1b2b44", strokeOpacity: 0.55, fill: "#1b2b44", fillOpacity: 0.55 }}
                activeDot={{ r: 5 }}
              >
                <LabelList dataKey="bookedRevenue" content={renderLineLabel} />
              </Line>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      {loading && <div className="chart-loading">Loadingâ€¦</div>}

      <div className="perf-legend perf-legend-bottom">
        <span className="legend-dot budget" /> Budget Groups
        <span className="legend-sep" />
        <span className="legend-line" /> Booked Revenue (USD)
      </div>
    </div>
  );
}


