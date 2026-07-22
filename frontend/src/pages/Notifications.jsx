import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as notificationApi from "../services/notificationApi";

function formatWhen(at) {
  if (!at) return "";
  try {
    return new Date(at).toLocaleString();
  } catch {
    return "";
  }
}

export function NotificationsPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const { programTier, selectProgramTier } = useProgramTier();
  const [notifications, setNotifications] = useState([]);

  const load = useCallback(async () => {
    const res = await notificationApi.listMyNotifications(accessToken);
    setNotifications(res.notifications || []);
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  useEffect(() => {
    const timer = setInterval(() => {
      reload().catch(() => {});
    }, 8000);
    return () => clearInterval(timer);
  }, [reload]);

  async function openNotification(n) {
    try {
      if (!n.readAt) {
        await notificationApi.markNotificationRead(accessToken, n.id);
      }
    } catch {
      /* still navigate */
    }
    const needsPortalSwitch =
      n.programTier && n.programTier !== programTier && user?.role === "research_director";
    if (needsPortalSwitch) {
      selectProgramTier(n.programTier);
    }
    if (n.link) {
      // Persist tier before the review/detail page fetches
      window.setTimeout(() => navigate(n.link), needsPortalSwitch ? 80 : 0);
    } else {
      await reload().catch(() => {});
    }
  }

  return (
    <div className="dashboardPage">
      <header className="dashPageHeader">
        <h1 className="dashPageTitle">Notifications</h1>
        <p className="dashPageSub">Your personal notifications — messages, grants, ethics, and more.</p>
      </header>

      {loading ? <p className="muted">Loading notifications…</p> : null}
      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>
          {error}
          <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "grid", gap: 10 }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              className="card"
              style={{
                opacity: n.readAt ? 0.7 : 1,
                borderColor: n.readAt ? undefined : "rgba(14, 165, 233, 0.35)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div style={{ fontWeight: 800 }}>{n.title}</div>
                <span className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                  {formatWhen(n.createdAt)}
                </span>
              </div>
              <div className="muted" style={{ marginTop: 4, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.5 }}>
                {n.body}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                {n.link ? (
                  <button type="button" className="btn primary" onClick={() => openNotification(n)}>
                    {n.type === "message" ? "Open chat" : "Open"}
                  </button>
                ) : null}
                {!n.readAt ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={async () => {
                      await notificationApi.markNotificationRead(accessToken, n.id);
                      await reload();
                    }}
                  >
                    Mark read
                  </button>
                ) : (
                  <span className="muted">Read</span>
                )}
              </div>
            </div>
          ))}
          {notifications.length === 0 ? <div className="muted">No notifications yet.</div> : null}
        </div>
      </div>
    </div>
  );
}
