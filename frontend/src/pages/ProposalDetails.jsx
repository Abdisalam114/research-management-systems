import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProgramTier } from "../hooks/useProgramTier";
import * as proposalApi from "../services/proposalApi";
import { ProposalEthicsWorkflow } from "../components/ProposalEthicsWorkflow";
import { SubmitValidationAlert, SubmitSuccessAlert } from "../components/SubmitValidationAlert";
import { collectSubmitValidationIssues, SUBMIT_SUCCESS_MESSAGE } from "../utils/proposalSubmitValidation";
import { scrollElementIntoAppView } from "../utils/scrollContainer";
import { apiOrigin } from "../config/apiBase";
import { StatusBadge } from "../components/StatusBadge";

export function ProposalDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken, user } = useAuth();
  const { programTier } = useProgramTier();
  const [proposal, setProposal] = useState(null);
  const [ethics, setEthics] = useState(null);
  const [error, setError] = useState("");
  const [validationIssues, setValidationIssues] = useState([]);
  const [successMsg, setSuccessMsg] = useState(() => {
    if (location.state?.submitSuccess) {
      return location.state.message || SUBMIT_SUCCESS_MESSAGE;
    }
    if (searchParams.get("submitted") === "1") return SUBMIT_SUCCESS_MESSAGE;
    return "";
  });
  const [busy, setBusy] = useState(false);

  const isOwner = proposal && String(proposal.researcherId) === String(user?.id);
  const showSubmitBtn =
    isOwner && ["draft", "revision_requested"].includes(proposal?.status) && proposal?.requiresEthics;

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
  }, [id, accessToken, programTier]);

  async function submitCombined() {
    setValidationIssues([]);
    setError("");
    setSuccessMsg("");

    const issues = collectSubmitValidationIssues(proposal, ethics || {}, proposal?.requiresEthics);
    if (issues.length > 0) {
      setValidationIssues(issues);
      requestAnimationFrame(() => {
        scrollElementIntoAppView(document.getElementById("validation-errors"), { behavior: "smooth", block: "start", offset: 88 });
      });
      return;
    }

    setBusy(true);
    try {
      await proposalApi.submitProposal(accessToken, id);
      await load();
      setSuccessMsg(SUBMIT_SUCCESS_MESSAGE);
      if (searchParams.get("submitted") !== "1") {
        setSearchParams({ submitted: "1" }, { replace: true });
      }
    } catch (e) {
      const msg = e?.response?.data?.message || "Submission failed";
      setError(msg);
      if (/ethics|complete|signature|design|aims|title|abstract/i.test(msg)) {
        setValidationIssues(collectSubmitValidationIssues(proposal, ethics || {}, proposal?.requiresEthics));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!proposal) return <div style={{ padding: 8 }}>{error ? error : "Loading..."}</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>Proposal Details</h2>
        <Link className="btn" to="/proposals">
          Back
        </Link>
      </div>

      <SubmitSuccessAlert message={successMsg} onDismiss={() => setSuccessMsg("")} />
      <SubmitValidationAlert issues={validationIssues} />
      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)", marginTop: 12 }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{proposal.title}</div>
        <div className="muted" style={{ marginTop: 6 }}>
          <span
            style={{
              display: "inline-block",
              marginRight: 8,
              padding: "2px 8px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              background:
                (proposal.proposalKind || (proposal.fundingCallId ? "grant_fund_call" : "voluntary")) === "voluntary"
                  ? "rgba(56, 189, 248, 0.15)"
                  : "rgba(250, 204, 21, 0.18)",
              color:
                (proposal.proposalKind || (proposal.fundingCallId ? "grant_fund_call" : "voluntary")) === "voluntary"
                  ? "#7dd3fc"
                  : "#fde047",
            }}
          >
            {(proposal.proposalKind || (proposal.fundingCallId ? "grant_fund_call" : "voluntary")) === "voluntary"
              ? "Voluntary"
              : "Grant Fund Call"}
          </span>
          Status: <StatusBadge status={proposal.status} /> • Version: {proposal.version}
        </div>
        {(proposal.proposalKind || (proposal.fundingCallId ? "grant_fund_call" : "voluntary")) === "voluntary" ? (
          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            Research proposal path. After approval a project is created for academic research.
          </div>
        ) : proposal.fundingCallId ? (
          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            Linked to a funding call. Continue grant steps from{" "}
            <Link to={`/grants/apply?callId=${proposal.fundingCallId}`}>Funding Call apply</Link>.
          </div>
        ) : null}
        {proposal.status === "submitted" ? (
          <div
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(34, 197, 94, 0.1)",
              border: "1px solid rgba(34, 197, 94, 0.35)",
              fontSize: 14,
            }}
          >
            ⏳ Proposal + ethics submitted. Awaiting the Director&apos;s decision.
          </div>
        ) : null}
        <div style={{ marginTop: 12 }} className="muted">
          <div>
            <b>Department:</b> {proposal.department}
          </div>
          <div>
            <b>Research area:</b> {proposal.researchArea}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ marginBottom: 6 }}>
            Abstract
          </div>
          <div>{proposal.abstract}</div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ marginBottom: 6 }}>
            Document
          </div>
          {proposal.document ? (
            <a className="btn" href={`${apiOrigin()}${proposal.document}`} target="_blank" rel="noreferrer">
              View document
            </a>
          ) : (
            <div className="muted">No document uploaded yet.</div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          {isOwner && ["draft", "revision_requested"].includes(proposal.status) ? (
            <Link className="btn primary" to={`/proposals/${id}/edit`}>
              Edit proposal + ethics
            </Link>
          ) : null}
          {isOwner ? (
            <Link className="btn" to="/proposals/new">
              New voluntary proposal
            </Link>
          ) : null}

          {showSubmitBtn ? (
            <button type="button" className="btn primary" disabled={busy} onClick={submitCombined}>
              {busy ? "Submitting…" : "Submit to Director (Proposal + Ethics)"}
            </button>
          ) : null}

          {["faculty_coordinator", "research_director"].includes(user?.role) ? (
            <button type="button" className="btn primary" onClick={() => navigate(`/proposals/${id}/review`)}>
              Review
            </button>
          ) : null}
        </div>
      </div>

      <ProposalEthicsWorkflow
        accessToken={accessToken}
        proposal={proposal}
        onRefresh={load}
        onSubmitCombined={showSubmitBtn ? submitCombined : undefined}
        submitBusy={busy}
      />

      {(proposal.versionHistory || []).length > 0 ? (
        <div className="card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Version history</div>
          <table className="dashTable">
            <thead>
              <tr>
                <th>Version</th>
                <th>Saved</th>
                <th>Note</th>
                <th>Document</th>
              </tr>
            </thead>
            <tbody>
              {[...(proposal.versionHistory || [])].reverse().map((v, idx) => (
                <tr key={idx}>
                  <td>v{v.version}</td>
                  <td>{v.savedAt ? new Date(v.savedAt).toLocaleString() : "—"}</td>
                  <td>{v.note || "—"}</td>
                  <td>
                    {v.document ? (
                      <a href={`${apiOrigin()}${v.document}`} target="_blank" rel="noreferrer">Download</a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Reviewer Comments</div>
        {(proposal.reviewerComments || []).length === 0 ? (
          <div className="muted">No comments yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {proposal.reviewerComments.map((c, idx) => (
              <div key={idx} className="card">
                <div className="muted">
                  {c.role} • {new Date(c.at).toLocaleString()}
                </div>
                <div style={{ marginTop: 6 }}>{c.comment}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
