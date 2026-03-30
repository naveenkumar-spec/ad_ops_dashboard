import { useEffect, useState } from "react";
import axios from "axios";
import { mockBottomCampaigns, mockBottomCampaignsTotals } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import { formatAbsoluteCurrency, formatAbsoluteInteger, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import "../../styles/Tables.css";

function fmtUSD(v) {
  if (v == null) return "";
  const n = Number(v);
  if (Math.abs(n) >= 1e6)  return `USD ${(n/1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3)  return `USD ${(n/1e3).toFixed(2)}K`;
  return `USD ${n.toFixed(0)}`;
}
function fmtImpr(v) {
  if (v == null) return "";
  const n = Number(v);
  if (n >= 1e9) return `${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n/1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(2)}K`;
  return String(n);
}
function fmtNum(v) {
  if (v == null) return "";
  return Number(v).toLocaleString();
}

export default function BottomCampaignsTable({ filters = {} }) {
  const [data, setData]     = useState([]);
  const [totals, setTotals] = useState(null);
  const [view, setView]     = useState("bottom"); // "bottom" | "top"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("http://localhost:5000/api/overview/campaigns-detailed", { timeout: 6000, params: toApiParams(filters) })
      .then(res => {
        if (res.data?.rows?.length) {
          setData(res.data.rows);
          setTotals(res.data.totals);
        } else {
          setData(mockBottomCampaigns);
          setTotals(mockBottomCampaignsTotals);
        }
      })
      .catch(() => {
        setData(mockBottomCampaigns);
        setTotals(mockBottomCampaignsTotals);
      })
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  const displayed = view === "bottom"
    ? [...data].sort((a, b) => a.grossMarginPct - b.grossMarginPct)
    : [...data].sort((a, b) => b.grossMarginPct - a.grossMarginPct);

  return (
    <div className="adv-table-card">
      {/* Header row */}
      <div className="adv-table-header">
        <h3 className="adv-table-title">Bottom Campaigns ( with &lt; 50% Gross Margin )</h3>
        <div className="bottom-top-toggle">
          <button
            className={`bt-btn ${view === "bottom" ? "active" : ""}`}
            onClick={() => setView("bottom")}
          >Bottom</button>
          <button
            className={`bt-btn ${view === "top" ? "active" : ""}`}
            onClick={() => setView("top")}
          >Top</button>
        </div>
      </div>

      {loading ? (
        <div className="table-loading">Loading…</div>
      ) : (
        <div className="adv-table-scroll">
          <table className="adv-table">
            <thead>
              <tr>
                <th>Campaign Name</th>
                <th>Status</th>
                <th>Booked Revenue</th>
                <th>Spend</th>
                <th>Gross Margin</th>
                <th>Gross Margin %</th>
                <th>Net Margin</th>
                <th>Net Margin %</th>
                <th>Planned Impressions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((r, i) => (
                <tr key={i}>
                  <td className="col-name" title={safeTitle(r.name)}>{r.name}</td>
                  <td title={safeTitle(r.status)}>{r.status}</td>
                  <td title={formatAbsoluteCurrency(r.revenue, "USD")}>{fmtUSD(r.revenue)}</td>
                  <td title={formatAbsoluteCurrency(r.spend, "USD")}>{fmtUSD(r.spend)}</td>
                  <td title={formatAbsoluteCurrency(r.grossMargin, "USD")}>{fmtNum(r.grossMargin)}</td>
                  <td title={formatAbsolutePercent(r.grossMarginPct, 2)}>{r.grossMarginPct != null ? `${r.grossMarginPct.toFixed(2)}%` : ""}</td>
                  <td title={formatAbsoluteCurrency(r.netMargin, "USD")}>{r.netMargin != null ? fmtUSD(r.netMargin) : ""}</td>
                  <td title={formatAbsolutePercent(r.netMarginPct, 2)}>{r.netMarginPct != null ? `${r.netMarginPct.toFixed(2)}%` : ""}</td>
                  <td title={formatAbsoluteInteger(r.plannedImpressions)}>{fmtImpr(r.plannedImpressions)}</td>
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="total-row">
                  <td><strong>Total</strong></td>
                  <td></td>
                  <td title={formatAbsoluteCurrency(totals.revenue, "USD")}><strong>{fmtUSD(totals.revenue)}</strong></td>
                  <td title={formatAbsoluteCurrency(totals.spend, "USD")}><strong>{fmtUSD(totals.spend)}</strong></td>
                  <td title={formatAbsoluteCurrency(totals.grossMargin, "USD")}><strong>{fmtUSD(totals.grossMargin)}</strong></td>
                  <td title={formatAbsolutePercent(totals.grossMarginPct, 2)}><strong>{totals.grossMarginPct.toFixed(2)}%</strong></td>
                  <td title={formatAbsoluteCurrency(totals.netMargin, "USD")}><strong>{fmtUSD(totals.netMargin)}</strong></td>
                  <td title={formatAbsolutePercent(totals.netMarginPct, 2)}><strong>{totals.netMarginPct.toFixed(2)}%</strong></td>
                  <td title={formatAbsoluteInteger(totals.plannedImpressions)}><strong>{fmtImpr(totals.plannedImpressions)}</strong></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
