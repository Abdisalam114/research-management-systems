import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { BackButton } from "../components/BackButton";
import { GlobalSearchBar } from "../components/GlobalSearchBar";
import * as notificationApi from "../services/notificationApi";
import logo from "../assets/jamhuriya-logo.png";
import { PROGRAM_TIER_OPTIONS } from "../constants/programTier";

export function TopBar({ title = "Dashboard" }) {
  const { user, accessToken } = useAuth();
  const { programTier, programTierLabel, clearProgramTier } = useProgramTier();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  const tierMeta = PROGRAM_TIER_OPTIONS.find((o) => o.value === programTier);
  const activeTier = user?.role === "research_director" ? programTier : user?.programTier;
  const activeTierLabel = PROGRAM_TIER_OPTIONS.find((o) => o.value === activeTier)?.label;
  const showTierBadge = Boolean(activeTier);
  const canSwitchTier = user?.role === "research_director";

  useEffect(() => {
    if (!accessToken) return undefined;
    let cancelled = false;

    async function poll() {
      try {
        const res = await notificationApi.getUnreadCount(accessToken);
        if (!cancelled) setUnread(res.unread || 0);
} catch {
        if (!cancelled) setUnread(0);
      }
    }

    poll();
    const timer = setInterval(poll, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [accessToken, user?.id, programTier]);

  return (
    <header className="topBar">
      <div className="topBarLeft">
        <BackButton />
        <img src={logo} alt="Jamhuriya University" className="topBarLogo" />
        <div>
          <div className="topBarBrand">JAMHURIYA RESEARCH PORTAL</div>
          <div className="topBarPage">{title}</div>
        </div>
      </div>

      <div className="topBarActions">
        <GlobalSearchBar />
        {showTierBadge ? (
          <button
            type="button"
            className="topBarTierBadge"
            title={canSwitchTier ? "Switch Undergraduate / Postgraduate portal" : "Your program portal"}
            onClick={
              canSwitchTier
                ? () => {
                    clearProgramTier();
                    navigate("/program-tier", { replace: true });
                  }
                : undefined
            }
            style={{
              border: `1px solid ${(tierMeta?.accent || PROGRAM_TIER_OPTIONS.find((o) => o.value === activeTier)?.accent) || "#38bdf8"}55`,
              background: `${(tierMeta?.accent || PROGRAM_TIER_OPTIONS.find((o) => o.value === activeTier)?.accent) || "#38bdf8"}18`,
              color: (tierMeta?.accent || PROGRAM_TIER_OPTIONS.find((o) => o.value === activeTier)?.accent) || "#38bdf8",
              borderRadius: 999,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 800,
              cursor: canSwitchTier ? "pointer" : "default",
              marginRight: 4,
            }}
          >
            {(tierMeta?.icon || PROGRAM_TIER_OPTIONS.find((o) => o.value === activeTier)?.icon) || "📍"}{" "}
            {user?.role === "research_director" ? programTierLabel : activeTierLabel}
            {canSwitchTier ? " ▾" : ""}
          </button>
        ) : null}
        <Link className="topBarIconBtn" to="/messages" title="Messages">
          💬
        </Link>
        <Link className="topBarIconBtn topBarBell" to="/notifications" title="Notifications">
          🔔
          {unread > 0 ? <span className="topBarDot" aria-label={`${unread} unread`} /> : null}
        </Link>
        <Link className="topBarAvatar" to="/profile" title={user?.fullName}>
          {(user?.fullName || "U").slice(0, 1).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}
