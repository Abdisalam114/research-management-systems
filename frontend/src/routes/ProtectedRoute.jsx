import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { financeRedirectPath, isFinanceOnlyPath } from "../constants/financeScope";

export function ProtectedRoute({ roles }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;

  // Shared staff see all portals — no program-tier gate
  if (location.pathname === "/program-tier") {
    return <Navigate to="/dashboard" replace />;
  }

  if (roles?.length && !roles.includes(user?.role)) {
    const homeByRole = {
      finance_officer: "/budgets",
      leadership: "/grants",
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
      return <Navigate to="/budgets" replace />;
    }
  }

  return <Outlet />;
}
