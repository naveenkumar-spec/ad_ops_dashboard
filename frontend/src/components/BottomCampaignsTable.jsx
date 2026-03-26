import { useEffect, useState } from "react";
import axios from "axios";
import { mockBottomCampaigns, mockBottomCampaignsTotals } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
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
                  <td className="col-name">{r.name}</td>
                  <td>{r.status}</td>
                  <td>{fmtUSD(r.revenue)}</td>
                  <td>{fmtUSD(r.spend)}</td>
                  <td>{fmtNum(r.grossMargin)}</td>
                  <td>{r.grossMarginPct != null ? `${r.grossMarginPct.toFixed(2)}%` : ""}</td>
                  <td>{r.netMargin != null ? fmtUSD(r.netMargin) : ""}</td>
                  <td>{r.netMarginPct != null ? `${r.netMarginPct.toFixed(2)}%` : ""}</td>
                  <td>{fmtImpr(r.plannedImpressions)}</td>
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="total-row">
                  <td><strong>Total</strong></td>
                  <td></td>
                  <td><strong>{fmtUSD(totals.revenue)}</strong></td>
                  <td><strong>{fmtUSD(totals.spend)}</strong></td>
                  <td><strong>{fmtUSD(totals.grossMargin)}</strong></td>
                  <td><strong>{totals.grossMarginPct.toFixed(2)}%</strong></td>
                  <td><strong>{fmtUSD(totals.netMargin)}</strong></td>
                  <td><strong>{totals.netMarginPct.toFixed(2)}%</strong></td>
                  <td><strong>{fmtImpr(totals.plannedImpressions)}</strong></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
