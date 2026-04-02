import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../utils/apiClient";
import DashboardHeader from "../components/DashboardHeader";
import AppLayout from "../components/AppLayout";
import FiltersPanel from "../components/FiltersPanel";
import KPICards from "../components/KPICards";
import CombinedTrends from "../components/CombinedTrends";
import CombinedTrendsSecondary from "../components/CombinedTrendsSecondary";
import BottomCampaignsTable from "../components/BottomCampaignsTable";
import CountryWiseTable from "../components/CountryWiseTable";
import ProductWiseTable from "../components/ProductWiseTable";
import CampaignWiseTable from "../components/CampaignWiseTable";
import { toApiParams } from "../utils/apiFilters";
import { resolveCurrencyContext } from "../utils/currencyDisplay";
import "../../styles/Overview.css";

export default function Overview({ currentUser, onLogout }) {
  const omitFilterKeys = (obj, keys = []) =>
    Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !keys.includes(k)));

  const overviewFilters = [
    { label: "Region / Country", name: "region" },
    { label: "Year/Month", name: "year" },
    { label: "Status", name: "status" },
    { label: "Product", name: "product" },
    { label: "Platform", name: "platform" },
    { label: "Sales Responsible", name: "sales" },
    { label: "Ops Responsible", name: "ops" },
    { label: "CS Responsible", name: "cs" }
  ];

  const [filters, setFilters] = useState({
    region: "all",
    year: "all",
    month: "all",
    status: "all",
    product: "all",
    platform: "all",
    sales: "all",
    ops: "all",
    cs: "all"
  });

  const [filterOptions, setFilterOptions] = useState({});
  const [trendBundle, setTrendBundle] = useState(null);
  const [currency, setCurrency] = useState("USD");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setRefreshTick((v) => v + 1), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Promise.all([
      apiGet("/api/overview/filter-options", { timeout: 20000, params: toApiParams(filters) }),
      apiGet("/api/overview/filter-options", {
        timeout: 20000,
        params: toApiParams(omitFilterKeys(filters, ["region"]))
      }),
      apiGet("/api/overview/filter-options", {
        timeout: 20000,
        params: toApiParams(omitFilterKeys(filters, ["year", "month"]))
      })
    ])
      .then(([allRes, regionRes, yearRes]) => {
        const all = allRes.data || {};
        const regionOnly = regionRes.data || {};
        const yearOnly = yearRes.data || {};
        setFilterOptions({
          ...all,
          region: regionOnly.region || all.region || [],
          regionTree: regionOnly.regionTree || all.regionTree || [],
          year: yearOnly.year || all.year || [],
          month: yearOnly.month || all.month || [],
          yearMonthTree: yearOnly.yearMonthTree || all.yearMonthTree || []
        });
      })
      .catch(() => setFilterOptions({}));
  }, [refreshTick, JSON.stringify(filters)]);

  useEffect(() => {
    apiGet("/api/overview/trends", { timeout: 20000 })
      .then((res) => setTrendBundle(res.data || null))
      .catch(() => setTrendBundle(null));
  }, [refreshTick]);

  const currencyContext = useMemo(
    () =>
      resolveCurrencyContext({
        mode: currency,
        regionFilter: filters.region,
        regionTree: filterOptions?.regionTree || []
      }),
    [currency, filters.region, JSON.stringify(filterOptions?.regionTree || [])]
  );

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleClear = () => {
    setFilters({
      region: "all",
      year: "all",
      month: "all",
      status: "all",
      product: "all",
      platform: "all",
      sales: "all",
      ops: "all",
      cs: "all"
    });
  };

  return (
    <AppLayout currentUser={currentUser}>
      <div className="app-shell">
        <DashboardHeader activeTab="overview" currentUser={currentUser} onLogout={onLogout} />
        <div className="overview-page">
          <FiltersPanel
            filters={overviewFilters}
            values={filters}
            options={filterOptions}
            currency={currency}
            onCurrencyChange={setCurrency}
            onChange={handleFilterChange}
            onClear={handleClear}
          />
          <KPICards key={`kpi-${refreshTick}`} filters={filters} currencyContext={currencyContext} />
          <CombinedTrends key={`ct1-${refreshTick}`} filters={filters} trendBundle={trendBundle} currencyContext={currencyContext} />
          <CombinedTrendsSecondary key={`ct2-${refreshTick}`} filters={filters} trendBundle={trendBundle} currencyContext={currencyContext} />
          <div className="overview-tables-stack">
            <CountryWiseTable key={`cty-${refreshTick}`} filters={filters} currencyContext={currencyContext} />
            <ProductWiseTable key={`prd-${refreshTick}`} filters={filters} currencyContext={currencyContext} />
            <CampaignWiseTable key={`cpg-${refreshTick}`} filters={filters} />
            <BottomCampaignsTable key={`btm-${refreshTick}`} filters={filters} currencyContext={currencyContext} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

