import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as proposalApi from "../services/proposalApi";
import { apiOrigin } from "../config/apiBase";

export function ProposalDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken, user } = useAuth();
  const [proposal, setProposal] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isOwner = proposal && String(proposal.researcherId) === String(user?.id);
  const canSubmit = isOwner && ["draft", "revision_requested"].includes(proposal?.status);

  async function load() {
    setError("");
    const res = await proposalApi.getProposal(accessToken, id);
    setProposal(res.proposal);
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load proposal"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!proposal) return <div style={{ padding: 8 }}>{error ? error : "Loading..."}</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>Proposal Details</h2>
        <Link className="btn" to="/proposals">
          Back
        </Link>
      </div>

      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)" }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>{proposal.title}</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Status: {proposal.status} • Version: {proposal.version}
        </div>
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

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          {isOwner ? (
            <Link className="btn" to="/proposals/new">
              New draft
            </Link>
          ) : null}

          {canSubmit ? (
            <button
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await proposalApi.submitProposal(accessToken, id);
                  await load();
                } catch (e) {
                  setError(e?.response?.data?.message || "Submit failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Submitting..." : "Submit proposal"}
            </button>
          ) : null}

          {["faculty_coordinator", "research_director"].includes(user?.role) ? (
            <button className="btn primary" onClick={() => navigate(`/proposals/${id}/review`)}>
              Review
            </button>
          ) : null}
        </div>
      </div>

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

