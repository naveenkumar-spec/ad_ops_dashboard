import DashboardHeader from "../components/DashboardHeader";
import AppLayout from "../components/AppLayout";
import FiltersPanel from "../components/FiltersPanel";
import OwnerPerformanceTable from "../components/OwnerPerformanceTable";
import PlatformSpendsTable from "../components/PlatformSpendsTable";
import RegionTable from "../components/RegionTable";
import PerformanceChart from "../components/PerformanceChart";
import { mockManagementRegions } from "../mockData";
import "../../styles/ManagementView.css";
import { useEffect, useState } from "react";
import axios from "axios";
import { toApiParams } from "../utils/apiFilters";

export default function ManagementView({ currentUser, onLogout }) {
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

  useEffect(() => {
    axios
      .get("/api/management/filter-options", { timeout: 20000, params: toApiParams(filters) })
      .then((res) => setFilterOptions(res.data || {}))
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
          <PerformanceChart title="Ops Performance" variant="ops" filters={filters} />
          <PerformanceChart title="CS Performance" variant="cs" filters={filters} />
          <PlatformSpendsTable filters={filters} />
          <RegionTable title="Region / Country wise data" variant="management" forceData={mockManagementRegions} />
          <OwnerPerformanceTable title="KPI Performance by Ops Responsible" endpoint="/api/management/ops" filters={filters} />
          <OwnerPerformanceTable title="KPI Performance by CS Responsible" endpoint="/api/management/cs" filters={filters} />
          <OwnerPerformanceTable title="KPI Performance by Sales Responsible" endpoint="/api/management/sales" filters={filters} />
        </div>
        </div>
      </div>
    </AppLayout>
  );
}


