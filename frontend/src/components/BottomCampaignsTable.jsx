import { useEffect, useState } from "react";
import axios from "axios";
import { mockBottomCampaigns, mockBottomCampaignsTotals } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import { formatAbsoluteInteger, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import {
  convertUsdToDisplay,
  formatAbsoluteCurrencyByContext,
  formatCompactCurrency
} from "../utils/currencyDisplay.js";
import "../../styles/Tables.css";

function fmtImpr(v) {
  if (v == null) return "";
  const n = Number(v);
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return String(n);
}

export default function BottomCampaignsTable({ filters = {}, currencyContext = null }) {
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState(null);
  const [view, setView] = useState("bottom");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("/api/overview/campaigns-detailed", { timeout: 6000, params: toApiParams(filters) })
      .then((res) => {
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

  const converted = (v) => convertUsdToDisplay(v, currencyContext) ?? 0;

  return (
    <div className="adv-table-card">
      <div className="adv-table-header">
        <h3 className="adv-table-title">Bottom Campaigns ( with &lt; 50% Gross Margin )</h3>
        <div className="bottom-top-toggle">
          <button className={`bt-btn ${view === "bottom" ? "active" : ""}`} onClick={() => setView("bottom")}>Bottom</button>
          <button className={`bt-btn ${view === "top" ? "active" : ""}`} onClick={() => setView("top")}>Top</button>
        </div>
      </div>

      {loading ? (
        <div className="table-loading">Loading...</div>
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
              {displayed.map((r, i) => {
                const revenue = converted(r.revenue);
                const spend = converted(r.spend);
                const grossMargin = converted(r.grossMargin);
                const netMargin = converted(r.netMargin);
                return (
                  <tr key={i}>
                    <td className="col-name" title={safeTitle(r.name)}>{r.name}</td>
                    <td title={safeTitle(r.status)}>{r.status}</td>
                    <td title={formatAbsoluteCurrencyByContext(revenue, currencyContext)}>{formatCompactCurrency(revenue, currencyContext)}</td>
                    <td title={formatAbsoluteCurrencyByContext(spend, currencyContext)}>{formatCompactCurrency(spend, currencyContext)}</td>
                    <td title={formatAbsoluteCurrencyByContext(grossMargin, currencyContext)}>{formatCompactCurrency(grossMargin, currencyContext)}</td>
                    <td title={formatAbsolutePercent(r.grossMarginPct, 2)}>{r.grossMarginPct != null ? `${r.grossMarginPct.toFixed(2)}%` : ""}</td>
                    <td title={formatAbsoluteCurrencyByContext(netMargin, currencyContext)}>{r.netMargin != null ? formatCompactCurrency(netMargin, currencyContext) : ""}</td>
                    <td title={formatAbsolutePercent(r.netMarginPct, 2)}>{r.netMarginPct != null ? `${r.netMarginPct.toFixed(2)}%` : ""}</td>
                    <td title={formatAbsoluteInteger(r.plannedImpressions)}>{fmtImpr(r.plannedImpressions)}</td>
                  </tr>
                );
              })}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="total-row">
                  <td><strong>Total</strong></td>
                  <td></td>
                  <td title={formatAbsoluteCurrencyByContext(converted(totals.revenue), currencyContext)}><strong>{formatCompactCurrency(converted(totals.revenue), currencyContext)}</strong></td>
                  <td title={formatAbsoluteCurrencyByContext(converted(totals.spend), currencyContext)}><strong>{formatCompactCurrency(converted(totals.spend), currencyContext)}</strong></td>
                  <td title={formatAbsoluteCurrencyByContext(converted(totals.grossMargin), currencyContext)}><strong>{formatCompactCurrency(converted(totals.grossMargin), currencyContext)}</strong></td>
                  <td title={formatAbsolutePercent(totals.grossMarginPct, 2)}><strong>{totals.grossMarginPct.toFixed(2)}%</strong></td>
                  <td title={formatAbsoluteCurrencyByContext(converted(totals.netMargin), currencyContext)}><strong>{formatCompactCurrency(converted(totals.netMargin), currencyContext)}</strong></td>
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

