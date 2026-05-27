import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as proposalApi from "../services/proposalApi";
import * as ethicsApi from "../services/ethicsApi";
import { ProposalEthicsReviewPanel } from "../components/ProposalEthicsReviewPanel";
import { apiOrigin } from "../config/apiBase";

export function ProposalReviewPage() {
  const { id } = useParams();
  const { accessToken, user } = useAuth();
  const [proposal, setProposal] = useState(null);
  const [ethics, setEthics] = useState(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isCoordinator = user?.role === "faculty_coordinator";
  const isDirector = user?.role === "research_director";

  const actions = useMemo(() => {
    if (isCoordinator) {
      return [
        { id: "recommend_revision", label: "Recommend Revision" },
        { id: "recommend_approval", label: "Recommend Approval" },
      ];
    }
    if (isDirector) {
      return [
        { id: "approved", label: "Approve proposal (creates project)" },
        { id: "revision_requested", label: "Request Revision" },
        { id: "rejected", label: "Reject" },
      ];
    }
    return [];
  }, [isCoordinator, isDirector]);

  const [selected, setSelected] = useState(actions[0]?.id || "");

  async function load() {
    setError("");
    const res = await proposalApi.getProposal(accessToken, id);
    setProposal(res.proposal);
    if (res.proposal?.requiresEthics) {
      const eth = await proposalApi.getProposalEthicsApplication(accessToken, id);
      setEthics(eth.application);
    } else {
      setEthics(null);
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load proposal"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setSelected((prev) => prev || actions[0]?.id || "");
  }, [actions]);

  async function approveEthics() {
    if (!ethics?.id) return;
    const y = new Date().getFullYear();
    const defaultAcademic = `${y}/${y + 1}`;
    const academicYear = window.prompt("Academic year (certificate):", defaultAcademic) || defaultAcademic;
    const year = window.prompt("Year (certificate):", String(y)) || String(y);
    const serialNumber = window.prompt("Serial number (optional):") || undefined;
    setBusy(true);
    setError("");
    try {
      await ethicsApi.directorDecision(accessToken, ethics.id, {
        decision: "approve",
        academicYear,
        year,
        serialNumber,
      });
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Ethics approval failed");
    } finally {
      setBusy(false);
    }
  }

  async function rejectEthics() {
    if (!ethics?.id) return;
    const rejectionReason = window.prompt("Rejection reason for ethics?") || "Rejected";
    setBusy(true);
    setError("");
    try {
      await ethicsApi.directorDecision(accessToken, ethics.id, { decision: "reject", rejectionReason });
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Ethics rejection failed");
    } finally {
      setBusy(false);
    }
  }

  if (!proposal) return <div style={{ padding: 8 }}>{error ? error : "Loading..."}</div>;

  const ethicsApproved = !proposal.requiresEthics || proposal.ethicsStatus === "approved" || ethics?.status === "approved";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>Director review — Proposal + Ethics</h2>
        <Link className="btn" to={`/proposals/${id}`}>
          Back to details
        </Link>
      </div>

      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)" }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 12, borderColor: "rgba(14,165,233,0.25)" }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{proposal.title}</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Proposal status: <strong>{proposal.status}</strong> • v{proposal.version}
          {proposal.requiresEthics ? (
            <>
              {" "}
              • Ethics: <strong>{ethics?.status || proposal.ethicsStatus || "—"}</strong>
            </>
          ) : null}
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <div>
            <span className="muted">Department:</span> {proposal.department}
          </div>
          <div>
            <span className="muted">Research area:</span> {proposal.researchArea}
          </div>
          <div>
            <span className="muted">Abstract:</span>
            <div style={{ marginTop: 4 }}>{proposal.abstract}</div>
          </div>
          <div>
            <span className="muted">Document:</span>{" "}
            {proposal.document ? (
              <a href={`${apiOrigin()}${proposal.document}`} target="_blank" rel="noreferrer">
                View proposal document
              </a>
            ) : (
              "—"
            )}
          </div>
        </div>
      </div>

      {proposal.requiresEthics ? (
        <ProposalEthicsReviewPanel
          ethics={ethics}
          isDirector={isDirector}
          onApproveEthics={approveEthics}
          onRejectEthics={rejectEthics}
          busy={busy}
        />
      ) : null}

      {(isCoordinator || isDirector) && ["submitted", "under_review", "revision_requested"].includes(proposal.status) ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            {isDirector ? "Proposal decision" : "Coordinator recommendation"}
          </div>
          {isDirector && proposal.requiresEthics && !ethicsApproved ? (
            <div className="muted" style={{ marginBottom: 10, fontSize: 13 }}>
              Approve the ethics application above first, then approve the proposal to create the project.
            </div>
          ) : null}

          <div className="field">
            <label>Action</label>
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              {actions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Comment</label>
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write review notes..." />
          </div>

          <button
            className="btn primary"
            disabled={
              busy ||
              !selected ||
              !comment.trim() ||
              (isDirector && selected === "approved" && proposal.requiresEthics && !ethicsApproved)
            }
            title={
              isDirector && selected === "approved" && !ethicsApproved
                ? "Approve ethics first"
                : undefined
            }
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                if (isCoordinator) {
                  await proposalApi.coordinatorReview(accessToken, id, selected, comment.trim());
                } else if (isDirector) {
                  await proposalApi.directorDecision(accessToken, id, selected, comment.trim());
                }
                setComment("");
                await load();
              } catch (e) {
                setError(e?.response?.data?.message || "Action failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving..." : "Submit decision"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
