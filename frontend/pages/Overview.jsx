// src/pages/Overview.jsx    (or Dashboard.jsx — keep consistent with your router)

import DashboardHeader from "../components/DashboardHeader";
import FiltersPanel from "../components/FiltersPanel";
import KPICards from "../components/KPICards";
import RevenueChart from "../components/RevenueChart";
import SpendChart from "../components/SpendChart";
import RegionTable from "../components/RegionTable";
import CampaignTable from "../components/CampaignTable";

import ProductWiseTable from "../components/ProductWiseTable";
import RegionWiseTable from "../components/RegionWiseTable";

import "../styles/Overview.css";

function Overview() {
  return (
    <div className="overview-page">
      <DashboardHeader activeTab="overview" />
      <FiltersPanel />
      <KPICards />

      <section className="overview-grid overview-charts">
        <RevenueChart />
        <SpendChart />
        {/* If you have a CombinedTrends component, uncomment: */}
        {/* <CombinedTrends /> */}
      </section>

      <section className="overview-grid overview-tables">
        <CampaignTable title="Bottom Campaigns" />
        <RegionTable title="Country wise data" />
      </section>

      {/* ────────────────────────────────────────────────
          New summary tables – added at the bottom
      ──────────────────────────────────────────────── */}
      <section className="mt-12 px-4 md:px-6 lg:px-8">
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Product wise data
          </h2>
          <ProductWiseTable />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Region / Country wise Data
          </h2>
          <RegionWiseTable />
        </div>
      </section>
    </div>
  );
}

export default Overview;