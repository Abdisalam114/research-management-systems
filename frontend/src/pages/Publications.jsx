import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as publicationApi from "../services/publicationApi";
import { PageHeader } from "../components/PageHeader";
import { filterByStatKey, statFilterLabel } from "../utils/pageHeaderFilters";
import {
  OUTPUT_TRACKING_CATEGORIES,
  PUBLICATION_TYPE_OPTIONS,
  FORM_TYPE_GROUPS,
  countByTrackingCategory,
  matchesTrackingFilter,
  publicationTypeLabel,
} from "../constants/publicationTypes";
import { workflowStageMeta } from "../constants/facultyWorkflow";

const EMPTY_FORM = {
  title: "",
  type: "paper",
  year: new Date().getFullYear(),
  venue: "",
  doi: "",
  orcid: "",
  communityImpact: "",
};

export function PublicationsPage() {
  const { accessToken, user } = useAuth();
  const [publications, setPublications] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useUrlStatFilter("all");

  const canCreate = user?.role === "researcher";
  const canValidate = ["faculty_coordinator", "research_director"].includes(user?.role);

  const load = useCallback(async () => {
    const res = await publicationApi.listPublications(accessToken);
    setPublications(res.publications || []);
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  const trackingStats = useMemo(
    () =>
      OUTPUT_TRACKING_CATEGORIES.map((cat) => ({
        ...cat,
        count: countByTrackingCategory(publications, cat),
      })),
    [publications]
  );

  const filtered = useMemo(() => {
    let list = filterByStatKey(publications, statusFilter);
    return list.filter((p) => matchesTrackingFilter(p, typeFilter));
  }, [publications, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const by = (s) => publications.filter((p) => p.status === s).length;
    const totalCitations = publications.reduce((acc, p) => acc + Number(p.citationCount || 0), 0);
    return [
      { label: "Total outputs", value: publications.length, filterKey: "all" },
      { label: "Draft", value: by("draft"), filterKey: "draft" },
      { label: "Submitted", value: by("submitted"), filterKey: "submitted", accent: "#38bdf8" },
      { label: "Validated", value: by("validated"), filterKey: "validated", accent: "#1d4ed8" },
      { label: "Citations", value: totalCitations.toLocaleString(), accent: "#7dd3fc" },
    ];
  }, [publications]);

  const isCommunityType = form.type === "community_research_impact";

  return (
    <div>
      <PageHeader
        title="Publication & Output Tracking"
        subtitle="Papers • Conference • Review • Case studies • Letter to editor — plus journal articles, books, patents, thesis, and community impact."
        stats={stats}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        actions={
          canCreate ? (
            <button type="button" className="btn primary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Close form" : "+ New output"}
            </button>
          ) : null
        }
      />

      {statusFilter !== "all" ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Showing status: <strong>{statFilterLabel(stats, statusFilter)}</strong>
          {typeFilter !== "all" ? ` • type: ${OUTPUT_TRACKING_CATEGORIES.find((c) => c.id === typeFilter)?.label}` : ""}
        </p>
      ) : null}

      {loading ? <p className="muted">Loading publications…</p> : null}
      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>
          {error}
        </div>
      ) : null}

      <div className="overviewGrid pubCategoryGrid" style={{ marginTop: 12 }}>
        {trackingStats.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="overviewTile"
            style={{
              textAlign: "left",
              cursor: "pointer",
              borderColor: typeFilter === cat.id ? "rgba(56,189,248,0.55)" : undefined,
              background: typeFilter === cat.id ? "rgba(14,165,233,0.08)" : undefined,
            }}
            onClick={() => setTypeFilter((f) => (f === cat.id ? "all" : cat.id))}
          >
            <div className="label">
              {cat.icon} {cat.label}
            </div>
            <div className="value">{cat.count}</div>
          </button>
        ))}
      </div>

      {typeFilter !== "all" ? (
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 13 }}>
            Filter: {OUTPUT_TRACKING_CATEGORIES.find((c) => c.id === typeFilter)?.label}
          </span>
          <button type="button" className="btn" onClick={() => setTypeFilter("all")}>
            Show all
          </button>
        </div>
      ) : null}

      {canCreate && showForm ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>Register research output</div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <div className="field">
              <label>Title</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="row">
              <div className="field">
                <label>Output type</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  {FORM_TYPE_GROUPS.map((g) => (
                    <optgroup key={g.key} label={g.label}>
                      {PUBLICATION_TYPE_OPTIONS.filter((o) => o.group === g.key).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Year</label>
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="field">
              <label>Journal / conference / publisher / patent office</label>
              <input
                value={form.venue}
                onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                placeholder="e.g. BMC Public Health, IEEE ICRERA, Springer"
              />
            </div>
            <div className="row">
              <div className="field">
                <label>DOI</label>
                <input value={form.doi} onChange={(e) => setForm((f) => ({ ...f, doi: e.target.value }))} />
              </div>
              <div className="field">
                <label>ORCID</label>
                <input value={form.orcid} onChange={(e) => setForm((f) => ({ ...f, orcid: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label>
                {isCommunityType ? "Describe community / societal impact (required)" : "Community / research impact (optional)"}
              </label>
              <textarea
                rows={3}
                value={form.communityImpact}
                onChange={(e) => setForm((f) => ({ ...f, communityImpact: e.target.value }))}
                placeholder={
                  isCommunityType
                    ? "e.g. policy brief adopted by ministry, 500 farmers trained, clinic pilot in 3 districts"
                    : "Optional: local adoption, policy change, beneficiaries, outreach"
                }
              />
            </div>
            <button
              type="button"
              className="btn primary"
              onClick={async () => {
                try {
                  setError("");
                  if (isCommunityType && !form.communityImpact.trim()) {
                    setError("Community research impact description is required for this output type.");
                    return;
                  }
                  await publicationApi.createPublication(accessToken, form);
                  setForm(EMPTY_FORM);
                  setShowForm(false);
                  await reload();
                } catch (e) {
                  setError(e?.response?.data?.message || "Failed to create publication");
                }
              }}
            >
              Create
            </button>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800 }}>
          Outputs {typeFilter !== "all" ? `(${filtered.length})` : `(${publications.length})`}
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {filtered.map((p) => (
            <div key={p.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{p.title}</div>
                  <div className="muted">
                    {publicationTypeLabel(p.type)} • {p.year} • {p.status}
                    {p.venue ? ` • ${p.venue}` : ""}
                  </div>
                  {p.workflowStage ? (
                    <div style={{ fontSize: 12, marginTop: 4, color: workflowStageMeta(p.workflowStage).accent }}>
                      {workflowStageMeta(p.workflowStage).icon}{" "}
                      Faculty workflow: <strong>{p.workflowStageLabel || p.workflowStage}</strong>
                    </div>
                  ) : null}
                  {p.doi ? <div className="muted">DOI: {p.doi}</div> : null}
                  {p.orcid ? <div className="muted">ORCID: {p.orcid}</div> : null}
                  {typeof p.citationCount === "number" ? (
                    <div className="muted">
                      Citations: <strong>{p.citationCount}</strong>
                    </div>
                  ) : null}
                  {p.communityImpact ? (
                    <div className="muted" style={{ marginTop: 4 }}>
                      🌍 Community impact: {p.communityImpact}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {p.doi ? (
                    <button
                      type="button"
                      className="btn"
                      title="Look up citations via CrossRef"
                      onClick={async () => {
                        try {
                          setError("");
                          const res = await publicationApi.refreshCitations(accessToken, p.id);
                          if (res.source !== "crossref") {
                            setError(res.message);
                          }
                          await reload();
                        } catch (e) {
                          setError(e?.response?.data?.message || "Failed to refresh citations");
                        }
                      }}
                    >
                      Refresh citations
                    </button>
                  ) : null}
                  {canCreate && p.status === "draft" ? (
                    <button
                      type="button"
                      className="btn"
                      onClick={async () => {
                        try {
                          setError("");
                          await publicationApi.submitPublication(accessToken, p.id);
                          await reload();
                        } catch (e) {
                          setError(e?.response?.data?.message || "Failed to submit");
                        }
                      }}
                    >
                      Submit
                    </button>
                  ) : null}
                  {canValidate && p.status === "submitted" ? (
                    <>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={async () => {
                          const comment = prompt("Validation comment (required):");
                          if (!comment) return;
                          try {
                            setError("");
                            await publicationApi.validatePublication(accessToken, p.id, {
                              decision: "validated",
                              comment,
                            });
                            await reload();
                          } catch (e) {
                            setError(e?.response?.data?.message || "Failed to validate");
                          }
                        }}
                      >
                        Validate
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={async () => {
                          const comment = prompt("Rejection reason (required):");
                          if (!comment) return;
                          try {
                            setError("");
                            await publicationApi.validatePublication(accessToken, p.id, {
                              decision: "rejected",
                              comment,
                            });
                            await reload();
                          } catch (e) {
                            setError(e?.response?.data?.message || "Failed to reject");
                          }
                        }}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 ? (
            <div className="muted">
              {publications.length === 0
                ? "No outputs yet. Use + New output to register journal articles, conferences, books, patents, or community impact."
                : "No outputs in this category."}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
