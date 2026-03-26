import { useState, useEffect } from 'react';
import '../styles/Tables.css';

export default function CampaignTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/overview/campaigns');
        const campaignData = await response.json();
        setData(campaignData);
      } catch (error) {
        console.error('Error fetching campaigns:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="table-container">Loading campaign data...</div>;
  }

  return (
    <div className="table-container">
      <div className="table-header-section">
        <h3>Bottom Campaigns ( with &lt;50% Gross Profit )</h3>
        <div className="table-toggles">
          <button className="toggle-btn-small active">Bottom</button>
          <button className="toggle-btn-small">Top</button>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Campaign Name</th>
            <th>Status</th>
            <th>Booked Revenue</th>
            <th>Spend</th>
            <th>Gross Profit / Loss</th>
            <th>Gross Margin %</th>
            <th>Net Profit / Loss</th>
            <th>Net Margin %</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              <td>{row.campaign}</td>
              <td>{row.status}</td>
              <td>{row.bookedRevenue}</td>
              <td>{row.spend}</td>
              <td>{row.grossProfit}</td>
              <td>{row.grossMargin}</td>
              <td>{row.netProfit}</td>
              <td>{row.netMargin}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
