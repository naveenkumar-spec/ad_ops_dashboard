export function toApiParams(filters = {}) {
  const params = {};
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      const cleaned = value.map((v) => String(v).trim()).filter((v) => v && v.toLowerCase() !== "all");
      if (!cleaned.length) return;
      params[key] = cleaned.join(",");
      return;
    }
    const text = String(value).trim();
    if (!text || text.toLowerCase() === "all") return;
    params[key] = text;
  });
  return params;
}
