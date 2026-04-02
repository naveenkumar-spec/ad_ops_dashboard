import { useState, useEffect } from 'react';
import apiClient from '../utils/apiClient';
import '../styles/InsightsPanel.css';

export default function InsightsPanel({ filters }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => {
    fetchInsights();
  }, [filters]);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams(filters).toString();
      const response = await apiClient.get(`/api/ai/insights?${params}`);
      
      if (response.data.success) {
        setInsights(response.data.insights);
        setGeneratedAt(response.data.generatedAt);
      } else {
        setError('Failed to generate insights');
      }
    } catch (err) {
      console.error('Error fetching insights:', err);
      setError('Unable to load insights. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getInsightIcon = (type) => {
    switch (type) {
      case 'positive':
        return '📈';
      case 'negative':
        return '📉';
      case 'recommendation':
        return '💡';
      default:
        return 'ℹ️';
    }
  };

  if (loading) {
    return (
      <div className="insights-panel loading">
        <div className="insights-header">
          <h3>🤖 AI Insights</h3>
        </div>
        <div className="insights-loading">
          <div className="spinner"></div>
          <p>Analyzing your data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="insights-panel error">
        <div className="insights-header">
          <h3>🤖 AI Insights</h3>
          <button onClick={fetchInsights} className="refresh-btn">🔄 Retry</button>
        </div>
        <div className="insights-error">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="insights-panel">
      <div className="insights-header">
        <h3>🤖 AI Insights</h3>
        <div className="insights-actions">
          {generatedAt && (
            <span className="generated-time">
              Updated {new Date(generatedAt).toLocaleTimeString()}
            </span>
          )}
          <button onClick={fetchInsights} className="refresh-btn" title="Refresh insights">
            🔄
          </button>
        </div>
      </div>
      
      <div className="insights-list">
        {insights.length === 0 ? (
          <p className="no-insights">No insights available</p>
        ) : (
          insights.map((insight, index) => (
            <div key={index} className={`insight-item ${insight.type}`}>
              <span className="insight-icon">{getInsightIcon(insight.type)}</span>
              <p className="insight-text">{insight.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
