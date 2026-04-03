import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../utils/apiClient";
import {
  mockProductData,
  mockProductTotals,
  mockProductChildren,
} from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import { formatAbsoluteInteger, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import { convertUsdToDisplay, formatAbsoluteCurrencyByContext, formatCompactCurrency } from "../utils/currencyDisplay.js";
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

export default function ProductWiseTable({ filters = {}, currencyContext = null }) {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const c = (v) => convertUsdToDisplay(v, currencyContext) ?? 0;

  const loadData = (isInitial = false, currentRows = []) => {
    const currentOffset = isInitial ? 0 : offset;
    if (isInitial) {
      if (currentRows.length === 0) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    apiGet("/api/overview/product-wise", {
      timeout: 6000,
      params: { ...toApiParams(filters), limit: 50, offset: currentOffset }
    })
      .then((res) => {
        if (res.data?.rows?.length) {
          const newRows = res.data.rows;
          setRows(prev => isInitial ? newRows : [...prev, ...newRows]);
          setTotals(res.data.totals);
          setHasMore(res.data.hasMore !== false);
          setOffset(currentOffset + newRows.length);
        } else if (isInitial) {
          setRows(mockProductData);
          setTotals(mockProductTotals);
          setHasMore(false);
        }
      })
      .catch(() => {
        if (isInitial) {
          setRows(mockProductData);
          setTotals(mockProductTotals);
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
    setRows(prev => {
      loadData(true, prev);
      return prev;
    });
  }, [JSON.stringify(filters)]);

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

  const renderDelivered = (row) => {
    const pct =
      row.deliveredPct ??
      (row.plannedImpressions
        ? (row.deliveredImpressions / row.plannedImpressions) * 100
        : null);
    return (
      <>
        {fmtImpr(row.deliveredImpressions)}
        {pct != null && (
          <span className="delivered-pct"> ({pct.toFixed(2)}%)</span>
        )}
      </>
    );
  };

  const toggle = (product) =>
    setExpanded((prev) => ({ ...prev, [product]: !prev[product] }));

  const flattened = useMemo(() => {
    const sortedRows = sortRows(rows, sortField, sortDirection);
    const out = [];
    sortedRows.forEach((row) => {
      out.push({ type: "product", ...row });
      const children = mockProductChildren[row.product] || [];
      if (expanded[row.product] && children.length) {
        children.forEach((ch) => out.push({ type: "child", parent: row.product, ...ch }));
      }
    });
    return out;
  }, [rows, expanded, sortField, sortDirection]);

  const sh = (field, label) => (
    <SortableHeader field={field} sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
      {label}
    </SortableHeader>
  );

  return (
    <div className="adv-table-card">
      <div className="adv-table-header">
        <h3 className="adv-table-title">
          Product and Platform wise data
          {totals?.rowCount && ` - Showing ${rows.length} of ${totals.rowCount} products`}
        </h3>
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
                  {sh("product", "Product")}
                  {sh("totalCampaigns", "Total Campaigns")}
                  {sh("budgetGroups", "Budget Groups")}
                  {sh("bookedRevenue", "Booked Revenue")}
                  {sh("spend", "Spend")}
                  {sh("plannedImpressions", "Planned Impressions")}
                  {sh("deliveredImpressions", "Delivered Impressions")}
                  {sh("grossProfitLoss", "Gross Profit / Loss")}
                  {sh("grossMargin", "Gross Margin %")}
                  {sh("netMargin", "Net Margin")}
                  {sh("netMarginPct", "Net Margin %")}
                </tr>
              </thead>
              <tbody>
                {flattened.map((row, idx) => {
                  if (row.type === "child") {
                    return (
                      <tr key={`c-${idx}`} className="child-row">
                        <td className="child-name">
                          <span className="child-bullet">•</span>
                          <span title={safeTitle(row.product)}>{row.product}</span>
                        </td>
                        <td title={formatAbsoluteInteger(row.totalCampaigns)}>{row.totalCampaigns}</td>
                        <td title={formatAbsoluteInteger(row.budgetGroups)}>{row.budgetGroups?.toLocaleString()}</td>
                        <td title={formatAbsoluteCurrencyByContext(c(row.bookedRevenue), currencyContext)}>{formatCompactCurrency(c(row.bookedRevenue), currencyContext)}</td>
                        <td title={formatAbsoluteCurrencyByContext(c(row.spend), currencyContext)}>{formatCompactCurrency(c(row.spend), currencyContext)}</td>
                        <td title={formatAbsoluteInteger(row.plannedImpressions)}>{fmtImpr(row.plannedImpressions)}</td>
                        <td title={`${formatAbsoluteInteger(row.deliveredImpressions)}${row.deliveredPct != null ? ` (${formatAbsolutePercent(row.deliveredPct, 2)})` : ""}`}>{renderDelivered(row)}</td>
                        <td title={formatAbsoluteCurrencyByContext(c(row.grossProfitLoss), currencyContext)}>{formatCompactCurrency(c(row.grossProfitLoss), currencyContext)}</td>
                        <td title={formatAbsolutePercent(row.grossMargin, 2)}>{row.grossMargin != null ? `${row.grossMargin.toFixed(2)}%` : ""}</td>
                        <td title={formatAbsoluteCurrencyByContext(c(row.netMargin), currencyContext)}>{row.netMargin != null ? formatCompactCurrency(c(row.netMargin), currencyContext) : ""}</td>
                        <td title={formatAbsolutePercent(row.netMarginPct, 2)}>{row.netMarginPct != null ? `${row.netMarginPct.toFixed(2)}%` : ""}</td>
                      </tr>
                    );
                  }

                  const children = mockProductChildren[row.product] || [];
                  const isOpen = expanded[row.product];

                  return (
                    <tr key={`p-${idx}`} className={row.isTotal ? "total-row" : "region-row"}>
                      <td>
                        <button
                          className={`expand-btn ${isOpen ? "open" : ""} ${children.length ? "" : "disabled"}`}
                          onClick={() => children.length && toggle(row.product)}
                          disabled={!children.length}
                        >
                          {children.length ? (isOpen ? "-" : "+") : "+"}
                        </button>
                        <span className="region-name" title={safeTitle(row.product)}>{row.product}</span>
                      </td>
                      <td title={formatAbsoluteInteger(row.totalCampaigns)}>{row.totalCampaigns}</td>
                      <td title={formatAbsoluteInteger(row.budgetGroups)}>{row.budgetGroups?.toLocaleString()}</td>
                      <td title={formatAbsoluteCurrencyByContext(c(row.bookedRevenue), currencyContext)}>{formatCompactCurrency(c(row.bookedRevenue), currencyContext)}</td>
                      <td title={formatAbsoluteCurrencyByContext(c(row.spend), currencyContext)}>{formatCompactCurrency(c(row.spend), currencyContext)}</td>
                      <td title={formatAbsoluteInteger(row.plannedImpressions)}>{fmtImpr(row.plannedImpressions)}</td>
                      <td title={`${formatAbsoluteInteger(row.deliveredImpressions)}${row.deliveredPct != null ? ` (${formatAbsolutePercent(row.deliveredPct, 2)})` : ""}`}>{renderDelivered(row)}</td>
                      <td title={formatAbsoluteCurrencyByContext(c(row.grossProfitLoss), currencyContext)}>{formatCompactCurrency(c(row.grossProfitLoss), currencyContext)}</td>
                      <td title={formatAbsolutePercent(row.grossMargin, 2)}>{row.grossMargin != null ? `${row.grossMargin.toFixed(2)}%` : ""}</td>
                      <td title={formatAbsoluteCurrencyByContext(c(row.netMargin), currencyContext)}>{row.netMargin != null ? formatCompactCurrency(c(row.netMargin), currencyContext) : ""}</td>
                      <td title={formatAbsolutePercent(row.netMarginPct, 2)}>{row.netMarginPct != null ? `${row.netMarginPct.toFixed(2)}%` : ""}</td>
                    </tr>
                  );
                })}
                {loadingMore && (
                  <tr>
                    <td colSpan="11" style={{ textAlign: "center", padding: "20px" }}>Loading more...</td>
                  </tr>
                )}
                {!loadingMore && hasMore && rows.length >= 50 && (
                  <tr>
                    <td colSpan="11" style={{ textAlign: "center", padding: "10px", color: "#666", fontSize: "12px" }}>
                      Scroll down to load more
                    </td>
                  </tr>
                )}
              </tbody>
              {totals && (
                <tfoot>
                  <tr className="total-row">
                    <td><strong>Total</strong></td>
                    <td><strong title={formatAbsoluteInteger(totals.totalCampaigns)}>{totals.totalCampaigns}</strong></td>
                    <td><strong title={formatAbsoluteInteger(totals.budgetGroups)}>{totals.budgetGroups?.toLocaleString()}</strong></td>
                    <td><strong title={formatAbsoluteCurrencyByContext(c(totals.bookedRevenue), currencyContext)}>{formatCompactCurrency(c(totals.bookedRevenue), currencyContext)}</strong></td>
                    <td><strong title={formatAbsoluteCurrencyByContext(c(totals.spend), currencyContext)}>{formatCompactCurrency(c(totals.spend), currencyContext)}</strong></td>
                    <td><strong title={formatAbsoluteInteger(totals.plannedImpressions)}>{fmtImpr(totals.plannedImpressions)}</strong></td>
                    <td title={`${formatAbsoluteInteger(totals.deliveredImpressions)}${totals.deliveredPct != null ? ` (${formatAbsolutePercent(totals.deliveredPct, 2)})` : ""}`}>
                      <strong>{fmtImpr(totals.deliveredImpressions)}</strong>
                      {totals.deliveredPct != null && <span className="delivered-pct-total"> ({totals.deliveredPct.toFixed(2)}%)</span>}
                    </td>
                    <td><strong title={formatAbsoluteCurrencyByContext(c(totals.grossProfitLoss), currencyContext)}>{formatCompactCurrency(c(totals.grossProfitLoss), currencyContext)}</strong></td>
                    <td><strong title={formatAbsolutePercent(totals.grossMargin, 2)}>{totals.grossMargin.toFixed(2)}%</strong></td>
                    <td><strong title={formatAbsoluteCurrencyByContext(c(totals.netMargin), currencyContext)}>{totals.netMargin != null ? formatCompactCurrency(c(totals.netMargin), currencyContext) : ""}</strong></td>
                    <td><strong title={formatAbsolutePercent(totals.netMarginPct, 2)}>{totals.netMarginPct != null ? `${totals.netMarginPct.toFixed(2)}%` : ""}</strong></td>
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
