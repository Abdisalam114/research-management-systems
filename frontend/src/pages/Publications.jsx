import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as publicationApi from "../services/publicationApi";
import { PageHeader } from "../components/PageHeader";

export function PublicationsPage() {
  const { accessToken, user } = useAuth();
  const [publications, setPublications] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "paper",
    year: new Date().getFullYear(),
    doi: "",
    orcid: "",
    communityImpact: "",
  });

  const canCreate = user?.role === "researcher";
  const canValidate = ["faculty_coordinator", "research_director"].includes(user?.role);

  const load = useCallback(async () => {
    const res = await publicationApi.listPublications(accessToken);
    setPublications(res.publications || []);
  }, [accessToken]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load);

  const stats = useMemo(() => {
    const by = (s) => publications.filter((p) => p.status === s).length;
    const totalCitations = publications.reduce((acc, p) => acc + Number(p.citationCount || 0), 0);
    return [
      { label: "Total", value: publications.length },
      { label: "Draft", value: by("draft") },
      { label: "Submitted", value: by("submitted"), accent: "#38bdf8" },
      { label: "Validated", value: by("validated"), accent: "#1d4ed8" },
      { label: "Citations", value: totalCitations.toLocaleString(), accent: "#7dd3fc" },
    ];
  }, [publications]);

  return (
    <div>
      <PageHeader
        title="Publications & Outputs"
        subtitle="Journal articles • Conference papers • Books • Patents • Theses • Community impact."
        stats={stats}
        actions={
          <>
            {canCreate ? (
              <button type="button" className="btn primary" onClick={() => setShowForm((v) => !v)}>
                {showForm ? "Close form" : "+ New publication"}
              </button>
            ) : null}
          </>
        }
      />
      {loading ? <p className="muted">Loading publications…</p> : null}
      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)" }}>
          {error}
        </div>
      ) : null}

      {canCreate && showForm ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800 }}>New Publication</div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <div className="field">
              <label>Title</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="row">
              <div className="field">
                <label>Type</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  <option value="journal_article">Journal article</option>
                  <option value="paper">Paper</option>
                  <option value="conference">Conference paper</option>
                  <option value="book">Book</option>
                  <option value="book_chapter">Book chapter</option>
                  <option value="patent">Patent</option>
                  <option value="thesis">Thesis</option>
                  <option value="review">Review</option>
                  <option value="case_study">Case study</option>
                  <option value="letter_to_editor">Letter to editor</option>
                </select>
              </div>
              <div className="field">
                <label>Year</label>
                <input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))} />
              </div>
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
              <label>Community / research impact</label>
              <textarea
                rows={2}
                value={form.communityImpact}
                onChange={(e) => setForm((f) => ({ ...f, communityImpact: e.target.value }))}
                placeholder="e.g. piloted in 3 local clinics, policy brief shared with the Ministry of Health"
              />
            </div>
            <button
              className="btn primary"
              onClick={async () => {
                try {
                  setError("");
                  await publicationApi.createPublication(accessToken, form);
                  setForm({
                    title: "",
                    type: "paper",
                    year: new Date().getFullYear(),
                    doi: "",
                    orcid: "",
                    communityImpact: "",
                  });
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
        <div style={{ fontWeight: 800 }}>Publications</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {publications.map((p) => (
            <div key={p.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{p.title}</div>
                  <div className="muted">
                    {p.type} • {p.year} • {p.status}
                  </div>
                  {p.doi ? <div className="muted">DOI: {p.doi}</div> : null}
                  {p.orcid ? <div className="muted">ORCID: {p.orcid}</div> : null}
                  {typeof p.citationCount === "number" ? (
                    <div className="muted">Citations: <strong>{p.citationCount}</strong></div>
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
          {publications.length === 0 ? <div className="muted">No publications yet.</div> : null}
        </div>
      </div>
    </div>
  );
}

