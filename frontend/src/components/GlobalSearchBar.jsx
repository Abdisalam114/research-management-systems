import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as searchApi from "../services/searchApi";

export function GlobalSearchBar() {
  const { accessToken } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await searchApi.globalSearch(accessToken, q.trim());
        setResults(res.results || {});
        setOpen(true);
      } catch {
        setResults(null);
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [q, accessToken]);

  const flat = results
    ? Object.entries(results).flatMap(([group, items]) =>
        (items || []).map((item) => ({ ...item, group }))
      )
    : [];

  return (
    <div className="globalSearchWrap" style={{ position: "relative", marginRight: 8 }}>
      <input
        type="search"
        placeholder="Search system…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q.length >= 2 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        style={{
          minWidth: 180,
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid rgba(148,163,184,0.35)",
          background: "rgba(15,23,42,0.5)",
          color: "#e2e8f0",
          fontSize: 13,
        }}
      />
      {open && flat.length > 0 ? (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            minWidth: 280,
            maxHeight: 320,
            overflow: "auto",
            background: "#0f172a",
            border: "1px solid rgba(56,189,248,0.25)",
            borderRadius: 8,
            zIndex: 50,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          {flat.slice(0, 12).map((item) => (
            <Link
              key={`${item.group}-${item.id}`}
              to={item.link}
              style={{ display: "block", padding: "10px 12px", borderBottom: "1px solid rgba(148,163,184,0.15)", fontSize: 13 }}
            >
              <strong>{item.title}</strong>
              <div className="muted" style={{ fontSize: 11 }}>{item.type} · {item.status || item.group}</div>
            </Link>
          ))}
        </div>
      ) : null}
      {busy ? <span style={{ fontSize: 10, marginLeft: 4 }}>…</span> : null}
    </div>
  );
}
