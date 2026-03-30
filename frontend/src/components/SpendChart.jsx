import TrendChart from "./TrendChart";

function SpendChart() {
  return <TrendChart title="Gross Margin Trend" endpoint="/api/overview/margin-trend" isPercent={true} />;
}

export default SpendChart;


