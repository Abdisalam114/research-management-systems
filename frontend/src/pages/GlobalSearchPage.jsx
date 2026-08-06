import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import * as searchApi from "../services/searchApi";
import { PageHeader } from "../components/PageHeader";

const SECTIONS = [
  { key: "proposals", label: "Proposals" },
  { key: "projects", label: "Projects" },
  { key: "grants", label: "Grants" },
  { key: "publications", label: "Publications & outputs" },
  { key: "fundingCalls", label: "Funding calls" },
  { key: "ethics", label: "Ethics (JUREC)" },
  { key: "thesisGroups", label: "Thesis groups" },
  { key: "researchGroups", label: "Research groups" },
  { key: "repository", label: "Repository" },
  { key: "budgets", label: "Budgets" },
  { key: "payments", label: "Payments" },
  { key: "policies", label: "Policies" },
  { key: "users", label: "Users" },
  { key: "departments", label: "Departments" },
  { key: "notifications", label: "Notifications" },
];

function sectionsForRole(role) {
  if (role === "leadership") {
    return SECTIONS.filter((s) =>
      ["proposals", "grants", "fundingCalls", "policies", "notifications"].includes(s.key)
    );
  }
  if (role === "researcher") {
    return SECTIONS.filter((s) => !["users", "departments"].includes(s.key));
  }
  if (role === "faculty_coordinator") {
    return SECTIONS.filter((s) => !["users", "departments", "budgets", "payments"].includes(s.key));
  }
  if (role === "finance_officer") {
    return SECTIONS.filter((s) =>
      ["grants", "fundingCalls", "budgets", "payments", "policies", "notifications"].includes(s.key)
    );
  }
  return SECTIONS;
}

export function GlobalSearchPage() {
  const { accessToken, user } = useAuth();
  const { programTier, programTierLabel } = useProgramTier();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const [q, setQ] = useState(initialQ);
  const [results, setResults] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  const visibleSections = useMemo(() => sectionsForRole(user?.role), [user?.role]);

  useEffect(() => {
    setResults(null);
    setTotal(0);
    setError("");
    setSearched(false);
  }, [programTier]);

  useEffect(() => {
    const urlQ = searchParams.get("q") || "";
    setQ(urlQ);
    if (urlQ.trim().length >= 2 && accessToken) {
      runSearch(urlQ.trim(), { syncUrl: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("q"), accessToken, programTier]);

  async function runSearch(queryText, { syncUrl = true } = {}) {
    const term = String(queryText || q).trim();
    if (term.length < 2) {
      setError("Type at least 2 characters");
      return;
    }
    setBusy(true);
    setError("");
    setSearched(true);
    if (syncUrl) {
      setSearchParams(term ? { q: term } : {}, { replace: true });
    }
    try {
      const res = await searchApi.globalSearch(accessToken, term);
      setResults(res.results || {});
      setTotal(Number(res.total) || 0);
    } catch (err) {
      setError(err?.response?.data?.message || "Search failed");
      setResults(null);
      setTotal(0);
    } finally {
      setBusy(false);
    }
  }

  const hasAnyResults =
    results &&
    visibleSections.some(({ key }) => Array.isArray(results[key]) && results[key].length > 0);

  return (
    <div className="pageStack">
      <PageHeader
        title="Global search"
        subtitle={`Search across the whole ${programTierLabel} portal — proposals, projects, ethics, thesis, finance, policies, and more`}
      />
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(q);
        }}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      >
        <input
          style={{ flex: "1 1 240px" }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search titles, names, departments, DOI, ethics, thesis…"
          aria-label="Search query"
        />
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>
      {error ? <div className="bannerErr">{error}</div> : null}
      {searched && !busy && !error && !hasAnyResults ? (
        <div className="card muted">No results found for &ldquo;{q.trim()}&rdquo;.</div>
      ) : null}
      {hasAnyResults ? (
        <p className="muted" style={{ fontSize: 13 }}>
          {total} result{total === 1 ? "" : "s"} for &ldquo;{q.trim()}&rdquo;
        </p>
      ) : null}
      {results ? (
        <div style={{ display: "grid", gap: 12 }}>
          {visibleSections.map(({ key, label }) => {
            const items = results[key] || [];
            if (!items.length) return null;
            return (
              <div key={key} className="card">
                <div style={{ fontWeight: 800, marginBottom: 8 }}>{label}</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {items.map((item) => (
                    <li key={`${key}-${item.id}`} style={{ marginBottom: 6 }}>
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
