import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

function normalizeStatFilter(raw, defaultFilter, allowedFilters) {
  if (!raw || raw === "all") return defaultFilter;
  if (!allowedFilters?.length) return raw;
  if (allowedFilters.includes(raw)) return raw;
  if (raw.startsWith("type:") || raw.startsWith("field:")) return raw;
  return defaultFilter;
}

/** Sync PageHeader stat filter with ?filter= query param (dashboard deep links). */
export function useUrlStatFilter(defaultFilter = "all", allowedFilters = null) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilter = searchParams.get("filter");
  const allowedKey = allowedFilters?.join("|") ?? "";

  const [statusFilter, setStatusFilterState] = useState(() =>
    normalizeStatFilter(urlFilter, defaultFilter, allowedFilters)
  );

  useEffect(() => {
    setStatusFilterState(normalizeStatFilter(urlFilter, defaultFilter, allowedFilters));
  }, [urlFilter, defaultFilter, allowedKey]);

  function setStatusFilter(key) {
    const nextKey = normalizeStatFilter(key, defaultFilter, allowedFilters);
    setStatusFilterState(nextKey);
    const next = new URLSearchParams(searchParams);
    if (!nextKey || nextKey === "all") next.delete("filter");
    else next.set("filter", nextKey);
    setSearchParams(next, { replace: true });
  }

  return [statusFilter, setStatusFilter];
}
