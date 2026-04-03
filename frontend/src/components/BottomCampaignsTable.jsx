import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../utils/apiClient";
import { mockBottomCampaigns, mockBottomCampaignsTotals } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import { formatAbsoluteInteger, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import {
  convertUsdToDisplay,
  formatAbsoluteCurrencyByContext,
  formatCompactCurrency
} from "../utils/currencyDisplay.js";
import SortableHeader from "./SortableHeader.jsx";
import "../../styles/Tables.css";

function fmtImpr(v) {
  if (v == null) return "";
  const n = Number(v);
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return String(n);
}

function sortRows(arr, field, direction) {
  if (!field) return arr;
  return [...arr].sort((a, b) => {
    const av = a[field], bv = b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
    return direction === "asc" ? cmp : -cmp;
  });
}

export default function BottomCampaignsTable({ filters = {}, currencyContext = null }) {
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState(null);
  const [view, setView] = useState("bottom");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  const loadData = (isInitial = false, currentData = []) => {
    const currentOffset = isInitial ? 0 : offset;
    if (isInitial) {
      if (currentData.length === 0) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    apiGet("/api/overview/campaigns-detailed", {
      timeout: 6000,
      params: { ...toApiParams(filters), view, limit: 50, offset: currentOffset }
    })
      .then((res) => {
        if (res.data?.rows?.length) {
          const newRows = res.data.rows;
          setData(prev => isInitial ? newRows : [...prev, ...newRows]);
          setTotals(res.data.totals);
          setHasMore(res.data.hasMore !== false);
          setOffset(currentOffset + newRows.length);
        } else if (isInitial) {
          setData(mockBottomCampaigns);
          setTotals(mockBottomCampaignsTotals);
          setHasMore(false);
        }
      })
      .catch(() => {
        if (isInitial) {
          setData(mockBottomCampaigns);
          setTotals(mockBottomCampaignsTotals);
          setHasMore(false);
        }
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      });
  };

  useEffect(() => {
    setData(prev => {
      loadData(true, prev);
      return prev;
    });
  }, [JSON.stringify(filters), view]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleScroll = (e) => {
    if (refreshing) return;
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasMore && !loadingMore) {
      loadData(false);
    }
  };

  const sortedData = useMemo(() => sortRows(data, sortField, sortDirection), [data, sortField, sortDirection]);

  const converted = (v) => convertUsdToDisplay(v, currencyContext) ?? 0;

  const sh = (field, label) => (
    <SortableHeader field={field} sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
      {label}
    </SortableHeader>
  );

  return (
    <div className="adv-table-card">
      <div className="adv-table-header">
        <h3 className="adv-table-title">
          {view === "bottom"
            ? "Bottom Campaigns ( with ≤ 50% Gross Margin )"
            : "Top Campaigns ( with ≥ 50% Gross Margin )"}
          {totals?.rowCount && ` - Showing ${data.length} of ${totals.rowCount}`}
        </h3>
        <div className="bottom-top-toggle">
          <button className={`bt-btn ${view === "bottom" ? "active" : ""}`} onClick={() => setView("bottom")}>Bottom</button>
          <button className={`bt-btn ${view === "top" ? "active" : ""}`} onClick={() => setView("top")}>Top</button>
        </div>
      </div>

      {loading ? (
        <div className="table-loading">Loading...</div>
      ) : (
        <div className="table-refresh-wrapper">
          {refreshing && (
            <div className="table-refreshing-overlay">
              <div className="table-refreshing-spinner">Updating...</div>
            </div>
          )}
          <div className="adv-table-scroll" onScroll={handleScroll}>
            <table className="adv-table">
              <thead>
                <tr>
                  {sh("name", "Campaign Name")}
                  {sh("status", "Status")}
                  {sh("revenue", "Booked Revenue")}
                  {sh("spend", "Spend")}
                  {sh("grossMargin", "Gross Margin")}
                  {sh("grossMarginPct", "Gross Margin %")}
                  {sh("netMargin", "Net Margin")}
                  {sh("netMarginPct", "Net Margin %")}
                  {sh("plannedImpressions", "Planned Impressions")}
                </tr>
              </thead>
              <tbody>
                {sortedData.map((r, i) => {
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
                {loadingMore && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", padding: "20px" }}>Loading more...</td>
                  </tr>
                )}
                {!loadingMore && hasMore && data.length >= 50 && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: "center", padding: "10px", color: "#666", fontSize: "12px" }}>
                      Scroll down to load more
                    </td>
                  </tr>
                )}
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
        </div>
      )}
    </div>
  );
}
