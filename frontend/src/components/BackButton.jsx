import { useLocation, useNavigate } from "react-router-dom";
import { resolveParentRoute, shouldShowBack } from "../utils/navigation";

export function BackButton({ className = "topBarBackBtn", label = "Back" }) {
  const location = useLocation();
  const navigate = useNavigate();

  if (!shouldShowBack(location.pathname, location.search)) return null;

  function handleBack() {
    if (location.pathname === "/messages" && location.search) {
      navigate("/messages", { replace: true });
      return;
    }

    // After proposal accept, stay in Projects — do not jump back to Review.
    if (location.state?.proposalAccepted && location.pathname.startsWith("/projects")) {
      navigate("/projects");
      return;
    }

    const historyIdx = window.history.state?.idx;
    if (typeof historyIdx === "number" && historyIdx > 0) {
      navigate(-1);
      return;
    }

    const parent = resolveParentRoute(location.pathname);
    navigate(parent || "/dashboard");
  }

  return (
    <button type="button" className={className} onClick={handleBack} title={label} aria-label={label}>
      ← {label}
    </button>
  );
}
