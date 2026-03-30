import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { mockCampaignWise, mockCampaignWiseTotals } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import { formatAbsoluteInteger, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import "../../styles/Tables.css";

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
  const duration = Math.max(1, Math.round((end - start) / MS_PER_DAY) + 1);
  const today = new Date();
  const daysRemaining = Math.round((end - today) / MS_PER_DAY);
  const pctPassed = ((duration - daysRemaining) / duration) * 100;
  return {
    ...row,
    duration,
    daysRemaining,
    pctPassed,
  };
}

export default function CampaignWiseTable({ filters = {} }) {
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/overview/campaign-wise", { timeout: 6000, params: toApiParams(filters) })
      .then((res) => {
        if (res.data?.rows?.length) {
          setData(res.data.rows.map(deriveRow));
          setTotals(res.data.totals);
        } else {
          setData(mockCampaignWise.map(deriveRow));
          setTotals(mockCampaignWiseTotals);
        }
      })
      .catch(() => {
        setData(mockCampaignWise.map(deriveRow));
        setTotals(mockCampaignWiseTotals);
      })
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  const totalsDerived = useMemo(() => {
    if (totals) return totals;
    if (!data.length) return null;
    const acc = data.reduce(
      (agg, r) => {
        agg.budgetGroups += r.budgetGroups || 0;
        agg.duration += r.duration || 0;
        agg.daysRemaining += r.daysRemaining || 0;
        agg.plannedImpressions += r.plannedImpressions || 0;
        return agg;
      },
      { budgetGroups: 0, duration: 0, daysRemaining: 0, plannedImpressions: 0 }
    );
    acc.avgPctPassed = data.reduce((sum, r) => sum + (r.pctPassed || 0), 0) / data.length;
    return acc;
  }, [data, totals]);

  return (
    <div className="adv-table-card">
      <div className="adv-table-header">
        <h3 className="adv-table-title">Campaign Wise Data</h3>
      </div>

      {loading ? (
        <div className="table-loading">Loading...</div>
      ) : (
        <div className="adv-table-scroll">
          <table className="adv-table">
            <thead>
              <tr>
                <th>Campaign Name</th>
                <th>Budget Groups</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Campaign Duration</th>
                <th>Days Remaining</th>
                <th>% of Days Passed</th>
                <th>Planned Impressions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i}>
                  <td className="col-name" title={safeTitle(r.name)}>{r.name}</td>
                  <td title={formatAbsoluteInteger(r.budgetGroups)}>{r.budgetGroups}</td>
                  <td title={safeTitle(fmtDate(r.startDate))}>{fmtDate(r.startDate)}</td>
                  <td title={safeTitle(fmtDate(r.endDate))}>{fmtDate(r.endDate)}</td>
                  <td title={formatAbsoluteInteger(r.duration)}>{fmtNum(r.duration)}</td>
                  <td className={r.daysRemaining < 0 ? "text-warn" : ""} title={formatAbsoluteInteger(r.daysRemaining)}>
                    {fmtNum(r.daysRemaining)}
                  </td>
                  <td title={formatAbsolutePercent(r.pctPassed, 2)}>{fmtPct(r.pctPassed)}</td>
                  <td title={formatAbsoluteInteger(r.plannedImpressions)}>{fmtImpr(r.plannedImpressions)}</td>
                </tr>
              ))}
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
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
