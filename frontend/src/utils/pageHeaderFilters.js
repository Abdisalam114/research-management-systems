/** Build clickable PageHeader stat tiles that filter a list by status. */
export function buildStatusFilterStats(items, statusField = "status", extraStats = []) {
  const by = (s) => items.filter((i) => i[statusField] === s).length;
  const base = [
    { label: "Total", value: items.length, filterKey: "all" },
    { label: "Draft", value: by("draft"), filterKey: "draft" },
    { label: "Submitted", value: by("submitted"), filterKey: "submitted", accent: "#38bdf8" },
    { label: "Approved", value: by("approved"), filterKey: "approved", accent: "#1d4ed8" },
    { label: "Rejected", value: by("rejected"), filterKey: "rejected" },
  ];
  const known = new Set(base.map((s) => s.filterKey));
  const merged = [...base];
  for (const s of extraStats) {
    if (!known.has(s.filterKey)) merged.push(s);
  }
  return merged.filter((s) => s.filterKey === "all" || s.value > 0 || s.alwaysShow);
}

export function isAwardedItem(item, statusField = "status") {
  return Number(item.amountAwarded || 0) > 0;
}

/** filterKey conventions: all | status value | type:X | field:value | custom keys in customFilters */
export function filterByStatKey(items, filterKey, options = {}) {
  const opts = typeof options === "string" ? { statusField: options } : options;
  const { statusField = "status", customFilters = {} } = opts;

  if (!filterKey || filterKey === "all") return items;
  if (customFilters[filterKey]) return items.filter((i) => customFilters[filterKey](i));
  if (filterKey === "awarded" || filterKey === "awarded_total") return items.filter((i) => isAwardedItem(i, statusField));

  if (filterKey.startsWith("type:")) {
    const value = filterKey.slice(5);
    return items.filter((i) => i.type === value);
  }
  if (filterKey.startsWith("field:")) {
    const rest = filterKey.slice(6);
    const sep = rest.indexOf(":");
    const field = rest.slice(0, sep);
    const value = rest.slice(sep + 1);
    return items.filter((i) => String(i[field] ?? "") === value);
  }

  return items.filter((i) => i[statusField] === filterKey);
}

export function statFilterLabel(stats, activeFilter) {
  if (!activeFilter || activeFilter === "all") return null;
  const tile = stats.find((s) => s.filterKey === activeFilter);
  return tile?.label || activeFilter;
}

export function totalStatTile(label = "Total", count = 0) {
  return { label, value: count, filterKey: "all" };
}

export function fieldStatTile(label, count, field, value, accent) {
  return { label, value: count, filterKey: `field:${field}:${value}`, accent };
}

export function typeStatTile(label, count, type, accent) {
  return { label, value: count, filterKey: `type:${type}`, accent };
}
