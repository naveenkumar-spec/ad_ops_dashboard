import DashboardHeader from "../components/DashboardHeader";
import AppLayout from "../components/AppLayout";
import FiltersPanel from "../components/FiltersPanel";
import OwnerPerformanceTable from "../components/OwnerPerformanceTable";
import PlatformSpendsTable from "../components/PlatformSpendsTable";
import RegionTable from "../components/RegionTable";
import PerformanceChart from "../components/PerformanceChart";
import "../../styles/ManagementView.css";
import "../../styles/Tables.css";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../utils/apiClient";
import { toApiParams } from "../utils/apiFilters";
import { resolveCurrencyContext } from "../utils/currencyDisplay";

export default function ManagementView({ currentUser, onLogout }) {
  const omitFilterKeys = (obj, keys = []) =>
    Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !keys.includes(k)));

  const managementFilters = [
    { label: "Region / Country", name: "region" },
    { label: "Year/Month", name: "year" },
    { label: "Status", name: "status" },
    { label: "Product", name: "product" },
    { label: "Platform", name: "platform" }
  ];

  const [filters, setFilters] = useState({
    region: "all",
    year: "all",
    month: "all",
    status: "all",
    product: "all",
    platform: "all"
  });

  const [filterOptions, setFilterOptions] = useState({});
  const [currency, setCurrency] = useState("USD");
  const [chartMetric, setChartMetric] = useState("budgetGroups");

  const currencyContext = useMemo(
    () =>
      resolveCurrencyContext({
        mode: currency,
        regionFilter: filters.region,
        regionTree: filterOptions?.regionTree || []
      }),
    [currency, filters.region, JSON.stringify(filterOptions?.regionTree || [])]
  );

  useEffect(() => {
    Promise.all([
      apiGet("/api/management/filter-options", { timeout: 20000, params: toApiParams(filters) }),
      apiGet("/api/management/filter-options", {
        timeout: 20000,
        params: toApiParams(omitFilterKeys(filters, ["region"]))
      }),
      apiGet("/api/management/filter-options", {
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
  }, [JSON.stringify(filters)]);

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
      platform: "all"
    });
  };

  return (
    <AppLayout currentUser={currentUser}>
      <div className="app-shell">
        <DashboardHeader activeTab="management" currentUser={currentUser} onLogout={onLogout} />
        <div className="management-page">
          <FiltersPanel
            filters={managementFilters}
            values={filters}
            options={filterOptions}
            currency={currency}
            onCurrencyChange={setCurrency}
            onChange={handleFilterChange}
            onClear={handleClear}
          />

          <div className="management-stack">
            {/* Grouped performance charts with Budget Groups / Campaigns toggle */}
            <div className="charts-group-card">
              <div className="charts-group-header">
                <div className="bottom-top-toggle">
                  <button
                    className={`bt-btn ${chartMetric === "budgetGroups" ? "active" : ""}`}
                    onClick={() => setChartMetric("budgetGroups")}
                  >
                    Budget Groups
                  </button>
                  <button
                    className={`bt-btn ${chartMetric === "campaigns" ? "active" : ""}`}
                    onClick={() => setChartMetric("campaigns")}
                  >
                    Campaigns
                  </button>
                </div>
              </div>
              <div className="charts-group-body">
                <PerformanceChart title="Ops Performance" variant="ops" metric={chartMetric} filters={filters} currencyContext={currencyContext} />
                <PerformanceChart title="CS Performance" variant="cs" metric={chartMetric} filters={filters} currencyContext={currencyContext} />
              </div>
            </div>

            <PlatformSpendsTable filters={filters} currencyContext={currencyContext} />
            <RegionTable title="Region / Country wise data" variant="management" filters={filters} currencyContext={currencyContext} />
            <OwnerPerformanceTable title="KPI Performance by Ops Responsible" endpoint="/api/management/ops" filters={filters} currencyContext={currencyContext} />
            <OwnerPerformanceTable title="KPI Performance by CS Responsible" endpoint="/api/management/cs" filters={filters} currencyContext={currencyContext} />
            <OwnerPerformanceTable title="KPI Performance by Sales Responsible" endpoint="/api/management/sales" filters={filters} currencyContext={currencyContext} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
