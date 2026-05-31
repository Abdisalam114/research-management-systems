import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { BackButton } from "../components/BackButton";
import * as notificationApi from "../services/notificationApi";
import logo from "../assets/jamhuriya-logo.png";

export function TopBar({ title = "Dashboard" }) {
  const { user, accessToken } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!accessToken) return undefined;
    let cancelled = false;

    async function poll() {
      try {
        const res = await notificationApi.getUnreadCount(accessToken);
        if (!cancelled) setUnread(res.unread || 0);
        // #region agent log
        fetch("http://127.0.0.1:7457/ingest/e845c40a-0f0d-41d9-883a-67cbc157bfa2", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6113cc" },
          body: JSON.stringify({
            sessionId: "6113cc",
            location: "TopBar.jsx:poll",
            message: "unread count fetched",
            data: { unread: res.unread || 0, userId: user?.id },
            timestamp: Date.now(),
            hypothesisId: "MSG2",
            runId: "collab-comms",
          }),
        }).catch(() => {});
        // #endregion
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
  }, [accessToken, user?.id]);

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
