import { useEffect, useRef, useState } from "react";
import TrendChart from "./TrendChart";
import "../../styles/Charts.css";

export default function CombinedTrends({ filters = {}, currencyContext = null }) {
  const [selectedYears, setSelectedYears] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [granularity, setGranularity] = useState("month");
  const [showPanel, setShowPanel] = useState(false);
  const yearWrapRef = useRef(null);

  const sortYearsDesc = (arr) => [...arr].sort((a, b) => Number(b) - Number(a));

  // Whenever the allowed/available list changes, reset to the top 2 (descending) to stay in sync.
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
    <div className="combined-trends">
      <div className="combined-controls-bar">
        <div className="chart-note-pill">
          Current and previous month data is sourced from Trackers, all earlier data is sourced from the Branding Sheet
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
        title="Booked Revenue Trend"
        endpoint="/api/overview/revenue-trend"
        isPercent={false}
        filters={filters}
        controlledYears={selectedYears}
        onYearsChange={years => setSelectedYears(sortYearsDesc(Array.from(new Set(years)).map(Number).filter(Boolean)))}
        controlledGranularity={granularity}
        onAvailableYears={(years) => setAvailableYears(sortYearsDesc(Array.from(new Set((years || []).map(Number).filter(Boolean)))))}
        currencyContext={currencyContext}
      />

      <TrendChart
        title="Gross Margin Trend"
        endpoint="/api/overview/margin-trend"
        isPercent={true}
        filters={filters}
        controlledYears={selectedYears}
        onYearsChange={years => setSelectedYears(sortYearsDesc(Array.from(new Set(years)).map(Number).filter(Boolean)))}
        controlledGranularity={granularity}
        onAvailableYears={(years) => setAvailableYears(sortYearsDesc(Array.from(new Set((years || []).map(Number).filter(Boolean)))))}
        currencyContext={currencyContext}
      />

      <TrendChart
        title="Average Buying CPM Trend"
        endpoint="/api/overview/cpm-trend"
        isPercent={false}
        isRaw={true}
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


