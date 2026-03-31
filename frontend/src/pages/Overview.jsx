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
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    axios
      .get("/api/overview/filter-options", { timeout: 20000 })
      .then((res) => setFilterOptions(res.data || {}))
      .catch(() => setFilterOptions({}));
  }, []);

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
          <KPICards filters={filters} />
          <CombinedTrends filters={filters} />
          <CombinedTrendsSecondary filters={filters} />
          <div className="overview-tables-stack">
            <BottomCampaignsTable filters={filters} />
            <CountryWiseTable filters={filters} />
            <ProductWiseTable filters={filters} />
            <CampaignWiseTable filters={filters} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}


