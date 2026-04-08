import { useEffect, useState, useMemo, Fragment } from "react";
import { apiGet } from "../utils/apiClient";
import { mockRegions, mockManagementRegions } from "../mockData.js";
import { formatAbsoluteInteger, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import { convertUsdToDisplay, formatAbsoluteCurrencyByContext, formatCompactCurrency } from "../utils/currencyDisplay.js";
import SortableHeader from "./SortableHeader.jsx";
import "../../styles/Tables.css";

const fmtN = v => (Number(v) || 0).toLocaleString();
const fmtMoneyShort = (v, ctx) => formatCompactCurrency(convertUsdToDisplay(v, ctx), ctx);

export default function RegionTable({ title = "Region Performance", variant = "overview", forceData = null, filters = {}, currencyContext = null }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  const totals = useMemo(() => {
    if (!data.length) return null;
    const sum = (fn) => data.reduce((s, r) => s + (Number(fn(r)) || 0), 0);
    if (variant === "management") {
      return {
        adOps: sum(r => r.adOps),
        cs: sum(r => r.cs),
        sales: sum(r => r.sales),
        bookedRevenue: sum(r => r.bookedRevenue),
        totalCampaigns: sum(r => r.totalCampaigns),
        budgetGroups: sum(r => r.budgetGroups)
      };
    }
    const booked = sum(r => r.bookedRevenue);
    const gross = sum(r => r.grossMargin);
    return {
      totalCampaigns: sum(r => r.totalCampaigns),
      budgetGroups: sum(r => r.budgetGroups),
      bookedRevenue: booked,
      spend: sum(r => r.spend),
      plannedImpressions: sum(r => r.plannedImpressions),
      deliveredImpressions: sum(r => r.deliveredImpressions),
      grossMargin: gross,
      grossMarginPct: booked ? ((gross / booked) * 100).toFixed(2) : "0.00"
    };
  }, [data, variant]);

  useEffect(() => {
    if (forceData) {
      setData(forceData);
      setLoading(false);
      setInitialLoadComplete(true);
      return;
    }
    setLoading(true);
    const isManagement = variant === "management";
    const endpoint = isManagement ? "/api/management/regions" : "/api/overview/regions";
    const fallback = isManagement ? mockManagementRegions : mockRegions;
    const params = filters; // Pass filters for both overview and management variants
    apiGet(endpoint, { timeout: 6000, params })
      .then(res => {
        setData(res.data?.length ? res.data : fallback);
        setInitialLoadComplete(true);
      })
      .catch(() => {
        setData(fallback);
        setInitialLoadComplete(true);
      })
      .finally(() => setLoading(false));
  }, [variant, forceData, JSON.stringify(filters)]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedData = useMemo(() => {
    // Don't show any data until initial load is complete
    if (!initialLoadComplete) {
      return [];
    }
    
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [data, sortField, sortDirection, initialLoadComplete]);

  const toggle = (idx) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const sh = (field, label) => (
    <SortableHeader field={field} sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
      {label}
    </SortableHeader>
  );

  return (
    <div className="table-card">
      <div className="table-card-header"><h3>{title}</h3></div>
      <div className="table-card-body">
        {loading ? <div className="table-loading">Loading…</div>
          : data.length === 0 ? <div className="table-empty">No data</div>
            : (
              <div className="overflow-wrapper">
                {variant === "management" ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        {sh("region", "Region & Country")}
                        {sh("adOps", "No of AdOps")}
                        {sh("cs", "No of CS")}
                        {sh("sales", "No of Sales")}
                        {sh("bookedRevenue", "Booked Revenue")}
                        {sh("totalCampaigns", "Total Campaigns")}
                        {sh("budgetGroups", "Total Budget Groups")}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedData.map((r, i) => (
                        <Fragment key={i}>
                          <tr className="row-expandable" onClick={() => r.children?.length && toggle(i)}>
                            <td>
                              <button
                                type="button"
                                className={`table-expander${r.children?.length ? "" : " disabled"}`}
                                aria-label="Toggle region"
                                disabled={!r.children?.length}
                                onClick={(e) => { e.stopPropagation(); r.children?.length && toggle(i); }}
                              >
                                {r.children?.length ? (expanded.has(i) ? "−" : "+") : "+"}
                              </button>
                              <span title={safeTitle(r.region)}>{r.region}</span>
                            </td>
                            <td title={formatAbsoluteInteger(r.adOps)}>{fmtN(r.adOps)}</td>
                            <td title={formatAbsoluteInteger(r.cs)}>{fmtN(r.cs)}</td>
                            <td title={formatAbsoluteInteger(r.sales)}>{fmtN(r.sales)}</td>
                            <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(r.bookedRevenue, currencyContext), currencyContext)}>{fmtMoneyShort(r.bookedRevenue, currencyContext)}</td>
                            <td title={formatAbsoluteInteger(r.totalCampaigns)}>{fmtN(r.totalCampaigns)}</td>
                            <td title={formatAbsoluteInteger(r.budgetGroups)}>{fmtN(r.budgetGroups)}</td>
                          </tr>
                          {expanded.has(i) && r.children?.map((ch, ci) => (
                            <tr key={`${i}-${ci}`} className="row-child">
                              <td title={safeTitle(ch.region)}>{ch.region}</td>
                              <td title={formatAbsoluteInteger(ch.adOps)}>{fmtN(ch.adOps)}</td>
                              <td title={formatAbsoluteInteger(ch.cs)}>{fmtN(ch.cs)}</td>
                              <td title={formatAbsoluteInteger(ch.sales)}>{fmtN(ch.sales)}</td>
                              <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(ch.bookedRevenue, currencyContext), currencyContext)}>{fmtMoneyShort(ch.bookedRevenue, currencyContext)}</td>
                              <td title={formatAbsoluteInteger(ch.totalCampaigns)}>{fmtN(ch.totalCampaigns)}</td>
                              <td title={formatAbsoluteInteger(ch.budgetGroups)}>{fmtN(ch.budgetGroups)}</td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                      <tr className="table-total">
                        <td>Total</td>
                        <td title={formatAbsoluteInteger(totals?.adOps || 0)}>{fmtN(totals?.adOps || 0)}</td>
                        <td title={formatAbsoluteInteger(totals?.cs || 0)}>{fmtN(totals?.cs || 0)}</td>
                        <td title={formatAbsoluteInteger(totals?.sales || 0)}>{fmtN(totals?.sales || 0)}</td>
                        <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(totals?.bookedRevenue || 0, currencyContext), currencyContext)}>{fmtMoneyShort(totals?.bookedRevenue || 0, currencyContext)}</td>
                        <td title={formatAbsoluteInteger(totals?.totalCampaigns || 0)}>{fmtN(totals?.totalCampaigns || 0)}</td>
                        <td title={formatAbsoluteInteger(totals?.budgetGroups || 0)}>{fmtN(totals?.budgetGroups || 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        {sh("region", "Region & Country")}
                        {sh("totalCampaigns", "Total Campaigns")}
                        {sh("budgetGroups", "Budget Groups")}
                        {sh("bookedRevenue", "Booked Revenue")}
                        {sh("spend", "Spend")}
                        {sh("plannedImpressions", "Planned Impressions")}
                        {sh("deliveredImpressions", "Delivered Impressions")}
                        {sh("grossMargin", "Gross Margin")}
                        {sh("grossMarginPct", "Gross Margin %")}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedData.map((r, i) => (
                        <Fragment key={i}>
                          <tr className="row-expandable" onClick={() => r.children?.length && toggle(i)}>
                            <td>
                              <button
                                type="button"
                                className={`table-expander${r.children?.length ? "" : " disabled"}`}
                                aria-label="Toggle region"
                                disabled={!r.children?.length}
                                onClick={(e) => { e.stopPropagation(); r.children?.length && toggle(i); }}
                              >
                                {r.children?.length ? (expanded.has(i) ? "−" : "+") : "+"}
                              </button>
                              <span title={safeTitle(r.region)}>{r.region}</span>
                            </td>
                            <td title={formatAbsoluteInteger(r.totalCampaigns)}>{fmtN(r.totalCampaigns)}</td>
                            <td title={formatAbsoluteInteger(r.budgetGroups)}>{fmtN(r.budgetGroups)}</td>
                            <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(r.bookedRevenue, currencyContext), currencyContext)}>{fmtMoneyShort(r.bookedRevenue, currencyContext)}</td>
                            <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(r.spend, currencyContext), currencyContext)}>{fmtMoneyShort(r.spend, currencyContext)}</td>
                            <td title={formatAbsoluteInteger(r.plannedImpressions)}>{`${(Number(r.plannedImpressions) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</td>
                            <td title={`${formatAbsoluteInteger(r.deliveredImpressions)}${r.deliveredPct != null ? ` (${formatAbsolutePercent(r.deliveredPct, 2)})` : ""}`}>
                              {`${(Number(r.deliveredImpressions) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}{r.deliveredPct != null ? ` (${r.deliveredPct}%)` : ""}
                            </td>
                            <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(r.grossMargin, currencyContext), currencyContext)}>{fmtMoneyShort(r.grossMargin, currencyContext)}</td>
                            <td title={formatAbsolutePercent(r.grossMarginPct, 2)}>{r.grossMarginPct != null ? `${r.grossMarginPct}%` : ""}</td>
                          </tr>
                          {expanded.has(i) && r.children?.map((ch, ci) => (
                            <tr key={`${i}-${ci}`} className="row-child">
                              <td title={safeTitle(ch.region)}>{ch.region}</td>
                              <td title={formatAbsoluteInteger(ch.totalCampaigns)}>{fmtN(ch.totalCampaigns)}</td>
                              <td title={formatAbsoluteInteger(ch.budgetGroups)}>{fmtN(ch.budgetGroups)}</td>
                              <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(ch.bookedRevenue, currencyContext), currencyContext)}>{fmtMoneyShort(ch.bookedRevenue, currencyContext)}</td>
                              <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(ch.spend, currencyContext), currencyContext)}>{fmtMoneyShort(ch.spend, currencyContext)}</td>
                              <td title={formatAbsoluteInteger(ch.plannedImpressions)}>{`${(Number(ch.plannedImpressions) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</td>
                              <td title={`${formatAbsoluteInteger(ch.deliveredImpressions)}${ch.deliveredPct != null ? ` (${formatAbsolutePercent(ch.deliveredPct, 2)})` : ""}`}>
                                {`${(Number(ch.deliveredImpressions) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}{ch.deliveredPct != null ? ` (${ch.deliveredPct}%)` : ""}
                              </td>
                              <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(ch.grossMargin, currencyContext), currencyContext)}>{fmtMoneyShort(ch.grossMargin, currencyContext)}</td>
                              <td title={formatAbsolutePercent(ch.grossMarginPct, 2)}>{ch.grossMarginPct != null ? `${ch.grossMarginPct}%` : ""}</td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                      <tr className="table-total">
                        <td>Total</td>
                        <td title={formatAbsoluteInteger(totals?.totalCampaigns || 0)}>{fmtN(totals?.totalCampaigns || 0)}</td>
                        <td title={formatAbsoluteInteger(totals?.budgetGroups || 0)}>{fmtN(totals?.budgetGroups || 0)}</td>
                        <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(totals?.bookedRevenue || 0, currencyContext), currencyContext)}>{fmtMoneyShort(totals?.bookedRevenue || 0, currencyContext)}</td>
                        <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(totals?.spend || 0, currencyContext), currencyContext)}>{fmtMoneyShort(totals?.spend || 0, currencyContext)}</td>
                        <td title={formatAbsoluteInteger(totals?.plannedImpressions || 0)}>{`${(totals?.plannedImpressions || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</td>
                        <td title={formatAbsoluteInteger(totals?.deliveredImpressions || 0)}>{`${(totals?.deliveredImpressions || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</td>
                        <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(totals?.grossMargin || 0, currencyContext), currencyContext)}>{fmtMoneyShort(totals?.grossMargin || 0, currencyContext)}</td>
                        <td title={formatAbsolutePercent(totals?.grossMarginPct || 0, 2)}>{`${totals?.grossMarginPct || "0.00"}%`}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            )}
      </div>
    </div>
  );
}
