import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { isCrossTierRole } from "../constants/programTier";
import { financeRedirectPath, isFinanceOnlyPath } from "../constants/financeScope";

function homeForRole(role) {
  if (role === "finance_officer") return "/budgets";
  if (role === "leadership") return "/grants";
  return "/dashboard";
}

export function ProtectedRoute({ roles }) {
  const { isAuthenticated, loading, user } = useAuth();
  const { hasProgramTier } = useProgramTier();
  const location = useLocation();

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;

  const sharedStaff = isCrossTierRole(user?.role);
  const onTierSelectPage = location.pathname === "/program-tier";

  if (sharedStaff && !hasProgramTier && !onTierSelectPage) {
    return <Navigate to="/program-tier" replace state={{ from: location }} />;
  }

  if (sharedStaff && hasProgramTier && onTierSelectPage) {
    return <Navigate to={homeForRole(user?.role)} replace />;
  }

  if (!sharedStaff && onTierSelectPage) {
    return <Navigate to={homeForRole(user?.role)} replace />;
  }

  if (roles?.length && !roles.includes(user?.role)) {
    return <Navigate to={homeForRole(user?.role)} replace />;
  }

  // Hard scope: finance_officer may only open finance-related paths
  if (user?.role === "finance_officer" && !onTierSelectPage) {
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
