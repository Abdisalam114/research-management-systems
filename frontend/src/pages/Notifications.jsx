import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as notificationApi from "../services/notificationApi";

export function NotificationsPage() {
  const { accessToken } = useAuth();
  const [notifications, setNotifications] = useState([]);

  const load = useCallback(async () => {
    const res = await notificationApi.listMyNotifications(accessToken);
    setNotifications(res.notifications || []);
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Notifications</h2>
      {loading ? <p className="muted">Loading notifications…</p> : null}
      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>
          {error}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "grid", gap: 10 }}>
          {notifications.map((n) => (
            <div key={n.id} className="card" style={{ opacity: n.readAt ? 0.7 : 1 }}>
              <div style={{ fontWeight: 800 }}>{n.title}</div>
              <div className="muted" style={{ marginTop: 4 }}>
                {n.body}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                {n.link ? (
                  <Link className="btn" to={n.link}>
                    Open
                  </Link>
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
