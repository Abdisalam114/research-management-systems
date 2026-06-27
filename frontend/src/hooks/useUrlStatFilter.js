import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

/** Sync PageHeader stat filter with ?filter= query param (dashboard deep links). */
export function useUrlStatFilter(defaultFilter = "all") {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilter = searchParams.get("filter");
  const [statusFilter, setStatusFilterState] = useState(urlFilter || defaultFilter);

  useEffect(() => {
    if (urlFilter) setStatusFilterState(urlFilter);
  }, [urlFilter]);

  function setStatusFilter(key) {
    setStatusFilterState(key);
    const next = new URLSearchParams(searchParams);
    if (!key || key === "all") next.delete("filter");
    else next.set("filter", key);
    setSearchParams(next, { replace: true });
  }

  return [statusFilter, setStatusFilter];
}
