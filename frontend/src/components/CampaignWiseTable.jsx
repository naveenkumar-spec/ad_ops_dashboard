import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../utils/apiClient";
import { mockCampaignWise, mockCampaignWiseTotals } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import { formatAbsoluteInteger, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import { convertUsdToDisplay, formatAbsoluteCurrencyByContext, formatCompactCurrency } from "../utils/currencyDisplay.js";
import SortableHeader from "./SortableHeader.jsx";
import DownloadButton from "./DownloadButton.jsx";
import { exportTableToCSV } from "../utils/csvExport.js";
import "../../styles/Tables.css";
import "../../styles/Filters.css";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function fmtNum(v) {
  if (v == null) return "";
  return Number(v).toLocaleString();
}

function fmtPct(v) {
  if (v == null) return "";
  return `${v.toFixed(2)}%`;
}

function fmtImpr(v) {
  if (v == null) return "";
  const n = Number(v);
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return String(n);
}

function deriveRow(row) {
  const start = new Date(row.startDate);
  const end = new Date(row.endDate);
  const calculatedDuration = Math.max(1, Math.round((end - start) / MS_PER_DAY) + 1);
  const today = new Date();
  const calculatedDaysRemaining = Math.round((end - today) / MS_PER_DAY);
  const calculatedPctPassed = ((calculatedDuration - calculatedDaysRemaining) / calculatedDuration) * 100;
  const calculatedDailyRequiredPace = calculatedDaysRemaining > 0 ? (row.plannedImpressions - row.deliveredImpressions) / calculatedDaysRemaining : 0;

  return {
    ...row,
    duration: row.campaignDuration || calculatedDuration,
    daysRemaining: row.daysRemaining !== undefined ? row.daysRemaining : calculatedDaysRemaining,
    pctPassed: row.daysPassed !== undefined ? row.daysPassed : calculatedPctPassed,
    dailyRequiredPace: row.dailyRequiredPace !== undefined ? row.dailyRequiredPace : calculatedDailyRequiredPace,
    yesterdayPace: row.yesterdayPace || 0,
    paceRemarks: row.paceRemarks || ""
  };
}

export default function CampaignWiseTable({ filters = {}, currencyContext = null }) {
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [campaignFilter, setCampaignFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortField, setSortField] = useState("name");
  const [sortDirection, setSortDirection] = useState("desc");
  const filterRef = useRef(null);
  const c = (v) => convertUsdToDisplay(v, currencyContext) ?? 0;

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

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
      currencyMode: currencyContext?.mode === "Native" ? "native" : "usd",
      limit: 50,
      offset: currentOffset
    };
    if (campaignFilter.trim()) {
      apiParams.campaign = campaignFilter.trim();
    }
    if (sortField) {
      apiParams.sortBy = sortField;
      apiParams.sortOrder = sortDirection;
    }

    console.log(`[CampaignWiseTable] API call params:`, {
      currencyMode: apiParams.currencyMode,
      currencyContextMode: currencyContext?.mode,
      offset: currentOffset,
      sortBy: apiParams.sortBy
    });

    apiGet("/api/overview/campaign-wise", {
      timeout: 12000,
      params: apiParams
    })
      .then((res) => {
        if (res.data?.rows?.length) {
          const newRows = res.data.rows.map(deriveRow);
          setData(prev => isInitial ? newRows : [...prev, ...newRows]);
          setTotals(res.data.totals);
          setHasMore(res.data.hasMore !== false);
          setOffset(currentOffset + res.data.rows.length);
          if (isInitial) setInitialLoadComplete(true);
        } else if (isInitial) {
          setData(mockCampaignWise.map(deriveRow));
          setTotals(mockCampaignWiseTotals);
          setHasMore(false);
          setInitialLoadComplete(true);
        }
      })
      .catch(() => {
        if (isInitial) {
          setData(mockCampaignWise.map(deriveRow));
          setTotals(mockCampaignWiseTotals);
          setHasMore(false);
          setInitialLoadComplete(true);
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
  }, [JSON.stringify(filters), campaignFilter, sortField, sortDirection, currencyContext?.mode]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
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

  const totalsDerived = useMemo(() => {
    if (totals) return totals;
    if (!data.length) return null;
    const acc = data.reduce(
      (agg, r) => {
        agg.budgetGroups += r.budgetGroups || 0;
        agg.duration += r.duration || 0;
        agg.daysRemaining += r.daysRemaining || 0;
        agg.plannedImpressions += r.plannedImpressions || 0;
        agg.deliveredImpressions += r.deliveredImpressions || 0;
        agg.yesterdayPace += r.yesterdayPace || 0;
        agg.revenue += r.revenue || 0;
        agg.spend += r.spend || 0;
        agg.grossMargin += r.grossMargin || 0;
        agg.netMargin += r.netMargin || 0;
        return agg;
      },
      { budgetGroups: 0, duration: 0, daysRemaining: 0, plannedImpressions: 0, deliveredImpressions: 0, yesterdayPace: 0, revenue: 0, spend: 0, grossMargin: 0, netMargin: 0 }
    );
    acc.avgPctPassed = data.reduce((sum, r) => sum + (r.pctPassed || 0), 0) / data.length;
    acc.grossMarginPct = acc.revenue > 0 ? ((acc.revenue - acc.spend) / acc.revenue) * 100 : 0;
    acc.netMarginPct = acc.revenue > 0 ? (acc.netMargin / acc.revenue) * 100 : 0;
    return acc;
  }, [data, totals]);

  const sh = (field, label) => (
    <SortableHeader field={field} sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
      {label}
    </SortableHeader>
  );

  const handleDownload = () => {
    const exportData = data.map((row) => ({
      campaignName: row.name,
      budgetGroups: row.budgetGroups || 0,
      startDate: fmtDate(row.startDate),
      endDate: fmtDate(row.endDate),
      status: row.status,
      duration: row.duration || 0,
      daysRemaining: row.daysRemaining || 0,
      pctPassed: row.pctPassed != null ? row.pctPassed.toFixed(2) : "",
      plannedImpressions: Math.round(row.plannedImpressions || 0),
      deliveredImpressions: Math.round(row.deliveredImpressions || 0),
      dailyRequiredPace: Math.round(row.dailyRequiredPace || 0),
      yesterdayPace: Math.round(row.yesterdayPace || 0),
      revenue: Math.round(c(row.revenue) || 0),
      spend: Math.round(c(row.spend) || 0),
      grossMargin: Math.round(c(row.grossMargin) || 0),
      grossMarginPct: row.grossMarginPct != null ? row.grossMarginPct.toFixed(2) : "",
      netMargin: Math.round(c(row.netMargin) || 0),
      netMarginPct: row.netMarginPct != null ? row.netMarginPct.toFixed(2) : "",
      paceRemarks: row.paceRemarks || ""
    }));

    // Add totals row
    if (totalsDerived) {
      exportData.push({
        campaignName: "Total",
        budgetGroups: totalsDerived.budgetGroups || 0,
        startDate: "",
        endDate: "",
        status: "",
        duration: totalsDerived.duration || 0,
        daysRemaining: totalsDerived.daysRemaining || 0,
        pctPassed: totalsDerived.avgPctPassed != null ? totalsDerived.avgPctPassed.toFixed(2) : "",
        plannedImpressions: Math.round(totalsDerived.plannedImpressions || 0),
        deliveredImpressions: Math.round(totalsDerived.deliveredImpressions || 0),
        dailyRequiredPace: "",
        yesterdayPace: Math.round(totalsDerived.yesterdayPace || 0),
        revenue: Math.round(c(totalsDerived.revenue) || 0),
        spend: Math.round(c(totalsDerived.spend) || 0),
        grossMargin: Math.round(c(totalsDerived.grossMargin) || 0),
        grossMarginPct: totalsDerived.grossMarginPct != null ? totalsDerived.grossMarginPct.toFixed(2) : "",
        netMargin: Math.round(c(totalsDerived.netMargin) || 0),
        netMarginPct: totalsDerived.netMarginPct != null ? totalsDerived.netMarginPct.toFixed(2) : "",
        paceRemarks: ""
      });
    }

    const columns = [
      { key: 'campaignName', label: 'Campaign Name' },
      { key: 'budgetGroups', label: 'Budget Groups' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'endDate', label: 'End Date' },
      { key: 'status', label: 'Status' },
      { key: 'duration', label: 'Campaign Duration' },
      { key: 'daysRemaining', label: 'Days Remaining' },
      { key: 'pctPassed', label: '% of Days Passed' },
      { key: 'plannedImpressions', label: 'Planned Impressions' },
      { key: 'deliveredImpressions', label: 'Delivered Impressions' },
      { key: 'dailyRequiredPace', label: 'Daily Required Pace' },
      { key: 'yesterdayPace', label: "Yesterday's Pace" },
      { key: 'revenue', label: `Booked Revenue (${currencyContext?.code || "USD"})` },
      { key: 'spend', label: `Spend (${currencyContext?.code || "USD"})` },
      { key: 'grossMargin', label: `Gross Margin (${currencyContext?.code || "USD"})` },
      { key: 'grossMarginPct', label: 'Gross Margin %' },
      { key: 'netMargin', label: `Net Margin (${currencyContext?.code || "USD"})` },
      { key: 'netMarginPct', label: 'Net Margin %' },
      { key: 'paceRemarks', label: 'Pace Remarks' }
    ];

    const timestamp = new Date().toISOString().split('T')[0];
    exportTableToCSV(exportData, columns, `campaign-wise-data-${timestamp}`);
  };

  return (
    <div className="adv-table-card">
      <div className="adv-table-header">
        <h3 className="adv-table-title">
          Campaign Wise Data ({totalsDerived?.rowCount || data.length} budget groups)
          <DownloadButton onClick={handleDownload} disabled={loading || !data.length} title="Download Campaign Data as CSV" />
        </h3>
        <div className="filter-group" ref={filterRef} style={{ minWidth: "200px" }}>
          <label style={{ fontSize: "10px", fontWeight: 700, color: "#4f6158", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Campaign Name
          </label>
          <div className="hierarchy-filter">
            <button
              type="button"
              className="hierarchy-trigger"
              onClick={() => setFilterOpen(o => !o)}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {campaignFilter.trim() || "All"}
              </span>
              <span className={`hierarchy-caret ${filterOpen ? "open" : ""}`} />
            </button>
            {filterOpen && (
              <div className="hierarchy-menu" style={{ minWidth: "240px", left: "auto", right: 0 }}>
                <div className="hierarchy-search-wrap">
                  <input
                    type="text"
                    className="hierarchy-search"
                    placeholder="Search campaigns..."
                    value={campaignFilter}
                    onChange={(e) => setCampaignFilter(e.target.value)}
                    autoFocus
                  />
                </div>
                <label className="hierarchy-check-row">
                  <input
                    type="checkbox"
                    checked={!campaignFilter.trim()}
                    onChange={() => setCampaignFilter("")}
                  />
                  <span>All</span>
                </label>
              </div>
            )}
          </div>
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
                  {sh("budgetGroups", "Budget Groups")}
                  {sh("startDate", "Start Date")}
                  {sh("endDate", "End Date")}
                  {sh("status", "Status")}
                  {sh("duration", "Campaign Duration")}
                  {sh("daysRemaining", "Days Remaining")}
                  {sh("pctPassed", "% of Days Passed")}
                  {sh("plannedImpressions", "Planned Impressions")}
                  {sh("deliveredImpressions", "Delivered Impressions")}
                  {sh("dailyRequiredPace", "Daily Required Pace")}
                  {sh("yesterdayPace", "Yesterday's Pace")}
                  {sh("revenue", "Booked Revenue")}
                  {sh("spend", "Spend")}
                  {sh("grossMargin", "Gross Margin")}
                  {sh("grossMarginPct", "Gross Margin %")}
                  {sh("netMargin", "Net Margin")}
                  {sh("netMarginPct", "Net Margin %")}
                  {sh("paceRemarks", "Pace Remarks")}
                </tr>
              </thead>
              <tbody>
                {initialLoadComplete && data.map((r, i) => (
                  <tr key={i}>
                    <td className="col-name" title={safeTitle(r.name)}>{r.name}</td>
                    <td title={formatAbsoluteInteger(r.budgetGroups)}>{r.budgetGroups}</td>
                    <td title={safeTitle(fmtDate(r.startDate))}>{fmtDate(r.startDate)}</td>
                    <td title={safeTitle(fmtDate(r.endDate))}>{fmtDate(r.endDate)}</td>
                    <td title={safeTitle(r.status)}>{r.status}</td>
                    <td title={formatAbsoluteInteger(r.duration)}>{fmtNum(r.duration)}</td>
                    <td className={r.daysRemaining < 0 ? "text-warn" : ""} title={formatAbsoluteInteger(r.daysRemaining)}>
                      {fmtNum(r.daysRemaining)}
                    </td>
                    <td title={formatAbsolutePercent(r.pctPassed, 2)}>{fmtPct(r.pctPassed)}</td>
                    <td title={formatAbsoluteInteger(r.plannedImpressions)}>{fmtImpr(r.plannedImpressions)}</td>
                    <td title={formatAbsoluteInteger(r.deliveredImpressions)}>{fmtImpr(r.deliveredImpressions)}</td>
                    <td title={formatAbsoluteInteger(r.dailyRequiredPace)}>{fmtImpr(r.dailyRequiredPace)}</td>
                    <td title={formatAbsoluteInteger(r.yesterdayPace)}>{fmtImpr(r.yesterdayPace)}</td>
                    <td title={formatAbsoluteCurrencyByContext(c(r.revenue), currencyContext)}>{formatCompactCurrency(c(r.revenue), currencyContext)}</td>
                    <td title={formatAbsoluteCurrencyByContext(c(r.spend), currencyContext)}>{formatCompactCurrency(c(r.spend), currencyContext)}</td>
                    <td title={formatAbsoluteCurrencyByContext(c(r.grossMargin), currencyContext)}>{formatCompactCurrency(c(r.grossMargin), currencyContext)}</td>
                    <td title={formatAbsolutePercent(r.grossMarginPct, 2)}>{r.grossMarginPct != null ? fmtPct(r.grossMarginPct) : ""}</td>
                    <td title={formatAbsoluteCurrencyByContext(c(r.netMargin), currencyContext)}>{r.netMargin != null ? formatCompactCurrency(c(r.netMargin), currencyContext) : ""}</td>
                    <td title={formatAbsolutePercent(r.netMarginPct, 2)}>{r.netMarginPct != null ? fmtPct(r.netMarginPct) : ""}</td>
                    <td title={safeTitle(r.paceRemarks)}>{r.paceRemarks}</td>
                  </tr>
                ))}
                {loadingMore && (
                  <tr>
                    <td colSpan="19" style={{ textAlign: "center", padding: "20px" }}>Loading more...</td>
                  </tr>
                )}
                {!loadingMore && hasMore && data.length >= 50 && (
                  <tr>
                    <td colSpan="19" style={{ textAlign: "center", padding: "10px", color: "#666", fontSize: "12px" }}>
                      Scroll down to load more
                    </td>
                  </tr>
                )}
              </tbody>
              {totalsDerived && (
                <tfoot>
                  <tr className="total-row">
                    <td><strong>Total</strong></td>
                    <td><strong title={formatAbsoluteInteger(totalsDerived.budgetGroups)}>{fmtNum(totalsDerived.budgetGroups)}</strong></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td><strong title={formatAbsoluteInteger(totalsDerived.duration)}>{fmtNum(totalsDerived.duration)}</strong></td>
                    <td><strong title={formatAbsoluteInteger(totalsDerived.daysRemaining)}>{fmtNum(totalsDerived.daysRemaining)}</strong></td>
                    <td><strong><span title={formatAbsolutePercent(totalsDerived.avgPctPassed, 2)}>{totalsDerived.avgPctPassed ? `${totalsDerived.avgPctPassed.toFixed(2)}%` : ""}</span></strong></td>
                    <td><strong title={formatAbsoluteInteger(totalsDerived.plannedImpressions)}>{fmtImpr(totalsDerived.plannedImpressions)}</strong></td>
                    <td><strong title={formatAbsoluteInteger(totalsDerived.deliveredImpressions)}>{fmtImpr(totalsDerived.deliveredImpressions)}</strong></td>
                    <td></td>
                    <td><strong title={formatAbsoluteInteger(totalsDerived.yesterdayPace)}>{fmtImpr(totalsDerived.yesterdayPace)}</strong></td>
                    <td><strong title={formatAbsoluteCurrencyByContext(c(totalsDerived.revenue), currencyContext)}>{formatCompactCurrency(c(totalsDerived.revenue), currencyContext)}</strong></td>
                    <td><strong title={formatAbsoluteCurrencyByContext(c(totalsDerived.spend), currencyContext)}>{formatCompactCurrency(c(totalsDerived.spend), currencyContext)}</strong></td>
                    <td><strong title={formatAbsoluteCurrencyByContext(c(totalsDerived.grossMargin), currencyContext)}>{formatCompactCurrency(c(totalsDerived.grossMargin), currencyContext)}</strong></td>
                    <td><strong title={formatAbsolutePercent(totalsDerived.grossMarginPct, 2)}>{fmtPct(totalsDerived.grossMarginPct)}</strong></td>
                    <td><strong title={formatAbsoluteCurrencyByContext(c(totalsDerived.netMargin), currencyContext)}>{formatCompactCurrency(c(totalsDerived.netMargin), currencyContext)}</strong></td>
                    <td><strong title={formatAbsolutePercent(totalsDerived.netMarginPct, 2)}>{fmtPct(totalsDerived.netMarginPct)}</strong></td>
                    <td></td>
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
