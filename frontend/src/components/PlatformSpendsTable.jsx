import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../utils/apiClient";
import { mockPlatformSpends } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import { safeTitle } from "../utils/absoluteTooltip.js";
import {
  convertUsdToDisplay,
  formatAbsoluteCurrencyByContext,
  formatCompactCurrency
} from "../utils/currencyDisplay.js";
import SortableHeader from "./SortableHeader.jsx";
import "../../styles/Tables.css";

const PRIORITY = ["CTV", "Meta", "OpenWeb", "Tiktok", "Youtube", "YT Mirrors"];
const MONTH_ORDER = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

export default function PlatformSpendsTable({ filters = {}, currencyContext = null }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");
  const c = (v) => convertUsdToDisplay(v, currencyContext) ?? 0;

  useEffect(() => {
    setLoading(true);
    apiGet("/api/management/platform-spends", { timeout: 6000, params: toApiParams(filters) })
      .then((res) => setRows(res.data?.length ? res.data : mockPlatformSpends()))
      .catch(() => setRows(mockPlatformSpends()))
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const { tableRows, platforms, totals } = useMemo(() => {
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

    let sortedRows = Object.values(agg).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : (MONTH_ORDER[a.month] || 0) - (MONTH_ORDER[b.month] || 0)
    );

    if (sortField) {
      sortedRows = [...sortedRows].sort((a, b) => {
        let av, bv;
        if (sortField === "label") {
          // For month sorting, use year + month order for proper chronological sorting
          av = a.year * 100 + (MONTH_ORDER[a.month] || 0);
          bv = b.year * 100 + (MONTH_ORDER[b.month] || 0);
        } else if (sortField === "total") {
          av = a.total;
          bv = b.total;
        } else {
          av = a.spends[sortField] || 0;
          bv = b.spends[sortField] || 0;
        }
        const cmp = typeof av === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }

    // Calculate totals for each platform
    const totals = { total: 0, spends: {} };
    ordered.forEach(p => { totals.spends[p] = 0; });
    
    sortedRows.forEach(row => {
      totals.total += row.total;
      ordered.forEach(p => {
        totals.spends[p] += row.spends[p] || 0;
      });
    });

    return { tableRows: sortedRows, platforms: ordered, totals };
  }, [rows, sortField, sortDirection]);

  const sh = (field, label) => (
    <SortableHeader field={field} sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
      {label}
    </SortableHeader>
  );

  return (
    <div className="table-card">
      <div className="table-card-header"><h3>Platform-wise Monthly Spends</h3></div>
      <div className="table-card-body">
        {loading ? <div className="table-loading">Loading...</div>
          : tableRows.length === 0 ? <div className="table-empty">No data</div>
            : (
              <div className="overflow-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      {sh("label", "Month")}
                      {platforms.map((p) => (
                        <SortableHeader key={p} field={p} sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                          {p}
                        </SortableHeader>
                      ))}
                      {sh("total", "Total")}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r) => (
                      <tr key={r.label}>
                        <td style={{ fontWeight: 600 }} title={safeTitle(r.label)}>{r.label}</td>
                        {platforms.map((p) => (
                          <td key={p} title={r.spends[p] ? formatAbsoluteCurrencyByContext(c(r.spends[p]), currencyContext) : ""}>
                            {r.spends[p] ? formatCompactCurrency(c(r.spends[p]), currencyContext) : "--"}
                          </td>
                        ))}
                        <td style={{ fontWeight: 600 }} title={formatAbsoluteCurrencyByContext(c(r.total), currencyContext)}>{formatCompactCurrency(c(r.total), currencyContext)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {totals && (
                    <tfoot>
                      <tr className="table-total">
                        <td style={{ fontWeight: 700 }}>Total</td>
                        {platforms.map((p) => (
                          <td key={p} style={{ fontWeight: 700 }} title={formatAbsoluteCurrencyByContext(c(totals.spends[p]), currencyContext)}>
                            {formatCompactCurrency(c(totals.spends[p]), currencyContext)}
                          </td>
                        ))}
                        <td style={{ fontWeight: 700 }} title={formatAbsoluteCurrencyByContext(c(totals.total), currencyContext)}>
                          {formatCompactCurrency(c(totals.total), currencyContext)}
                        </td>
                      </tr>
                    </tfoot>
                  )
                </table>
              </div>
            )}
      </div>
    </div>
  );
}
