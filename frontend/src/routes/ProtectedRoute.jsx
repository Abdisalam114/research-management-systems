import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { financeRedirectPath, isFinanceOnlyPath } from "../constants/financeScope";

export function ProtectedRoute({ roles }) {
  const { isAuthenticated, loading, user } = useAuth();
  const { hasProgramTier } = useProgramTier();
  const location = useLocation();

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;

  const isDirector = user?.role === "research_director";
  const onTierSelectPage = location.pathname === "/program-tier";

  if (isDirector && !hasProgramTier && !onTierSelectPage) {
    return <Navigate to="/program-tier" replace state={{ from: location }} />;
  }

  if (isDirector && hasProgramTier && onTierSelectPage) {
    return <Navigate to="/dashboard" replace />;
  }

  if (roles?.length && !roles.includes(user?.role)) {
    // #region agent log
    fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
      body: JSON.stringify({
        sessionId: "f558f7",
        runId: "peer-flow",
        hypothesisId: "PF3",
        location: "ProtectedRoute.jsx:roleDenied",
        message: "role blocked from route",
        data: { role: user?.role, path: location.pathname, allowedRoles: roles },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const homeByRole = {
      finance_officer: "/budgets",
      procurement_officer: "/budgets",
      hr_officer: "/projects",
      leadership: "/grants",
      donor_agency: "/donor-reports",
    };
    return <Navigate to={homeByRole[user?.role] || "/dashboard"} replace />;
  }

  // Hard scope: finance_officer may only open finance-related paths
  if (user?.role === "finance_officer") {
    const remap = financeRedirectPath(location.pathname);
    if (remap && remap !== location.pathname) {
      return <Navigate to={remap} replace />;
    }
    if (!isFinanceOnlyPath(location.pathname)) {
      // #region agent log
      fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f558f7" },
        body: JSON.stringify({
          sessionId: "f558f7",
          runId: "peer-flow",
          hypothesisId: "PF2",
          location: "ProtectedRoute.jsx:financeScope",
          message: "finance blocked from non-finance path",
          data: { path: location.pathname, policiesAllowed: isFinanceOnlyPath("/policies") },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return <Navigate to="/budgets" replace />;
    }
  }

  return <Outlet />;
}
