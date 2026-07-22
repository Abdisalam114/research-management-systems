import { useCallback, useEffect, useState } from "react";
import { useProgramTier } from "./useProgramTier";

/** Load module data only when accessToken is ready; avoids 401 race on mount. */
export function useModuleLoad(accessToken, loader, deps = []) {
  const { programTier } = useProgramTier();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!accessToken) {
      setLoading(true);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await loader();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }, [accessToken, loader, programTier, ...deps]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { loading, error, setError, reload };
}
