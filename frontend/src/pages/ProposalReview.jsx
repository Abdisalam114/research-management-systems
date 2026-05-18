import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as proposalApi from "../services/proposalApi";
import * as userApi from "../services/userApi";
import { apiOrigin } from "../config/apiBase";

export function ProposalReviewPage() {
  const { id } = useParams();
  const { accessToken, user } = useAuth();
  const [proposal, setProposal] = useState(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ethicsDecision, setEthicsDecision] = useState("approved");
  const [reviewerIds, setReviewerIds] = useState("");
  const [staffUsers, setStaffUsers] = useState([]);

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
        { id: "approved", label: "Approve" },
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
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Failed to load proposal"));
    if (user?.role === "research_director") {
      userApi
        .listUsers(accessToken, { status: "active" })
        .then((r) => setStaffUsers((r.users || []).filter((u) => u.role !== "research_director")))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setSelected((prev) => prev || actions[0]?.id || "");
  }, [actions]);

  if (!proposal) return <div style={{ padding: 8 }}>{error ? error : "Loading..."}</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ marginTop: 0 }}>Proposal Review</h2>
        <Link className="btn" to={`/proposals/${id}`}>
          Back to details
        </Link>
      </div>

      {error ? <div className="card" style={{ borderColor: "rgba(255, 99, 132, 0.55)" }}>{error}</div> : null}

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800 }}>{proposal.title}</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Status: {proposal.status} • v{proposal.version}
          {proposal.requiresEthics ? ` • Ethics: ${proposal.ethicsStatus}` : ""}
        </div>

        {(isCoordinator || isDirector) && proposal.requiresEthics ? (
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700 }}>Ethics approval</div>
            <div className="field">
              <label>Ethics decision</label>
              <select value={ethicsDecision} onChange={(e) => setEthicsDecision(e.target.value)}>
                <option value="approved">Approve ethics</option>
                <option value="revision_requested">Request ethics revision</option>
                <option value="rejected">Reject ethics</option>
              </select>
            </div>
            <button
              className="btn"
              type="button"
              disabled={busy || !comment.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await proposalApi.ethicsDecision(accessToken, id, ethicsDecision, comment.trim());
                  await load();
                } catch (e) {
                  setError(e?.response?.data?.message || "Ethics action failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save ethics decision
            </button>
          </div>
        ) : null}

        {isDirector ? (
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700 }}>Assign reviewers</div>
            <div className="field">
              <label>Reviewer user IDs (comma-separated)</label>
              <input value={reviewerIds} onChange={(e) => setReviewerIds(e.target.value)} />
            </div>
            <button
              className="btn"
              type="button"
              disabled={busy}
              onClick={async () => {
                const ids = reviewerIds.split(",").map((x) => x.trim()).filter(Boolean);
                if (!ids.length) return;
                setBusy(true);
                try {
                  await proposalApi.assignReviewers(accessToken, id, ids);
                  await load();
                } catch (e) {
                  setError(e?.response?.data?.message || "Assign failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Assign reviewers
            </button>
          </div>
        ) : null}


        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ marginBottom: 6 }}>
            Uploaded document
          </div>
          {proposal.document ? (
            <a
              className="btn"
              href={`${apiOrigin()}${proposal.document}`}
              target="_blank"
              rel="noreferrer"
            >
              View document
            </a>
          ) : (
            <div className="muted">No document uploaded.</div>
          )}
        </div>

        <div className="field" style={{ marginTop: 12 }}>
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
          disabled={busy || !selected || !comment.trim()}
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
          {busy ? "Saving..." : "Submit review"}
        </button>
      </div>
    </div>
  );
}

