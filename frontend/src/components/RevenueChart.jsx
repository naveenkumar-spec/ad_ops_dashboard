import TrendChart from "./TrendChart";

function RevenueChart() {
  return <TrendChart title="Booked Revenue Trend" endpoint="/api/overview/revenue-trend" isPercent={false} />;
}

export default RevenueChart;


