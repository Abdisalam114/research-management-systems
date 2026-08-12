import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { useModuleLoad } from "../hooks/useModuleLoad";
import { useScrollToTop } from "../hooks/useScrollToTop";
import { isCrossTierRole } from "../constants/programTier";
import { SYSTEM_REFRESH_MS } from "../constants/systemRefresh";
import * as notificationApi from "../services/notificationApi";
import * as ethicsApi from "../services/ethicsApi";
import { apiOrigin } from "../config/apiBase";
import { triggerBlobDownload } from "../utils/downloadBlob";

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

function hasDetailBody(n) {
  return Boolean(n?.body?.trim());
}

function typeLabel(type) {
  if (!type) return "";
  return String(type).replace(/_/g, " ");
}

function tierLabel(tier) {
  if (!tier) return "";
  if (tier === "undergraduate") return "UG";
  if (tier === "postgraduate") return "PG";
  return String(tier);
}

export function NotificationsPage() {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const { programTier, selectProgramTier } = useProgramTier();
  const [notifications, setNotifications] = useState([]);
  const [downloadBusy, setDownloadBusy] = useState("");
  const [actionBusy, setActionBusy] = useState("");

  useScrollToTop([]);

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

  function downloadNotificationSummary(n) {
    const meta = [
      n.type ? `Type: ${typeLabel(n.type)}` : "",
      n.programTier ? `Portal: ${tierLabel(n.programTier)}` : "",
      n.link ? `Link: ${n.link}` : "",
      n.downloadLink ? `Download: ${n.downloadLink}` : "",
      n.createdAt ? `When: ${formatWhen(n.createdAt)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const text = `${n.title || "Notification"}\n\n${n.body || ""}${meta ? `\n\n---\n${meta}` : ""}`.trim();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(n.title || "notification").slice(0, 60).replace(/[^\w-]+/g, "_")}.txt`;
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

    const link = typeof n.link === "string" ? n.link.trim() : "";
    if (link) {
      if (link.startsWith("http")) {
        window.open(link, "_blank", "noopener,noreferrer");
      } else if (needsPortalSwitch) {
        window.setTimeout(() => navigate(link), 0);
      } else {
        navigate(link);
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
        await ethicsApi.downloadAndSaveCertificate(
          accessToken,
          ethicsId,
          `JUREC-certificate-${ethicsId}.pdf`
        );
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
      setDownloadBusy(n.id);
      try {
        const res = await fetch(`${apiOrigin()}${n.downloadLink}`);
        if (!res.ok) throw new Error("File not found on server");
        const blob = await res.blob();
        const name = n.downloadLink.split("/").pop() || "download";
        triggerBlobDownload(blob, name);
        if (!n.readAt) {
          await notificationApi.markNotificationRead(accessToken, n.id);
          await reload();
        }
      } catch (e) {
        setError(e?.message || "Could not download file");
      } finally {
        setDownloadBusy("");
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

    if (hasDetailBody(n)) {
      downloadNotificationSummary(n);
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
        hasDetailBody(n)
    );

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  async function handleMarkAllRead() {
    if (unreadCount === 0) return;
    setActionBusy("read-all");
    setError("");
    try {
      await notificationApi.markAllNotificationsRead(accessToken);
      notificationApi.notifyNotificationsUpdated();
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Could not mark all as read");
    } finally {
      setActionBusy("");
    }
  }

  async function handleClearAll() {
    if (notifications.length === 0) return;
    const ok = window.confirm(
      "Clear all notifications for this portal?\n\nThis removes them from your list. It cannot be undone."
    );
    if (!ok) return;
    setActionBusy("clear");
    setError("");
    try {
      await notificationApi.clearAllNotifications(accessToken);
      notificationApi.notifyNotificationsUpdated();
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Could not clear notifications");
    } finally {
      setActionBusy("");
    }
  }

  return (
    <div className="dashboardPage">
      <header className="dashPageHeader">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <h1 className="dashPageTitle">Notifications</h1>
            <p className="dashPageSub">Your personal notifications — messages, grants, ethics, and more.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn"
              disabled={loading || actionBusy || unreadCount === 0}
              onClick={handleMarkAllRead}
            >
              {actionBusy === "read-all" ? "Working…" : `Mark all read${unreadCount ? ` (${unreadCount})` : ""}`}
            </button>
            <button
              type="button"
              className="btn"
              disabled={loading || actionBusy || notifications.length === 0}
              onClick={handleClearAll}
            >
              {actionBusy === "clear" ? "Clearing…" : "Clear all"}
            </button>
          </div>
        </div>
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

              <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {n.type ? (
                  <span className="fundingCallMetaChip" style={{ textTransform: "capitalize" }}>
                    {typeLabel(n.type)}
                  </span>
                ) : null}
                {n.programTier ? (
                  <span className="fundingCallMetaChip">{tierLabel(n.programTier)}</span>
                ) : null}
                {!n.readAt ? (
                  <span className="fundingCallMetaChip" style={{ borderColor: "rgba(14,165,233,0.55)" }}>
                    Unread
                  </span>
                ) : null}
                {n.downloadLink ? (
                  <span className="fundingCallMetaChip">Has download</span>
                ) : null}
              </div>

              <div
                style={{
                  marginTop: 10,
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: 1.55,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(15,23,42,0.04)",
                  color: "inherit",
                }}
              >
                {n.body?.trim() ? n.body : <span className="muted">No additional details.</span>}
              </div>

              {(n.link || n.downloadLink) ? (
                <div className="muted" style={{ marginTop: 8, fontSize: 12, display: "grid", gap: 2 }}>
                  {n.link ? (
                    <div>
                      <strong>Link:</strong> {n.link}
                    </div>
                  ) : null}
                  {n.downloadLink ? (
                    <div>
                      <strong>Download:</strong>{" "}
                      {ethicsIdFromDownloadLink(n.downloadLink)
                        ? "JUREC certificate PDF"
                        : n.downloadLink}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {n.link ? (
                  <button type="button" className="btn primary" onClick={() => openNotification(n)}>
                    {n.type === "message" ? "Open chat" : "Open"}
                  </button>
                ) : null}
                {canDownload(n) ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={downloadBusy === n.id}
                    onClick={() => downloadDocument(n)}
                  >
                    {downloadBusy === n.id
                      ? "Downloading…"
                      : ethicsIdFromDownloadLink(n.downloadLink) || n.downloadLink
                        ? "Download document"
                        : "Download summary"}
                  </button>
                ) : null}
                {!n.readAt ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={async () => {
                      await notificationApi.markNotificationRead(accessToken, n.id);
                      notificationApi.notifyNotificationsUpdated();
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
    </div>
  );
}
