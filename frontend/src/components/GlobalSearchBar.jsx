import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import * as searchApi from "../services/searchApi";

const GROUP_LABELS = {
  proposals: "Proposal",
  projects: "Project",
  grants: "Grant",
  publications: "Publication",
  fundingCalls: "Funding call",
  ethics: "Ethics",
  thesisGroups: "Thesis",
  researchGroups: "Group",
  repository: "Repository",
  budgets: "Budget",
  payments: "Payment",
  purchaseOrders: "Purchase order",
  policies: "Policy",
  conversations: "Message",
  users: "User",
  departments: "Department",
  notifications: "Notification",
  auditEvents: "Audit",
};

const MESSAGE_ROLES = new Set(["researcher", "faculty_coordinator", "research_director"]);

export function GlobalSearchBar() {
  const { accessToken, user } = useAuth();
  const { programTier } = useProgramTier();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const trimmed = q.trim();
  const canOpenMessages = MESSAGE_ROLES.has(user?.role);

  useEffect(() => {
    setResults(null);
    setTotal(0);
    setError("");
    setOpen(false);
  }, [programTier]);

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults(null);
      setTotal(0);
      setError("");
      return undefined;
    }
    const timer = setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const res = await searchApi.globalSearch(accessToken, trimmed);
        setResults(res.results || {});
        setTotal(Number(res.total) || 0);
        setOpen(true);
      } catch (err) {
        setResults(null);
        setTotal(0);
        setError(err?.response?.data?.message || "Search failed");
        setOpen(true);
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [trimmed, accessToken, programTier]);

  const flat = useMemo(() => {
    if (!results) return [];
    const mapItem = (item, group) => ({
      ...item,
      group: group || item.section,
      groupLabel: GROUP_LABELS[group || item.section] || group || item.section,
    });
    let items = [];
    if (Array.isArray(results.all) && results.all.length) {
      items = results.all.map((item) => mapItem(item, item.section));
    } else {
      items = Object.entries(results).flatMap(([group, list]) => {
        if (group === "all" || !Array.isArray(list)) return [];
        return list.map((item) => mapItem(item, group));
      });
    }
    return items.filter((item) => {
      const group = item.group || item.section;
      if (group === "conversations" && !canOpenMessages) return false;
      if (String(item.link || "").startsWith("/messages") && !canOpenMessages) return false;
      return true;
    });
  }, [results, canOpenMessages]);

  const preview = flat.slice(0, 12);

  return (
    <div className="globalSearchWrap" style={{ position: "relative", marginRight: 8 }}>
      <input
        type="search"
        placeholder="Search whole system…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => trimmed.length >= 2 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        aria-label="Global search"
        style={{
          minWidth: 200,
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid rgba(148,163,184,0.35)",
          background: "rgba(15,23,42,0.5)",
          color: "#e2e8f0",
          fontSize: 13,
        }}
      />
      {open && trimmed.length >= 2 && !busy ? (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            minWidth: 320,
            maxHeight: 360,
            overflow: "auto",
            background: "#0f172a",
            border: "1px solid rgba(56,189,248,0.25)",
            borderRadius: 8,
            zIndex: 50,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          {error ? (
            <div style={{ padding: "10px 12px", fontSize: 13, color: "#fca5a5" }}>{error}</div>
          ) : null}
          {!error && preview.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 13 }} className="muted">
              No results for &ldquo;{trimmed}&rdquo;
            </div>
          ) : null}
          {preview.map((item) => (
            <Link
              key={`${item.group}-${item.id}`}
              to={item.link}
              style={{
                display: "block",
                padding: "10px 12px",
                borderBottom: "1px solid rgba(148,163,184,0.15)",
                fontSize: 13,
              }}
            >
              <strong>{item.title}</strong>
              {item.subtitle ? (
                <div className="muted" style={{ fontSize: 11 }}>
                  {item.subtitle}
                </div>
              ) : null}
              <div className="muted" style={{ fontSize: 11 }}>
                {item.groupLabel} · {item.status || item.type}
              </div>
            </Link>
          ))}
          {!error && total > preview.length ? (
            <Link
              to={`/search?q=${encodeURIComponent(trimmed)}`}
              style={{ display: "block", padding: "10px 12px", fontSize: 12, fontWeight: 700 }}
            >
              View all {total} results
            </Link>
          ) : null}
          {!error && preview.length > 0 && total <= preview.length ? (
            <Link
              to={`/search?q=${encodeURIComponent(trimmed)}`}
              style={{ display: "block", padding: "10px 12px", fontSize: 12, fontWeight: 700 }}
            >
              Open full search
            </Link>
          ) : null}
        </div>
      ) : null}
      {busy ? <span style={{ fontSize: 10, marginLeft: 4 }}>…</span> : null}
    </div>
  );
}
