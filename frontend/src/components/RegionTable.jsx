import { useEffect, useState, useMemo, Fragment } from "react";
import axios from "axios";
import { mockRegions, mockManagementRegions } from "../mockData.js";
import "../../styles/Tables.css";

const fmtM = v => `$${(Number(v)||0).toFixed(2)}M`;
const fmtN = v => (Number(v)||0).toLocaleString();
const fmtMoneyShort = v => {
  const n = Number(v)||0;
  if (Math.abs(n) >= 1_000_000) return `USD ${(n/1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `USD ${(n/1_000).toFixed(2)}K`;
  return `USD ${n.toFixed(2)}`;
};

export default function RegionTable({ title="Region Performance", variant="overview", forceData=null }) {
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
    const endpoint = isManagement ? "http://localhost:5000/api/management/regions" : "http://localhost:5000/api/overview/regions";
    const fallback = isManagement ? mockManagementRegions : mockRegions;
    axios.get(endpoint,{timeout:6000})
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
                          {r.region}
                        </td>
                        <td>{fmtN(r.adOps)}</td>
                        <td>{fmtN(r.cs)}</td>
                        <td>{fmtN(r.sales)}</td>
                        <td>{fmtMoneyShort(r.bookedRevenue)}</td>
                        <td>{fmtN(r.totalCampaigns)}</td>
                        <td>{fmtN(r.budgetGroups)}</td>
                      </tr>
                      {expanded.has(i) && r.children?.map((c,ci)=>( 
                        <tr key={`${i}-${ci}`} className="row-child">
                          <td>{c.region}</td>
                          <td>{fmtN(c.adOps)}</td>
                          <td>{fmtN(c.cs)}</td>
                          <td>{fmtN(c.sales)}</td>
                          <td>{fmtMoneyShort(c.bookedRevenue)}</td>
                          <td>{fmtN(c.totalCampaigns)}</td>
                          <td>{fmtN(c.budgetGroups)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  <tr className="table-total">
                    <td>Total</td>
                    <td>{fmtN(totals?.adOps||0)}</td>
                    <td>{fmtN(totals?.cs||0)}</td>
                    <td>{fmtN(totals?.sales||0)}</td>
                    <td>{fmtMoneyShort(totals?.bookedRevenue||0)}</td>
                    <td>{fmtN(totals?.totalCampaigns||0)}</td>
                    <td>{fmtN(totals?.budgetGroups||0)}</td>
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
                          {r.region}
                        </td>
                        <td>{fmtN(r.totalCampaigns)}</td>
                        <td>{fmtN(r.budgetGroups)}</td>
                        <td>{fmtMoneyShort(r.bookedRevenue)}</td>
                        <td>{fmtMoneyShort(r.spend)}</td>
                        <td>{`${(Number(r.plannedImpressions)||0).toLocaleString(undefined,{maximumFractionDigits:0})}`}</td>
                        <td>{`${(Number(r.deliveredImpressions)||0).toLocaleString(undefined,{maximumFractionDigits:0})}`}{r.deliveredPct!=null?` (${r.deliveredPct}%)`:""}</td>
                        <td>{fmtMoneyShort(r.grossMargin)}</td>
                        <td>{r.grossMarginPct!=null?`${r.grossMarginPct}%`:""}</td>
                      </tr>
                      {expanded.has(i) && r.children?.map((c,ci)=>(
                        <tr key={`${i}-${ci}`} className="row-child">
                          <td>{c.region}</td>
                          <td>{fmtN(c.totalCampaigns)}</td>
                          <td>{fmtN(c.budgetGroups)}</td>
                          <td>{fmtMoneyShort(c.bookedRevenue)}</td>
                          <td>{fmtMoneyShort(c.spend)}</td>
                          <td>{`${(Number(c.plannedImpressions)||0).toLocaleString(undefined,{maximumFractionDigits:0})}`}</td>
                          <td>{`${(Number(c.deliveredImpressions)||0).toLocaleString(undefined,{maximumFractionDigits:0})}`}{c.deliveredPct!=null?` (${c.deliveredPct}%)`:""}</td>
                          <td>{fmtMoneyShort(c.grossMargin)}</td>
                          <td>{c.grossMarginPct!=null?`${c.grossMarginPct}%`:""}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                  <tr className="table-total">
                    <td>Total</td>
                    <td>{fmtN(totals?.totalCampaigns||0)}</td>
                    <td>{fmtN(totals?.budgetGroups||0)}</td>
                    <td>{fmtMoneyShort(totals?.bookedRevenue||0)}</td>
                    <td>{fmtMoneyShort(totals?.spend||0)}</td>
                    <td>{`${(totals?.plannedImpressions||0).toLocaleString(undefined,{maximumFractionDigits:0})}`}</td>
                    <td>{`${(totals?.deliveredImpressions||0).toLocaleString(undefined,{maximumFractionDigits:0})}`}</td>
                    <td>{fmtMoneyShort(totals?.grossMargin||0)}</td>
                    <td>{`${totals?.grossMarginPct||"0.00"}%`}</td>
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
