import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import { useScrollToTop } from "../hooks/useScrollToTop";
import * as proposalApi from "../services/proposalApi";
import * as ethicsApi from "../services/ethicsApi";
import { ProposalEthicsReviewPanel } from "../components/ProposalEthicsReviewPanel";
import { EthicsDirectorDecisionModal } from "../components/EthicsDirectorDecisionModal";
import { ProposalMultiStageReview } from "../components/ProposalMultiStageReview";
import { StatusBadge } from "../components/StatusBadge";
import { openProtectedUpload } from "../utils/protectedFile";

export function ProposalReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const { programTier } = useProgramTier();
  const [proposal, setProposal] = useState(null);
  const [ethics, setEthics] = useState(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ethicsDecisionModal, setEthicsDecisionModal] = useState(null);
  const [message, setMessage] = useState("");

  useScrollToTop([id, proposal?.id]);

  const isCoordinator = user?.role === "faculty_coordinator";
  const isDirector = user?.role === "research_director";
  const isLeadershipReviewer = user?.role === "leadership";

  const actions = useMemo(() => {
    if (isDirector) {
      return [
        { id: "approved", label: "Approve proposal (creates Open project)" },
        { id: "revision_requested", label: "Request Revision" },
        { id: "rejected", label: "Reject" },
      ];
    }
    return [];
  }, [isDirector]);

  const [selected, setSelected] = useState(actions[0]?.id || "");

  async function load() {
    setError("");
    try {
      const res = await proposalApi.getProposal(accessToken, id);
setProposal(res.proposal);
      if (res.proposal?.requiresEthics) {
        const eth = await proposalApi.getProposalEthicsApplication(accessToken, id);
        setEthics(eth.application);
      } else {
        setEthics(null);
      }
    } catch (e) {
throw e;
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load proposal"));
  }, [id, accessToken, programTier]);

  useEffect(() => {
    setSelected((prev) => prev || actions[0]?.id || "");
  }, [actions]);

  async function confirmEthicsDecision(payload) {
    if (!ethics?.id) return;
    setBusy(true);
    setError("");
    try {
      await ethicsApi.directorDecision(accessToken, ethics.id, payload);
      setEthicsDecisionModal(null);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Ethics decision failed");
    } finally {
      setBusy(false);
    }
  }

  if (!proposal) return <div style={{ padding: 8 }}>{error ? error : "Loading..."}</div>;

  const ethicsApproved =
    !proposal.requiresEthics || proposal.ethicsStatus === "approved" || ethics?.status === "approved";

  // Final Approve / Reject waits until Multi-stage review (Phase 3) is complete (UG + PG).
  const multiStageReady = proposal.currentReviewStage === "ready_for_director";
  const reviewableStatuses = ["submitted", "under_review", "revision_requested"];
  const showDirectorDecision =
    isDirector && multiStageReady && reviewableStatuses.includes(proposal.status);
  const showFinalDecision = showDirectorDecision;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>
          {isLeadershipReviewer
            ? "Peer review — Proposal"
            : isCoordinator
              ? "Committee review — Proposal + Ethics"
              : "Director review — Proposal + Ethics"}
        </h2>
        <Link
          className="btn"
          to={isLeadershipReviewer ? "/review-assignments" : `/proposals/${id}`}
        >
          {isLeadershipReviewer ? "Back to assignments" : "Back to details"}
        </Link>
      </div>

      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)" }}>{error}</div> : null}
      {message ? (
        <div className="card" style={{ borderColor: "rgba(45,212,191,0.4)", marginTop: 12 }}>
          {message}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12, borderColor: "rgba(14,165,233,0.25)" }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{proposal.title}</div>
        <div className="muted" style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <StatusBadge status={proposal.status} />
          <span>v{proposal.version}</span>
          {proposal.requiresEthics ? (
            <>
              <span className="muted">Ethics:</span>
              <StatusBadge status={ethics?.status || proposal.ethicsStatus || "pending"} />
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
              <button
                type="button"
                className="btn"
                onClick={() =>
                  openProtectedUpload(accessToken, proposal.document).catch((e) =>
                    setError(e?.message || "Could not open document")
                  )
                }
              >
                View proposal document
              </button>
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
          onApproveEthics={() => setEthicsDecisionModal("approve")}
          onIssueCertificate={() => setEthicsDecisionModal("approve")}
          onRejectEthics={() => setEthicsDecisionModal("reject")}
          onDownloadCertificate={async () => {
            if (!ethics?.id) return;
            try {
              setBusy(true);
              setError("");
              await ethicsApi.downloadAndSaveCertificate(
                accessToken,
                ethics.id,
                `JUREC-certificate-${ethics.approval?.refNumber || ethics.approval?.certificateNumber || ethics.id}.pdf`
              );
            } catch (e) {
              setError(e?.message || "Failed to download certificate");
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      ) : null}

      <ProposalMultiStageReview proposal={proposal} onReload={load} />

      {(isCoordinator || isDirector) &&
      ["submitted", "under_review", "revision_requested"].includes(proposal.status) &&
      !multiStageReady ? (
        <div className="card muted" style={{ marginTop: 12, fontSize: 13 }}>
          <strong>Proposal decision</strong> is locked until Multi-stage review (Phase 3) is complete
          (peer → committee
          {proposal.proposalKind === "grant_fund_call" || proposal.fundingCallId
            ? " → finance"
            : " — voluntary: no finance"}
          ). Use Assign &amp; send above to move the proposal forward.
        </div>
      ) : null}

      {showFinalDecision ? (
        <form
          className="card"
          style={{ marginTop: 12 }}
          data-app-form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!selected) {
              setError("Choose an action.");
              return;
            }
            if (!comment.trim()) {
              setError("Write a short comment, then submit.");
              return;
            }
            if (isDirector && selected === "approved" && proposal.requiresEthics && !ethicsApproved) {
              setError("Approve ethics first, then submit Approve.");
              return;
            }
            setBusy(true);
            setError("");
            setMessage("");
            try {
              if (isDirector) {
                const res = await proposalApi.directorDecision(accessToken, id, selected, comment.trim());
                const projectId = res?.project?.id ? String(res.project.id) : "";
                if (selected === "approved") {
                  navigate(projectId ? `/projects/${projectId}` : "/projects", {
                    replace: true,
                    state: {
                      proposalAccepted: true,
                      message:
                        res?.message ||
                        "Congratulations — the proposal was accepted and the project is Open. Please continue your work.",
                    },
                  });
                  return;
                }
                setMessage(res?.message || "Decision saved");
              }
              setComment("");
              await load();
            } catch (err) {
              setError(err?.response?.data?.message || "Action failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            {proposal.fundingCallId || proposal.proposalKind === "grant_fund_call"
              ? "Proposal decision — funding call"
              : "Proposal decision"}
          </div>
          {proposal.fundingCallId || proposal.proposalKind === "grant_fund_call" ? (
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
              Approving creates an Open project for the researcher (listed under Projects) and links the funding
              call, grant, and budget. Finance still authorizes the allocated amount (not a payment).
            </p>
          ) : (
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
              Approve creates an Open project for the researcher. It appears immediately under Projects — not
              rejected, not hidden.
            </p>
          )}
          {isDirector && proposal.requiresEthics && !ethicsApproved ? (
            <div className="muted" style={{ marginBottom: 10, fontSize: 13 }}>
              Approve ethics (certificate) above first. Then you can approve the proposal to create the Open project.
            </div>
          ) : null}
          {isDirector && proposal.requiresEthics && ethicsApproved ? (
            <div className="muted" style={{ marginBottom: 10, fontSize: 13, color: "#0369a1" }}>
              Ethics is cleared — approve below to create an Open project (it will appear under Projects).
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
            <label>Comment *</label>
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write review notes..." />
          </div>

          <button
            type="submit"
            className="btn primary"
            data-form-submit
            disabled={busy}
          >
            {busy ? "Saving..." : "Submit decision"}
          </button>
        </form>
      ) : null}

      <EthicsDirectorDecisionModal
        open={Boolean(ethicsDecisionModal)}
        mode={ethicsDecisionModal}
        applicationId={ethics?.id}
        accessToken={accessToken}
        applicationTitle={ethics?.projectTitle || proposal?.title}
        busy={busy}
        onClose={() => !busy && setEthicsDecisionModal(null)}
        onConfirm={confirmEthicsDecision}
      />
    </div>
  );
}
