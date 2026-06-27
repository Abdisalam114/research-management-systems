import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModuleLoad } from "../hooks/useModuleLoad";
import * as grantApi from "../services/grantApi";
import * as projectApi from "../services/projectApi";
import { PageHeader } from "../components/PageHeader";
import { GrantAwardModal } from "../components/GrantAwardModal";

function formatMoney(n) {
  const num = Number(n || 0);
  return Number.isFinite(num) ? num.toLocaleString() : "0";
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function statusLabel(status) {
  const labels = {
    draft: "Draft",
    submitted: "Submitted — awaiting review",
    approved: "Approved",
    rejected: "Rejected",
    active: "Active (awarded)",
    closed: "Closed",
  };
  return labels[status] || status;
}

export function GrantDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const [grant, setGrant] = useState(null);
  const [projects, setProjects] = useState([]);
  const [linkProjectId, setLinkProjectId] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [awardOpen, setAwardOpen] = useState(false);
  const [awardBusy, setAwardBusy] = useState(false);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [message, setMessage] = useState("");

  const isDirector = user?.role === "research_director";
  const isOwner = grant && String(grant.researcherId) === String(user?.id);
  const canEditLink = isOwner && ["draft", "rejected"].includes(grant?.status || "");
  const canDecide = isDirector && grant?.status === "submitted";

  const load = useCallback(async () => {
    const res = await grantApi.getGrant(accessToken, id);
    const g = res.grant || null;
    setGrant(g);
    setLinkProjectId(g?.projectId || g?.project?.id || "");
    if (user?.role === "researcher") {
      const projRes = await projectApi.listProjects(accessToken).catch(() => ({ projects: [] }));
      setProjects(projRes.projects || []);
    }
  }, [accessToken, id, user?.role]);

  const { loading, error, setError, reload } = useModuleLoad(accessToken, load, [id]);

  async function handleAwardConfirm(amountAwarded) {
    if (!grant) return;
    try {
      setAwardBusy(true);
      setError("");
      const res = await grantApi.directorDecision(accessToken, grant.id, {
        decision: "approved",
        amountAwarded,
      });
      setAwardOpen(false);
      if (res?.budget?.created) {
        setMessage("Grant approved. A budget was created for the researcher — see Budgets.");
      }
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to approve grant");
    } finally {
      setAwardBusy(false);
    }
  }

  async function handleLinkProject() {
    if (!grant || !linkProjectId) {
      setError("Select a research project to link");
      return;
    }
    try {
      setLinkBusy(true);
      setError("");
      await grantApi.updateGrant(accessToken, grant.id, { projectId: linkProjectId });
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to link project");
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleReject() {
    if (!grant) return;
    const ok = window.confirm("Reject this grant request?");
    if (!ok) return;
    try {
      setRejectBusy(true);
      setError("");
      await grantApi.directorDecision(accessToken, grant.id, { decision: "rejected" });
      await reload();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to reject grant");
    } finally {
      setRejectBusy(false);
    }
  }

  const currency = grant?.currency || "USD";
  const researcher = grant?.researcher;

  return (
    <div>
      <PageHeader
        title="Grant — Review details"
        subtitle={
          canDecide
            ? "Review all information below before approving or rejecting."
            : "Full details for this grant / award request."
        }
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn" to="/grants">
              ← Back to grants
            </Link>
            {canDecide ? (
              <>
                <button type="button" className="btn primary" onClick={() => setAwardOpen(true)} disabled={awardBusy || rejectBusy}>
                  Approve
                </button>
                <button type="button" className="btn" onClick={handleReject} disabled={awardBusy || rejectBusy}>
                  {rejectBusy ? "Rejecting…" : "Reject"}
                </button>
              </>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div className="card" style={{ borderColor: "rgba(255,99,132,0.55)", marginTop: 12 }}>
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="card" style={{ borderColor: "rgba(45,212,191,0.35)", marginTop: 12 }}>
          {message}
        </div>
      ) : null}

      {loading ? <div className="muted" style={{ marginTop: 12 }}>Loading…</div> : null}

      {!loading && !grant ? <div className="muted" style={{ marginTop: 12 }}>Grant not found.</div> : null}

      {grant ? (
        <>
          {canDecide ? (
            <div
              className="card"
              style={{
                marginTop: 12,
                borderColor: "rgba(59,130,246,0.45)",
                background: "rgba(59,130,246,0.08)",
              }}
            >
              <div style={{ fontWeight: 800 }}>Director review</div>
              <p className="muted" style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5 }}>
                This grant is waiting for your decision. Review the researcher profile, funding request, and linked
                project below, then choose Approve or Reject.
              </p>
            </div>
          ) : null}

          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{grant.title}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Status: <strong>{statusLabel(grant.status)}</strong>
            </div>

            <hr style={{ border: 0, borderTop: "1px solid rgba(255,255,255,0.10)", margin: "14px 0" }} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Funding source</div>
                <div style={{ fontWeight: 700 }}>{grant.fundingSource || "—"}</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Donor reference</div>
                <div style={{ fontWeight: 700 }}>{grant.donorRef || "—"}</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Amount requested</div>
                <div style={{ fontWeight: 900, fontSize: 17 }}>
                  {formatMoney(grant.amountRequested)} {currency}
                </div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Amount awarded</div>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 17,
                    color: Number(grant.amountAwarded || 0) > 0 ? "#38bdf8" : "#fbbf24",
                  }}
                >
                  {Number(grant.amountAwarded || 0) > 0
                    ? `${formatMoney(grant.amountAwarded)} ${currency}`
                    : "Pending — not awarded yet"}
                </div>
              </div>
            </div>

            <div
              className="muted"
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 14, fontSize: 12 }}
            >
              <div>Created: {formatDate(grant.createdAt)}</div>
              <div>Submitted: {formatDate(grant.submittedAt)}</div>
              <div>Decided: {formatDate(grant.decidedAt)}</div>
              <div>Last updated: {formatDate(grant.updatedAt)}</div>
            </div>

            {grant.complianceNotes ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Compliance / notes</div>
                <div className="muted" style={{ whiteSpace: "pre-wrap" }}>
                  {grant.complianceNotes}
                </div>
              </div>
            ) : null}
          </div>

          {researcher ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Researcher (applicant)</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Full name</div>
                  <div style={{ fontWeight: 700 }}>{researcher.fullName}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Email</div>
                  <div style={{ fontWeight: 700 }}>{researcher.email}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Department</div>
                  <div style={{ fontWeight: 700 }}>{researcher.department || "—"}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Rank</div>
                  <div style={{ fontWeight: 700 }}>{researcher.rank || "—"}</div>
                </div>
              </div>
              {researcher.researchInterests ? (
                <div style={{ marginTop: 12 }}>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Research interests</div>
                  <div style={{ marginTop: 4 }}>{researcher.researchInterests}</div>
                </div>
              ) : null}
            </div>
          ) : null}

          {grant.project ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Linked project</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Title</div>
                  <div style={{ fontWeight: 700 }}>{grant.project.title}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Status</div>
                  <div style={{ fontWeight: 700 }}>{grant.project.status}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>Start</div>
                  <div style={{ fontWeight: 700 }}>{formatDate(grant.project.startDate)}</div>
                </div>
                <div>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>End</div>
                  <div style={{ fontWeight: 700 }}>{formatDate(grant.project.endDate)}</div>
                </div>
              </div>
              <Link className="btn" to={`/projects/${grant.project.id}`} style={{ marginTop: 12, display: "inline-block" }}>
                Open project
              </Link>
            </div>
          ) : canEditLink ? (
            <div className="card" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 10 }}>Link research project</div>
              <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                This grant must be linked to your research project before you can submit it.
              </p>
              <div className="row">
                <div className="field" style={{ flex: 2 }}>
                  <label>Your project</label>
                  <select value={linkProjectId} onChange={(e) => setLinkProjectId(e.target.value)}>
                    <option value="">— Select project —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="button" className="btn primary" style={{ marginTop: 10 }} onClick={handleLinkProject} disabled={linkBusy}>
                {linkBusy ? "Saving…" : "Save project link"}
              </button>
            </div>
          ) : (
            <div className="card" style={{ marginTop: 12, fontSize: 13, borderColor: "rgba(251,191,36,0.35)" }}>
              <div style={{ fontWeight: 800 }}>No linked research project</div>
              <p className="muted" style={{ margin: "6px 0 0" }}>
                This grant is not connected to a research project yet.
              </p>
            </div>
          )}

          {canDecide ? (
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <button type="button" className="btn primary" onClick={() => setAwardOpen(true)} disabled={awardBusy || rejectBusy}>
                Approve grant
              </button>
              <button type="button" className="btn" onClick={handleReject} disabled={awardBusy || rejectBusy}>
                {rejectBusy ? "Rejecting…" : "Reject grant"}
              </button>
              <button type="button" className="btn" onClick={() => navigate("/grants")}>
                Back to list
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      <GrantAwardModal
        open={awardOpen}
        grant={grant}
        busy={awardBusy}
        onClose={() => {
          if (!awardBusy) setAwardOpen(false);
        }}
        onConfirm={handleAwardConfirm}
      />
    </div>
  );
}
