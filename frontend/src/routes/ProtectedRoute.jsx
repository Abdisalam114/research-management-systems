import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";

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
    const homeByRole = {
      ethics_committee: "/ethics",
      procurement_officer: "/budgets",
      peer_reviewer: "/review-assignments",
      hr_officer: "/projects",
      leadership: "/grants",
      donor_agency: "/donor-reports",
    };
    return <Navigate to={homeByRole[user?.role] || "/dashboard"} replace />;
  }

  return <Outlet />;
}
