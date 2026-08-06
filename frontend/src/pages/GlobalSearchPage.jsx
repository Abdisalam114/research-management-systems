import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import * as searchApi from "../services/searchApi";
import { PageHeader } from "../components/PageHeader";

const SECTION_META = {
  proposals: { label: "Proposals", accent: "#38bdf8" },
  projects: { label: "Projects", accent: "#34d399" },
  thesisGroups: { label: "Thesis", accent: "#a78bfa" },
  ethics: { label: "Ethics (JUREC)", accent: "#2dd4bf" },
  publications: { label: "Publications & outputs", accent: "#fbbf24" },
  grants: { label: "Grants", accent: "#eab308" },
  fundingCalls: { label: "Funding calls", accent: "#fb923c" },
  researchGroups: { label: "Research groups", accent: "#94a3b8" },
  repository: { label: "Repository", accent: "#64748b" },
  budgets: { label: "Budgets", accent: "#22c55e" },
  payments: { label: "Payments", accent: "#16a34a" },
  purchaseOrders: { label: "Purchase orders", accent: "#0ea5e9" },
  policies: { label: "Policies", accent: "#cbd5e1" },
  conversations: { label: "Messages", accent: "#818cf8" },
  notifications: { label: "Notifications", accent: "#f472b6" },
  users: { label: "Users", accent: "#e2e8f0" },
  departments: { label: "Departments", accent: "#94a3b8" },
  auditEvents: { label: "Audit trail", accent: "#78716c" },
};

const SECTION_ORDER = Object.keys(SECTION_META);

function sectionsForRole(role) {
  if (role === "leadership") {
    return SECTION_ORDER.filter((k) =>
      ["proposals", "grants", "fundingCalls", "policies", "notifications", "conversations"].includes(k)
    );
  }
  if (role === "researcher") {
    return SECTION_ORDER.filter((k) => !["users", "departments", "auditEvents"].includes(k));
  }
  if (role === "faculty_coordinator") {
    return SECTION_ORDER.filter((k) => !["users", "departments", "budgets", "payments", "purchaseOrders"].includes(k));
  }
  if (role === "finance_officer") {
    return SECTION_ORDER.filter((k) =>
      ["grants", "fundingCalls", "budgets", "payments", "purchaseOrders", "policies", "notifications", "conversations"].includes(k)
    );
  }
  return SECTION_ORDER;
}

function typeBadge(sectionKey) {
  return SECTION_META[sectionKey]?.label || sectionKey;
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

  const allResults = useMemo(() => {
    if (!results?.all?.length) {
      return visibleSections.flatMap((key) =>
        (results?.[key] || []).map((item) => ({ ...item, section: key }))
      );
    }
    return (results.all || []).filter((item) => visibleSections.includes(item.section));
  }, [results, visibleSections]);

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

  return (
    <div className="pageStack">
      <PageHeader
        title="Global search"
        subtitle={`One search across the whole ${programTierLabel} portal — proposals, projects, thesis titles, ethics, finance, messages, and more`}
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
          placeholder="Search thesis title, student name, proposal, project, DOI, ethics…"
          aria-label="Search query"
        />
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>
      {error ? <div className="bannerErr">{error}</div> : null}
      {searched && !busy && !error && allResults.length === 0 ? (
        <div className="card muted">
          No results found for &ldquo;{q.trim()}&rdquo;.
          <div style={{ marginTop: 8, fontSize: 13 }}>
            Hubi inaad portal sax dooratay: <strong>{programTierLabel}</strong> — thesis UG iyo PG waa kala duwan yihiin.
            Tusaale: &ldquo;green energy&rdquo; waa UG, &ldquo;research management system&rdquo; waa PG.
          </div>
        </div>
      ) : null}
      {allResults.length > 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>
          {total} result{total === 1 ? "" : "s"} for &ldquo;{q.trim()}&rdquo;
        </p>
      ) : null}
      {allResults.length > 0 ? (
        <div className="card">
          <div style={{ fontWeight: 800, marginBottom: 10 }}>All results</div>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 8 }}>
            {allResults.map((item) => (
              <li
                key={`${item.section}-${item.id}`}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "rgba(15,23,42,0.35)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Link to={item.link} style={{ fontWeight: 700 }}>
                      {item.title}
                    </Link>
                    {item.subtitle ? (
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                        {item.subtitle}
                      </div>
                    ) : null}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 6,
                      alignSelf: "flex-start",
                      background: `${SECTION_META[item.section]?.accent || "#64748b"}22`,
                      color: SECTION_META[item.section]?.accent || "#94a3b8",
                    }}
                  >
                    {typeBadge(item.section)}
                  </span>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {item.status || item.type}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
