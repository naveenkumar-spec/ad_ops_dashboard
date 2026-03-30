import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { mockPlatformSpends } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import { formatAbsoluteCurrency, safeTitle } from "../utils/absoluteTooltip.js";
import "../../styles/Tables.css";

const PRIORITY = ["CTV", "Meta", "OpenWeb", "Tiktok", "Youtube", "YT Mirrors"];
const MONTH_ORDER = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

function fmtC(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function PlatformSpendsTable({ filters = {} }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get("/api/management/platform-spends", { timeout: 6000, params: toApiParams(filters) })
      .then((res) => setRows(res.data?.length ? res.data : mockPlatformSpends()))
      .catch(() => setRows(mockPlatformSpends()))
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  const { tableRows, platforms } = useMemo(() => {
    const agg = {};
    const pSet = new Set();
    rows.forEach((r) => {
      const label = `${r.month} ${r.year}`;
      if (!agg[label]) agg[label] = { label, month: r.month, year: r.year, total: 0, spends: {} };
      const p = r.platform || "Other";
      pSet.add(p);
      agg[label].spends[p] = (agg[label].spends[p] || 0) + Number(r.spend || 0);
      agg[label].total += Number(r.spend || 0);
    });
    const ordered = PRIORITY.filter((p) => pSet.has(p));
    pSet.forEach((p) => { if (!PRIORITY.includes(p)) ordered.push(p); });
    const sortedRows = Object.values(agg).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : (MONTH_ORDER[a.month] || 0) - (MONTH_ORDER[b.month] || 0)
    );
    return { tableRows: sortedRows, platforms: ordered };
  }, [rows]);

  return (
    <div className="table-card">
      <div className="table-card-header"><h3>Platform-wise Monthly Spends</h3></div>
      <div className="table-card-body">
        {loading ? <div className="table-loading">Loading...</div>
          : tableRows.length === 0 ? <div className="table-empty">No data</div>
            : (
              <div className="overflow-wrapper">
                <table className="data-table">
                  <thead><tr>
                    <th>Month</th>
                    {platforms.map((p) => <th key={p} title={safeTitle(p)}>{p}</th>)}
                    <th>Total</th>
                  </tr></thead>
                  <tbody>
                    {tableRows.map((r) => (
                      <tr key={r.label}>
                        <td style={{ fontWeight: 600 }} title={safeTitle(r.label)}>{r.label}</td>
                        {platforms.map((p) => (
                          <td key={p} title={r.spends[p] ? formatAbsoluteCurrency(r.spends[p], "USD") : ""}>
                            {r.spends[p] ? fmtC(r.spends[p]) : "--"}
                          </td>
                        ))}
                        <td style={{ fontWeight: 600 }} title={formatAbsoluteCurrency(r.total, "USD")}>{fmtC(r.total)}</td>
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


