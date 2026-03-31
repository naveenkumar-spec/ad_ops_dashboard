import { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/Filters.css";

export default function FiltersPanel({
  filters = [],
  values = {},
  options = {},
  currency = "USD",
  onCurrencyChange,
  onChange,
  onClear
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const [expandedRegions, setExpandedRegions] = useState({});
  const [expandedYears, setExpandedYears] = useState({});
  const [searchByFilter, setSearchByFilter] = useState({});
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const fallbackFilters = filters.length
    ? filters
    : [
        { label: "Region / Country", name: "region" },
        { label: "Year/Month", name: "year" },
        { label: "Status", name: "status" },
        { label: "Product", name: "product" },
        { label: "Platform", name: "platform" }
      ];

  const regionTree = Array.isArray(options?.regionTree) ? options.regionTree : [];
  const yearMonthTree = Array.isArray(options?.yearMonthTree) ? options.yearMonthTree : [];

  const toList = (value) => {
    if (value === undefined || value === null || value === "all") return [];
    return Array.isArray(value) ? value.map((v) => String(v)) : [String(value)];
  };

  const encodeRegionToken = (kind, value) => `${kind}::${String(value || "").trim()}`;
  const decodeRegionToken = (value) => {
    const text = String(value || "");
    if (text.startsWith("region::")) return text.slice("region::".length);
    if (text.startsWith("country::")) return text.slice("country::".length);
    return text;
  };

  const includesValue = (list, value) =>
    list.some((item) => String(item).toLowerCase() === String(value).toLowerCase());

  const toggleListValue = (list, value) => {
    if (includesValue(list, value)) {
      return list.filter((item) => String(item).toLowerCase() !== String(value).toLowerCase());
    }
    return [...list, value];
  };

  const emitFilter = (name, list) => {
    onChange?.(name, list.length ? list : "all");
  };

  const selectedRegions = toList(values?.region);
  const selectedYears = toList(values?.year);
  const selectedMonths = toList(values?.month);

  const selectedRegionLabel = useMemo(() => {
    if (!selectedRegions.length) return "All";
    if (selectedRegions.length === 1) return decodeRegionToken(selectedRegions[0]);
    return `${selectedRegions.length} selected`;
  }, [selectedRegions]);

  const selectedYearLabel = useMemo(() => {
    const total = selectedYears.length + selectedMonths.length;
    if (!total) return "All";
    if (total === 1 && selectedMonths.length === 1) return selectedMonths[0];
    if (total === 1 && selectedYears.length === 1) return selectedYears[0];
    return `${total} selected`;
  }, [selectedYears, selectedMonths]);

  const getOptions = (name) => (Array.isArray(options?.[name]) ? options[name] : []);
  const getSearchValue = (name) => String(searchByFilter?.[name] || "");
  const updateSearchValue = (name, value) =>
    setSearchByFilter((prev) => ({ ...prev, [name]: value }));

  const getSummaryLabel = (name) => {
    const selected = toList(values?.[name]);
    if (!selected.length) return "All";
    if (selected.length === 1) return selected[0];
    return `${selected.length} selected`;
  };

  const regionSearch = getSearchValue("region").toLowerCase();
  const filteredRegionTree = useMemo(() => {
    if (!regionSearch) return regionTree;
    return regionTree
      .map((node) => {
        const region = String(node.region || "");
        const countries = Array.isArray(node.countries) ? node.countries : [];
        const regionMatch = region.toLowerCase().includes(regionSearch);
        const matchedCountries = countries.filter((country) =>
          String(country || "").toLowerCase().includes(regionSearch)
        );
        if (regionMatch) return { ...node, countries };
        if (matchedCountries.length) return { ...node, countries: matchedCountries };
        return null;
      })
      .filter(Boolean);
  }, [regionTree, regionSearch]);

  const yearSearch = getSearchValue("year").toLowerCase();
  const filteredYearMonthTree = useMemo(() => {
    if (!yearSearch) return yearMonthTree;
    return yearMonthTree
      .map((node) => {
        const year = String(node.year || "");
        const months = Array.isArray(node.months) ? node.months : [];
        const yearMatch = year.toLowerCase().includes(yearSearch);
        const matchedMonths = months.filter((month) =>
          String(month || "").toLowerCase().includes(yearSearch)
        );
        if (yearMatch) return { ...node, months };
        if (matchedMonths.length) return { ...node, months: matchedMonths };
        return null;
      })
      .filter(Boolean);
  }, [yearMonthTree, yearSearch]);

  return (
    <div className="filters-section" ref={menuRef}>
      {fallbackFilters.map((filter) => (
        <div className="filter-group" key={filter.name}>
          <label>{filter.label}</label>

          {filter.name === "region" && regionTree.length > 0 ? (
            <div className="hierarchy-filter">
              <button
                type="button"
                className="hierarchy-trigger"
                onClick={() => setOpenMenu(openMenu === "region" ? null : "region")}
              >
                <span>{selectedRegionLabel}</span>
                <span className={`hierarchy-caret ${openMenu === "region" ? "open" : ""}`} />
              </button>

              {openMenu === "region" && (
                <div className="hierarchy-menu">
                  <div className="hierarchy-search-wrap">
                    <input
                      type="text"
                      className="hierarchy-search"
                      placeholder="Search region or country"
                      value={getSearchValue("region")}
                      onChange={(e) => updateSearchValue("region", e.target.value)}
                    />
                  </div>
                  <label className="hierarchy-check-row">
                    <input
                      type="checkbox"
                      checked={!selectedRegions.length}
                      onChange={() => emitFilter("region", [])}
                    />
                    <span>All</span>
                  </label>

                  {filteredRegionTree.map((node) => {
                    const region = String(node.region || "");
                    const countries = Array.isArray(node.countries) ? node.countries : [];
                    const expanded = !!expandedRegions[region];
                    const regionToken = encodeRegionToken("region", region);

                    return (
                      <div key={region} className="hierarchy-group">
                        <div className="hierarchy-parent-row">
                          <button
                            type="button"
                            className="hierarchy-expand"
                            onClick={() => setExpandedRegions((prev) => ({ ...prev, [region]: !prev[region] }))}
                          >
                            {expanded ? "-" : "+"}
                          </button>

                          <label className="hierarchy-check-row hierarchy-parent">
                            <input
                              type="checkbox"
                              checked={includesValue(selectedRegions, regionToken)}
                              onChange={() => emitFilter("region", toggleListValue(selectedRegions, regionToken))}
                            />
                            <span>{region}</span>
                            <span className="hierarchy-node-type">Region</span>
                          </label>
                        </div>

                        {expanded && countries.length > 0 && (
                          <div className="hierarchy-children">
                            {countries.map((country) => {
                              const countryToken = encodeRegionToken("country", country);
                              return (
                                <label key={`${region}-${country}`} className="hierarchy-check-row hierarchy-child">
                                  <input
                                    type="checkbox"
                                    checked={includesValue(selectedRegions, countryToken)}
                                    onChange={() => emitFilter("region", toggleListValue(selectedRegions, countryToken))}
                                  />
                                  <span>{country}</span>
                                  <span className="hierarchy-node-type">Country</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : filter.name === "year" && yearMonthTree.length > 0 ? (
            <div className="hierarchy-filter">
              <button
                type="button"
                className="hierarchy-trigger"
                onClick={() => setOpenMenu(openMenu === "year" ? null : "year")}
              >
                <span>{selectedYearLabel}</span>
                <span className={`hierarchy-caret ${openMenu === "year" ? "open" : ""}`} />
              </button>

              {openMenu === "year" && (
                <div className="hierarchy-menu">
                  <div className="hierarchy-search-wrap">
                    <input
                      type="text"
                      className="hierarchy-search"
                      placeholder="Search year or month"
                      value={getSearchValue("year")}
                      onChange={(e) => updateSearchValue("year", e.target.value)}
                    />
                  </div>
                  <label className="hierarchy-check-row">
                    <input
                      type="checkbox"
                      checked={!selectedYears.length && !selectedMonths.length}
                      onChange={() => {
                        emitFilter("year", []);
                        emitFilter("month", []);
                      }}
                    />
                    <span>All</span>
                  </label>

                  {filteredYearMonthTree.map((node) => {
                    const year = String(node.year || "");
                    const months = Array.isArray(node.months) ? node.months : [];
                    const expanded = !!expandedYears[year];

                    return (
                      <div key={year} className="hierarchy-group">
                        <div className="hierarchy-parent-row">
                          <button
                            type="button"
                            className="hierarchy-expand"
                            onClick={() => setExpandedYears((prev) => ({ ...prev, [year]: !prev[year] }))}
                          >
                            {expanded ? "-" : "+"}
                          </button>

                          <label className="hierarchy-check-row hierarchy-parent">
                            <input
                              type="checkbox"
                              checked={includesValue(selectedYears, year)}
                              onChange={() => emitFilter("year", toggleListValue(selectedYears, year))}
                            />
                            <span>{year}</span>
                            <span className="hierarchy-node-type">Year</span>
                          </label>
                        </div>

                        {expanded && months.length > 0 && (
                          <div className="hierarchy-children">
                            {months.map((month) => (
                              <label key={`${year}-${month}`} className="hierarchy-check-row hierarchy-child">
                                <input
                                  type="checkbox"
                                  checked={includesValue(selectedMonths, month)}
                                  onChange={() => {
                                    emitFilter("month", toggleListValue(selectedMonths, month));
                                    if (!includesValue(selectedYears, year)) emitFilter("year", [...selectedYears, year]);
                                  }}
                                />
                                <span>{month}</span>
                                <span className="hierarchy-node-type">Month</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="hierarchy-filter">
              <button
                type="button"
                className="hierarchy-trigger"
                onClick={() => setOpenMenu(openMenu === filter.name ? null : filter.name)}
              >
                <span>{getSummaryLabel(filter.name)}</span>
                <span className={`hierarchy-caret ${openMenu === filter.name ? "open" : ""}`} />
              </button>

              {openMenu === filter.name && (
                <div className="hierarchy-menu">
                  <div className="hierarchy-search-wrap">
                    <input
                      type="text"
                      className="hierarchy-search"
                      placeholder={`Search ${filter.label}`}
                      value={getSearchValue(filter.name)}
                      onChange={(e) => updateSearchValue(filter.name, e.target.value)}
                    />
                  </div>
                  <label className="hierarchy-check-row">
                    <input
                      type="checkbox"
                      checked={!toList(values?.[filter.name]).length}
                      onChange={() => emitFilter(filter.name, [])}
                    />
                    <span>All</span>
                  </label>

                  {getOptions(filter.name)
                    .filter((opt) => String(opt).toLowerCase().includes(getSearchValue(filter.name).toLowerCase()))
                    .map((opt) => {
                    const selected = toList(values?.[filter.name]);
                    return (
                      <label key={String(opt)} className="hierarchy-check-row">
                        <input
                          type="checkbox"
                          checked={includesValue(selected, opt)}
                          onChange={() => emitFilter(filter.name, toggleListValue(selected, opt))}
                        />
                        <span>{String(opt)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <div className="filters-actions">
        <button className="clear-filters" type="button" onClick={onClear}>
          Clear all filters
        </button>
      </div>

      <div className="filters-currency-corner">
        <div className="filters-currency-toggle">
          <button
            className={`filters-currency-btn ${currency === "USD" ? "active" : ""}`}
            type="button"
            onClick={() => onCurrencyChange?.("USD")}
          >
            USD
          </button>
          <button
            className={`filters-currency-btn ${currency === "Native" ? "active" : ""}`}
            type="button"
            onClick={() => onCurrencyChange?.("Native")}
          >
            Native Currency
          </button>
        </div>
      </div>
    </div>
  );
}


