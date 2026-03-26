import DashboardHeader from "../src/components/DashboardHeader";
import FiltersPanel from "../src/components/FiltersPanel";
import KPICards from "../src/components/KPICards";
import OwnerPerformanceTable from "../src/components/OwnerPerformanceTable";
import PlatformSpendsTable from "../src/components/PlatformSpendsTable";
import RegionTable from "../src/components/RegionTable";
import CampaignTable from "../src/components/CampaignTable";
import "../styles/ManagementView.css";

export default function ManagementView() {
  return (
    <div className="management-page">
      <DashboardHeader activeTab="management" />
      <FiltersPanel />
      <KPICards />

      <section className="management-grid owner-grid">
        <OwnerPerformanceTable title="KPI Performance by Ops Responsible" endpoint="/api/management/ops" />
        <OwnerPerformanceTable title="KPI Performance by CS Responsible" endpoint="/api/management/cs" />
        <OwnerPerformanceTable title="KPI Performance by Sales Responsible" endpoint="/api/management/sales" />
      </section>

      <section className="management-grid">
        <PlatformSpendsTable />
      </section>

      <section className="management-grid management-bottom">
        <RegionTable title="Region / Country wise data" />
        <CampaignTable title="Bottom Campaigns" />
      </section>
    </div>
  );
}
