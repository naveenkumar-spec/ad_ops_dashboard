import { useEffect, useState } from "react";
import axios from "axios";
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
import "../../styles/Overview.css";

export default function Overview({ currentUser, onLogout }) {
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
    axios
      .get("/api/overview/filter-options", { timeout: 20000, params: toApiParams(filters) })
      .then((res) => setFilterOptions(res.data || {}))
      .catch(() => setFilterOptions({}));
  }, [refreshTick, JSON.stringify(filters)]);

  useEffect(() => {
    axios
      .get("/api/overview/trends", { timeout: 20000 })
      .then((res) => setTrendBundle(res.data || null))
      .catch(() => setTrendBundle(null));
  }, [refreshTick]);

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
          <KPICards key={`kpi-${refreshTick}`} filters={filters} />
          <CombinedTrends key={`ct1-${refreshTick}`} filters={filters} trendBundle={trendBundle} />
          <CombinedTrendsSecondary key={`ct2-${refreshTick}`} filters={filters} trendBundle={trendBundle} />
          <div className="overview-tables-stack">
            <BottomCampaignsTable key={`btm-${refreshTick}`} filters={filters} />
            <CountryWiseTable key={`cty-${refreshTick}`} filters={filters} />
            <ProductWiseTable key={`prd-${refreshTick}`} filters={filters} />
            <CampaignWiseTable key={`cpg-${refreshTick}`} filters={filters} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}


