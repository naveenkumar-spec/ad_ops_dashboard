import TrendChart from "./TrendChart";

function SpendChart() {
  return <TrendChart title="Gross Margin Trend" endpoint="http://localhost:5000/api/overview/margin-trend" isPercent={true} />;
}

export default SpendChart;
