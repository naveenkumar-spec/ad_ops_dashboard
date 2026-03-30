import { useEffect, useState } from "react";
import axios from "axios";
import { mockOwners } from "../mockData.js";
import { formatAbsoluteCurrency, formatAbsoluteInteger, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import "../../styles/Tables.css";

function fmtVal(v, fmt) {
  const n=Number(v)||0;
  if(fmt==="currency") {
    if(Math.abs(n)>=1e6) return `$${(n/1e6).toFixed(2)}M`;
    if(Math.abs(n)>=1e3) return `$${(n/1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  }
  if(fmt==="percent") return `${n.toFixed(1)}%`;
  return v;
}

function valueTitle(v, fmt) {
  if (fmt === "currency") return formatAbsoluteCurrency(v, "USD");
  if (fmt === "percent") return formatAbsolutePercent(v, 2);
  if (typeof v === "number") return formatAbsoluteInteger(v);
  return safeTitle(v);
}

const cols=[
  {header:"Owner",accessor:"owner"},
  {header:"Campaigns",accessor:"campaigns"},
  {header:"Booked Revenue",accessor:"revenue",format:"currency"},
  {header:"Spend",accessor:"spend",format:"currency"},
  {header:"Gross Margin %",accessor:"grossMarginPct",format:"percent"},
  {header:"Net Margin %",accessor:"netMarginPct",format:"percent"},
];

export default function OwnerPerformanceTable({ title, endpoint, filters = {} }) {
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const key = endpoint?.includes("ops") ? "ops" : endpoint?.includes("cs") ? "cs" : "sales";
    axios.get(`http://localhost:5000${endpoint}`,{
      timeout:6000,
      params: filters
    })
      .then(res=>setRows(res.data?.length ? res.data : mockOwners[key]))
      .catch(()=>setRows(mockOwners[key]))
      .finally(()=>setLoading(false));
  },[endpoint, JSON.stringify(filters)]);

  return (
    <div className="table-card">
      <div className="table-card-header"><h3>{title}</h3></div>
      <div className="table-card-body">
        {loading ? <div className="table-loading">Loading…</div>
         : rows.length===0 ? <div className="table-empty">No data</div>
         : (
          <div className="overflow-wrapper">
            <table className="data-table">
              <thead><tr>{cols.map(c=><th key={c.accessor}>{c.header}</th>)}</tr></thead>
              <tbody>
                {rows.map((r,i)=>(
                  <tr key={i}>
                    {cols.map(c=><td key={c.accessor} title={valueTitle(r[c.accessor], c.format)}>{c.format?fmtVal(r[c.accessor],c.format):r[c.accessor]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
