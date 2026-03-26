import { useEffect, useState } from "react";
import axios from "axios";
import { mockCountryData, mockCountryTotals } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import "../../styles/Tables.css";

function fmtUSD(v) {
  if (v == null) return "";
  const n = Number(v);
  if (Math.abs(n) >= 1e6)  return `USD ${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3)  return `USD ${(n / 1e3).toFixed(2)}K`;
  return `USD ${n.toFixed(0)}`;
}
function fmtImpr(v) {
  if (v == null) return "";
  const n = Number(v);
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return String(n);
}

// Sub-country data for each region
const REGION_CHILDREN = {
  "India+SEA": [
    { country:"Vietnam",     campaigns:34, budgetGroups:447, revenue:3670000,  spend:1240000, plannedImpressions:891860000,  deliveredImpressions:834800000,  deliveredPct:93.60, grossMargin:2440000,  grossMarginPct:66.33 },
    { country:"Philippines", campaigns:17, budgetGroups:234, revenue:1380000,  spend:363760,  plannedImpressions:530130000,  deliveredImpressions:503170000,  deliveredPct:94.91, grossMargin:1010000,  grossMarginPct:73.61 },
    { country:"Thailand",    campaigns:26, budgetGroups:198, revenue:748140,   spend:287890,  plannedImpressions:226310000,  deliveredImpressions:206860000,  deliveredPct:91.41, grossMargin:460250,   grossMarginPct:61.52 },
    { country:"Indonesia",   campaigns:50, budgetGroups:208, revenue:699680,   spend:200520,  plannedImpressions:376330000,  deliveredImpressions:246290000,  deliveredPct:65.45, grossMargin:499150,   grossMarginPct:71.34 },
    { country:"India",       campaigns:23, budgetGroups:114, revenue:730340,   spend:406970,  plannedImpressions:545630000,  deliveredImpressions:422730000,  deliveredPct:77.48, grossMargin:323370,   grossMarginPct:44.28 },
    { country:"Malaysia",    campaigns:3,  budgetGroups:15,  revenue:96970,    spend:16930,   plannedImpressions:16480000,   deliveredImpressions:8460000,    deliveredPct:51.33, grossMargin:80040,    grossMarginPct:82.54 },
  ],
  "North America": [
    { country:"United States", campaigns:38, budgetGroups:220, revenue:3800000, spend:2100000, plannedImpressions:890000000,  deliveredImpressions:510000000, deliveredPct:57.30, grossMargin:1580000, grossMarginPct:41.58 },
    { country:"Canada",        campaigns:10, budgetGroups:75,  revenue:750000,  spend:530000,  plannedImpressions:250000000,  deliveredImpressions:118350000, deliveredPct:47.34, grossMargin:340000,  grossMarginPct:45.33 },
  ],
  "Australia": [
    { country:"Australia",     campaigns:50, budgetGroups:454, revenue:3480000, spend:1120000, plannedImpressions:448890000, deliveredImpressions:397350000, deliveredPct:88.52, grossMargin:2360000, grossMarginPct:67.81 },
  ],
  "Europe": [
    { country:"United Kingdom", campaigns:42, budgetGroups:105, revenue:1400000, spend:680000, plannedImpressions:128000000, deliveredImpressions:104000000, deliveredPct:81.25, grossMargin:720000, grossMarginPct:51.43 },
    { country:"Germany",        campaigns:28, budgetGroups:88,  revenue:980000,  spend:490000, plannedImpressions:98000000,  deliveredImpressions:79000000,  deliveredPct:80.61, grossMargin:490000, grossMarginPct:50.00 },
    { country:"France",         campaigns:22, budgetGroups:62,  revenue:640000,  spend:320000, plannedImpressions:64000000,  deliveredImpressions:50040000,  deliveredPct:78.19, grossMargin:320000, grossMarginPct:50.00 },
    { country:"Netherlands",    campaigns:14, budgetGroups:32,  revenue:290000,  spend:135000, plannedImpressions:29000000,  deliveredImpressions:23000000,  deliveredPct:79.31, grossMargin:155000, grossMarginPct:53.45 },
    { country:"Other Europe",   campaigns:12, budgetGroups:18,  revenue:90000,   spend:75000,  plannedImpressions:16040000,  deliveredImpressions:11000000,  deliveredPct:68.58, grossMargin:15000,  grossMarginPct:16.67 },
  ],
  "Middle East": [
    { country:"UAE",            campaigns:8,  budgetGroups:80,  revenue:820000,  spend:230000, plannedImpressions:78000000,  deliveredImpressions:70000000,  deliveredPct:89.74, grossMargin:590000, grossMarginPct:71.95 },
    { country:"Saudi Arabia",   campaigns:4,  budgetGroups:51,  revenue:500000,  spend:152870, plannedImpressions:50310000,  deliveredImpressions:43270000,  deliveredPct:85.99, grossMargin:351110, grossMarginPct:70.22 },
  ],
  "Rest of APAC": [
    { country:"Singapore",      campaigns:5,  budgetGroups:50,  revenue:230000,  spend:80000,  plannedImpressions:30000000, deliveredImpressions:27490000, deliveredPct:91.63, grossMargin:150000, grossMarginPct:65.22 },
    { country:"New Zealand",    campaigns:6,  budgetGroups:62,  revenue:223160,  spend:80940,  plannedImpressions:29010000, deliveredImpressions:27000000, deliveredPct:93.07, grossMargin:142220, grossMarginPct:63.74 },
  ],
  "Japan": [
    { country:"Japan",          campaigns:12, budgetGroups:58,  revenue:380790, spend:185030, plannedImpressions:44060000, deliveredImpressions:34830000, deliveredPct:79.06, grossMargin:195760, grossMarginPct:51.41 },
  ],
  "Africa": [
    { country:"South Africa",   campaigns:8,  budgetGroups:42,  revenue:130530, spend:56430,  plannedImpressions:18500000, deliveredImpressions:10050000, deliveredPct:54.32, grossMargin:74100,  grossMarginPct:56.77 },
    { country:"Nigeria",        campaigns:5,  budgetGroups:30,  revenue:80000,  spend:35000,  plannedImpressions:12000000, deliveredImpressions:7000000,  deliveredPct:58.33, grossMargin:45000,  grossMarginPct:56.25 },
  ],
};

export default function CountryWiseTable({ filters = {} }) {
  const [data, setData]         = useState([]);
  const [totals, setTotals]     = useState(null);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    axios.get("http://localhost:5000/api/overview/country-wise", { timeout: 6000, params: toApiParams(filters) })
      .then(res => {
        if (res.data?.rows?.length) {
          setData(res.data.rows);
          setTotals(res.data.totals);
        } else {
          setData(mockCountryData);
          setTotals(mockCountryTotals);
        }
      })
      .catch(() => {
        setData(mockCountryData);
        setTotals(mockCountryTotals);
      })
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  const toggle = region =>
    setExpanded(prev => ({ ...prev, [region]: !prev[region] }));

  const rows = [];
  data.forEach(r => {
    rows.push({ type: "region", ...r });
    if (expanded[r.region]) {
      const children = REGION_CHILDREN[r.region] || [];
      children.forEach(c => rows.push({ type: "child", ...c }));
    }
  });

  return (
    <div className="adv-table-card">
      <div className="adv-table-header">
        <h3 className="adv-table-title">Region / Country wise Data</h3>
      </div>

      {loading ? (
        <div className="table-loading">Loading…</div>
      ) : (
        <div className="adv-table-scroll">
          <table className="adv-table">
            <thead>
              <tr>
                <th>Region &amp; Country</th>
                <th>Total Campaigns</th>
                <th>Budget Groups</th>
                <th>Booked Revenue</th>
                <th>Spend</th>
                <th>Planned Impressions</th>
                <th>Delivered Impressions</th>
                <th>Gross Margin</th>
                <th>Gross Margin %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                if (r.type === "region") {
                  const isOpen = expanded[r.region];
                  const hasChildren = (REGION_CHILDREN[r.region] || []).length > 0;
                  return (
                    <tr key={`region-${i}`} className="region-row">
                      <td>
                        <button
                          className={`expand-btn ${isOpen ? "open" : ""}`}
                          onClick={() => hasChildren && toggle(r.region)}
                          style={{ visibility: hasChildren ? "visible" : "hidden" }}
                        >
                          {isOpen ? "−" : "+"}
                        </button>
                        <span className="region-name">{r.region}</span>
                      </td>
                      <td>{r.campaigns}</td>
                      <td>{r.budgetGroups?.toLocaleString()}</td>
                      <td>{fmtUSD(r.revenue)}</td>
                      <td>{fmtUSD(r.spend)}</td>
                      <td>{fmtImpr(r.plannedImpressions)}</td>
                      <td>
                        {fmtImpr(r.deliveredImpressions)}
                        {r.deliveredPct != null && (
                          <span className="delivered-pct"> ({r.deliveredPct.toFixed(2)}%)</span>
                        )}
                      </td>
                      <td>{fmtUSD(r.grossMargin)}</td>
                      <td>{r.grossMarginPct != null ? `${r.grossMarginPct.toFixed(2)}%` : ""}</td>
                    </tr>
                  );
                } else {
                  return (
                    <tr key={`child-${i}`} className="child-row">
                      <td className="child-name">
                        <span className="child-bullet">•</span>
                        {r.country}
                      </td>
                      <td>{r.campaigns}</td>
                      <td>{r.budgetGroups?.toLocaleString()}</td>
                      <td>{fmtUSD(r.revenue)}</td>
                      <td>{fmtUSD(r.spend)}</td>
                      <td>{fmtImpr(r.plannedImpressions)}</td>
                      <td>
                        {fmtImpr(r.deliveredImpressions)}
                        {r.deliveredPct != null && (
                          <span className="delivered-pct"> ({r.deliveredPct.toFixed(2)}%)</span>
                        )}
                      </td>
                      <td>{fmtUSD(r.grossMargin)}</td>
                      <td>{r.grossMarginPct != null ? `${r.grossMarginPct.toFixed(2)}%` : ""}</td>
                    </tr>
                  );
                }
              })}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="total-row">
                  <td><strong>Total</strong></td>
                  <td><strong>{totals.campaigns}</strong></td>
                  <td><strong>{totals.budgetGroups?.toLocaleString()}</strong></td>
                  <td><strong>{fmtUSD(totals.revenue)}</strong></td>
                  <td><strong>{fmtUSD(totals.spend)}</strong></td>
                  <td><strong>{fmtImpr(totals.plannedImpressions)}</strong></td>
                  <td>
                    <strong>{fmtImpr(totals.deliveredImpressions)}</strong>
                    {totals.deliveredPct != null && (
                      <span className="delivered-pct-total"> ({totals.deliveredPct.toFixed(2)}%)</span>
                    )}
                  </td>
                  <td><strong>{fmtUSD(totals.grossMargin)}</strong></td>
                  <td><strong>{totals.grossMarginPct.toFixed(2)}%</strong></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
