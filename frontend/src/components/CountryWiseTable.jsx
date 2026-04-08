import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../utils/apiClient";
import { mockCountryData, mockCountryTotals } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import { formatAbsoluteInteger, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import { convertUsdToDisplay, formatAbsoluteCurrencyByContext, formatCompactCurrency } from "../utils/currencyDisplay.js";
import { exportTableToCSV } from "../utils/csvExport.js";
import SortableHeader from "./SortableHeader.jsx";
import DownloadButton from "./DownloadButton.jsx";
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

export default function CountryWiseTable({ filters = {}, currencyContext = null }) {
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState(null);
  const [childrenByRegion, setChildrenByRegion] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const c = (v) => convertUsdToDisplay(v, currencyContext) ?? 0;

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

    const apiParams = {
      ...toApiParams(filters),
      currencyMode: currencyContext?.mode === "Native" ? "native" : "usd"
    };
    
    Promise.all([
      apiGet("/api/overview/country-wise", {
        timeout: 12000,
        params: { ...apiParams, limit: 50, offset: currentOffset }
      }),
      apiGet("/api/overview/regions", { timeout: 12000, params: apiParams })
    ])
      .then(([countryRes, regionRes]) => {
        if (countryRes.data?.rows?.length) {
          const newRows = countryRes.data.rows;
          setData(prev => isInitial ? newRows : [...prev, ...newRows]);
          setTotals(countryRes.data.totals);
          setHasMore(countryRes.data.hasMore !== false);
          setOffset(currentOffset + newRows.length);
        } else if (isInitial) {
          setData(mockCountryData);
          setTotals(mockCountryTotals);
          setHasMore(false);
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
            grossMarginPct: row.grossMarginPct,
            netMargin: row.netMargin,
            netMarginPct: row.netMarginPct
          });
        });
        setChildrenByRegion(map);
      })
      .catch(() => {
        if (isInitial) {
          setData(mockCountryData);
          setTotals(mockCountryTotals);
          setChildrenByRegion({});
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
  }, [JSON.stringify(filters), currencyContext?.mode]);

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

  const toggle = (region) => setExpanded((prev) => ({ ...prev, [region]: !prev[region] }));

  const sortedData = useMemo(() => sortRows(data, sortField, sortDirection), [data, sortField, sortDirection]);

  const rows = [];
  sortedData.forEach((r) => {
    rows.push({ type: "region", ...r });
    const children = childrenByRegion[r.region] || [];
    if (expanded[r.region] && children.length) {
      children.forEach((child) => rows.push({ type: "child", ...child }));
    }
  });

  const sh = (field, label) => (
    <SortableHeader field={field} sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
      {label}
    </SortableHeader>
  );

  const handleDownload = () => {
    // Flatten data for CSV export with Region and Country columns
    const exportData = [];
    
    sortedData.forEach((region) => {
      // Add country rows under each region
      const children = childrenByRegion[region.region] || [];
      children.forEach((country) => {
        exportData.push({
          region: region.region,
          country: country.country,
          campaigns: country.campaigns,
          budgetGroups: country.budgetGroups,
          revenue: c(country.revenue),
          spend: c(country.spend),
          plannedImpressions: country.plannedImpressions,
          deliveredImpressions: country.deliveredImpressions,
          deliveredPct: country.deliveredPct,
          grossMargin: c(country.grossMargin),
          grossMarginPct: country.grossMarginPct
        });
      });
    });
    
    // Add totals row at the end
    if (totals) {
      exportData.push({
        region: 'Total',
        country: '',
        campaigns: totals.campaigns,
        budgetGroups: totals.budgetGroups,
        revenue: c(totals.revenue),
        spend: c(totals.spend),
        plannedImpressions: totals.plannedImpressions,
        deliveredImpressions: totals.deliveredImpressions,
        deliveredPct: totals.deliveredPct,
        grossMargin: c(totals.grossMargin),
        grossMarginPct: totals.grossMarginPct
      });
    }
    
    const columns = [
      { key: 'region', label: 'Region' },
      { key: 'country', label: 'Country' },
      { key: 'campaigns', label: 'Total Campaigns' },
      { key: 'budgetGroups', label: 'Budget Groups' },
      { key: 'revenue', label: `Booked Revenue (${currencyContext?.symbol || 'USD'})` },
      { key: 'spend', label: `Spend (${currencyContext?.symbol || 'USD'})` },
      { key: 'plannedImpressions', label: 'Planned Impressions' },
      { key: 'deliveredImpressions', label: 'Delivered Impressions' },
      { key: 'deliveredPct', label: 'Delivered %' },
      { key: 'grossMargin', label: `Gross Margin (${currencyContext?.symbol || 'USD'})` },
      { key: 'grossMarginPct', label: 'Gross Margin %' }
    ];
    
    const timestamp = new Date().toISOString().split('T')[0];
    exportTableToCSV(exportData, columns, `country-wise-data-${timestamp}`);
  };

  return (
    <div className="adv-table-card">
      <div className="adv-table-header">
        <h3 className="adv-table-title">
          Region / Country wise Data
          {totals?.rowCount && ` - Showing ${data.length} of ${totals.rowCount} regions`}
          <DownloadButton onClick={handleDownload} disabled={loading || !data.length} />
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
                  {sh("region", "Region & Country")}
                  {sh("campaigns", "Total Campaigns")}
                  {sh("budgetGroups", "Budget Groups")}
                  {sh("revenue", "Booked Revenue")}
                  {sh("spend", "Spend")}
                  {sh("plannedImpressions", "Planned Impressions")}
                  {sh("deliveredImpressions", "Delivered Impressions")}
                  {sh("grossMargin", "Gross Margin")}
                  {sh("grossMarginPct", "Gross Margin %")}
                  {sh("netMargin", "Net Margin")}
                  {sh("netMarginPct", "Net Margin %")}
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
                {loadingMore && (
                  <tr>
                    <td colSpan="11" style={{ textAlign: "center", padding: "20px" }}>Loading more...</td>
                  </tr>
                )}
                {!loadingMore && hasMore && data.length >= 50 && (
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
        </div>
      )}
    </div>
  );
}
