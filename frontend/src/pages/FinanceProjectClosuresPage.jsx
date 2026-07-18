import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as projectApi from "../services/projectApi";
import { PageHeader } from "../components/PageHeader";

/** Finance-only project closure — no general project workflow / team / progress. */
export function FinanceProjectClosuresPage() {
  const { id } = useParams();
  if (id) return <FinanceClosureDetail id={id} />;
  return <FinanceClosureList />;
}

function FinanceClosureList() {
  const { accessToken } = useAuth();
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    projectApi
      .listProjects(accessToken)
      .then((res) => setProjects(res.projects || []))
      .catch((e) => setError(e?.response?.data?.message || "Failed to load closure queue"));
  }, [accessToken]);

  const awaiting = useMemo(
    () => (projects || []).filter((p) => p.closure?.status === "director_approved"),
    [projects]
  );
  const cleared = useMemo(
    () => (projects || []).filter((p) => ["finance_approved", "archived"].includes(p.closure?.status)),
    [projects]
  );

  return (
    <div>
      <PageHeader
        title="Project closure (Finance)"
        subtitle="Kaliya clearance-ka lacagta ee closure — ma arki kartid xogta guud ee project-ka."
        stats={[
          { label: "Awaiting finance clearance", value: awaiting.length, accent: "#38bdf8" },
          { label: "Finance cleared", value: cleared.length },
        ]}
        actions={
          <Link className="btn" to="/finance/reviews">
            Finance review (Proposals)
          </Link>
        }
      />

      {error ? <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginTop: 12 }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Awaiting finance clearance</div>
        {awaiting.length === 0 ? (
          <div className="muted">No projects waiting for finance closure approval.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {awaiting.map((p) => (
              <div key={p.id} className="card" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{p.title}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Closure: {p.closure?.status}
                    {p.isVoluntary ? " • Voluntary (no finance expected)" : " • Grant-funded"}
                    {p.principalInvestigator?.fullName ? ` • PI: ${p.principalInvestigator.fullName}` : ""}
                  </div>
                </div>
                <Link className="btn primary" to={`/finance/closures/${p.id}`}>
                  Review clearance
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
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await projectApi.getProject(accessToken, id);
    setProject(res.project || null);
  }, [accessToken, id]);

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load closure"));
  }, [load]);

  async function approve() {
    if (busy) return;
    if (!window.confirm("Confirm finance clearance for this project closure? This does not open the full project record.")) return;
    const comment = window.prompt("Finance clearance note (optional):") || "Finance cleared";
    setBusy(true);
    setError("");
    try {
      await projectApi.financeClosureApproval(accessToken, id, comment);
      setMessage("Finance closure approved.");
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Finance closure approval failed");
    } finally {
      setBusy(false);
    }
  }

  if (!project && !error) return <p className="muted">Loading finance closure…</p>;

  const checklist = project?.closure?.checklist || {};
  const canApprove = project?.closure?.status === "director_approved" && !project?.isVoluntary;

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
            <button type="button" className="btn primary" style={{ marginTop: 16 }} disabled={busy} onClick={approve}>
              {busy ? "Saving…" : "Finance approve closure"}
            </button>
          ) : project.closure?.status === "finance_approved" || project.closure?.status === "archived" ? (
            <div className="muted" style={{ marginTop: 16 }}>Already finance-cleared.</div>
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
