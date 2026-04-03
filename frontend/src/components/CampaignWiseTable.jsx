import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../utils/apiClient";
import { mockCampaignWise, mockCampaignWiseTotals } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import { formatAbsoluteInteger, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import { convertUsdToDisplay, formatAbsoluteCurrencyByContext, formatCompactCurrency } from "../utils/currencyDisplay.js";
import "../../styles/Tables.css";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function SortableHeader({ field, children, sortField, sortDirection, onSort }) {
  const isActive = sortField === field;
  const isAsc = isActive && sortDirection === "asc";
  const isDesc = isActive && sortDirection === "desc";
  
  return (
    <th 
      className="sortable-header" 
      onClick={() => onSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      <div className="header-content">
        <span>{children}</span>
        <span className="sort-icons">
          <span className={`sort-icon sort-asc ${isAsc ? 'active' : ''}`}>▲</span>
          <span className={`sort-icon sort-desc ${isDesc ? 'active' : ''}`}>▼</span>
        </span>
      </div>
    </th>
  );
}

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
  // Use backend data when available, fallback to calculations for compatibility
  const start = new Date(row.startDate);
  const end = new Date(row.endDate);
  const calculatedDuration = Math.max(1, Math.round((end - start) / MS_PER_DAY) + 1);
  const today = new Date();
  const calculatedDaysRemaining = Math.round((end - today) / MS_PER_DAY);
  const calculatedPctPassed = ((calculatedDuration - calculatedDaysRemaining) / calculatedDuration) * 100;
  const calculatedDailyRequiredPace = calculatedDaysRemaining > 0 ? (row.plannedImpressions - row.deliveredImpressions) / calculatedDaysRemaining : 0;
  
  return {
    ...row,
    // Use backend data if available, otherwise use calculated values
    duration: row.campaignDuration || calculatedDuration,
    daysRemaining: row.daysRemaining !== undefined ? row.daysRemaining : calculatedDaysRemaining,
    pctPassed: row.daysPassed !== undefined ? row.daysPassed : calculatedPctPassed,
    dailyRequiredPace: row.dailyRequiredPace !== undefined ? row.dailyRequiredPace : calculatedDailyRequiredPace,
    yesterdayPace: row.yesterdayPace || 0,
    paceRemarks: row.paceRemarks || ''
  };
}

export default function CampaignWiseTable({ filters = {}, currencyContext = null }) {
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [campaignFilter, setCampaignFilter] = useState("");
  const [sortField, setSortField] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");
  const c = (v) => convertUsdToDisplay(v, currencyContext) ?? 0;

  const loadData = (isInitial = false) => {
    const currentOffset = isInitial ? 0 : offset;
    if (isInitial) {
      setLoading(true);
      setData([]);
      setOffset(0);
    } else {
      setLoadingMore(true);
    }

    // Add campaign filter to API params
    const apiParams = { 
      ...toApiParams(filters), 
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
        } else if (isInitial) {
          setData(mockCampaignWise.map(deriveRow));
          setTotals(mockCampaignWiseTotals);
          setHasMore(false);
        }
      })
      .catch(() => {
        if (isInitial) {
          setData(mockCampaignWise.map(deriveRow));
          setTotals(mockCampaignWiseTotals);
          setHasMore(false);
        }
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  };

  useEffect(() => {
    loadData(true);
  }, [JSON.stringify(filters), campaignFilter, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleScroll = (e) => {
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

  return (
    <div className="adv-table-card">
      <div className="adv-table-header">
        <h3 className="adv-table-title">
          Campaign Wise Data ({totalsDerived?.rowCount || data.length} budget groups)
        </h3>
        <div className="campaign-filter-container">
          <input
            type="text"
            placeholder="Filter by campaign name..."
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="campaign-filter-input"
          />
        </div>
      </div>

      {loading ? (
        <div className="table-loading">Loading...</div>
      ) : (
        <div className="adv-table-scroll" onScroll={handleScroll}>
          <table className="adv-table">
            <thead>
              <tr>
                <SortableHeader field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Campaign Name
                </SortableHeader>
                <SortableHeader field="budgetGroups" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Budget Groups
                </SortableHeader>
                <SortableHeader field="startDate" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Start Date
                </SortableHeader>
                <SortableHeader field="endDate" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  End Date
                </SortableHeader>
                <SortableHeader field="status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Status
                </SortableHeader>
                <SortableHeader field="duration" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Campaign Duration
                </SortableHeader>
                <SortableHeader field="daysRemaining" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Days Remaining
                </SortableHeader>
                <SortableHeader field="pctPassed" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  % of Days Passed
                </SortableHeader>
                <SortableHeader field="plannedImpressions" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Planned Impressions
                </SortableHeader>
                <SortableHeader field="deliveredImpressions" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Delivered Impressions
                </SortableHeader>
                <SortableHeader field="dailyRequiredPace" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Daily Required Pace
                </SortableHeader>
                <SortableHeader field="yesterdayPace" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Yesterday's Pace
                </SortableHeader>
                <SortableHeader field="revenue" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Booked Revenue
                </SortableHeader>
                <SortableHeader field="spend" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Spend
                </SortableHeader>
                <SortableHeader field="grossMargin" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Gross Margin
                </SortableHeader>
                <SortableHeader field="grossMarginPct" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Gross Margin %
                </SortableHeader>
                <SortableHeader field="netMargin" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Net Margin
                </SortableHeader>
                <SortableHeader field="netMarginPct" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Net Margin %
                </SortableHeader>
                <SortableHeader field="paceRemarks" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Pace Remarks
                </SortableHeader>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
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
                  <td colSpan="19" style={{ textAlign: 'center', padding: '20px' }}>
                    Loading more...
                  </td>
                </tr>
              )}
              {!loadingMore && hasMore && data.length >= 50 && (
                <tr>
                  <td colSpan="19" style={{ textAlign: 'center', padding: '10px', color: '#666', fontSize: '12px' }}>
                    Scroll down to load more
                  </td>
                </tr>
              )}
            </tbody>
            {totalsDerived && (
              <tfoot>
                <tr className="total-row">
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td>
                    <strong title={formatAbsoluteInteger(totalsDerived.budgetGroups)}>{fmtNum(totalsDerived.budgetGroups)}</strong>
                  </td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td>
                    <strong title={formatAbsoluteInteger(totalsDerived.duration)}>{fmtNum(totalsDerived.duration)}</strong>
                  </td>
                  <td>
                    <strong title={formatAbsoluteInteger(totalsDerived.daysRemaining)}>{fmtNum(totalsDerived.daysRemaining)}</strong>
                  </td>
                  <td>
                    <strong>
                      <span title={formatAbsolutePercent(totalsDerived.avgPctPassed, 2)}>{totalsDerived.avgPctPassed
                        ? `${totalsDerived.avgPctPassed.toFixed(2)}%`
                        : ""}</span>
                    </strong>
                  </td>
                  <td>
                    <strong title={formatAbsoluteInteger(totalsDerived.plannedImpressions)}>{fmtImpr(totalsDerived.plannedImpressions)}</strong>
                  </td>
                  <td>
                    <strong title={formatAbsoluteInteger(totalsDerived.deliveredImpressions)}>{fmtImpr(totalsDerived.deliveredImpressions)}</strong>
                  </td>
                  <td></td>
                  <td>
                    <strong title={formatAbsoluteInteger(totalsDerived.yesterdayPace)}>{fmtImpr(totalsDerived.yesterdayPace)}</strong>
                  </td>
                  <td>
                    <strong title={formatAbsoluteCurrencyByContext(c(totalsDerived.revenue), currencyContext)}>{formatCompactCurrency(c(totalsDerived.revenue), currencyContext)}</strong>
                  </td>
                  <td>
                    <strong title={formatAbsoluteCurrencyByContext(c(totalsDerived.spend), currencyContext)}>{formatCompactCurrency(c(totalsDerived.spend), currencyContext)}</strong>
                  </td>
                  <td>
                    <strong title={formatAbsoluteCurrencyByContext(c(totalsDerived.grossMargin), currencyContext)}>{formatCompactCurrency(c(totalsDerived.grossMargin), currencyContext)}</strong>
                  </td>
                  <td>
                    <strong title={formatAbsolutePercent(totalsDerived.grossMarginPct, 2)}>{fmtPct(totalsDerived.grossMarginPct)}</strong>
                  </td>
                  <td>
                    <strong title={formatAbsoluteCurrencyByContext(c(totalsDerived.netMargin), currencyContext)}>{formatCompactCurrency(c(totalsDerived.netMargin), currencyContext)}</strong>
                  </td>
                  <td>
                    <strong title={formatAbsolutePercent(totalsDerived.netMarginPct, 2)}>{fmtPct(totalsDerived.netMarginPct)}</strong>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}