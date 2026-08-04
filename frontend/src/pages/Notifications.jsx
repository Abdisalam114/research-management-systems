import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { useModuleLoad } from "../hooks/useModuleLoad";
import { isCrossTierRole } from "../constants/programTier";
import { SYSTEM_REFRESH_MS } from "../constants/systemRefresh";
import * as notificationApi from "../services/notificationApi";
import * as ethicsApi from "../services/ethicsApi";
import { apiOrigin } from "../config/apiBase";

function formatWhen(at) {
  if (!at) return "";
  try {
    return new Date(at).toLocaleString();
  } catch {
    return "";
  }
}

function ethicsIdFromDownloadLink(link) {
  if (!link?.startsWith("ethics-certificate:")) return null;
  return link.slice("ethics-certificate:".length);
}

export function NotificationsPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const { programTier, selectProgramTier } = useProgramTier();
  const [notifications, setNotifications] = useState([]);
  const [downloadBusy, setDownloadBusy] = useState("");
  const [detailNote, setDetailNote] = useState(null);

  const load = useCallback(async () => {
    const res = await notificationApi.listMyNotifications(accessToken);
    setNotifications(res.notifications || []);
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  useEffect(() => {
    const timer = setInterval(() => {
      reload().catch(() => {});
    }, SYSTEM_REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  function viewPublicationDetails(n) {
    if (n.body?.trim()) {
      setDetailNote(n);
      return;
    }
    if (n.link) {
      if (n.link.startsWith("http")) {
        window.open(n.link, "_blank", "noopener,noreferrer");
      } else {
        navigate(n.link);
      }
    }
  }

  function downloadPublicationSummary(n) {
    const text = `${n.title || "Publication"}\n\n${n.body || ""}`.trim();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(n.title || "notification").slice(0, 60).replace(/[^\w\-]+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function openNotification(n) {
    try {
      if (!n.readAt) {
        await notificationApi.markNotificationRead(accessToken, n.id);
      }
    } catch {
      /* still navigate */
    }

    const needsPortalSwitch =
      n.programTier &&
      n.programTier !== programTier &&
      isCrossTierRole(user?.role);

    if (needsPortalSwitch) {
      selectProgramTier(n.programTier);
    }

    if (n.link) {
      if (needsPortalSwitch) {
        window.setTimeout(() => navigate(n.link), 0);
      } else {
        navigate(n.link);
      }
    } else {
      await reload().catch(() => {});
    }
  }

  async function downloadDocument(n) {
    const ethicsId = ethicsIdFromDownloadLink(n.downloadLink);
    if (ethicsId) {
      setDownloadBusy(n.id);
      try {
        await ethicsApi.downloadCertificate(accessToken, ethicsId);
        if (!n.readAt) {
          await notificationApi.markNotificationRead(accessToken, n.id);
          await reload();
        }
      } catch (e) {
        setError(e?.message || "Could not download certificate");
      } finally {
        setDownloadBusy("");
      }
      return;
    }

    if (n.downloadLink?.startsWith("/uploads/")) {
      window.open(`${apiOrigin()}${n.downloadLink}`, "_blank", "noopener,noreferrer");
      if (!n.readAt) {
        await notificationApi.markNotificationRead(accessToken, n.id);
        await reload();
      }
      return;
    }

    if (n.downloadLink && /^https?:\/\//i.test(n.downloadLink)) {
      window.open(n.downloadLink, "_blank", "noopener,noreferrer");
      if (!n.readAt) {
        await notificationApi.markNotificationRead(accessToken, n.id);
        await reload();
      }
      return;
    }

    if (n.type === "publication" && n.body) {
      downloadPublicationSummary(n);
      if (!n.readAt) {
        await notificationApi.markNotificationRead(accessToken, n.id);
        await reload();
      }
    }
  }

  const canDownload = (n) =>
    Boolean(
      ethicsIdFromDownloadLink(n.downloadLink) ||
        n.downloadLink?.startsWith("/uploads/") ||
        (n.downloadLink && /^https?:\/\//i.test(n.downloadLink)) ||
        (n.type === "publication" && n.body)
    );

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
              <div
                className="muted"
                style={{
                  marginTop: 8,
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: 1.55,
                  padding: n.type === "publication" ? "10px 12px" : undefined,
                  borderRadius: n.type === "publication" ? 8 : undefined,
                  background: n.type === "publication" ? "rgba(15,23,42,0.04)" : undefined,
                  fontFamily: n.type === "publication" ? "inherit" : undefined,
                }}
              >
                {n.body}
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {n.link ? (
                  <button type="button" className="btn primary" onClick={() => openNotification(n)}>
                    {n.type === "message" ? "Open chat" : "Open"}
                  </button>
                ) : null}
                {n.type === "publication" && n.body ? (
                  <button type="button" className="btn" onClick={() => viewPublicationDetails(n)}>
                    View details
                  </button>
                ) : null}
                {canDownload(n) ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={downloadBusy === n.id}
                    onClick={() => downloadDocument(n)}
                  >
                    {downloadBusy === n.id ? "Downloading…" : n.type === "publication" ? "Download details" : "Download document"}
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
                ) : null}
              </div>
            </div>
          ))}
          {!loading && notifications.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No notifications yet.
            </p>
          ) : null}
        </div>
      </div>

      {detailNote ? (
        <>
          <div
            role="presentation"
            onClick={() => setDetailNote(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999,
              background: "rgba(0,0,0,0.45)",
            }}
          />
          <div
            className="card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pub-detail-title"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 1000,
              width: "min(640px, calc(100vw - 32px))",
              maxHeight: "min(85vh, 720px)",
              overflow: "auto",
              boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
            }}
          >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div id="pub-detail-title" style={{ fontWeight: 800, fontSize: 18 }}>
              {detailNote.title}
            </div>
            <button type="button" className="btn" onClick={() => setDetailNote(null)}>
              Close
            </button>
          </div>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "inherit",
              fontSize: 13,
              lineHeight: 1.55,
              marginTop: 12,
              marginBottom: 0,
              padding: 12,
              borderRadius: 8,
              background: "rgba(15,23,42,0.04)",
            }}
          >
            {detailNote.body}
          </pre>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {detailNote.link ? (
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setDetailNote(null);
                  openNotification(detailNote);
                }}
              >
                Open in project
              </button>
            ) : null}
            <button type="button" className="btn" onClick={() => downloadPublicationSummary(detailNote)}>
              Download summary
            </button>
          </div>
        </div>
        </>
      ) : null}
    </div>
  );
}
