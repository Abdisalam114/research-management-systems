import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { useScrollToTop } from "../hooks/useScrollToTop";
import * as projectApi from "../services/projectApi";
import { PageHeader } from "../components/PageHeader";
import { useUrlStatFilter } from "../hooks/useUrlStatFilter";

/** Finance-only project closure — no general project workflow / team / progress. */
export function FinanceProjectClosuresPage() {
  const { id } = useParams();
  if (id) return <FinanceClosureDetail id={id} />;
  return <FinanceClosureList />;
}

function FinanceClosureList() {
  const { accessToken } = useAuth();
  const { programTier } = useProgramTier();
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useUrlStatFilter("awaiting", ["awaiting", "cleared"]);

  useEffect(() => {
    projectApi
      .listProjects(accessToken)
      .then((res) => setProjects(res.projects || []))
      .catch((e) => setError(e?.response?.data?.message || "Failed to load closure queue"));
  }, [accessToken, programTier]);

  const awaiting = useMemo(
    () => (projects || []).filter((p) => p.closure?.status === "director_approved"),
    [projects]
  );
  const cleared = useMemo(
    () => (projects || []).filter((p) => ["finance_approved", "archived"].includes(p.closure?.status)),
    [projects]
  );

  const visible = tab === "awaiting" ? awaiting : cleared;

  const stats = useMemo(
    () => [
      {
        label: "Awaiting finance clearance",
        value: awaiting.length,
        filterKey: "awaiting",
        accent: "#38bdf8",
      },
      {
        label: "Finance cleared",
        value: cleared.length,
        filterKey: "cleared",
        accent: "#16a34a",
      },
    ],
    [awaiting.length, cleared.length]
  );


  return (
    <div>
      <PageHeader
        title="Project closure (Finance)"
        subtitle="Kaliya clearance-ka lacagta ee closure — taabo card si aad u aragto liiska."
        stats={stats}
        activeFilter={tab}
        onFilterChange={(key) => {
          if (key === "cleared" || key === "awaiting") setTab(key);
        }}
        disableFilterToggle
        actions={
          <Link className="btn" to="/finance/reviews">
            Finance review (Proposals)
          </Link>
        }
      />

      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginTop: 12 }}>
          {error}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>
          {tab === "awaiting" ? "Awaiting finance clearance" : "Finance cleared"}
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 12 }}>
          {tab === "awaiting"
            ? "Projects Director approved — review and clear finance to close the project."
            : "Projects already finance-cleared and closed."}
        </p>

        {visible.length === 0 ? (
          <div className="muted">
            {tab === "awaiting"
              ? "No projects waiting. They appear here after Director approves closure."
              : "No cleared closures yet."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {visible.map((p) => (
              <div
                key={p.id}
                className="card"
                style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{p.title}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Closure: {p.closure?.status}
                    {p.isVoluntary ? " • Voluntary" : " • Grant-funded"}
                    {p.principalInvestigator?.fullName ? ` • PI: ${p.principalInvestigator.fullName}` : ""}
                  </div>
                </div>
                <Link
                  className={tab === "awaiting" ? "btn primary" : "btn"}
                  to={`/finance/closures/${p.id}`}
                >
                  {tab === "awaiting" ? "Review clearance" : "View"}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FinanceClosureDetail({ id }) {
  const { accessToken } = useAuth();
  const { programTier } = useProgramTier();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("Finance cleared");

  useScrollToTop([id, project?.id]);

  const load = useCallback(async () => {
    const res = await projectApi.getProject(accessToken, id);
    setProject(res.project || null);
  }, [accessToken, id, programTier]);

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load closure"));
  }, [load]);

  async function approve() {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await projectApi.financeClosureApproval(accessToken, id, note.trim() || "Finance cleared");
      setMessage("Finance cleared — project closed automatically.");
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Finance closure approval failed");
    } finally {
      setBusy(false);
    }
  }

  if (!project && !error) return <p className="muted">Loading finance closure…</p>;

  const checklist = project?.closure?.checklist || {};
  // Director-approved grant closures are actionable. Voluntary never reach this queue.
  const canApprove = project?.closure?.status === "director_approved";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ marginTop: 0 }}>Finance closure clearance</h2>
        <button type="button" className="btn" onClick={() => navigate("/finance/closures")}>
          Back to closure queue
        </button>
      </div>

      <p className="muted" style={{ fontSize: 13 }}>
        View limited to finance clearance only — general project data is hidden.
      </p>

      {error ? <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginTop: 12 }}>{error}</div> : null}
      {message ? <div className="card" style={{ borderColor: "rgba(45,212,191,0.35)", marginTop: 12 }}>{message}</div> : null}

      {project ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{project.title}</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Project status: {project.status} • Closure: <strong>{project.closure?.status || "none"}</strong>
            {project.isVoluntary ? " • Voluntary" : " • Grant-funded"}
          </div>
          {project.principalInvestigator?.fullName ? (
            <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              PI: {project.principalInvestigator.fullName}
              {project.principalInvestigator.department ? ` (${project.principalInvestigator.department})` : ""}
            </div>
          ) : null}

          <div style={{ marginTop: 14, fontWeight: 700 }}>Finance checklist</div>
          <ul style={{ marginTop: 8, paddingLeft: 18 }}>
            <li>Financial cleared: {checklist.financialCleared ? "Yes" : "No / pending"}</li>
            <li>Assets handed over: {checklist.assetsHandedOver ? "Yes" : "—"}</li>
            <li>Data archived: {checklist.dataArchived ? "Yes" : "—"}</li>
          </ul>

          {project.closure?.finalReport ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Closure note (excerpt)</div>
              <div className="muted" style={{ whiteSpace: "pre-wrap", fontSize: 13, maxHeight: 160, overflow: "auto" }}>
                {String(project.closure.finalReport).slice(0, 800)}
                {String(project.closure.finalReport).length > 800 ? "…" : ""}
              </div>
            </div>
          ) : null}

          {project.budgetSummary ? (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 8, border: "1px solid rgba(56,189,248,0.35)" }}>
              <div style={{ fontWeight: 700 }}>Linked budget (finance)</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Allocated: {project.budgetSummary.currency} {Number(project.budgetSummary.totalAllocated || 0).toLocaleString()}
                {" · "}
                Paid: {project.budgetSummary.currency} {Number(project.budgetSummary.totalDisbursed || 0).toLocaleString()}
                {" · "}
                Remaining: {project.budgetSummary.currency}{" "}
                {Number(project.budgetSummary.remainingBalance ?? 0).toLocaleString()}
              </div>
            </div>
          ) : null}

          {canApprove ? (
            <div style={{ marginTop: 16, display: "grid", gap: 10, maxWidth: 480 }}>
              <label style={{ fontWeight: 700, fontSize: 13 }}>
                Clearance note
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 6 }}
                  placeholder="Finance cleared"
                />
              </label>
              <button type="button" className="btn primary" disabled={busy} onClick={approve}>
                {busy ? "Saving…" : "Finance approve closure"}
              </button>
            </div>
          ) : project.closure?.status === "finance_approved" || project.closure?.status === "archived" ? (
            <div className="muted" style={{ marginTop: 16 }}>Already finance-cleared.</div>
          ) : project.closure?.status === "submitted" ? (
            <div className="muted" style={{ marginTop: 16 }}>
              Waiting for Research Director to approve closure before Finance can clear.
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 16 }}>
              Not ready for finance clearance (needs director-approved closure on a grant-funded project).
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
