import { useEffect, useState } from "react";
import axios from "axios";
import { mockCountryData, mockCountryTotals } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import { formatAbsoluteInteger, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import { convertUsdToDisplay, formatAbsoluteCurrencyByContext, formatCompactCurrency } from "../utils/currencyDisplay.js";
import "../../styles/Tables.css";

function fmtImpr(v) {
  if (v == null) return "";
  const n = Number(v);
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return String(n);
}

export default function CountryWiseTable({ filters = {}, currencyContext = null }) {
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState(null);
  const [childrenByRegion, setChildrenByRegion] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const c = (v) => convertUsdToDisplay(v, currencyContext) ?? 0;

  useEffect(() => {
    setLoading(true);
    Promise.all([
      axios.get("/api/overview/country-wise", { timeout: 12000, params: toApiParams(filters) }),
      axios.get("/api/overview/regions", { timeout: 12000, params: toApiParams(filters) })
    ])
      .then(([countryRes, regionRes]) => {
        if (countryRes.data?.rows?.length) {
          setData(countryRes.data.rows);
          setTotals(countryRes.data.totals);
        } else {
          setData(mockCountryData);
          setTotals(mockCountryTotals);
        }

        const map = {};
        (regionRes.data || []).forEach((row) => {
          const parent = String(row.parentRegion || "").trim();
          if (!parent) return;
          if (!map[parent]) map[parent] = [];
          map[parent].push({
            country: row.country || row.region,
            campaigns: row.totalCampaigns,
            budgetGroups: row.budgetGroups,
            revenue: row.bookedRevenue,
            spend: row.spend,
            plannedImpressions: row.plannedImpressions,
            deliveredImpressions: row.deliveredImpressions,
            deliveredPct: row.deliveredPct,
            grossMargin: row.grossMargin,
            grossMarginPct: row.grossMarginPct
          });
        });
        setChildrenByRegion(map);
      })
      .catch(() => {
        setData(mockCountryData);
        setTotals(mockCountryTotals);
        setChildrenByRegion({});
      })
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  const toggle = (region) => setExpanded((prev) => ({ ...prev, [region]: !prev[region] }));

  const rows = [];
  data.forEach((r) => {
    rows.push({ type: "region", ...r });
    const children = childrenByRegion[r.region] || [];
    if (expanded[r.region] && children.length) {
      children.forEach((child) => rows.push({ type: "child", ...child }));
    }
  });

  return (
    <div className="adv-table-card">
      <div className="adv-table-header">
        <h3 className="adv-table-title">Region / Country wise Data</h3>
      </div>

      {loading ? (
        <div className="table-loading">Loading...</div>
      ) : (
        <div className="adv-table-scroll">
          <table className="adv-table">
            <thead>
              <tr>
                <th>Region &amp; Country</th>
                <th>Total Campaigns</th>
                <th>Budget Groups</th>
                <th>Booked Revenue</th>
                <th>Spend</th>
                <th>Planned Impressions</th>
                <th>Delivered Impressions</th>
                <th>Gross Margin</th>
                <th>Gross Margin %</th>
                <th>Net Margin</th>
                <th>Net Margin %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                if (r.type === "region") {
                  const isOpen = expanded[r.region];
                  const hasChildren = (childrenByRegion[r.region] || []).length > 0;
                  return (
                    <tr key={`region-${i}`} className="region-row">
                      <td>
                        <button
                          className={`expand-btn ${isOpen ? "open" : ""}`}
                          onClick={() => hasChildren && toggle(r.region)}
                          style={{ visibility: hasChildren ? "visible" : "hidden" }}
                        >
                          {isOpen ? "-" : "+"}
                        </button>
                        <span className="region-name" title={safeTitle(r.region)}>{r.region}</span>
                      </td>
                      <td title={formatAbsoluteInteger(r.campaigns)}>{r.campaigns}</td>
                      <td title={formatAbsoluteInteger(r.budgetGroups)}>{r.budgetGroups?.toLocaleString()}</td>
                      <td title={formatAbsoluteCurrencyByContext(c(r.revenue), currencyContext)}>{formatCompactCurrency(c(r.revenue), currencyContext)}</td>
                      <td title={formatAbsoluteCurrencyByContext(c(r.spend), currencyContext)}>{formatCompactCurrency(c(r.spend), currencyContext)}</td>
                      <td title={formatAbsoluteInteger(r.plannedImpressions)}>{fmtImpr(r.plannedImpressions)}</td>
                      <td title={`${formatAbsoluteInteger(r.deliveredImpressions)}${r.deliveredPct != null ? ` (${formatAbsolutePercent(r.deliveredPct, 2)})` : ""}`}>
                        {fmtImpr(r.deliveredImpressions)}
                        {r.deliveredPct != null && <span className="delivered-pct"> ({r.deliveredPct.toFixed(2)}%)</span>}
                      </td>
                      <td title={formatAbsoluteCurrencyByContext(c(r.grossMargin), currencyContext)}>{formatCompactCurrency(c(r.grossMargin), currencyContext)}</td>
                      <td title={formatAbsolutePercent(r.grossMarginPct, 2)}>{r.grossMarginPct != null ? `${r.grossMarginPct.toFixed(2)}%` : ""}</td>
                      <td title={formatAbsoluteCurrencyByContext(c(r.netMargin), currencyContext)}>{r.netMargin != null ? formatCompactCurrency(c(r.netMargin), currencyContext) : ""}</td>
                      <td title={formatAbsolutePercent(r.netMarginPct, 2)}>{r.netMarginPct != null ? `${r.netMarginPct.toFixed(2)}%` : ""}</td>
                    </tr>
                  );
                }

                return (
                  <tr key={`child-${i}`} className="child-row">
                    <td className="child-name">
                      <span className="child-bullet">-</span>
                      <span title={safeTitle(r.country)}>{r.country}</span>
                    </td>
                    <td title={formatAbsoluteInteger(r.campaigns)}>{r.campaigns}</td>
                    <td title={formatAbsoluteInteger(r.budgetGroups)}>{r.budgetGroups?.toLocaleString()}</td>
                    <td title={formatAbsoluteCurrencyByContext(c(r.revenue), currencyContext)}>{formatCompactCurrency(c(r.revenue), currencyContext)}</td>
                    <td title={formatAbsoluteCurrencyByContext(c(r.spend), currencyContext)}>{formatCompactCurrency(c(r.spend), currencyContext)}</td>
                    <td title={formatAbsoluteInteger(r.plannedImpressions)}>{fmtImpr(r.plannedImpressions)}</td>
                    <td title={`${formatAbsoluteInteger(r.deliveredImpressions)}${r.deliveredPct != null ? ` (${formatAbsolutePercent(r.deliveredPct, 2)})` : ""}`}>
                      {fmtImpr(r.deliveredImpressions)}
                      {r.deliveredPct != null && <span className="delivered-pct"> ({r.deliveredPct.toFixed(2)}%)</span>}
                    </td>
                    <td title={formatAbsoluteCurrencyByContext(c(r.grossMargin), currencyContext)}>{formatCompactCurrency(c(r.grossMargin), currencyContext)}</td>
                    <td title={formatAbsolutePercent(r.grossMarginPct, 2)}>{r.grossMarginPct != null ? `${r.grossMarginPct.toFixed(2)}%` : ""}</td>
                    <td title={formatAbsoluteCurrencyByContext(c(r.netMargin), currencyContext)}>{r.netMargin != null ? formatCompactCurrency(c(r.netMargin), currencyContext) : ""}</td>
                    <td title={formatAbsolutePercent(r.netMarginPct, 2)}>{r.netMarginPct != null ? `${r.netMarginPct.toFixed(2)}%` : ""}</td>
                  </tr>
                );
              })}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="total-row">
                  <td><strong>Total</strong></td>
                  <td title={formatAbsoluteInteger(totals.campaigns)}><strong>{totals.campaigns}</strong></td>
                  <td title={formatAbsoluteInteger(totals.budgetGroups)}><strong>{totals.budgetGroups?.toLocaleString()}</strong></td>
                  <td title={formatAbsoluteCurrencyByContext(c(totals.revenue), currencyContext)}><strong>{formatCompactCurrency(c(totals.revenue), currencyContext)}</strong></td>
                  <td title={formatAbsoluteCurrencyByContext(c(totals.spend), currencyContext)}><strong>{formatCompactCurrency(c(totals.spend), currencyContext)}</strong></td>
                  <td title={formatAbsoluteInteger(totals.plannedImpressions)}><strong>{fmtImpr(totals.plannedImpressions)}</strong></td>
                  <td title={`${formatAbsoluteInteger(totals.deliveredImpressions)}${totals.deliveredPct != null ? ` (${formatAbsolutePercent(totals.deliveredPct, 2)})` : ""}`}>
                    <strong>{fmtImpr(totals.deliveredImpressions)}</strong>
                    {totals.deliveredPct != null && <span className="delivered-pct-total"> ({totals.deliveredPct.toFixed(2)}%)</span>}
                  </td>
                  <td title={formatAbsoluteCurrencyByContext(c(totals.grossMargin), currencyContext)}><strong>{formatCompactCurrency(c(totals.grossMargin), currencyContext)}</strong></td>
                  <td title={formatAbsolutePercent(totals.grossMarginPct, 2)}><strong>{totals.grossMarginPct.toFixed(2)}%</strong></td>
                  <td title={formatAbsoluteCurrencyByContext(c(totals.netMargin), currencyContext)}><strong>{totals.netMargin != null ? formatCompactCurrency(c(totals.netMargin), currencyContext) : ""}</strong></td>
                  <td title={formatAbsolutePercent(totals.netMarginPct, 2)}><strong>{totals.netMarginPct != null ? `${totals.netMarginPct.toFixed(2)}%` : ""}</strong></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

