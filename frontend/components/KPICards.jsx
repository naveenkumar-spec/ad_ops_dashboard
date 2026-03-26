import { useState, useEffect } from 'react';
import '../styles/KPICards.css';

export default function KPICards() {
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/overview/kpis');
        const data = await response.json();
        setKpis(data);
      } catch (error) {
        console.error('Error fetching KPIs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchKPIs();
  }, []);

  if (loading) {
    return <div className="kpi-cards-container">Loading KPI data...</div>;
  }

  return (
    <div className="kpi-cards-container">
      {kpis.map((kpi, index) => (
        <div key={index} className="kpi-card">
          <div className="kpi-title">{kpi.title}</div>
          <div className="kpi-value">{kpi.value}</div>
          <div className="kpi-subtitle">{kpi.subtitle}</div>
        </div>
      ))}
    </div>
  );
}
