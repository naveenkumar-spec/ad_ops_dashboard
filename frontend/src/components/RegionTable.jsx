import { useEffect, useState, useMemo, Fragment } from "react";
import { apiGet } from "../utils/apiClient";
import { mockRegions, mockManagementRegions } from "../mockData.js";
import { formatAbsoluteInteger, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import { convertUsdToDisplay, formatAbsoluteCurrencyByContext, formatCompactCurrency } from "../utils/currencyDisplay.js";
import "../../styles/Tables.css";

const fmtN = v => (Number(v)||0).toLocaleString();
const fmtMoneyShort = (v, ctx) => formatCompactCurrency(convertUsdToDisplay(v, ctx), ctx);

export default function RegionTable({ title="Region Performance", variant="overview", forceData=null, currencyContext = null }) {
  const [data,setData]=useState([]);
  const [loading,setLoading]=useState(true);
  const [expanded,setExpanded]=useState(new Set());
  const totals = useMemo(() => {
    if (!data.length) return null;
    const sum = (fn) => data.reduce((s,r)=>s+(Number(fn(r))||0),0);
    const booked = sum(r=>r.bookedRevenue);
    const gross = sum(r=>r.grossMargin);
    return {
      totalCampaigns: sum(r=>r.totalCampaigns),
      budgetGroups: sum(r=>r.budgetGroups),
      bookedRevenue: booked,
      spend: sum(r=>r.spend),
      plannedImpressions: sum(r=>r.plannedImpressions),
      deliveredImpressions: sum(r=>r.deliveredImpressions),
      grossMargin: gross,
      grossMarginPct: booked ? ((gross / booked) * 100).toFixed(2) : "0.00"
    };
  }, [data]);

  useEffect(()=>{
    if (forceData) {
      setData(forceData);
      setLoading(false);
      return;
    }
    const isManagement = variant === "management";
    const endpoint = isManagement ? "/api/management/regions" : "/api/overview/regions";
    const fallback = isManagement ? mockManagementRegions : mockRegions;
    apiGet(endpoint,{timeout:6000})
      .then(res=>setData(res.data?.length ? res.data : fallback))
      .catch(()=>setData(fallback))
      .finally(()=>setLoading(false));
  },[variant, forceData]);

  const toggle = (idx) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  return (
    <div className="table-card">
      <div className="table-card-header"><h3>{title}</h3></div>
      <div className="table-card-body">
        {loading ? <div className="table-loading">Loading…</div>
         : data.length===0 ? <div className="table-empty">No data</div>
         : (
          <div className="overflow-wrapper">
            {variant === "management" ? (
              <table className="data-table">
                <thead><tr>
                  <th>Region &amp; Country</th>
                  <th>No of AdOps</th>
                  <th>No of CS</th>
                  <th>No of Sales</th>
                  <th>Booked Revenue</th>
                  <th>Total Campaigns</th>
                  <th>Total Budget Groups</th>
                </tr></thead>
                <tbody>
                  {data.map((r,i)=>( 
                    <Fragment key={i}>
                      <tr className="row-expandable" onClick={() => r.children?.length && toggle(i)}>
                        <td>
                          <button
                            type="button"
                            className={`table-expander${r.children?.length ? "" : " disabled"}`}
                            aria-label="Toggle region"
                            disabled={!r.children?.length}
                            onClick={(e)=>{e.stopPropagation(); r.children?.length && toggle(i);}}
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
                      {expanded.has(i) && r.children?.map((c,ci)=>( 
                        <tr key={`${i}-${ci}`} className="row-child">
                          <td title={safeTitle(c.region)}>{c.region}</td>
                          <td title={formatAbsoluteInteger(c.adOps)}>{fmtN(c.adOps)}</td>
                          <td title={formatAbsoluteInteger(c.cs)}>{fmtN(c.cs)}</td>
                          <td title={formatAbsoluteInteger(c.sales)}>{fmtN(c.sales)}</td>
                          <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(c.bookedRevenue, currencyContext), currencyContext)}>{fmtMoneyShort(c.bookedRevenue, currencyContext)}</td>
                          <td title={formatAbsoluteInteger(c.totalCampaigns)}>{fmtN(c.totalCampaigns)}</td>
                          <td title={formatAbsoluteInteger(c.budgetGroups)}>{fmtN(c.budgetGroups)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  <tr className="table-total">
                    <td>Total</td>
                    <td title={formatAbsoluteInteger(totals?.adOps||0)}>{fmtN(totals?.adOps||0)}</td>
                    <td title={formatAbsoluteInteger(totals?.cs||0)}>{fmtN(totals?.cs||0)}</td>
                    <td title={formatAbsoluteInteger(totals?.sales||0)}>{fmtN(totals?.sales||0)}</td>
                    <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(totals?.bookedRevenue||0, currencyContext), currencyContext)}>{fmtMoneyShort(totals?.bookedRevenue||0, currencyContext)}</td>
                    <td title={formatAbsoluteInteger(totals?.totalCampaigns||0)}>{fmtN(totals?.totalCampaigns||0)}</td>
                    <td title={formatAbsoluteInteger(totals?.budgetGroups||0)}>{fmtN(totals?.budgetGroups||0)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <table className="data-table">
                <thead><tr>
                  <th>Region &amp; Country</th>
                  <th>Total Campaigns</th>
                  <th>Budget Groups</th>
                  <th>Booked Revenue</th>
                  <th>Spend</th>
                  <th>Planned Impressions</th>
                  <th>Delivered Impressions</th>
                  <th>Gross Margin</th>
                  <th>Gross Margin %</th>
                </tr></thead>
                <tbody>
                  {data.map((r,i)=>(
                    <Fragment key={i}>
                      <tr className="row-expandable" onClick={() => r.children?.length && toggle(i)}>
                        <td>
                          <button
                            type="button"
                            className={`table-expander${r.children?.length ? "" : " disabled"}`}
                            aria-label="Toggle region"
                            disabled={!r.children?.length}
                            onClick={(e)=>{e.stopPropagation(); r.children?.length && toggle(i);}}
                          >
                            {r.children?.length ? (expanded.has(i) ? "−" : "+") : "+"}
                          </button>
                          <span title={safeTitle(r.region)}>{r.region}</span>
                        </td>
                        <td title={formatAbsoluteInteger(r.totalCampaigns)}>{fmtN(r.totalCampaigns)}</td>
                        <td title={formatAbsoluteInteger(r.budgetGroups)}>{fmtN(r.budgetGroups)}</td>
                        <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(r.bookedRevenue, currencyContext), currencyContext)}>{fmtMoneyShort(r.bookedRevenue, currencyContext)}</td>
                        <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(r.spend, currencyContext), currencyContext)}>{fmtMoneyShort(r.spend, currencyContext)}</td>
                        <td title={formatAbsoluteInteger(r.plannedImpressions)}>{`${(Number(r.plannedImpressions)||0).toLocaleString(undefined,{maximumFractionDigits:0})}`}</td>
                        <td title={`${formatAbsoluteInteger(r.deliveredImpressions)}${r.deliveredPct!=null?` (${formatAbsolutePercent(r.deliveredPct,2)})`:""}`}>{`${(Number(r.deliveredImpressions)||0).toLocaleString(undefined,{maximumFractionDigits:0})}`}{r.deliveredPct!=null?` (${r.deliveredPct}%)`:""}</td>
                        <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(r.grossMargin, currencyContext), currencyContext)}>{fmtMoneyShort(r.grossMargin, currencyContext)}</td>
                        <td title={formatAbsolutePercent(r.grossMarginPct, 2)}>{r.grossMarginPct!=null?`${r.grossMarginPct}%`:""}</td>
                      </tr>
                      {expanded.has(i) && r.children?.map((c,ci)=>(
                        <tr key={`${i}-${ci}`} className="row-child">
                          <td title={safeTitle(c.region)}>{c.region}</td>
                          <td title={formatAbsoluteInteger(c.totalCampaigns)}>{fmtN(c.totalCampaigns)}</td>
                          <td title={formatAbsoluteInteger(c.budgetGroups)}>{fmtN(c.budgetGroups)}</td>
                          <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(c.bookedRevenue, currencyContext), currencyContext)}>{fmtMoneyShort(c.bookedRevenue, currencyContext)}</td>
                          <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(c.spend, currencyContext), currencyContext)}>{fmtMoneyShort(c.spend, currencyContext)}</td>
                          <td title={formatAbsoluteInteger(c.plannedImpressions)}>{`${(Number(c.plannedImpressions)||0).toLocaleString(undefined,{maximumFractionDigits:0})}`}</td>
                          <td title={`${formatAbsoluteInteger(c.deliveredImpressions)}${c.deliveredPct!=null?` (${formatAbsolutePercent(c.deliveredPct,2)})`:""}`}>{`${(Number(c.deliveredImpressions)||0).toLocaleString(undefined,{maximumFractionDigits:0})}`}{c.deliveredPct!=null?` (${c.deliveredPct}%)`:""}</td>
                          <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(c.grossMargin, currencyContext), currencyContext)}>{fmtMoneyShort(c.grossMargin, currencyContext)}</td>
                          <td title={formatAbsolutePercent(c.grossMarginPct, 2)}>{c.grossMarginPct!=null?`${c.grossMarginPct}%`:""}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  <tr className="table-total">
                    <td>Total</td>
                    <td title={formatAbsoluteInteger(totals?.totalCampaigns||0)}>{fmtN(totals?.totalCampaigns||0)}</td>
                    <td title={formatAbsoluteInteger(totals?.budgetGroups||0)}>{fmtN(totals?.budgetGroups||0)}</td>
                    <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(totals?.bookedRevenue||0, currencyContext), currencyContext)}>{fmtMoneyShort(totals?.bookedRevenue||0, currencyContext)}</td>
                    <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(totals?.spend||0, currencyContext), currencyContext)}>{fmtMoneyShort(totals?.spend||0, currencyContext)}</td>
                    <td title={formatAbsoluteInteger(totals?.plannedImpressions||0)}>{`${(totals?.plannedImpressions||0).toLocaleString(undefined,{maximumFractionDigits:0})}`}</td>
                    <td title={formatAbsoluteInteger(totals?.deliveredImpressions||0)}>{`${(totals?.deliveredImpressions||0).toLocaleString(undefined,{maximumFractionDigits:0})}`}</td>
                    <td title={formatAbsoluteCurrencyByContext(convertUsdToDisplay(totals?.grossMargin||0, currencyContext), currencyContext)}>{fmtMoneyShort(totals?.grossMargin||0, currencyContext)}</td>
                    <td title={formatAbsolutePercent(totals?.grossMarginPct||0, 2)}>{`${totals?.grossMarginPct||"0.00"}%`}</td>
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



