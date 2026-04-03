import { useEffect, useRef, useState } from "react";
import TrendChart from "./TrendChart";
import "../../styles/Charts.css";

export default function NetMarginTrendChart({ filters = {}, currencyContext = null }) {
  const [selectedYears, setSelectedYears] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [granularity, setGranularity] = useState("month");
  const [showPanel, setShowPanel] = useState(false);
  const yearWrapRef = useRef(null);

  const sortYearsDesc = (arr) => [...arr].sort((a, b) => Number(b) - Number(a));

  // Initialize with top 2 years when available years change
  useEffect(() => {
    if (availableYears.length) {
      setSelectedYears(sortYearsDesc(availableYears).slice(0, 2));
    }
  }, [availableYears]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (yearWrapRef.current && !yearWrapRef.current.contains(e.target)) {
        setShowPanel(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const yearButtonLabel = selectedYears.length > 1
    ? "Multiple selections"
    : selectedYears[0] || "Select years";
  const selectedYearsText = selectedYears.length
    ? selectedYears.join(", ")
    : "No year selected";

  return (
    <div className="combined-trends net-margin-chart-section">
      <div className="combined-controls-bar">
        <div className="chart-note-pill chart-note-pill--tracker">
          Net Margin data is sourced exclusively from Tracker Sheets (all months)
        </div>
        <div className="combined-right-controls">
          <div className="year-select-wrap" ref={yearWrapRef}>
            <div className="year-select-label">Selected Years: {selectedYearsText}</div>
            <button type="button" className="year-select-btn" onClick={() => setShowPanel(o => !o)}>
              {yearButtonLabel}
              <span className="select-chevron">▼</span>
            </button>
            {showPanel && (
              <div className="year-dropdown">
                {availableYears.map(year => (
                  <label key={year} className="year-option">
                    <input
                      type="checkbox"
                      checked={selectedYears.includes(year)}
                      onChange={e =>
                        setSelectedYears(prev => {
                          const next = e.target.checked
                            ? [...prev, year]
                            : prev.filter(y => y !== year);
                          return sortYearsDesc(next);
                        })
                      }
                    />
                    {year}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="granularity-toggle">
            {[{key:"month",label:"Month"},{key:"quarter",label:"Quarter"},{key:"year",label:"Year"}].map(btn => (
              <button
                key={btn.key}
                className={`gran-btn ${granularity === btn.key ? "active" : ""}`}
                onClick={() => setGranularity(btn.key)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <TrendChart
        title="Net Margin Trend (Tracker Sheet)"
        endpoint="/api/overview/net-margin-trend"
        isPercent={true}
        filters={filters}
        controlledYears={selectedYears}
        onYearsChange={years => setSelectedYears(sortYearsDesc(Array.from(new Set(years)).map(Number).filter(Boolean)))}
        controlledGranularity={granularity}
        onAvailableYears={(years) => setAvailableYears(sortYearsDesc(Array.from(new Set((years || []).map(Number).filter(Boolean)))))}
        currencyContext={currencyContext}
      />
    </div>
  );
}