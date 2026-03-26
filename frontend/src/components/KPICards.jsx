import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { mockKPIs } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import "../../styles/KPICards.css";

const CARD_ORDER = ["No of Campaigns","Gross Margin %","Net Margin %","Spend"];

function parseNumber(val="") {
  const num = Number(String(val).replace(/[^\d.\-]/g,""));
  return Number.isFinite(num) ? num : null;
}
function parseCurrency(label="") {
  const m = label.toUpperCase().match(/([\d.,]+)\s*([MBK]?)/);
  if(!m) return null;
  const raw = parseFloat(m[1].replace(/,/g,""));
  if(!Number.isFinite(raw)) return null;
  if(m[2]==="B") return raw*1e9;
  if(m[2]==="M") return raw*1e6;
  if(m[2]==="K") return raw*1e3;
  return raw;
}
function formatCurrency(v) {
  const n = Number(v)||0;
  if(Math.abs(n)>=1e6) return `$${(n/1e6).toFixed(2)}M`;
  if(Math.abs(n)>=1e3) return `$${(n/1e3).toFixed(2)}K`;
  return `$${n.toFixed(0)}`;
}

export default function KPICards({ filters = {} }) {
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("http://localhost:5000/api/overview/kpis", { timeout: 5000, params: toApiParams(filters) })
      .then(res => {
        const ordered = CARD_ORDER.map(t=>(res.data||[]).find(i=>i.title===t)).filter(Boolean);
        setKpis(ordered);
      })
      .catch(() => {
        const ordered = CARD_ORDER.map(t=>mockKPIs.find(i=>i.title===t)).filter(Boolean);
        setKpis(ordered);
      })
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  const display = useMemo(() => {
    if(!kpis.length) return [];
    const spendCard = kpis.find(k=>k.title==="Spend");
    const totalRevenue = parseCurrency(spendCard?.subtitle||"")||0;
    return kpis.map(kpi => {
      const valueNum = parseNumber(String(kpi.value));
      const isPct = kpi.title.includes("%");
      let sub = kpi.subtitle||"";
      if(kpi.title==="No of Campaigns") sub=`Budget Groups: ${String(kpi.subtitle||"").replace(/\D/g,"")}`;
      if(kpi.title==="Gross Margin %" && totalRevenue && valueNum) sub=`Gross Margin: ${formatCurrency(totalRevenue*valueNum/100)}`;
      if(kpi.title==="Net Margin %" && totalRevenue && valueNum) sub=`Net Margin: ${formatCurrency(totalRevenue*valueNum/100)}`;
      if(kpi.title==="Spend" && totalRevenue) sub=`Booked Revenue: ${formatCurrency(totalRevenue)}`;
      return {...kpi, subtitleText: sub};
    });
  }, [kpis]);

  if(loading) return <div className="kpi-banner">Loading KPI data…</div>;
  if(!display.length) return <div className="kpi-banner">No KPI data available</div>;

  return (
    <div className="kpi-cards-container">
      {display.map((kpi,i) => (
        <article className="kpi-card" key={i}>
          <p className="kpi-title">{kpi.title}</p>
          <p className="kpi-value">{kpi.value}</p>
          <div className="kpi-divider"/>
          <p className="kpi-subtitle">{kpi.subtitleText}</p>
        </article>
      ))}
    </div>
  );
}
