/**
 * Parse filter parameters from query string
 */
function parseFilters(query = {}) {
  const get = (key) => {
    const value = query[key];
    if (value === undefined || value === null) return "all";
    const parts = Array.isArray(value)
      ? value
      : String(value).split(",");
    const cleaned = parts
      .map((v) => String(v).trim())
      .filter((v) => v && v.toLowerCase() !== "all");
    if (!cleaned.length) return "all";
    return cleaned.length === 1 ? cleaned[0] : cleaned;
  };
  return {
    region: get("region"),
    year: get("year"),
    month: get("month"),
    status: get("status"),
    product: get("product"),
    platform: get("platform"),
    ops: get("ops"),
    cs: get("cs"),
    sales: get("sales")
  };
}

/**
 * Apply user scope restrictions to filters
 */
function withUserScope(filters, user) {
  const scoped = { ...(filters || {}) };
  if (user && user.role !== "admin" && !user.fullAccess) {
    scoped.scopeCountries = Array.isArray(user.allowedCountries) ? user.allowedCountries : [];
    scoped.scopeAdops = Array.isArray(user.allowedAdops) ? user.allowedAdops : [];
  }
  return scoped;
}

module.exports = {
  parseFilters,
  withUserScope
};
