import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { mockKPIs } from "../mockData.js";
import { toApiParams } from "../utils/apiFilters.js";
import { formatAbsoluteInteger, formatAbsolutePercent, safeTitle } from "../utils/absoluteTooltip.js";
import {
  convertUsdToDisplay,
  formatAbsoluteCurrencyByContext,
  formatCompactCurrency
} from "../utils/currencyDisplay.js";
import "../../styles/KPICards.css";

const CARD_ORDER = ["No of Campaigns", "Gross Margin %", "Net Margin %", "Spend"];
const ENABLE_MOCK_FALLBACK = String(import.meta.env.VITE_ENABLE_MOCK_FALLBACK || "").toLowerCase() === "true";

function parseNumber(val = "") {
  const num = Number(String(val).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(num) ? num : null;
}

function parseCurrency(label = "") {
  const m = label.toUpperCase().match(/([\d.,]+)\s*([MBK]?)/);
  if (!m) return null;
  const raw = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(raw)) return null;
  if (m[2] === "B") return raw * 1e9;
  if (m[2] === "M") return raw * 1e6;
  if (m[2] === "K") return raw * 1e3;
  return raw;
}

function getValueTitle(kpi, currencyContext) {
  const raw = String(kpi?.value ?? "");
  if (!raw) return "";
  if (kpi?.title === "No of Campaigns") return formatAbsoluteInteger(raw);
  if (raw.includes("%")) return formatAbsolutePercent(parseNumber(raw), 2);
  const asCurrency = parseCurrency(raw);
  if (asCurrency != null) return formatAbsoluteCurrencyByContext(asCurrency, currencyContext);
  const asNum = parseNumber(raw);
  return asNum != null ? formatAbsoluteInteger(asNum) : safeTitle(raw);
}

function getSubtitleTitle(text = "", currencyContext = null) {
  const raw = String(text || "");
  const currency = parseCurrency(raw);
  if (currency != null && /margin|revenue|spend/i.test(raw)) {
    return raw.replace(/(?:[A-Z]{2,4}|\$)?\s*[\d.,]+\s*[MBK]?/i, formatAbsoluteCurrencyByContext(currency, currencyContext));
  }
  if (/budget groups/i.test(raw)) {
    const n = parseNumber(raw);
    if (n != null) return `Budget Groups: ${formatAbsoluteInteger(n)}`;
  }
  return safeTitle(raw);
}

export default function KPICards({ filters = {}, currencyContext = null }) {
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    axios.get("/api/overview/kpis", { timeout: 20000, params: toApiParams(filters) })
      .then((res) => {
        const ordered = CARD_ORDER.map((t) => (res.data || []).find((i) => i.title === t)).filter(Boolean);
        setKpis(ordered);
      })
      .catch(() => {
        if (ENABLE_MOCK_FALLBACK) {
          const ordered = CARD_ORDER.map((t) => mockKPIs.find((i) => i.title === t)).filter(Boolean);
          setKpis(ordered);
          return;
        }
        setKpis([]);
        setError("Failed to load KPI data");
      })
      .finally(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  const display = useMemo(() => {
    if (!kpis.length) return [];
    const toDisplay = (value) => convertUsdToDisplay(value, currencyContext);

    const spendCard = kpis.find((k) => k.title === "Spend");
    const totalRevenueUsd = parseCurrency(spendCard?.subtitle || "") || 0;
    const totalRevenueConverted = toDisplay(totalRevenueUsd) ?? 0;

    return kpis.map((kpi) => {
      const valueNum = parseNumber(String(kpi.value));
      let sub = kpi.subtitle || "";

      if (kpi.title === "No of Campaigns") {
        sub = `Budget Groups: ${String(kpi.subtitle || "").replace(/\D/g, "")}`;
        return { ...kpi, subtitleText: sub };
      }

      const subtitleCurrency = parseCurrency(String(kpi.subtitle || ""));
      if (subtitleCurrency != null && /margin|revenue|spend/i.test(String(kpi.subtitle || ""))) {
        const convertedSubtitle = toDisplay(subtitleCurrency) ?? subtitleCurrency;
        sub = String(kpi.subtitle || "").replace(
          /(?:[A-Z]{2,4}|\$)?\s*[\d.,]+\s*[MBK]?/i,
          formatCompactCurrency(convertedSubtitle, currencyContext)
        );
      }

      if (kpi.title === "Spend") {
        const spendUsd = parseCurrency(String(kpi.value || "")) || 0;
        const spendConverted = toDisplay(spendUsd) ?? 0;
        if (totalRevenueConverted && !/Booked Revenue/i.test(sub)) {
          sub = `Booked Revenue: ${formatCompactCurrency(totalRevenueConverted, currencyContext)}`;
        }
        return {
          ...kpi,
          value: formatCompactCurrency(spendConverted, currencyContext),
          subtitleText: sub
        };
      }

      if (kpi.title === "Gross Margin %" && totalRevenueConverted && valueNum != null && !/Gross Margin/i.test(sub)) {
        sub = `Gross Margin: ${formatCompactCurrency((totalRevenueConverted * valueNum) / 100, currencyContext)}`;
      }
      if (kpi.title === "Net Margin %" && totalRevenueConverted && valueNum != null && !/Net Margin/i.test(sub)) {
        sub = `Net Margin: ${formatCompactCurrency((totalRevenueConverted * valueNum) / 100, currencyContext)}`;
      }
      return { ...kpi, subtitleText: sub };
    });
  }, [kpis, currencyContext]);

  if (loading) return <div className="kpi-banner">Loading KPI data...</div>;
  if (error) return <div className="kpi-banner">{error}</div>;
  if (!display.length) return <div className="kpi-banner">No KPI data available</div>;

  return (
    <div className="kpi-cards-container">
      {display.map((kpi, i) => (
        <article className="kpi-card" key={i}>
          <p className="kpi-title" title={safeTitle(kpi.title)}>{kpi.title}</p>
          <p className="kpi-value" title={getValueTitle(kpi, currencyContext)}>{kpi.value}</p>
          <div className="kpi-divider" />
          <p className="kpi-subtitle" title={getSubtitleTitle(kpi.subtitleText, currencyContext)}>{kpi.subtitleText}</p>
        </article>
      ))}
    </div>
  );
}
