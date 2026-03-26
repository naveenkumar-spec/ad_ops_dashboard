import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../styles/Charts.css';

export default function RevenueChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/overview/revenue-trend');
        const trendData = await response.json();
        setData(trendData);
      } catch (error) {
        console.error('Error fetching revenue trend:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="chart-container">Loading chart data...</div>;
  }

  return (
    <div className="chart-container">
      <div className="chart-header">
        <div className="chart-title">Booked Revenue Trend</div>
        <div className="chart-meta">Year ⬛ 2025 ⬛ 2026</div>
      </div>
      <div className="chart-note">
        Current and previous month data is sourced from Trackers, all earlier data is sourced from the Branding Sheet
      </div>
      <div className="time-toggles">
        <button className="toggle-btn active">Month</button>
        <button className="toggle-btn">Quarter</button>
        <button className="toggle-btn">Year</button>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }} />
          <Legend />
          <Bar dataKey="2025" fill="#8bb881" />
          <Bar dataKey="2026" fill="#3a5e3a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
