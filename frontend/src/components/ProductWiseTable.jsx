import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  mockProductData,
  mockProductTotals,
  mockProductChildren,
} from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import "../../styles/Tables.css";

function fmtUSD(v) {
  if (v == null) return "";
  const n = Number(v);
  if (Math.abs(n) >= 1e6) return `USD ${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `USD ${(n / 1e3).toFixed(2)}K`;
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

export default function ProductWiseTable({ filters = {} }) {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/overview/product-wise", { timeout: 6000, params: toApiParams(filters) })
      .then((res) => {
        if (res.data?.rows?.length) {
          setRows(res.data.rows);
          setTotals(res.data.totals);
        } else {
          setRows(mockProductData);
          setTotals(mockProductTotals);
        }
      })
      .catch(() => {
        setRows(mockProductData);
        setTotals(mockProductTotals);
      })
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  const renderDelivered = (row) => {
    const pct =
      row.deliveredPct ??
      (row.plannedImpressions
        ? (row.deliveredImpressions / row.plannedImpressions) * 100
        : null);
    return (
      <>
        {fmtImpr(row.deliveredImpressions)}
        {pct != null && (
          <span className="delivered-pct"> ({pct.toFixed(2)}%)</span>
        )}
      </>
    );
  };

  const toggle = (product) =>
    setExpanded((prev) => ({ ...prev, [product]: !prev[product] }));

  const flattened = useMemo(() => {
    const out = [];
    rows.forEach((row) => {
      out.push({ type: "product", ...row });
      const children = mockProductChildren[row.product] || [];
      if (expanded[row.product] && children.length) {
        children.forEach((c) => out.push({ type: "child", parent: row.product, ...c }));
      }
    });
    return out;
  }, [rows, expanded]);

  return (
    <div className="adv-table-card">
      <div className="adv-table-header">
        <h3 className="adv-table-title">Product and Platform wise data</h3>
      </div>

      {loading ? (
        <div className="table-loading">Loading...</div>
      ) : (
        <div className="adv-table-scroll">
          <table className="adv-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Total Campaigns</th>
                <th>Budget Groups</th>
                <th>Booked Revenue</th>
                <th>Spend</th>
                <th>Planned Impressions</th>
                <th>Delivered Impressions</th>
                <th>Gross Profit / Loss</th>
                <th>Gross Margin %</th>
              </tr>
            </thead>
            <tbody>
              {flattened.map((row, idx) => {
                if (row.type === "child") {
                  return (
                    <tr key={`c-${idx}`} className="child-row">
                      <td className="child-name">
                        <span className="child-bullet">•</span>
                        {row.product}
                      </td>
                      <td>{row.totalCampaigns}</td>
                      <td>{row.budgetGroups?.toLocaleString()}</td>
                      <td>{fmtUSD(row.bookedRevenue)}</td>
                      <td>{fmtUSD(row.spend)}</td>
                      <td>{fmtImpr(row.plannedImpressions)}</td>
                      <td>{renderDelivered(row)}</td>
                      <td>{fmtUSD(row.grossProfitLoss)}</td>
                      <td>
                        {row.grossMargin != null ? `${row.grossMargin.toFixed(2)}%` : ""}
                      </td>
                    </tr>
                  );
                }

                const children = mockProductChildren[row.product] || [];
                const isOpen = expanded[row.product];

                return (
                  <tr key={`p-${idx}`} className={row.isTotal ? "total-row" : "region-row"}>
                    <td>
                      <button
                        className={`expand-btn ${isOpen ? "open" : ""} ${children.length ? "" : "disabled"}`}
                        onClick={() => children.length && toggle(row.product)}
                        disabled={!children.length}
                      >
                        {children.length ? (isOpen ? "-" : "+") : "+"}
                      </button>
                      <span className="region-name">{row.product}</span>
                    </td>
                    <td>{row.totalCampaigns}</td>
                    <td>{row.budgetGroups?.toLocaleString()}</td>
                    <td>{fmtUSD(row.bookedRevenue)}</td>
                    <td>{fmtUSD(row.spend)}</td>
                    <td>{fmtImpr(row.plannedImpressions)}</td>
                    <td>{renderDelivered(row)}</td>
                    <td>{fmtUSD(row.grossProfitLoss)}</td>
                    <td>
                      {row.grossMargin != null ? `${row.grossMargin.toFixed(2)}%` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="total-row">
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td>
                    <strong>{totals.totalCampaigns}</strong>
                  </td>
                  <td>
                    <strong>{totals.budgetGroups?.toLocaleString()}</strong>
                  </td>
                  <td>
                    <strong>{fmtUSD(totals.bookedRevenue)}</strong>
                  </td>
                  <td>
                    <strong>{fmtUSD(totals.spend)}</strong>
                  </td>
                  <td>
                    <strong>{fmtImpr(totals.plannedImpressions)}</strong>
                  </td>
                  <td>
                    <strong>{fmtImpr(totals.deliveredImpressions)}</strong>
                    {totals.deliveredPct != null && (
                      <span className="delivered-pct-total">
                        {" "}
                        ({totals.deliveredPct.toFixed(2)}%)
                      </span>
                    )}
                  </td>
                  <td>
                    <strong>{fmtUSD(totals.grossProfitLoss)}</strong>
                  </td>
                  <td>
                    <strong>{totals.grossMargin.toFixed(2)}%</strong>
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
