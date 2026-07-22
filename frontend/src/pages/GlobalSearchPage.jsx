import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import * as searchApi from "../services/searchApi";
import { PageHeader } from "../components/PageHeader";

const SECTIONS = [
  { key: "proposals", label: "Proposals" },
  { key: "projects", label: "Projects" },
  { key: "grants", label: "Grants" },
  { key: "publications", label: "Publications" },
  { key: "fundingCalls", label: "Funding calls" },
  { key: "repository", label: "Repository" },
];

export function GlobalSearchPage() {
  const { accessToken } = useAuth();
  const { programTier, programTierLabel } = useProgramTier();
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setResults(null);
    setError("");
  }, [programTier]);

  async function runSearch(e) {
    e?.preventDefault();
    if (q.trim().length < 2) {
      setError("Type at least 2 characters");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await searchApi.globalSearch(accessToken, q.trim());
      setResults(res.results || {});
    } catch (err) {
      setError(err?.response?.data?.message || "Search failed");
      setResults(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pageStack">
      <PageHeader title="Global search" subtitle={`Search proposals, projects, grants, publications, funding calls, and repository — ${programTierLabel} portal`} />
      <form className="card" onSubmit={runSearch} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          style={{ flex: "1 1 240px" }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title…"
        />
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>
      {error ? <div className="bannerErr">{error}</div> : null}
      {results ? (
        <div style={{ display: "grid", gap: 12 }}>
          {SECTIONS.map(({ key, label }) => {
            const items = results[key] || [];
            if (!items.length) return null;
            return (
              <div key={key} className="card">
                <div style={{ fontWeight: 800, marginBottom: 8 }}>{label}</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {items.map((item) => (
                    <li key={item.id} style={{ marginBottom: 6 }}>
                      <Link to={item.link}>{item.title}</Link>
                      <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                        {item.status || item.type}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
