import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../utils/apiClient";
import { mockCampaigns } from "../mockData.js";
import { formatAbsoluteCurrency, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import SortableHeader from "./SortableHeader.jsx";
import "../../styles/Tables.css";

function fmt(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function CampaignTable({ title = "Campaign Performance (Bottom Performers)" }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  useEffect(() => {
    apiGet("/api/overview/campaigns", { timeout: 6000 })
      .then(res => setData(res.data?.length ? res.data : mockCampaigns))
      .catch(() => setData(mockCampaigns))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedData = useMemo(() => {
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [data, sortField, sortDirection]);

  const sh = (field, label) => (
    <SortableHeader field={field} sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
      {label}
    </SortableHeader>
  );

  return (
    <div className="table-card">
      <div className="table-card-header"><h3>{title}</h3></div>
      <div className="table-card-body">
        {loading ? <div className="table-loading">Loading...</div>
          : data.length === 0 ? <div className="table-empty">No data</div>
            : (
              <div className="overflow-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      {sh("campaignName", "Campaign Name")}
                      {sh("status", "Status")}
                      {sh("revenue", "Revenue")}
                      {sh("spend", "Spend")}
                      {sh("profit", "Gross Profit")}
                      {sh("grossMargin", "Gross Margin %")}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedData.map((c, i) => (
                      <tr key={i}>
                        <td title={safeTitle(c.campaignName)}>{c.campaignName}</td>
                        <td>
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                            background: c.status === "Active" ? "#dcf5e7" : c.status === "Paused" ? "#fff3cd" : "#f5e6e6",
                            color: c.status === "Active" ? "#166534" : c.status === "Paused" ? "#92400e" : "#991b1b"
                          }} title={safeTitle(c.status)}>{c.status}</span>
                        </td>
                        <td title={formatAbsoluteCurrency(c.revenue, "USD")}>{fmt(c.revenue)}</td>
                        <td title={formatAbsoluteCurrency(c.spend, "USD")}>{fmt(c.spend)}</td>
                        <td title={formatAbsoluteCurrency(c.profit, "USD")}>{fmt(c.profit)}</td>
                        <td title={formatAbsolutePercent(c.grossMargin, 2)}>{c.grossMargin != null ? `${c.grossMargin}%` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </div>
    </div>
  );
}
