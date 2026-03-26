import TrendChart from "./TrendChart";

function RevenueChart() {
  return <TrendChart title="Booked Revenue Trend" endpoint="http://localhost:5000/api/overview/revenue-trend" isPercent={false} />;
}

export default RevenueChart;
