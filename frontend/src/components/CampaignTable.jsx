import { useEffect, useState } from "react";
import axios from "axios";
import { mockCampaigns } from "../mockData.js";
import "../../styles/Tables.css";

function fmt(v) {
  const n=Number(v)||0;
  if(Math.abs(n)>=1e6) return `$${(n/1e6).toFixed(2)}M`;
  if(Math.abs(n)>=1e3) return `$${(n/1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function CampaignTable({ title="Campaign Performance (Bottom Performers)" }) {
  const [data,setData]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    axios.get("http://localhost:5000/api/overview/campaigns",{timeout:6000})
      .then(res=>setData(res.data?.length ? res.data : mockCampaigns))
      .catch(()=>setData(mockCampaigns))
      .finally(()=>setLoading(false));
  },[]);

  return (
    <div className="table-card">
      <div className="table-card-header"><h3>{title}</h3></div>
      <div className="table-card-body">
        {loading ? <div className="table-loading">Loading…</div>
         : data.length===0 ? <div className="table-empty">No data</div>
         : (
          <div className="overflow-wrapper">
            <table className="data-table">
              <thead><tr>
                <th>Campaign Name</th><th>Status</th>
                <th>Revenue</th><th>Spend</th>
                <th>Gross Profit</th><th>Gross Margin %</th>
              </tr></thead>
              <tbody>
                {data.map((c,i)=>(
                  <tr key={i}>
                    <td>{c.campaignName}</td>
                    <td>
                      <span style={{
                        display:'inline-block',padding:'2px 8px',borderRadius:99,fontSize:11,fontWeight:600,
                        background:c.status==='Active'?'#dcf5e7':c.status==='Paused'?'#fff3cd':'#f5e6e6',
                        color:c.status==='Active'?'#166534':c.status==='Paused'?'#92400e':'#991b1b'
                      }}>{c.status}</span>
                    </td>
                    <td>{fmt(c.revenue)}</td>
                    <td>{fmt(c.spend)}</td>
                    <td>{fmt(c.profit)}</td>
                    <td>{c.grossMargin!=null?`${c.grossMargin}%`:""}</td>
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
