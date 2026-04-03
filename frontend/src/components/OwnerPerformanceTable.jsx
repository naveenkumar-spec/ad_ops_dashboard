import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../utils/apiClient";
import { mockOwners } from "../mockData.js";
import { formatAbsoluteInteger, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import {
  convertUsdToDisplay,
  formatAbsoluteCurrencyByContext,
  formatCompactCurrency
} from "../utils/currencyDisplay.js";
import SortableHeader from "./SortableHeader.jsx";
import "../../styles/Tables.css";

function fmtVal(v, fmt, currencyContext) {
  const n = Number(v) || 0;
  if (fmt === "currency") {
    return formatCompactCurrency(convertUsdToDisplay(n, currencyContext), currencyContext);
  }
  if (fmt === "percent") return `${n.toFixed(1)}%`;
  return v;
}

function valueTitle(v, fmt, currencyContext) {
  if (fmt === "currency") return formatAbsoluteCurrencyByContext(convertUsdToDisplay(v, currencyContext), currencyContext);
  if (fmt === "percent") return formatAbsolutePercent(v, 2);
  if (typeof v === "number") return formatAbsoluteInteger(v);
  return safeTitle(v);
}

const COLS = [
  { header: "Owner", accessor: "owner" },
  { header: "Campaigns", accessor: "campaigns" },
  { header: "Booked Revenue", accessor: "revenue", format: "currency" },
  { header: "Spend", accessor: "spend", format: "currency" },
  { header: "Gross Margin %", accessor: "grossMarginPct", format: "percent" },
  { header: "Net Margin %", accessor: "netMarginPct", format: "percent" }
];

export default function OwnerPerformanceTable({ title, endpoint, filters = {}, currencyContext = null }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  useEffect(() => {
    const key = endpoint?.includes("ops") ? "ops" : endpoint?.includes("cs") ? "cs" : "sales";
    apiGet(`${endpoint}`, { timeout: 6000, params: filters })
      .then((res) => setRows(res.data?.length ? res.data : mockOwners[key]))
      .catch(() => setRows(mockOwners[key]))
      .finally(() => setLoading(false));
  }, [endpoint, JSON.stringify(filters)]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedRows = useMemo(() => {
    if (!sortField) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [rows, sortField, sortDirection]);

  const totals = useMemo(() => {
    if (!rows.length) return null;
    const sum = (key) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    const totalRevenue = sum("revenue");
    const totalSpend = sum("spend");
    const totalGrossMargin = rows.reduce((s, r) => s + (Number(r.revenue) || 0) * (Number(r.grossMarginPct) || 0) / 100, 0);
    const totalNetMargin = rows.reduce((s, r) => s + (Number(r.revenue) || 0) * (Number(r.netMarginPct) || 0) / 100, 0);
    return {
      owner: "Total",
      campaigns: sum("campaigns"),
      revenue: totalRevenue,
      spend: totalSpend,
      grossMarginPct: totalRevenue ? (totalGrossMargin / totalRevenue) * 100 : 0,
      netMarginPct: totalRevenue ? (totalNetMargin / totalRevenue) * 100 : 0
    };
  }, [rows]);

  return (
    <div className="table-card">
      <div className="table-card-header"><h3>{title}</h3></div>
      <div className="table-card-body">
        {loading ? <div className="table-loading">Loading...</div>
          : rows.length === 0 ? <div className="table-empty">No data</div>
            : (
              <div className="overflow-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      {COLS.map((col) => (
                        <SortableHeader
                          key={col.accessor}
                          field={col.accessor}
                          sortField={sortField}
                          sortDirection={sortDirection}
                          onSort={handleSort}
                        >
                          {col.header}
                        </SortableHeader>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r, i) => (
                      <tr key={i}>
                        {COLS.map((col) => (
                          <td key={col.accessor} title={valueTitle(r[col.accessor], col.format, currencyContext)}>
                            {col.format ? fmtVal(r[col.accessor], col.format, currencyContext) : r[col.accessor]}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {totals && (
                      <tr className="table-total">
                        {COLS.map((col) => (
                          <td key={col.accessor} title={valueTitle(totals[col.accessor], col.format, currencyContext)}>
                            {col.format ? fmtVal(totals[col.accessor], col.format, currencyContext) : totals[col.accessor]}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
      </div>
    </div>
  );
}
